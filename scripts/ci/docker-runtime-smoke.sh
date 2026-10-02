#!/usr/bin/env bash
set -Eeuo pipefail

image="${WEB_DOCKER_IMAGE:-stack-atlas-web:ci}"
learner_name="stack-atlas-web-smoke-learner"
admin_name="stack-atlas-web-smoke-admin"
missing_platform_name="stack-atlas-web-smoke-missing-platform"
invalid_platform_name="stack-atlas-web-smoke-invalid-platform"
container_names=(
  "$learner_name"
  "$admin_name"
  "$missing_platform_name"
  "$invalid_platform_name"
)

for name in "${container_names[@]}"; do
  docker rm -f "$name" >/dev/null 2>&1 || true
done

print_diagnostics() {
  echo 'Docker runtime smoke diagnostics:' >&2
  docker ps -a >&2 || true
  for name in "${container_names[@]}"; do
    if docker inspect "$name" >/dev/null 2>&1; then
      echo "--- docker inspect $name ---" >&2
      docker inspect "$name" >&2 || true
      echo "--- docker logs $name ---" >&2
      docker logs "$name" >&2 || true
    fi
  done
}

cleanup() {
  status=$?
  trap - EXIT
  if [[ "$status" -ne 0 ]]; then
    print_diagnostics
  fi
  for name in "${container_names[@]}"; do
    docker rm -f "$name" >/dev/null 2>&1 || true
  done
  exit "$status"
}
trap cleanup EXIT

wait_for_http() {
  local container="$1"
  local url="$2"
  local curl_log="/tmp/${container}-curl.log"
  local response_file="/tmp/${container}-response.txt"
  local attempts=60
  local state
  : >"$curl_log"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    case "$state" in
      exited|dead)
        echo "Container $container exited before HTTP readiness (state: $state)." >&2
        return 1
        ;;
      running)
        # A fresh container can briefly refuse or reset connections while Next starts.
        if curl --fail --silent --show-error --connect-timeout 1 --max-time 5 \
          "$url" --output "$response_file" 2>>"$curl_log"; then
          cat "$response_file"
          return 0
        fi
        ;;
      *)
        # Docker can briefly report `created` immediately after `docker run --detach`.
        ;;
    esac
    sleep 1
  done

  echo "Container $container did not serve $url after $attempts readiness attempts." >&2
  return 1
}

assert_status() {
  expected="$1"
  url="$2"
  actual="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$url")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected HTTP $expected from $url, received $actual." >&2
    return 1
  fi
}

wait_for_platform_rejection() {
  name="$1"
  platform_value="$2"
  attempts=15

  if [[ -n "$platform_value" ]]; then
    docker run --detach --name "$name" \
      --env "STACK_ATLAS_WEB_PLATFORM=$platform_value" "$image" >/dev/null
  else
    docker run --detach --name "$name" "$image" >/dev/null
  fi

  state="running"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    state="$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || true)"
    if [[ "$state" == exited ]]; then
      break
    fi
    sleep 1
  done

  if [[ "$state" != exited ]]; then
    echo "Container $name did not exit after rejecting STACK_ATLAS_WEB_PLATFORM=${platform_value:-<missing>}." >&2
    return 1
  fi

  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$name")"
  log_file="/tmp/${name}.log"
  docker logs "$name" >"$log_file" 2>&1
  if [[ "$exit_code" == 0 ]] || ! grep -q 'STACK_ATLAS_WEB_PLATFORM' "$log_file"; then
    echo "Container $name did not report the expected platform configuration error." >&2
    cat "$log_file" >&2
    return 1
  fi
}

wait_for_platform_rejection "$missing_platform_name" ""
wait_for_platform_rejection "$invalid_platform_name" "invalid"

docker run --detach --name "$learner_name" \
  --publish 127.0.0.1:3011:3001 \
  --env STACK_ATLAS_WEB_PLATFORM=learner "$image" >/dev/null
learner_health="$(wait_for_http "$learner_name" http://127.0.0.1:3011/api/healthz/)"
[[ "$learner_health" == *'"status":"ok"'* ]]
assert_status 200 http://127.0.0.1:3011/
curl --fail --silent --show-error http://127.0.0.1:3011/ \
  --output /tmp/stack-atlas-web-smoke-learner.html
grep -q 'Explore topics' /tmp/stack-atlas-web-smoke-learner.html
assert_status 404 http://127.0.0.1:3011/admin/
docker stop "$learner_name" >/dev/null

docker run --detach --name "$admin_name" \
  --publish 127.0.0.1:3012:3001 \
  --env STACK_ATLAS_WEB_PLATFORM=admin "$image" >/dev/null
admin_health="$(wait_for_http "$admin_name" http://127.0.0.1:3012/api/healthz/)"
[[ "$admin_health" == *'"status":"ok"'* ]]

admin_root_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3012/)"
case "$admin_root_status" in
  3??) ;;
  *)
    echo "Expected a temporary 3xx redirect from the admin root, received HTTP $admin_root_status." >&2
    exit 1
    ;;
esac
admin_root_location="$(curl --silent --show-error --output /dev/null --write-out '%{redirect_url}' http://127.0.0.1:3012/)"
case "$admin_root_location" in
  */admin/) ;;
  *)
    echo "Expected the admin root redirect destination to end in /admin/, received $admin_root_location." >&2
    exit 1
    ;;
esac

assert_status 200 http://127.0.0.1:3012/admin/
curl --fail --silent --show-error http://127.0.0.1:3012/admin/ \
  --output /tmp/stack-atlas-web-smoke-admin.html
grep -q 'Content workspace' /tmp/stack-atlas-web-smoke-admin.html
grep -q 'Administration' /tmp/stack-atlas-web-smoke-admin.html

assert_status 200 http://127.0.0.1:3012/admin/content/
curl --fail --silent --show-error http://127.0.0.1:3012/admin/content/ \
  --output /tmp/stack-atlas-web-smoke-admin-content.html
grep -q 'Search content' /tmp/stack-atlas-web-smoke-admin-content.html
grep -q 'New content' /tmp/stack-atlas-web-smoke-admin-content.html
assert_status 404 http://127.0.0.1:3012/articles/
assert_status 404 http://127.0.0.1:3012/paths/
docker stop "$admin_name" >/dev/null

echo 'Same-image learner/admin Docker runtime smoke passed.'

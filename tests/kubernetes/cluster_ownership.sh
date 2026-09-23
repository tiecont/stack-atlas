#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
bin="$temp_dir/bin"
mkdir -p "$bin"

cat >"$bin/kind" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-} ${2:-}" in
  "get clusters")
    [[ ! -f "$FAKE_CLUSTER_STATE" ]] || cat "$FAKE_CLUSTER_STATE"
    ;;
  "delete cluster")
    [[ "${4:-}" == "$CLUSTER_NAME" ]]
    printf 'kind-delete %s\n' "$CLUSTER_NAME" >>"$FAKE_RUNNER_LOG"
    rm -f "$FAKE_CLUSTER_STATE"
    ;;
  *)
    echo "unexpected kind stub call: $*" >&2
    exit 2
    ;;
esac
STUB

cat >"$bin/kubectl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *"config view"*) printf 'kind-%s' "$CLUSTER_NAME" ;;
  *"cluster-info"*) exit 0 ;;
  *) echo "unexpected kubectl stub call: $*" >&2; exit 2 ;;
esac
STUB

cat >"$bin/make" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf 'make:%s\n' "$*" >>"$FAKE_RUNNER_LOG"
if [[ "$*" == *cluster-up* ]]; then
  printf '%s\n' "$CLUSTER_NAME" >"$FAKE_CLUSTER_STATE"
fi
STUB

for command in python3 go; do
  cat >"$bin/$command" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
done
chmod +x "$bin"/*

run_runner() {
  local cluster_name="$1"
  PATH="$bin:$PATH" \
    FAKE_CLUSTER_STATE="$temp_dir/clusters" \
    FAKE_RUNNER_LOG="$temp_dir/log" \
    CLUSTER_NAME="$cluster_name" \
    CONTEXT="kind-$cluster_name" \
    KIND="$bin/kind" \
    KUBECTL="$bin/kubectl" \
    CLEANUP=1 \
    bash "$root/scripts/ci/test_kubernetes_labs.sh"
}

existing_cluster="stack-atlas-ownership-existing"
printf '%s\n' "$existing_cluster" >"$temp_dir/clusters"
: >"$temp_dir/log"
run_runner "$existing_cluster"
grep -Fxq "$existing_cluster" "$temp_dir/clusters"
if grep -q '^kind-delete ' "$temp_dir/log" || grep -q '^make:.*cluster-up' "$temp_dir/log"; then
  echo "The runner took ownership of or deleted a pre-existing cluster." >&2
  exit 1
fi

created_cluster="stack-atlas-ownership-created"
rm -f "$temp_dir/clusters"
: >"$temp_dir/log"
run_runner "$created_cluster"
if [[ -e "$temp_dir/clusters" ]]; then
  echo "The runner did not clean up the cluster it created." >&2
  exit 1
fi
grep -q '^make:.*cluster-up' "$temp_dir/log"
grep -q '^kind-delete ' "$temp_dir/log"

echo "Kubernetes cluster ownership regression passed."

#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
calls="$temp_dir/calls"
cat >"$temp_dir/kubectl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$KUBECTL_CALL_LOG"
[[ "${1:-}" == "--context" && "${2:-}" == "kind-stack-atlas" ]] || exit 90
shift 2
if [[ "$*" == "config view"* ]]; then
  printf '%s' "${FAKE_CLUSTER_CONTEXT:-kind-stack-atlas}"
fi
STUB
chmod +x "$temp_dir/kubectl"

export KUBECTL="$temp_dir/kubectl" KUBECTL_CALL_LOG="$calls"
export CLUSTER_NAME=stack-atlas CONTEXT=kind-stack-atlas
export KUBECONFIG_CURRENT_CONTEXT=kind-production
"$root/scripts/kubernetes/assert_lab_context.sh"
[[ "$(wc -l <"$calls")" -eq 2 ]]
if rg -v -- '--context kind-stack-atlas' "$calls"; then
  echo "A kubectl call omitted the explicit lab context." >&2
  exit 1
fi

: >"$calls"
if CONTEXT=kind-production "$root/scripts/kubernetes/assert_lab_context.sh" 2>/dev/null; then
  echo "The guard accepted a non-lab context." >&2
  exit 1
fi
[[ ! -s "$calls" ]]

: >"$calls"
if FAKE_CLUSTER_CONTEXT=kind-production "$root/scripts/kubernetes/assert_lab_context.sh" 2>/dev/null; then
  echo "The guard accepted a context mapped to another cluster." >&2
  exit 1
fi
echo "Kubernetes context safety regression passed."

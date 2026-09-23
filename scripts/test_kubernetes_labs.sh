#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-stack-atlas}"
CONTEXT="${CONTEXT:-kind-${CLUSTER_NAME}}"
KUBECTL="${KUBECTL:-kubectl}"
KIND="${KIND:-kind}"
CLEANUP="${CLEANUP:-0}"
export CLUSTER_NAME CONTEXT KUBECTL KIND
cluster_ready=0

cleanup() {
  if [[ "$CLEANUP" == "1" && "$cluster_ready" == "1" ]] && \
    KIND_EXPERIMENTAL_PROVIDER=docker "$KIND" get clusters | grep -qx "$CLUSTER_NAME"; then
    KIND_EXPERIMENTAL_PROVIDER=docker "$KIND" delete cluster --name "$CLUSTER_NAME"
  fi
}
trap cleanup EXIT

python3 "$root/scripts/validate_kubernetes_manifests.py"
GOCACHE="${GOCACHE:-/tmp/stack-atlas-go-cache}" go -C "$root/examples/atlas-demo-api" test -race ./...
cluster_ready=1
make -C "$root/labs/kubernetes/00-cluster" cluster-up CLUSTER_NAME="$CLUSTER_NAME" CONTEXT="$CONTEXT" KIND="$KIND" KUBECTL="$KUBECTL"
"$root/scripts/kubernetes/assert_lab_context.sh"
make -C "$root/labs/kubernetes/01-foundations" apply CLUSTER_NAME="$CLUSTER_NAME" CONTEXT="$CONTEXT" KIND="$KIND" KUBECTL="$KUBECTL"
python3 "$root/scripts/validate_kubernetes_manifests.py" --server-side --context "$CONTEXT" --kubectl "$KUBECTL"
make -C "$root/labs/kubernetes/01-foundations" test CLUSTER_NAME="$CLUSTER_NAME" CONTEXT="$CONTEXT" KUBECTL="$KUBECTL"

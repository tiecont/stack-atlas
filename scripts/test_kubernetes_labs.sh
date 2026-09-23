#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-stack-atlas}"
CONTEXT="${CONTEXT:-kind-${CLUSTER_NAME}}"
KUBECTL="${KUBECTL:-kubectl}"
export CLUSTER_NAME CONTEXT KUBECTL

"$root/scripts/kubernetes/assert_lab_context.sh"
python3 "$root/scripts/validate_kubernetes_manifests.py"
GOCACHE="${GOCACHE:-/tmp/stack-atlas-go-cache}" go -C "$root/examples/atlas-demo-api" test -race ./...
make -C "$root/labs/kubernetes/00-cluster" cluster-up CLUSTER_NAME="$CLUSTER_NAME" CONTEXT="$CONTEXT" KUBECTL="$KUBECTL"
"$KUBECTL" --context "$CONTEXT" apply -f "$root/labs/kubernetes/01-foundations/manifests/00-namespace.yaml"
python3 "$root/scripts/validate_kubernetes_manifests.py" --server-side
make -C "$root/labs/kubernetes/01-foundations" test CLUSTER_NAME="$CLUSTER_NAME" CONTEXT="$CONTEXT" KUBECTL="$KUBECTL"

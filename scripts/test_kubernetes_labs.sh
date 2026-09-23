#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$root/scripts/validate_kubernetes_manifests.py"
GOCACHE="${GOCACHE:-/tmp/stack-atlas-go-cache}" go -C "$root/examples/atlas-demo-api" test -race ./...
make -C "$root/labs/kubernetes/00-cluster" cluster-up
kubectl apply -f "$root/labs/kubernetes/01-foundations/manifests/00-namespace.yaml"
python3 "$root/scripts/validate_kubernetes_manifests.py" --server-side
make -C "$root/labs/kubernetes/01-foundations" test

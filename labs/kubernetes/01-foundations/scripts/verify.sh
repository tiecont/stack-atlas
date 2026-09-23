#!/usr/bin/env bash
set -euo pipefail

namespace="${NAMESPACE:-atlas-foundations}"
context="${CONTEXT:-kind-${CLUSTER_NAME:-stack-atlas}}"
kubectl_bin="${KUBECTL:-kubectl}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/../../../.." && pwd)"
"$root/scripts/kubernetes/assert_lab_context.sh"
"$kubectl_bin" --context "$context" wait --for=condition=available deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
"$kubectl_bin" --context "$context" wait --for=jsonpath='{.status.availableReplicas}'=2 deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
"$kubectl_bin" --context "$context" wait --for=condition=Ready pod --selector=app.kubernetes.io/name=atlas-demo-api --namespace "$namespace" --timeout=120s

ready="$("$kubectl_bin" --context "$context" get deployment atlas-demo-api --namespace "$namespace" -o jsonpath='{.status.availableReplicas}')"
if [[ "$ready" != "2" ]]; then
  echo "Expected 2 available replicas, got: ${ready:-<empty>}" >&2
  exit 1
fi

echo "Deployment reports two available replicas."
"$kubectl_bin" --context "$context" get deployment,replicaset,pods,service --namespace "$namespace" -o wide

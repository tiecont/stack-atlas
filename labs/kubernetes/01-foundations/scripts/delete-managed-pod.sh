#!/usr/bin/env bash
set -euo pipefail

namespace="${NAMESPACE:-atlas-foundations}"
context="${CONTEXT:-kind-${CLUSTER_NAME:-stack-atlas}}"
kubectl_bin="${KUBECTL:-kubectl}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/../../../.." && pwd)"
"$root/scripts/kubernetes/assert_lab_context.sh"
selector="app.kubernetes.io/name=atlas-demo-api"
pod="$("$kubectl_bin" --context "$context" get pods --namespace "$namespace" --selector="$selector" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$pod" ]]; then
  echo "No managed Pod found in namespace $namespace" >&2
  exit 1
fi
uid="$("$kubectl_bin" --context "$context" get pod "$pod" --namespace "$namespace" -o jsonpath='{.metadata.uid}')"

echo "Deleting $pod (UID $uid); the ReplicaSet controller should replace it."
"$kubectl_bin" --context "$context" delete pod "$pod" --namespace "$namespace" --wait=true
"$kubectl_bin" --context "$context" wait --for=condition=available deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
"$kubectl_bin" --context "$context" wait --for=jsonpath='{.status.availableReplicas}'=2 deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
"$kubectl_bin" --context "$context" wait --for=condition=Ready pod --selector="$selector" --namespace "$namespace" --timeout=120s

remaining_uids="$("$kubectl_bin" --context "$context" get pods --namespace "$namespace" --selector="$selector" -o jsonpath='{range .items[*]}{.metadata.uid}{"\n"}{end}')"
if grep -Fq "$uid" <<<"$remaining_uids"; then
  echo "The deleted Pod UID is still present; expected a replacement Pod." >&2
  exit 1
fi
echo "Replacement observed; the deleted Pod UID is gone."
"$kubectl_bin" --context "$context" get deployment,replicaset,pods --namespace "$namespace" -o wide

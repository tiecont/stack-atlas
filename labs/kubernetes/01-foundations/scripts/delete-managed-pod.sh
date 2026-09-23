#!/usr/bin/env bash
set -euo pipefail

namespace="${NAMESPACE:-atlas-foundations}"
selector="app.kubernetes.io/name=atlas-demo-api"
pod="$(kubectl get pods --namespace "$namespace" --selector="$selector" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$pod" ]]; then
  echo "No managed Pod found in namespace $namespace" >&2
  exit 1
fi
uid="$(kubectl get pod "$pod" --namespace "$namespace" -o jsonpath='{.metadata.uid}')"

echo "Deleting $pod (UID $uid); the ReplicaSet controller should replace it."
kubectl delete pod "$pod" --namespace "$namespace" --wait=true
kubectl wait --for=condition=available deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
kubectl wait --for=jsonpath='{.status.availableReplicas}'=2 deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
kubectl wait --for=condition=Ready pod --selector="$selector" --namespace "$namespace" --timeout=120s

remaining_uids="$(kubectl get pods --namespace "$namespace" --selector="$selector" -o jsonpath='{range .items[*]}{.metadata.uid}{"\n"}{end}')"
if grep -Fq "$uid" <<<"$remaining_uids"; then
  echo "The deleted Pod UID is still present; expected a replacement Pod." >&2
  exit 1
fi
echo "Replacement observed; the deleted Pod UID is gone."
kubectl get deployment,replicaset,pods --namespace "$namespace" -o wide

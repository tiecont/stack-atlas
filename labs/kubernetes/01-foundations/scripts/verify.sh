#!/usr/bin/env bash
set -euo pipefail

namespace="${NAMESPACE:-atlas-foundations}"
kubectl wait --for=condition=available deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
kubectl wait --for=jsonpath='{.status.availableReplicas}'=2 deployment/atlas-demo-api --namespace "$namespace" --timeout=120s
kubectl wait --for=condition=Ready pod --selector=app.kubernetes.io/name=atlas-demo-api --namespace "$namespace" --timeout=120s

ready="$(kubectl get deployment atlas-demo-api --namespace "$namespace" -o jsonpath='{.status.availableReplicas}')"
if [[ "$ready" != "2" ]]; then
  echo "Expected 2 available replicas, got: ${ready:-<empty>}" >&2
  exit 1
fi

echo "Deployment reports two available replicas."
kubectl get deployment,replicaset,pods,service --namespace "$namespace" -o wide

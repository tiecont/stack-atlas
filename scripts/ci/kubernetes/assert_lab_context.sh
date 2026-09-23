#!/usr/bin/env bash
set -euo pipefail

cluster_name="${CLUSTER_NAME:-stack-atlas}"
expected_context="kind-${cluster_name}"
context="${CONTEXT:-$expected_context}"
kubectl_bin="${KUBECTL:-kubectl}"

if [[ "$context" != "$expected_context" ]]; then
  echo "Refusing Kubernetes lab operation: CONTEXT must be $expected_context (got $context)." >&2
  exit 1
fi

actual_cluster="$("$kubectl_bin" --context "$context" config view --minify -o 'jsonpath={.contexts[0].context.cluster}')" || {
  echo "Refusing Kubernetes lab operation: context $context is missing or unreadable." >&2
  exit 1
}
if [[ "$actual_cluster" != "$expected_context" ]]; then
  echo "Refusing Kubernetes lab operation: context $context points to cluster ${actual_cluster:-<empty>}, expected $expected_context." >&2
  exit 1
fi

"$kubectl_bin" --context "$context" cluster-info >/dev/null || {
  echo "Refusing Kubernetes lab operation: API for $context is not responding." >&2
  exit 1
}

echo "Kubernetes lab context verified: $context"

CLUSTER_NAME ?= stack-atlas
CONTEXT ?= kind-$(CLUSTER_NAME)
NAMESPACE ?= atlas-foundations
IMAGE ?= atlas-demo-api:dev
KIND ?= kind
KUBECTL ?= kubectl

export CLUSTER_NAME CONTEXT NAMESPACE IMAGE KIND KUBECTL

.PHONY: cluster-up image apply verify test break observe reset clean

cluster-up:
	$(MAKE) -C ../00-cluster cluster-up CLUSTER_NAME=$(CLUSTER_NAME) CONTEXT=$(CONTEXT) KIND=$(KIND) KUBECTL=$(KUBECTL)

image:
	docker build --tag $(IMAGE) ../../../examples/atlas-demo-api
	KIND_EXPERIMENTAL_PROVIDER=docker $(KIND) load docker-image $(IMAGE) --name $(CLUSTER_NAME)

apply: cluster-up image
	../../../scripts/ci/kubernetes/assert_lab_context.sh
	$(KUBECTL) --context $(CONTEXT) apply -f manifests/
	$(KUBECTL) --context $(CONTEXT) rollout status deployment/atlas-demo-api --namespace $(NAMESPACE) --timeout=120s

verify:
	./scripts/verify.sh

test: apply verify break verify

break:
	./scripts/delete-managed-pod.sh

observe:
	../../../scripts/ci/kubernetes/assert_lab_context.sh
	$(KUBECTL) --context $(CONTEXT) get deployment,replicaset,pods,service --namespace $(NAMESPACE) -o wide
	$(KUBECTL) --context $(CONTEXT) describe deployment/atlas-demo-api --namespace $(NAMESPACE)
	$(KUBECTL) --context $(CONTEXT) get events --namespace $(NAMESPACE) --sort-by=.metadata.creationTimestamp

reset:
	../../../scripts/ci/kubernetes/assert_lab_context.sh
	$(KUBECTL) --context $(CONTEXT) delete namespace $(NAMESPACE) --ignore-not-found --wait=true

clean: reset

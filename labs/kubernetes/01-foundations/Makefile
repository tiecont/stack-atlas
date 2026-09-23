CLUSTER_NAME ?= stack-atlas
NAMESPACE ?= atlas-foundations
IMAGE ?= atlas-demo-api:dev
KIND ?= kind
KUBECTL ?= kubectl

.PHONY: cluster-up image apply verify test break observe reset clean

cluster-up:
	$(MAKE) -C ../00-cluster cluster-up

image:
	docker build --tag $(IMAGE) ../../../examples/atlas-demo-api
	KIND_EXPERIMENTAL_PROVIDER=docker $(KIND) load docker-image $(IMAGE) --name $(CLUSTER_NAME)

apply: cluster-up image
	$(KUBECTL) apply -f manifests/
	$(KUBECTL) rollout status deployment/atlas-demo-api --namespace $(NAMESPACE) --timeout=120s

verify:
	./scripts/verify.sh

test: apply verify break verify

break:
	./scripts/delete-managed-pod.sh

observe:
	$(KUBECTL) get deployment,replicaset,pods,service --namespace $(NAMESPACE) -o wide
	$(KUBECTL) describe deployment/atlas-demo-api --namespace $(NAMESPACE)
	$(KUBECTL) get events --namespace $(NAMESPACE) --sort-by=.metadata.creationTimestamp

reset:
	$(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found --wait=true

clean: reset

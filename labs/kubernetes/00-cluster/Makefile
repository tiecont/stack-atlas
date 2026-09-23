CLUSTER_NAME ?= stack-atlas
CONTEXT ?= kind-$(CLUSTER_NAME)
KIND ?= kind
KUBECTL ?= kubectl

export CLUSTER_NAME CONTEXT KIND KUBECTL

.PHONY: doctor cluster-up cluster-info cluster-down

doctor:
	@echo "Expected Kubernetes lab context: $(CONTEXT)"
	@command -v docker >/dev/null || { echo "Docker is required by this kind setup"; exit 1; }
	@command -v $(KIND) >/dev/null || { echo "Install kind v0.33.0; see README.md"; exit 1; }
	@command -v $(KUBECTL) >/dev/null || { echo "Install kubectl v1.37.0; see README.md"; exit 1; }
	@docker info >/dev/null
	@$(KIND) version
	@$(KUBECTL) version --client

cluster-up:
	@KIND_EXPERIMENTAL_PROVIDER=docker $(KIND) get clusters | grep -qx "$(CLUSTER_NAME)" || KIND_EXPERIMENTAL_PROVIDER=docker $(KIND) create cluster --name $(CLUSTER_NAME) --config kind-config.yaml --wait 180s
	@../../../scripts/ci/kubernetes/assert_lab_context.sh
	@$(KUBECTL) --context $(CONTEXT) wait --for=condition=Ready nodes --all --timeout=180s
	@$(MAKE) cluster-info

cluster-info:
	@../../../scripts/ci/kubernetes/assert_lab_context.sh
	$(KUBECTL) --context $(CONTEXT) cluster-info
	$(KUBECTL) --context $(CONTEXT) get nodes -o wide

cluster-down:
	KIND_EXPERIMENTAL_PROVIDER=docker $(KIND) delete cluster --name $(CLUSTER_NAME)

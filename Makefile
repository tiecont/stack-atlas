.PHONY: validate build serve test test-site test-api-integration test-kubernetes test-databases audit-content clean

validate:
	npm run content:validate

build:
	npm run build

serve: build
	npm run start

test: test-site test-kubernetes test-databases

test-site:
	npm test

test-api-integration:
	node --import tsx --test tests/integration/api-client.test.mjs

test-kubernetes:
	bash tests/kubernetes/context_safety.sh
	bash tests/kubernetes/cluster_ownership.sh
	CLEANUP=1 scripts/ci/test_kubernetes_labs.sh

test-databases:
	@echo "Database Engineering tests will be added after the Repository V2 gate."

audit-content: validate
	npm run audit:content

clean:
	rm -rf .next .cache .tmp *.tsbuildinfo

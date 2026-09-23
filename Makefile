PYTHON ?= python3
BASE_PATH ?=
SITE_URL ?=
export PYTHONPATH := $(CURDIR)/platform$(if $(PYTHONPATH),:$(PYTHONPATH))

BUILD_ARGS := $(if $(strip $(BASE_PATH)),--base-path "$(BASE_PATH)") $(if $(strip $(SITE_URL)),--site-url "$(SITE_URL)")

.PHONY: install validate build serve test test-site test-kubernetes test-databases audit-content clean

install:
	$(PYTHON) -m pip install -e .

validate:
	$(PYTHON) -m stack_atlas.cli.validate

build:
	$(PYTHON) -m stack_atlas.cli.build $(BUILD_ARGS)

serve: build
	$(PYTHON) -m stack_atlas.cli.serve

test: test-site test-kubernetes test-databases

test-site:
	$(PYTHON) -m unittest discover -s tests/platform -p 'test_*.py'
	node tests/platform/test_progress_migration.js
	node tests/platform/test_path_context.js

test-kubernetes:
	bash tests/kubernetes/context_safety.sh
	bash tests/kubernetes/cluster_ownership.sh
	CLEANUP=1 scripts/ci/test_kubernetes_labs.sh

test-databases:
	@echo "Database Engineering tests will be added after the Repository V2 gate."

audit-content: validate
	$(PYTHON) scripts/maintenance/audit_duplicate_articles.py

clean:
	rm -rf dist _site build .cache .tmp platform/*.egg-info
	find . -type d -name __pycache__ -prune -exec rm -rf {} +

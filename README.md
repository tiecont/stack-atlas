# Stack Atlas

Engineering knowledge, from code to infrastructure.

Stack Atlas is a static engineering knowledge platform. The repository stores authored content, platform code, labs, examples, tests and documentation. The public site is generated into ignored `dist/` output.

The current library has 346 canonical articles. Golang Backend Engineering contains 341 lessons across 24 modules. Kubernetes Engineer has six Foundations lessons and reuses a shared Kubernetes article.

## Local development

Requirements: Python 3.12+, Node.js 22 for browser-script tests, and Docker/kind/kubectl for the Kubernetes integration lab.

```sh
make install
make validate
make build
make serve
```

`make serve` builds `dist/` and serves it at `http://127.0.0.1:8000`. The build checks catalog references, local links and fragments, legacy redirect coverage, and redirect targets. Use `make clean` to remove disposable build and Python cache output.

## Tests and audits

```sh
make test-site
make test-kubernetes
make test-databases
make audit-content
```

The Kubernetes lab uses a disposable kind cluster. `make test-databases` is reserved for the Database Engineering phase after the Repository V2 gate.

## Repository map

```text
content/                 YAML metadata and article folders
platform/stack_atlas/    Catalog, validation, rendering, redirects and CLI
platform/templates/      Maintained HTML templates
platform/assets/         Maintained styles, scripts and icons
labs/                    Runnable learning labs
examples/                Example applications
tests/                   Platform and Kubernetes regressions
scripts/                 CI checks and maintenance tools
docs/                    Architecture, migration and audit records
dist/                    Ignored generated public site
```

Canonical articles own their public URLs. Historical lesson aliases live in each article's `legacy_urls` metadata; the builder generates those redirects and season-index module redirects in `dist/`. No season directory is kept in the source tree.

See [CONTRIBUTING.md](CONTRIBUTING.md) for content authoring and [docs/architecture/build-pipeline.md](docs/architecture/build-pipeline.md) for the build model.

## Philosophy

Understand systems, not just APIs. Learn the mental model, follow data and failure paths, and connect code to the infrastructure that runs it.

## License

See [LICENSE](LICENSE).

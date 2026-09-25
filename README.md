# Stack Atlas

Engineering knowledge, from code to infrastructure.

Stack Atlas Web is a Next.js application backed by a versioned engineering
knowledge catalog. The repository stores authored content, platform code, labs,
examples, tests and documentation. The Python builder validates and renders the
catalog into ignored `dist/` output; Next.js serves those generated public pages
and provides the account UI that integrates with the Nest API.

The current library has 346 canonical articles. Golang Backend Engineering contains 341 lessons across 24 modules. Kubernetes Engineer has six Foundations lessons and reuses a shared Kubernetes article.

## Local development

Requirements: Python 3.12+, Node.js 22.13+, and npm. Docker/kind/kubectl are
needed only for the Kubernetes integration lab.

```sh
python3 -m pip install -e .
npm ci
cp .env.local.example .env.local
```

Start the application at `http://localhost:3001`:

```sh
npm run dev
```

The Next launcher rebuilds the validated content output and copies generated
assets into ignored `public/` files before starting. Run `npm run content:build`
after editing catalog content while the server is already running. To use
account routes, also start the API and PostgreSQL as described in
`../api/README.md`. The Web knowledge pages can be developed without the API or
Engine.

The original static publishing workflow remains available:

```sh
make install
make validate
make build
make serve
```

The current GitHub Pages workflow and `make serve` publish the public knowledge
site only. Account routes require the Next.js server and API; they are not part
of the static export.

`make serve` builds `dist/` and serves it at `http://127.0.0.1:8000`. The build
checks catalog references, local links and fragments, legacy redirect coverage,
and redirect targets. Use `make clean` to remove disposable build and Python
cache output.

## Running the three repositories together

The local ports are deliberately separate: Next Web uses `3001`, Nest API uses
`3000`, PostgreSQL uses `5432`, and Engine runs as a worker process. Start the
API database and API from `../api`, then start Web here. Start Engine from
`../engine` when working on its worker code. Engine currently has no Kafka event
codec or runtime runner wired into the worker, so this starts its independent
foundation process rather than an end-to-end submission flow.

See the [parallel development plan](docs/architecture/parallel-development.md)
for repository ownership and the execution integration gates.

To check the Web-to-API HTTP contract while both are running:

```sh
API_BASE_URL=http://localhost:3000/api/v1/ make test-api-integration
```

## Tests and audits

```sh
make test-site
make test-kubernetes
make test-databases
make audit-content
npm run typecheck
npm run build
```

The Kubernetes lab uses a disposable kind cluster. `make test-databases` is reserved for the Database Engineering phase after the Repository V2 gate.

## Repository map

```text
content/                 YAML metadata and article folders
platform/stack_atlas/    Catalog, validation, rendering, redirects and CLI
platform/templates/      Maintained HTML templates
platform/assets/         Maintained styles, scripts and icons
app/                     Next.js App Router pages
components/              Account and authentication UI
lib/                     API client and generated-content adapter
scripts/                 Content bridge, CI and maintenance helpers
labs/                    Runnable learning labs
examples/                Example applications
tests/                   Platform and Kubernetes regressions
docs/                    Architecture, migration and audit records
dist/                    Ignored generated public site
```

Canonical articles own their public URLs. Historical lesson aliases live in each article's `legacy_urls` metadata; the builder generates those redirects and season-index module redirects in `dist/`. No season directory is kept in the source tree.

See [CONTRIBUTING.md](CONTRIBUTING.md) for content authoring and [docs/architecture/build-pipeline.md](docs/architecture/build-pipeline.md) for the build model.

## Philosophy

Understand systems, not just APIs. Learn the mental model, follow data and failure paths, and connect code to the infrastructure that runs it.

## License

See [LICENSE](LICENSE).

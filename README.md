# Stack Atlas

Engineering knowledge, from code to infrastructure.

Stack Atlas Web is a native Next.js application backed by a versioned
engineering knowledge catalog. TypeScript loads and validates Git-authored YAML
and HTML fragments; the App Router renders public content with React Server
Components and serves the authentication UI that integrates with the Nest API.

The current library has 346 canonical articles. Golang Backend Engineering
contains 341 lessons across 24 modules. Kubernetes Engineer has six Foundations
lessons and reuses a shared Kubernetes article.

## Local development

Requirements: Node.js 24 and npm. Docker is optional for local Web containers.
Kubernetes lab checks additionally require Python with PyYAML, Go, Docker, kind,
and kubectl.

```sh
npm ci
cp .env.example .env
npm run dev
```

The app starts at `http://localhost:3001`. Next.js reads content directly from
`content/`; no Python bootstrap or content build is required. Account routes
also need the API and PostgreSQL described in `../api/README.md`. Public
knowledge pages work without the API or Engine.

## Validate and build

```sh
npm run content:validate
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run start
```

The production app needs a Node-capable host because App Router pages, search,
and native redirects run in Next.js. GitHub Pages cannot host this runtime; its
old deployment workflow was removed. Set `SITE_URL` and
`NEXT_PUBLIC_BASE_PATH` at build time when deploying under a path prefix.

## Running the three repositories together

The local ports are deliberately separate: Next Web uses `3001`, Nest API uses
`3000`, PostgreSQL uses `5432`, and Engine runs as a worker process. Start the
API database and API from `../api`, then start Web here. Start Engine from
`../engine` when working on its worker code. Engine currently has no Kafka event
codec or runtime runner wired into the worker, so this starts its independent
foundation process rather than an end-to-end submission flow.

See the [parallel development plan](docs/architecture/parallel-development.md)
for repository ownership and execution integration gates.

To check the Web-to-API HTTP contract while both are running:

```sh
API_BASE_URL=http://localhost:3000/api/v1/ make test-api-integration
```

## Tests and audits

```sh
npm test
npm run test:e2e
npm run audit:content
docker compose config
docker compose up --build
make test-kubernetes
make test-databases
```

`docker compose up --build` runs the production-style standalone image on port 3001. Configure the API URL, public base path, site origin, or host port in
`.env` before building when needed. The Dockerfile also has a `development`
target for container-based Next.js development.

The Kubernetes lab uses a disposable kind cluster. Its separate workflow retains
Python only for validating lab manifests. `make test-databases` is reserved for
the Database Engineering phase after the Repository V2 gate.

## Repository map

```text
content/                 YAML metadata and article folders
app/                     Next.js App Router pages, metadata and route handlers
components/              Shared site chrome
features/                Auth, content, progress and search UI/state
lib/content/             Typed catalog, validation, search and redirects
lib/api/                 API client and Problem Details handling
scripts/                 Content validation, audits and lab CI helpers
e2e/                     Playwright browser regressions
tests/                   Node and Kubernetes regressions
labs/                    Runnable learning labs
examples/                Example applications
docs/                    Architecture, migration and audit records
```

Canonical articles own their public URLs. Historical lesson aliases live in
each article's `legacy_urls` metadata; `next.config.ts` derives permanent
redirects for those aliases and historical season indexes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for content authoring and
[docs/architecture/build-pipeline.md](docs/architecture/build-pipeline.md) for
the content and rendering model.

## Philosophy

Understand systems, not just APIs. Learn the mental model, follow data and
failure paths, and connect code to the infrastructure that runs it.

## License

See [LICENSE](LICENSE).

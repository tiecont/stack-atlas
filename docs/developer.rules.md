# Stack Atlas Web — Developer Rules

## Stack and local setup

- Use Node.js 24, Next.js App Router, React, and strict TypeScript.
- Use Server Components by default. Add client components for browser
  interaction such as search, theme, auth forms, and learning progress.
- Keep public article, topic, and learning-path URLs stable.
- Git-authored YAML and HTML remain the canonical content source.

```sh
npm ci
npm run dev
```

## Project structure

```text
app/                         # routes, metadata, search API, sitemap, robots
components/                  # shared site shell and header
features/
  auth/components/            # login, registration, account UI
  content/components/         # article, topic, and path UI
  progress/                   # browser learning-progress state and UI
  search/components/          # search dialog and trigger
lib/
  api/                        # one API client and Problem Details parser
  content/                    # YAML loader, typed catalog, validation, URLs
tests/                       # Node regression tests and fixtures
e2e/                         # Playwright browser tests
scripts/                     # validation and repository tooling
```

Keep feature-specific UI and state within `features/<feature>/`. Shared site
chrome belongs in `components/`; canonical content parsing stays in
`lib/content/`.

## Content and API boundaries

- Do not move canonical content into a database or introduce a CMS.
- Keep IDs, URLs, ordering, prerequisites, relationships, and redirect aliases
  stable when changing the loader or renderer.
- Add content invariants to `lib/content/validation.ts` and cover regressions
  with Node tests.
- Keep Web-to-API as the application boundary. Do not add Web-to-Engine or
  Web-to-Kafka calls.
- Route all API traffic through `lib/api/client.ts`; do not call `fetch` from
  auth components for backend operations.
- Render article fragments as React elements through the content allowlist.
  Do not add generated HTML pages or `dangerouslySetInnerHTML`.

## CI and local gates

The Web CI runs format checks, catalog validation, lint, TypeScript, unit tests,
production build, Playwright smoke tests, and a Docker build. Local commits run
lint-staged and `npm run test:precommit`.

```sh
npm run format:check
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
docker compose config
```

Use `docker compose up --build` for the production-style local container. Set
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_PATH`, `SITE_URL`, and `WEB_PORT`
in `.env` as needed; see `.env.example`.

The separate Kubernetes labs workflow keeps Python only for manifest
validation. Do not add that dependency to the Web image or main Web CI job.

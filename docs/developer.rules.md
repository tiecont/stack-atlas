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
tests/<feature>/             # Node regression and full-flow tests by feature
e2e/<feature>/                # Playwright browser tests by feature
scripts/                     # validation and repository tooling
```

Keep feature-specific UI and state within `features/<feature>/`. Shared site
chrome belongs in `components/`; canonical content parsing stays in
`lib/content/`.

Production `*.service.ts` files require an adjacent
`<service-name>.service.spec.ts` unit test. Full-flow and browser e2e tests stay
in the shared feature-scoped test trees, never beside production feature code.

## Content and API boundaries

- API/PostgreSQL owns published article documents and normal authoring uses
  Admin Web -> API -> PostgreSQL. Do not dual-write article bodies or fall back
  to Git HTML when an API article is missing. The Git catalog still owns the
  current topic/path, membership, lab, redirect, and sitemap inventory data;
  remove that runtime only after replacement API owners and parity checks exist.
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
- Read `STACK_ATLAS_WEB_PLATFORM` only in `lib/platform/config.ts`. Do not add
  hostname-based platform selection, client-only admin authorization, role
  checks in local storage/query parameters, or arbitrary executable content.
- Use the explicit shared renderer registry for structured blocks in learner
  content and admin previews. It consumes the API-owned Content Document V1
  contract through an independent Web mirror and matching canonical JSON
  fixture. Public article pages load published documents from the API in Server
  Components; the remaining Git catalog reads are supplemental migration data.

## CI and local gates

The Web CI runs format checks, catalog validation, lint, TypeScript, test
placement, unit tests, production build, feature-scoped Playwright smoke tests,
and a Docker build. Local commits run
lint-staged and `npm run test:precommit`.

```sh
npm run format:check
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run test:integration # requires API_BASE_URL
npm run build
npm run test:e2e
docker compose config
```

Use `docker compose up --build` for the production-style local container. Set
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_PATH`, `SITE_URL`, and `WEB_PORT`
in `.env` as needed; see `.env.example`.

The separate Kubernetes labs workflow uses the Node/TypeScript manifest
validator. Keep Kubernetes cluster execution and lab QA out of the Web runtime.

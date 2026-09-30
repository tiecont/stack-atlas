<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Stack Atlas Web — Agent Instructions

Canonical engineering contract for `stack-atlas-web`. Read this file and, for
architecture, content, platform, or delivery work, `docs/developer.rules.md`
before changing the repository. A nearer `AGENTS.md` may add constraints but
must not weaken these rules.

**MUST / MUST NOT** are merge blockers. **SHOULD / SHOULD NOT** are defaults;
a deviation needs a concrete reason. Preserve unrelated user changes.

## 1. Mandatory pre-work

Before editing:

1. Name the route/feature and the owner of its data and behavior.
2. Inspect the page/layout/route handler, owning feature/library, tests, and
   relevant installed Next.js 16 guide.
3. Trace server/client boundary, API and auth flow, URL/basePath behavior,
   cache freshness, and error/loading states affected by the change.
4. State compatibility expectations and the exact regression test/commands.

Do not guess data ownership or change public URLs as incidental cleanup.
For non-trivial work, record current behavior, target behavior, invariant,
owner, and objectively verifiable acceptance criteria before implementation.

## 2. Architecture and ownership rules

### WEB-001 — File ownership

- `app/` owns route composition, layouts, metadata, route handlers, sitemap,
  and robots.
- `features/<feature>/` owns feature UI and browser state.
- `components/` owns shared site chrome and domain-neutral presentation.
- `lib/content/` owns the typed Git catalog, content parsing, validation,
  redirects, search, and content URL rules.
- `lib/api/` owns the single Web-to-API transport and Problem Details parser.
- `lib/platform/` owns learner/admin platform configuration and route policy.
- `scripts/` owns repository validation, generation, and maintenance commands.
- `tests/` owns Node unit/regression tests; `e2e/` owns Playwright flows.

Keep shared tests grouped under `tests/<feature>/` and browser flows under
`e2e/<feature>/`. A production `*.service.ts` module MUST have an adjacent
`<service-name>.service.spec.ts` unit test; the test structure check is part of
`npm test`. Full-flow and e2e tests belong in the shared test trees and MUST
NOT live under `app/`, `features/`, `lib/`, or another production directory.
Service sidecars are the only tests allowed beside production source.

Keep one canonical owner for each rule. Do not copy catalog parsing into a
route, API transport into a feature, or authorization rules into UI state.

### WEB-002 — Route and feature command ownership

A page or Route Handler translates a URL/HTTP request and composes the owning
feature. Feature components own interaction and presentation state. Mutations
of account, progress, or administrative data are commands owned by the API;
Web validates form shape for UX, calls the API client, and renders its response.
A hidden button, disabled route, platform mode, or client-side check is never
authorization.

Route Handlers currently own Web-local search and health endpoints. A new
handler MUST have a Web-owned protocol; do not proxy arbitrary backend traffic
or bypass `lib/api/client.ts`.

### WEB-003 — Typed feature boundaries

Use strict TypeScript and explicit prop, API, and state types. Do not add
`any`, `@ts-ignore`, or unchecked casts to bypass a contract; treat external
JSON and browser input as `unknown` until validated. Use `import type` for
type-only imports. Keep secret-bearing modules server-only and do not read
`process.env` in a component; validate configuration at the server boundary.
Every interactive control must have a semantic role, accessible name, keyboard
behavior, and visible pending/error state where it performs work.

### WEB-004 — Script and CLI ownership

`package.json` scripts are the canonical command surface. Use those scripts
instead of ad hoc `next`, `eslint`, `prettier`, or Playwright invocations unless
a documented script delegates to that tool. Every new script needs a named
owner, bounded inputs, declared side effects, and a deterministic exit status.
Separate read-only audit/preflight commands from commands that write files or
external state. Do not make a build, test, or dev command depend on Python,
Kubernetes, API, Engine, or external infrastructure unless that workflow
explicitly owns the dependency.

For a data-changing maintenance command, define target scope, input validation,
preflight, dry-run/audit mode where useful, idempotency, partial-failure
behavior, and recovery. Never hide content rewrites, catalog generation, or
remote writes inside build, test, or dev commands.

## 3. Next.js and React rules

### NEXT-001 — Follow the installed framework version

The repository pins Next.js `16.3.6`, React `19.3.0`, and Node.js 24. Before
using or changing a Next API, read the matching guide under
`node_modules/next/dist/docs/01-app/`. For server/client boundaries, route
handlers, authentication, caching, environment variables, metadata, and
Playwright, use the relevant installed guide. Do not copy Pages Router or older
Next examples without verifying them against this version.

### NEXT-002 — Server/client boundary

Layouts and pages are Server Components by default. Add `'use client'` only
where browser state, event handlers, effects, or browser APIs require it. Keep
the client boundary at the smallest interactive leaf: a Client Component pulls
its imported module graph into the browser bundle.

Pass only serializable, browser-safe props across the boundary. Never pass
secrets, server clients, raw session credentials, or unfiltered private data
to Client Components. Use server-only code for secrets and privileged data.

If adding a Server Action, treat it as a public endpoint: validate every input
and perform authentication/authorization on the server for each call. UI
visibility is not a security boundary.

### NEXT-003 — Data fetching and caching

For each API-backed read, state whether it is public or user-specific, its
freshness requirement, cache/revalidation policy, and failure behavior. Do not
put authenticated or tenant-scoped responses in a shared public cache. Do not
add `use cache`, route cache flags, tags, or revalidation without documenting
ownership and invalidation. Confirm the behavior in the installed Next 16
caching guide; defaults may differ by route and configuration.

### NEXT-004 — Runtime and environment

`NEXT_PUBLIC_*` values are public and may be inlined into client bundles at
build time. Never place credentials or secrets in them. Keep server-only
configuration unprefixed, validate it at the server boundary, and update
`.env.example` when the runtime contract changes. Build-time public API URL,
base path, and site URL must match the deployed runtime.

## 4. Content, URL, and rendering contracts

### CONTENT-001 — Canonical source and identity

Git-authored YAML and article HTML remain the canonical learner content until
an explicit cutover. Do not dual-write or switch learner reads to the API
content foundation before that cutover.

Preserve article IDs, slugs, canonical URLs, authored ordering, prerequisites,
path membership, relationships, and legacy aliases. Do not replace the catalog
with a subset, silently merge duplicate articles, or move it to a CMS. Put
catalog invariants in `lib/content/validation.ts`; the loader and production
build must use the same validation rules.

### CONTENT-002 — Safe rendering and derived surfaces

Render authored article HTML only through the React allowlist in
`features/content/components/article-content.tsx`. Render structured content
blocks through the typed block renderer. Do not use `dangerouslySetInnerHTML`,
create generated HTML pages, or render arbitrary authored tags/attributes.

Derive search, redirects, sitemap, robots, topic/path links, and content URLs
from the typed catalog and its URL helpers. Do not recreate slug or basePath
logic in route components.

### CONTENT-003 — Public file routes

Lab/example runtime files are served only through registered entries in
`lib/labs/registry.ts`, `lib/examples/registry.ts`, and
`lib/public-content-files.ts`. Do not resolve arbitrary request paths against a
repository directory. Preserve allowlists and Next output tracing includes /
excludes. File-route changes must cover unknown IDs, path traversal, and
unregistered files.

## 5. API, authentication, and platform boundaries

All backend calls go through `lib/api/client.ts`, including auth forms. Keep
Problem Details parsing and error translation there; do not add direct `fetch`
for API operations inside components. Web calls the configured API only; it
MUST NOT call Engine or Kafka.

The API is authoritative for identity, session validity, ownership, and
permissions. Do not make local storage, progress state, platform mode, or
admin-shell visibility an authorization source. Keep admin routes `noindex`,
but also treat the API as the actual security boundary.

Use `lib/platform/config.ts`, `gate.ts`, and `routes.ts` for platform-mode
configuration and route policy. Test learner and admin behavior separately;
keep their route/content boundaries explicit.

## 6. Change-specific checklists

### Route or URL change

Before completion, verify canonical path and trailing slash, `basePath`, legacy
redirects, metadata, sitemap/robots, inbound links, not-found behavior, and an
e2e assertion for the affected route.

### Content loader, schema, or renderer change

Before completion, verify valid and invalid fixtures, IDs/order/relationships,
legacy URL resolution, allowlist behavior, and that `npm run content:validate`
and the production build use the same rules. A bug fix needs a regression test
for the original content or rendering failure.

### API or auth change

Before completion, verify the API client request/response contract, Problem
Details mapping, unauthenticated/forbidden/error state, and that no session or
permission decision was moved into the browser. Cover the visible flow with a
Node integration test or Playwright test as appropriate.

### Cache or environment change

Before completion, verify the data owner, public/private boundary, build-time
versus runtime value, cache lifetime, invalidation, and behavior with missing
configuration. Never expose a secret to the browser bundle.

### Lab/example file route change

Before completion, verify registered-file success, unknown entry, traversal
attempt, output tracing, and no dependency on Kubernetes in the Web runtime.

## 7. Tests, commands, and delivery

### TEST-001 — Test behavior

Use deterministic Node tests for content, URL, transport, and platform policy.
Use Playwright for user-visible routing, auth, admin-mode, and rendering flows.
Group Node tests in `tests/<feature>/` and Playwright suites in
`e2e/<feature>/`; keep full-flow tests out of `app/`, `features/`, and `lib/`.
Each test states setup, action, and observable result. Do not add tests whose
only assertion is importability or file existence. Every bug fix needs a
regression test; SQL/backend invariants belong in API tests, not Web mocks.
Playwright flows should verify keyboard access and user-visible loading,
success, empty, and error states when those states are part of the change.

### CMD-001 — Canonical Web commands

Run commands through the owning package scripts:

```sh
npm ci
npm run format:check
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm test` runs feature-scoped local tests and the placement gate.
API-backed Node integration tests use `npm run test:integration` and require an
explicit `API_BASE_URL`; they remain separate from the default unit suite.
Playwright e2e tests use API contract mocks unless a dedicated cross-repository
acceptance environment is configured.

For container/configuration changes also run `docker compose config --quiet`
and build `docker build --target runner .`. Kubernetes lab changes additionally
use `npm run kubernetes:validate` and the dedicated lab workflow; do not run
cluster QA for ordinary Web changes.

The `build` script validates content, builds Next standalone output, and checks
the standalone runtime. Do not substitute `next build` when verifying the
repository build contract. `npm ci` is required after dependency/lockfile
changes; do not hand-edit the lockfile.

### DEL-001 — CI and image ownership

CI owns format, content validation, lint, typecheck, test placement, unit tests,
production build, feature-scoped Playwright e2e, Compose validation, and Docker
`runner` image validation.
The publish job depends on all required jobs and uses the configured `main`,
`develop`, or version-tag trigger. Keep image identity and public build args
consistent with the workflow. Package-write permission stays in the publishing
job only.

The published image identity is
`ghcr.io/tiecont/stack-atlas-web`. Public build values such as
`NEXT_PUBLIC_API_BASE_URL`, `SITE_URL`, and `basePath` must match the workflow
and deployment contract; secrets never belong in build args. Compose uses the
explicit `stack-atlas` project and `WEB_PORT`. Inspect resolved project and
ports before local Compose verification; never remove volumes with
`docker compose down -v` during normal verification.

GitHub branch protection MUST require the repository CI checks and code-owner
review for pull requests. `.github/CODEOWNERS` names the repository owner;
required-review and status-check settings are repository-host controls and
must be checked in GitHub. A local hook or this file alone cannot enforce them.

The `runner` image uses Node 24 standalone output and a fixed non-root user.
Compose is a local production-style Web container, not a Kubernetes or
multi-service deployment. Do not add Engine, Kafka, Python, or cluster access
to the Web image.

Husky runs `lint-staged` and `npm run test:precommit`; preserve both gates.
Report unavailable commands with the exact command and concrete reason. Do not
claim a test or image build passed unless it ran.

## 8. Completion report

Report summary, route/feature owner, API/content/security impact, tests and
commands run, deployment or integration dependency, and remaining risks.

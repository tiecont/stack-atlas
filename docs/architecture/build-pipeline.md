# Native Next.js content pipeline

Git remains the canonical source for content. TypeScript loads and validates
YAML metadata and article HTML fragments; Next.js renders native App Router
pages with React Server Components.

```text
content/ (YAML + HTML fragments)
           ↓
TypeScript loader and schema checks
           ↓
typed catalog + relationship graph
           ↓
Next.js App Router and React components
           ↓
metadata, sitemap, robots, search and native redirects
```

## Source ownership

- `content/` stores canonical site, topic, category, path and article records.
- `lib/content/` loads YAML and bodies, validates references and links, derives
  search results, and builds historical redirect mappings.
- `app/` owns public routes, metadata, sitemap, robots, search and static lab
  file handlers.
- `features/` owns auth, content, progress and search UI and state;
  `components/` owns shared site chrome.
- `app/globals.css` and `public/` are the Next.js asset pipeline.

The loader preserves article IDs, canonical URLs, path module order and article
placement order. Article HTML is parsed into React elements after an explicit
element and attribute allowlist; complete legacy pages are never read or
embedded.

## Validation and checks

`npm run content:validate` checks duplicate IDs and URLs, required metadata,
references, path membership and ordering, prerequisites and cycles, local links
and fragments, asset targets, legacy URL ownership, redirect targets and
redirect chains. It exits non-zero on an error.

CI follows the Node 24 baseline and runs:

```sh
npm ci
npm run format:check
npm run content:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
docker compose config
docker build --target runner .
```

The build reruns content validation before `next build`. Development starts
Next.js directly and does not require a generated content step.

The multi-stage Dockerfile builds Next.js standalone output and runs it as an
unprivileged user. `docker-compose.yml` builds the runner image, exposes port
3001, and checks the native health route. The `development` Docker target is
available for container-based development.

## Hosting

The app requires a Node-capable Next.js host. GitHub Pages only serves static
files, so it cannot run App Router route handlers or `next.config.ts` redirects.
The old Pages deployment workflow was removed. Configure `SITE_URL` and
`NEXT_PUBLIC_BASE_PATH` during build when the host uses a path prefix.

GitHub Actions builds and validates the runner image. The GHCR publish job is
enabled on `main`, `develop`, and version tags after the repository variable
`NEXT_PUBLIC_API_BASE_URL` and `SITE_URL` are configured; public client and
canonical URL settings are baked into the Next.js build.

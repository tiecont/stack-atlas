<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Stack Atlas Web — Agent Instructions

Read `docs/developer.rules.md` before changing application architecture,
content loading, validation, deployment, or repository automation.

## Repository boundaries

- This app uses Node.js 24, TypeScript, React, and the Next.js App Router.
- Git-authored YAML and article HTML remain the canonical content source.
- The Web app may call the configured API. It must not call Engine or Kafka.
- Python is excluded from Web development, build, validation, and test paths.
  The separate Kubernetes lab manifest check is intentionally Python-based.

## Folder ownership

- `app/` owns routes, route metadata, route handlers, sitemap, and robots.
- `features/` owns feature-specific UI and state, grouped by feature.
- `components/` contains shared site chrome and reusable presentation.
- `lib/content/` owns the typed Git content catalog and its validation.
- `lib/api/` owns the single API transport and Problem Details handling.
- `tests/` contains Node unit/regression tests; `e2e/` contains Playwright tests.
- `scripts/` contains repository checks and maintenance commands.

## Content and rendering rules

- Preserve canonical URLs, authored ordering, IDs, relationships, and legacy
  aliases. Never replace the catalog with a demo subset or move it to a CMS.
- Add content rules to `lib/content/validation.ts`; keep the validator usable
  from `npm run content:validate` and the production build.
- Render authored article fragments with React through the allowlist in
  `features/content/components/article-content.tsx`.
- Do not use `dangerouslySetInnerHTML` to render authored or generated pages.
- Derive redirects, search, sitemap, and robots from the typed catalog.

## Local checks

```sh
npm ci
npm run format:check
npm run content:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
docker compose config
docker build --target runner .
```

The pre-commit hook runs lint-staged and `npm run test:precommit`.

# Hosting Stack Atlas Web

The app uses Next.js route handlers, server rendered pages and native redirects.
GitHub Pages only serves static files, so it cannot host the application. The
old Pages deployment workflow has been removed as part of the native Next.js
migration.

Deploy the standalone image to a Node-capable container host. For local
production-style use, set values in `.env` and run `docker compose up --build`.
Set `SITE_URL` to the public origin and `NEXT_PUBLIC_BASE_PATH` if the app is
served below the origin root. `NEXT_PUBLIC_API_BASE_URL` is required for the
published image to call the deployment's API.

`.github/workflows/ci.yml` runs content validation, format, lint, typecheck,
unit/browser regressions, production build, and Docker validation. It publishes
to GHCR on `main`, `develop`, and version tags after
`NEXT_PUBLIC_API_BASE_URL` and `SITE_URL` are configured. The separate
Kubernetes lab workflow retains Python with PyYAML only for lab manifest
validation.

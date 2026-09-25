# Contributing to Stack Atlas

Stack Atlas stores one canonical article per folder. Learning paths reference
article IDs and own lesson order.

## Add an article

Create `content/articles/<domain>/<slug>/article.yaml` and `article.html`.

```yaml
schema_version: 1
id: postgres-connection-pools
title: Why PostgreSQL Connection Pools Fail Under Load
description: How pool saturation affects latency and throughput.
type: article
domain: postgresql
category: performance
tags: [postgresql, performance, pooling]
difficulty: intermediate
learning_paths: []
prerequisites: []
related: []
labs: []
legacy_urls: []
status: published
review:
  last_reviewed: 2026-09-23
```

`article.html` contains the article fragment, not a full page. Use semantic
headings and stable IDs for section links. The directory name supplies the
article body location; do not add a separate `source` field.

An article may be standalone or appear in several paths. Add `{path_id,
module_id}` membership objects to `learning_paths`; the path module's
`article_ids` list owns order. Keep existing article IDs stable.

## Metadata conventions

- Topics: `content/domains/<id>.yaml`
- Categories: `content/categories.yaml`
- Learning paths: `content/paths/<id>.yaml`
- Site configuration: `content/site.yaml`
- Articles: folder-based YAML metadata and HTML body

All authored metadata uses YAML. Dates use `YYYY-MM-DD`; do not infer dates from
file ordering. Put executable companions under `labs/` and reference their
directories through an article's `labs` list.

## Validate, test, and build

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

Next.js reads canonical files directly and owns route rendering, metadata,
search, sitemap, robots and redirects. Do not create a second generated HTML
tree. The validator checks catalog identity and references, local content links
and fragments, path ordering, and legacy redirect coverage and targets.

Kubernetes lab checks use a separate toolchain:

```sh
make test-kubernetes
```

The full target requires Python with PyYAML, Go, Docker, kind v0.33.0 and
kubectl v1.37.0. Python is used only for the lab manifest validator. The lab
runner creates and removes a kind cluster only when it created the cluster.

The pre-commit hook formats and lints staged files, then runs
`npm run test:precommit`. For the production-style container, run
`docker compose config` and `docker compose up --build`.

## Legacy URLs

When migrating an article, retain each historical lesson URL in `legacy_urls`.
Validation requires one unique redirect per alias and checks its canonical
target. Preserve a historical season index by listing its exact
`/season-*/index.html` URL in the owning path module's `legacy_index_urls`;
redirects point to that module's anchor. The audited inventory is in
`docs/audits/legacy-url-inventory.md`.

Do not archive old season folders elsewhere; preserve historical routing
through canonical article metadata.

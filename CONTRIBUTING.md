# Contributing to Stack Atlas

Stack Atlas stores one canonical article per folder. Learning paths reference article IDs and own the lesson order.

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

`article.html` contains the content fragment, not a full page. Use semantic headings and stable IDs where links should target a section. The directory name supplies the article body location; do not add a separate `source` field.

An article may be standalone or appear in several paths. Add `{path_id, module_id}` membership objects to `learning_paths`; the path module's `article_ids` list owns order. Keep existing article IDs stable.

## Metadata conventions

- Domains: `content/domains/<id>.yaml`
- Categories: `content/categories.yaml`
- Learning paths: `content/paths/<id>.yaml`
- Site configuration: `content/site.yaml`
- Articles: folder-based YAML metadata and HTML body

All human-authored metadata uses YAML. Generated machine-readable output, including `dist/search-index.json`, uses JSON. Dates use `YYYY-MM-DD`; do not infer dates from file ordering.

Use semantic, technology-independent domain concepts where possible. Keep implementation details such as PostgreSQL-specific behavior clear in the content itself. Put executable companions under `labs/` and reference their directories through an article's `labs` list.

## Build and verify

```sh
make install
make validate
make build
make test-site
```

`make build` always writes the disposable site to ignored `dist/`. Never hand-edit generated files. `make serve` builds and serves the output. `make clean` removes `dist/`, `_site/`, local caches and Python bytecode.

Kubernetes lab checks:

```sh
make test-kubernetes
```

The full target requires Docker, kind v0.33.0 and kubectl v1.37.0. It creates and cleans up a kind cluster for the smoke test. The shell context-safety regression runs before cluster work.

## Legacy URLs

When migrating an article, retain each historical lesson URL in `legacy_urls`. The build must produce exactly one redirect for each declared alias and verify its canonical target. Season index compatibility redirects are derived from each season's lesson memberships and point to the corresponding path module anchor. The audited inventory is in `docs/audits/legacy-url-inventory.md`.

The repository structure test rejects root `season-*` directories and checked-in generated page trees. Do not archive old season folders elsewhere; preserve historical routing through canonical article metadata.

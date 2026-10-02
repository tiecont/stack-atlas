# Stack Atlas content model

Published article documents are owned by the API and PostgreSQL. The Web
renders the API's structured Content Document V1. The Git catalog remains a
temporary source for taxonomy, learning paths, supplemental article
relationships, redirects, and the public URL inventory.

## Core records

- **Site** — name, description, language and deployment URL settings in
  `content/site.yaml`.
- **Topic** — a subject such as Kubernetes or Golang in
  `content/domains/<id>.yaml`.
- **Category** — a cross-topic classification in `content/categories.yaml`.
- **Article** — the canonical knowledge node in
  `content/articles/<domain>/<slug>/article.yaml` plus `article.html`. Its
  public URL remains `/articles/<domain>/<slug>/`.
- **Learning path** — an optional curated route in `content/paths/<id>.yaml`.
  Modules own order through integer `order` and ordered `article_ids` lists.
- **Legacy URL** — a historical route listed in article or module metadata;
  Next.js serves a permanent redirect.
- **Lab** — a registered guide and allowlisted file set referenced by an
  article's `labs` list. Its stable ID is defined in `lib/labs/registry.ts`.

An API content item is the canonical published article node; a learning path is
an ordered set of article references from the current Git catalog. A season is
not a source content type.

## Validation

Article metadata uses `schema_version: 1`. The TypeScript validator checks
identity, title, description, domain, status, canonical URL, body presence,
relationships, path membership, dates, local links and legacy URL ownership.
Optional fields include `difficulty`, `category`, `tags`, `learning_paths`,
`prerequisites`, `related`, `labs`, `legacy_urls`, `review`, `created_at` and
`updated_at`.

An article's `learning_paths` entries state membership through `path_id` and
`module_id`; they do not specify order. The catalog checks that both
declarations agree and that an article occurs no more than once in each path.
Prerequisite relationships must resolve and remain acyclic.

Git authored article HTML is imported as immutable API revisions and the
published API representation is the only runtime source for article body,
title, description, slug, and publication state. A missing or archived API
article returns not-found; Web does not fall back to filesystem body content.
The public route uses the same structured renderer as admin preview and caches
public API reads for 60 seconds with a 3.5-second upstream timeout.

The current API model does not persist topic taxonomy, path/module membership,
prerequisites, lab references, or legacy redirect metadata. Those supplemental
surfaces still come from Git during this transition. This is not a dual-write
workflow: normal article authoring and publishing use Admin Web, API, and
PostgreSQL. The later filesystem runtime ownership cleanup must first provide
replacement owners for the remaining Git-backed data.

## Progress model

Completion is global to the article ID, so completing a shared article counts
in every path that includes it. The active path and last visited article are
path-specific. Browser local storage stores the active path, per-path resume
points and global completion IDs; it does not require an account or backend.

# Stack Atlas content model

Stack Atlas is a static knowledge platform. Human-authored knowledge is stored as YAML metadata and HTML article fragments; platform code turns it into a public static site.

## Core records

- **Domain** — a subject area such as Kubernetes or Golang, declared in `content/domains/<id>.yaml`.
- **Category** — a cross-domain classification declared in `content/categories.yaml`.
- **Article** — the canonical knowledge node, stored as `content/articles/<domain>/<slug>/article.yaml` plus `article.html`. The article folder determines the body path; canonical URLs remain under `/articles/<domain>/<slug>/`.
- **Learning Path** — an optional curated route declared in `content/paths/<id>.yaml`. Modules own order through integer `order` and ordered `article_ids` lists.
- **Module** — a named grouping within a path. It references article IDs and does not duplicate article content.
- **Legacy URL** — a historical lesson URL listed in an article's `legacy_urls`. The builder generates a redirect in `dist/`.
- **Lab** — an executable companion referenced by an article's `labs` list and stored under `labs/`.

The defining rule is: **Article = canonical knowledge node; Learning Path = ordered references to articles; Legacy URL = compatibility alias; Lab = executable companion. Season is not a source content type.**

## Article metadata

Article metadata uses `schema_version: 1`. The catalog validates identity, title, description, domain, status, canonical URL, body presence, relationships, path membership and legacy URL ownership. Optional fields include `difficulty`, `category`, `tags`, `learning_paths`, `prerequisites`, `related`, `labs`, `legacy_urls`, `review`, `created_at` and `updated_at`.

An article's `learning_paths` entries state membership through `path_id` and `module_id`; they do not specify order. The catalog checks that article and path declarations agree and that an article occurs no more than once in each path.

All human-authored domain, category, path, site and article metadata uses YAML. Generated machine-readable output uses JSON.

## Progress model

Completion is global to the article ID, so completing a shared article counts in every path that includes it. The active path and last visited article are path-specific. Browser local storage stores the active path, per-path resume points and global completion IDs; it does not require an account or backend.

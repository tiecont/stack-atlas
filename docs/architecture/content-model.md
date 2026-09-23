# Stack Atlas content model

Stack Atlas is a static knowledge platform. Its source model separates reusable knowledge from the routes that organize it.

## Core records

- **Domain** — a subject area such as Kubernetes or Golang. Domains are declared in `content/domains.json` and `content/domains/*.yaml`.
- **Category** — a cross-domain classification declared in `content/categories.json`.
- **Article** — the canonical knowledge node. An article has a stable `id`, metadata JSON under `content/articles/`, and an HTML fragment named by `source`. Its canonical URL is under `/articles/<domain>/<slug>/`. A standalone article need not belong to a path.
- **Learning Path** — an optional curated route declared under `content/paths/`. A path contains modules. Each module has a unique `id`, an integer `order`, and an ordered `article_ids` list. Those lists, after modules are sorted by `order`, are the sole source of lesson order.
- **Module** — a named grouping within one path, with its own domain and category. It references article IDs; it does not duplicate article content.
- **Legacy URL** — a historical season lesson URL listed in an article's `legacy_urls` array. The generator writes a redirect to the canonical article. Legacy URLs are aliases, not alternate content records.
- **Lab** — an executable companion referenced by an article's `labs` list. Lab instructions and manifests live under `labs/`; they complement the article and are independently validated.

The defining rule is: **Article = canonical knowledge node; Learning Path = ordered references to articles; Legacy URL = compatibility alias; Lab = executable companion. Season is not a canonical content type.**

## Article metadata

Metadata is versioned with `schema_version: 1`. Existing records without the field are read as version 1. The catalog validates required identity, title, description, domain, status, canonical URL, source fragment, supported relationships, and optional date fields. `difficulty`, `category`, `tags`, `learning_paths`, `prerequisites`, `related`, `labs`, `legacy_urls`, `review`, `created_at`, and `updated_at` may be supplied where relevant. Kubernetes version or feature fields are optional extensions and are not required for other domains.

An article's `learning_paths` entries state membership with `path_id` and `module_id`; they do not specify order. The catalog checks that membership and path references agree, that IDs and URLs are unique, and that an article occurs no more than once in a path.

JSON and YAML are both supported for metadata. Existing JSON remains valid; new human-authored domain and path metadata may use YAML. Generated machine-readable files use JSON. Conversion is incremental.

## Progress model

Completion is global to the article ID, so completing a shared article counts in every path that includes it. The active path and last visited article are path-specific. Browser local storage stores the active path, per-path resume points, and global completion IDs; it does not require an account or backend.

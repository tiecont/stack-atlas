# Stack Atlas content model

Stack Atlas stores authored knowledge as YAML metadata and HTML article
fragments. A TypeScript loader validates the catalog and Next.js renders it as
React pages.

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

Article is the canonical knowledge node; a learning path is an ordered set of
article references. A season is not a source content type.

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

All human-authored metadata uses YAML. Article content remains in the
repository; it is not copied to a CMS or database.

During the current platform phase, Git remains the canonical authored source;
the Web catalog is not dual-written to the API. Existing Git-authored HTML
continues through the strict allowlist renderer. The new shared structured
renderer consumes the API-owned Content Document V1 contract through an
independent Web mirror and canonical JSON fixture. It is not wired to learner
routes. API-owned immutable revision and publication tables remain a separate
foundation until authoring and cutover phases.

## Progress model

Completion is global to the article ID, so completing a shared article counts
in every path that includes it. The active path and last visited article are
path-specific. Browser local storage stores the active path, per-path resume
points and global completion IDs; it does not require an account or backend.

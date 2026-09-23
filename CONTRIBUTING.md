# Contributing to Stack Atlas

Stack Atlas accepts standalone engineering articles as well as articles included in learning paths. Keep one canonical article source and reference its ID from any number of paths.

## Add an article

1. Add an HTML fragment under `content/articles/<domain>/`. Use semantic headings and include stable `id` attributes when other sections should link directly to them.
2. Add a JSON metadata file alongside it. For example, `content/articles/postgresql/connection-pools.json`:

   ```json
   {
     "id": "postgres-connection-pools",
     "title": "Why PostgreSQL Connection Pools Fail Under Load",
     "description": "How pool saturation affects latency and throughput.",
     "type": "article",
     "domain": "postgresql",
     "category": "performance",
     "tags": ["postgresql", "performance", "pooling"],
     "difficulty": "intermediate",
   "learning_paths": [],
     "prerequisites": [],
     "related": [],
     "status": "published",
     "url": "/articles/postgresql/connection-pools/",
   "source": "content/articles/postgresql/connection-pools.html",
     "authors": ["tiecont"]
   }
   ```

3. The build generates the canonical article page with the shared layout, topic page listing, article index and search record. Add a category and domain first if the validator reports an unknown reference.

An article may have no learning path. To place it in a path, add an object to `learning_paths` with `path_id`, `module_id` and its 1-based `order`, for example `{ "path_id": "golang-backend", "module_id": "go-concurrency", "order": 342 }`. The order is local to that path. One article can have several such memberships without duplicating its source.

## Add a domain

Add an entry to `content/domains.json`, or add a YAML record at `content/domains/<domain>.yaml`, with a unique lowercase `id`, a title, a short description and a status (`published` or `planned`). The build creates its topic page automatically. A planned domain can be listed before it has articles.

## Add a category

Add a unique `id` and display `title` to `content/categories.json`. Categories are shared across domains; article domain and category remain separate fields.

## Create a learning path

Add `content/paths/<path-id>.json` or `.yaml`. Define its title, description, status and ordered modules. A module may reference a legacy season with `season`, or canonical articles through `article_ids`. For article records, also set a membership on each article so the relationship validates in both directions. Groups such as “Golang Core” are display groupings local to that path.

Version-sensitive article metadata may include `review: { kubernetes_baseline, last_reviewed }` and a `kubernetes` feature/version block. Runnable lab references belong in the article's `labs` list and must point to a directory containing `README.md`.

## Build and validate

```sh
python3 -m pip install -r requirements.txt
python3 scripts/build_site.py
```

The build checks required metadata, duplicate IDs, domains, categories, article relationships, learning-path/module references, source files, legacy lesson links, and local HTML links and fragments. It then refreshes the checked-in pages and search index.

Kubernetes manifests have additional static checks. With the pinned kind cluster running, add `--server-side` to the manifest validator for API-server validation and run `scripts/test_kubernetes_labs.sh` for the cluster smoke test.

To preview a deployable copy without replacing the checked-in output:

```sh
python3 scripts/build_site.py --output _site
python3 -m http.server 8000 --directory _site
```

The migration helper extracts only the selected batch, keeps article IDs stable, and preserves each legacy URL as a redirect after the next successful build. The first batch is Seasons 01–03:

```sh
python3 scripts/migrate_legacy_batch.py --seasons season-01-fundamentals season-02-runtime season-03-concurrency
python3 scripts/build_site.py
```

Keep version-sensitive articles clear about language or protocol guarantees versus implementation details and operational advice. Add `last_reviewed` where regular version review matters, and include official references when practical.

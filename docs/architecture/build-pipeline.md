# Static build pipeline

The modern site is generated from canonical metadata and article fragments. Normal catalog loading never reads `season-*/index.html` to discover lessons or infer their order.

```text
content metadata + article fragments + source templates/assets
                         |
                         v
                 catalog loading
                         |
                         v
                 catalog validation
                         |
                         v
                  static rendering
                    /   |   \
             topics articles paths
                    \   |   /
               search / SEO / redirects
                         |
                         v
                   link validation
                         |
                         v
                 deployable _site
```

## Source and generated files

- `content/` holds domains, categories, paths, article metadata and HTML fragments.
- `src/templates/`, `src/styles/`, `src/scripts/`, and `src/assets/` hold maintained presentation sources.
- `stack_atlas/catalog.py` loads and validates the content graph. `render.py`, `templates.py`, `search.py`, `links.py`, and `files.py` handle distinct build responsibilities.
- `scripts/build_site.py` parses options, loads the catalog, validates it, renders output, then validates generated links.
- `assets/site.css`, `assets/site.js`, and `assets/progress-store.js` are generated from `src/` and carry generated-file notices.
- `_site/` is a deployable build output when selected with `--output _site`.

The renderer sorts modules by their declared integer order and preserves each module's `article_ids` order. The same flattened sequence supplies path lesson numbering and Previous/Next navigation. Content lists that have no semantic order use stable source ordering. “Recently Updated” is sorted by explicit `updated_at` descending; dates are not inferred from traversal order.

## Validation and routes

Catalog validation checks IDs, references, path placement, source files, metadata schema version, and legacy URL ownership. Output validation checks local links and fragments. Search data is emitted as `search-index.json`; sitemap and robots files are generated from canonical routes. Legacy URL redirects are emitted from `legacy_urls`.

Useful commands:

```sh
python3 scripts/build_site.py
python3 scripts/build_site.py --output _site --base-path /stack-atlas
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/test_progress_migration.js
```

The build is deterministic: it introduces no build timestamp, and the regression suite compares hashes from repeated builds.

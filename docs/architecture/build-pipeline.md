# Static build pipeline

The repository stores source. The public site is generated from the catalog into ignored `dist/`.

```text
content/ + platform/ + labs/
          |
          v
      validation
          |
          v
      rendering
       /   |   \
 articles topics paths + assets + search/SEO
          |
          +--> lesson redirects from legacy_urls
          +--> season-index redirects from module legacy_index_urls
          |
          v
        dist/
          |
          v
   link and redirect validation
```

## Source and build output

- `content/` contains YAML metadata and article folders with `article.yaml` and `article.html`.
- `platform/stack_atlas/` contains catalog, models, validation, rendering, links, search, redirects and CLI code.
- `platform/templates/` and `platform/assets/` contain maintained templates, styles, scripts and icons.
- `labs/`, `examples/`, `tests/`, `scripts/` and `docs/` hold executable labs and project support material.
- `dist/` contains generated public pages, assets, search data, sitemap, robots file and historical redirects. It is ignored by Git and must not be hand-edited.

The renderer sorts modules by their declared integer order and preserves each module's `article_ids` order. The same flattened sequence supplies path lesson numbering and Previous/Next navigation.

## Validation

Catalog validation checks IDs, references, path placement, article schema and legacy URL ownership. Repository validation rejects root season directories, checked-in generated site trees and flat article metadata. Output validation checks local links, fragments, exact legacy redirect coverage and every redirect target.

Useful commands:

```sh
make install
make validate
make build
make serve
make test-site
make test-kubernetes
```

Set `BASE_PATH` and `SITE_URL` when building a project site:

```sh
make build BASE_PATH=/stack-atlas SITE_URL=https://tiecont.github.io
```

Builds contain no timestamp. The regression suite compares hashes from repeated builds.

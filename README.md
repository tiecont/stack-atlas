# Stack Atlas

Engineering knowledge, from code to infrastructure.

Stack Atlas is a static engineering knowledge base. It publishes standalone articles and organizes selected articles into optional learning paths. The current library has 346 canonical articles. The **Golang Backend Engineering** path contains 341 lessons across 24 modules; **Kubernetes Engineer** currently has six foundations lessons, including one canonical article shared with the Golang path.

## Explore

- Open `index.html` for the Stack Atlas homepage.
- Browse generated topic pages in `topics/`.
- Browse curated routes in `paths/`.
- Browse the full searchable article library at `articles/`.
- Existing `/season-*/...html` lesson URLs remain available as redirects.

All 24 season indexes and all 341 original lesson URLs remain available. The 346 canonical articles use routes under `/articles/<domain>/<slug>/`; each original lesson URL redirects to its canonical page. Season indexes remain as the legacy route into the Golang Backend Engineering learning path.

## Run locally

The site builder uses Python 3 and PyYAML for YAML domain and learning-path metadata:

```sh
python3 -m pip install -r requirements.txt
python3 scripts/build_site.py
python3 -m http.server 8000
```

Open `http://localhost:8000`. The build validates metadata and checks local HTML links and fragments. To build a clean deployable copy instead, run `python3 scripts/build_site.py --output _site` and serve `_site/`.

## Kubernetes labs

The first Kubernetes slice includes a pinned kind v0.33.0 / Kubernetes v1.37.0 cluster and a reusable API demo app. Install Docker, kind and kubectl as described in `labs/kubernetes/00-cluster/README.md`, then run `make -C labs/kubernetes/01-foundations test`. The test builds and loads the local image, checks two replicas, deletes one managed Pod and verifies reconciliation.

Search downloads a static `search-index.json`. Theme choice and learning progress are stored in browser local storage; no account or backend is required. Progress remembers the active learning path and last visited article for each path. Existing completed article IDs migrate from progress schema v1 without loss.

## Content model

Stack Atlas separates three ideas:

- **Domain** describes the engineering subject, such as Golang, PostgreSQL or Kubernetes.
- **Article** is one canonical piece of knowledge. It may be standalone or appear in one or more learning paths.
- **Learning path** is an ordered route through selected articles. Modules and groups are presentation concepts inside a path.

Categories and tags help organize articles within a domain. Prerequisites and related article IDs define knowledge relationships. See [CONTRIBUTING.md](CONTRIBUTING.md) for the authoring workflow and metadata shape.

## Repository map

```text
content/
  articles/          New article metadata and content fragments
  domains.json       Existing topic and domain definitions
  domains/           Additional YAML domain definitions
  categories.json    Shared category vocabulary
  paths/             JSON or YAML learning path definitions
labs/                Runnable, version-pinned Kubernetes labs
examples/            Shared lab applications
scripts/
  build_site.py      Static renderer and metadata/link validator
  migrate_legacy_batch.py  Extract a selected season batch into article sources
  validate_kubernetes_manifests.py  Static and API-server manifest checks
assets/              Shared CSS, browser behavior and favicon
topics/              Generated topic pages
paths/               Generated learning-path pages
season-*/             Preserved season indexes and legacy lesson URL redirects
```

The generated pages are checked in so the repository can be opened directly. GitHub Actions rebuilds and deploys a base-path-aware static copy from the same sources.

## Philosophy

Understand systems, not just APIs. Learn the mental model, follow data and failure paths, and connect code to the infrastructure that runs it.

## License

See [LICENSE](LICENSE).

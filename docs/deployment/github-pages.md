# GitHub Pages deployment

## One-time repository setting

For deployment, configure **Settings → Pages → Build and deployment → Source** as **GitHub Actions**. A successful artifact build alone does not enable the repository setting.

## Workflows

- `.github/workflows/site-ci.yml` runs repository validation, platform regressions and a base-path-aware site build.
- `.github/workflows/kubernetes-labs.yml` validates manifests and runs the isolated kind smoke test when platform, content or Kubernetes lab sources change.
- `.github/workflows/pages.yml` builds `dist/`, uploads only that directory, and deploys it from `main`.

The GitHub Project Pages base path and canonical site URL are passed to the builder through `make build BASE_PATH=... SITE_URL=...`.

## Contributor workflow

Use the repository's normal review process. Site and applicable lab checks must pass before a change is ready to merge. Pages deployment is separate and runs from `main`.

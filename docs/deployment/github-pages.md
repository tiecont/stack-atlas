# GitHub Pages deployment

## One-time repository setting

For the deployment workflow to publish, configure the repository once:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Save the setting, then rerun the `Deploy GitHub Pages` workflow on `main` (or run it with `workflow_dispatch` on `main`).

Without this repository setting, the build and artifact upload can succeed while `deploy-pages` fails with HTTP 404. A successful build is not evidence that Pages is enabled. Repository administration is required to change this setting; workflow code cannot enable it.

## Workflows

- `.github/workflows/site-ci.yml` runs on pull requests and branch pushes. It installs build dependencies, runs the catalog/link and progress regressions, and builds a base-path deployment preview. It does not deploy.
- `.github/workflows/pages.yml` builds and uploads the Pages artifact on `main` or manual dispatch, then deploys only from `main`. The `pages` concurrency group cancels an older deployment when a newer one starts.
- `.github/workflows/kubernetes-labs.yml` validates manifests and runs the isolated kind smoke test when Kubernetes lab sources change.

The site build uses the repository name as the base path for GitHub Project Pages. `site-url` configures canonical host URLs and sitemap entries. Public article and topic routes remain rooted beneath the configured base path at deploy time.

## Contributor workflow

Work on a branch, push that branch, and open a pull request to `main`. Site validation and applicable Kubernetes checks run before review. Do not push repair work directly to `main`; deployment is a separate workflow triggered from `main` after merge.

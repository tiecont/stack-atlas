# Native Next.js migration map

This document records the pre-migration behavior inventory and its TypeScript
replacement.

| Existing capability                                                    | Native replacement                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| YAML parsing and catalog assembly in `platform/stack_atlas/catalog.py` | `lib/content/loader.ts`, using `yaml` and Node filesystem reads                                                                   |
| Python models and metadata checks                                      | Explicit types in `lib/content/types.ts` and rules in `lib/content/validation.ts`                                                 |
| HTML template rendering for home, article, topic and path pages        | App Router pages and React Server Components in `app/` and `features/content/components/`                                         |
| Article fragments and generated table of contents                      | `parse5` analysis plus allowlisted React rendering in `lib/content/html.ts` and `features/content/components/article-content.tsx` |
| Repository, graph, local link and fragment checks                      | `npm run content:validate`                                                                                                        |
| Generated lesson and season-index redirects                            | Catalog-derived permanent redirects in `next.config.ts`                                                                           |
| Python search index JSON                                               | Server-side TypeScript search in `lib/content/search.ts` and `app/api/search/route.ts`                                            |
| Generated sitemap and robots files                                     | `app/sitemap.ts` and `app/robots.ts`                                                                                              |
| Generated asset copies                                                 | Next-owned `app/globals.css`, `app/site.css`, `app/tokens.css`, and `app/icon.svg`                                                |
| `site.js`, path-context, and progress scripts                          | Feature-scoped React search/progress, theme/menu interactions, and server-derived path navigation                                 |
| Duplicated browser API client                                          | Single `lib/api/client.ts` and shared Problem Details handling                                                                    |
| Python platform regressions                                            | Node test-runner checks under `tests/*.test.mjs`                                                                                  |
| Python duplicate-content audit                                         | `scripts/audit-duplicates.ts` and `npm run audit:content`                                                                         |
| Copied lab/example files                                               | Secure Next route handlers under `app/labs/`, `app/examples/`, and `app/tests/`                                                   |

The inventory covered 346 article records and HTML fragments, 19 topics, 23
categories, two learning paths with 25 modules (24 in Golang Backend), 341
lesson aliases and 24 season-index aliases. Article IDs, canonical URLs,
relationships, ordering and authored bodies remain in Git.

The remaining Python utility is `scripts/ci/validate_kubernetes_manifests.py`.
It validates standalone Kubernetes lab manifests and runs only in the separate
Kubernetes lab workflow with PyYAML. It is not used by Web development,
validation, tests or builds.

GitHub Pages cannot run Next.js route handlers or HTTP redirects. Its deploy
workflow was removed; the app now requires a Node-capable host.

# Legacy URL compatibility

Historical lesson and season-index routes remain available as generated redirects in `dist/`. No season directories or copied season pages remain in the repository source tree.

## Lesson URL ownership

Each canonical article stores its historical lesson paths in `legacy_urls`:

```yaml
legacy_urls:
  - /season-03-concurrency/01-goroutine.html
```

The builder emits one redirect file per declared route. It validates exact equality between metadata aliases and generated lesson routes, then checks that each redirect targets an existing canonical article. Redirects preserve query strings and fragments in browser navigation.

## Season index URLs

The builder groups legacy lesson aliases by season and matches each group to the learning-path module containing those articles. It emits the old `/season-*/index.html` route as a redirect to that module anchor. The generated path module has a stable `module-<id>` fragment.

The verified inventory contains 341 lesson aliases and 24 season index routes. The complete route-to-canonical map is recorded in `docs/audits/legacy-url-inventory.md`.

## No legacy content reader

Normal builds read only canonical YAML metadata and article HTML folders. They do not scrape, copy, or discover content from season pages. Do not move old directories into an archive; keep routing data on canonical articles.

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

Each path module lists its historical season-index URLs in `legacy_index_urls`. The builder emits those routes directly as redirects to the declared module's stable `module-<id>` fragment; lesson memberships are not used to infer the mapping.

The verified inventory contains 341 lesson aliases and 24 season index routes. The complete route-to-canonical map is recorded in `docs/audits/legacy-url-inventory.md`.

## No legacy content reader

Normal builds read only canonical YAML metadata and article HTML folders. They do not scrape, copy, or discover content from season pages. Do not move old directories into an archive; keep routing data on canonical articles.

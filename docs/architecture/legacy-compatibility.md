# Legacy URL compatibility

Historical lesson and season-index routes remain available as permanent
redirects declared by `next.config.ts`. Next derives them from canonical
`legacy_urls` and path-module `legacy_index_urls`; there are no copied redirect
pages or season directories in the app.

## Lesson URLs

Each canonical article stores its historical lesson paths in `legacy_urls`:

```yaml
legacy_urls:
  - /season-03-concurrency/01-goroutine.html
```

The TypeScript validator requires unique routes, valid canonical targets, and
no redirect chains. Next serves the redirects as HTTP permanent redirects.

## Season index URLs

Each path module may list its historical season-index URLs in
`legacy_index_urls`. Next redirects those routes to the owning path's stable
`module-<id>` fragment; lesson membership is not used to infer the mapping.

The verified inventory contains 341 lesson aliases and 24 season index routes.
The complete route-to-canonical map is recorded in
`docs/audits/legacy-url-inventory.md`.

The loader reads only canonical YAML metadata and article HTML fragments. It
does not scrape or copy content from historical season pages.

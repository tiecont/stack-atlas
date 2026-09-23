# Legacy URL compatibility

Season directories are retained to keep historical links working. They are not canonical content and are not consulted by normal catalog discovery, article ordering, topic rendering, path rendering, or search generation.

## Canonical ownership

Every migrated lesson has canonical article metadata under `content/articles/`. Its metadata lists historical lesson paths in `legacy_urls`, for example:

```json
{
  "legacy_urls": [
    "/season-03-concurrency/01-goroutine.html"
  ]
}
```

The generator emits a small redirect page at every listed path. Redirects target the canonical article and preserve query strings and fragments in browser navigation. The catalog rejects malformed aliases and aliases assigned to multiple articles.

The renderer also copies the static season directories into a separately selected output such as `_site` so historic season index routes remain available. It does not parse those indexes; they contain no catalog or ordering authority. Generated article redirects replace corresponding copied lesson pages. Canonical discovery comes only from article, domain, category, and path metadata.

## Migration tooling

`scripts/migrate_legacy_batch.py` is an explicit one-time migration aid. It may read old season HTML to extract a selected batch, then writes canonical article sources/metadata and path `article_ids` while retaining every historical lesson URL. Normal site builds do not call the migration parser.

When consolidating lessons, first preserve all useful material, path memberships, and historical URLs in the retained canonical article. Do not remove a legacy alias until a deliberate redirect destination has been verified. Existing public canonical URLs and IDs are stable compatibility interfaces.

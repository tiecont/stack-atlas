# Article metadata

New articles can be registered here as one JSON file per article. Migrated articles use the same metadata model and shared page layout; unmigrated season HTML remains indexed through a legacy adapter.

An article record has this shape:

```json
{
  "id": "postgres-connection-pools",
  "title": "Why PostgreSQL Connection Pools Fail Under Load",
  "description": "How pool saturation affects latency and throughput.",
  "type": "article",
  "domain": "postgresql",
  "category": "performance",
  "tags": ["postgresql", "performance", "pooling"],
  "difficulty": "intermediate",
  "learning_paths": [],
  "prerequisites": [],
  "related": [],
  "status": "published",
  "url": "/articles/postgresql/connection-pools/",
  "source": "content/articles/postgresql/connection-pools.html",
  "authors": ["tiecont"]
}
```

`source` points to an HTML fragment, not a full page. The generator wraps it in the shared article layout and writes it to `url`. `learning_paths` is a list, so a canonical article can appear in several routes or in none. Use membership objects with `path_id`, `module_id` and `order` when placing the article in a route. Keep article content in one source file; paths only reference its ID. `category` may be omitted for standalone articles. Migrated records include `legacy_url` during the compatibility period; the build generates a redirect there and preserves the canonical article ID so saved progress survives the move. Version-sensitive content can record `review.kubernetes_baseline` and `review.last_reviewed`; lab directories are linked from the optional `labs` field.

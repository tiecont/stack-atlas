# Article source layout

Each article lives in a domain and slug folder:

```text
content/articles/<domain>/<slug>/
├── article.yaml
└── article.html
```

The YAML record owns identity, title, canonical route, domain, relationships, path memberships and historical lesson URLs. The adjacent HTML file contains only the article body fragment. The catalog derives the body path from the folder; generated pages are written to ignored `dist/articles/`.

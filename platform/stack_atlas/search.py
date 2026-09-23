"""Build the deterministic JSON payload used by client-side search and navigation."""

from stack_atlas.catalog import ordered_modules


def build_search_index(domains: list[dict], paths: list[dict], articles: list[dict]) -> dict:
    search_domains = [
        {
            "id": domain["id"],
            "title": domain["title"],
            "description": domain["description"],
            "status": domain.get("status"),
            "url": f"/topics/{domain['id']}/",
        }
        for domain in domains
    ]
    search_paths = []
    for path in paths:
        search_paths.append(
            {
                "id": path["id"],
                "title": path["title"],
                "description": path["description"],
                "status": path.get("status"),
                "url": f"/paths/{path['id']}/",
                "modules": [
                    {
                        "id": module["id"],
                        "title": module["title"],
                        "order": module["order"],
                        "article_ids": [article["id"] for article in module.get("articles", [])],
                    }
                    for module in ordered_modules(path)
                ],
            }
        )
    return {"articles": articles, "domains": search_domains, "paths": search_paths}

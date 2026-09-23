#!/usr/bin/env python3
"""Search-index output stays deterministic and follows path-owned order."""

import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "platform"))
from stack_atlas.catalog import read_yaml  # noqa: E402
from stack_atlas.search import build_search_index  # noqa: E402


class SearchIndexTests(unittest.TestCase):
    def test_paths_and_articles_keep_their_declared_order(self):
        domains = [{"id": "demo", "title": "Demo", "description": "A demo"}]
        articles = [{"id": "first", "title": "First"}, {"id": "second", "title": "Second"}]
        path = {
            "id": "demo-path", "title": "Demo path", "description": "A route",
            "modules": [
                {"id": "later", "title": "Later", "order": 2, "articles": [articles[1]]},
                {"id": "earlier", "title": "Earlier", "order": 1, "articles": [articles[0]]},
            ],
        }
        index = build_search_index(domains, [path], articles)
        modules = index["paths"][0]["modules"]
        self.assertEqual([module["id"] for module in modules], ["earlier", "later"])
        self.assertEqual([module["article_ids"][0] for module in modules], ["first", "second"])
        self.assertEqual(json.dumps(index, sort_keys=True), json.dumps(build_search_index(domains, [path], articles), sort_keys=True))

    def test_search_index_serializes_unquoted_yaml_dates(self):
        with tempfile.TemporaryDirectory() as directory:
            article_file = Path(directory) / "article.yaml"
            article_file.write_text(
                "id: dated-article\n"
                "title: Dated article\n"
                "description: Uses ordinary ISO date scalars\n"
                "created_at: 2026-09-20\n"
                "updated_at: 2026-09-23\n"
                "review:\n"
                "  last_reviewed: 2026-09-23\n",
                encoding="utf-8",
            )
            article = read_yaml(article_file)

        index = build_search_index([], [], [article])
        encoded = json.dumps(index)
        self.assertIn('"created_at": "2026-09-20"', encoded)
        self.assertIn('"last_reviewed": "2026-09-23"', encoded)


if __name__ == "__main__":
    unittest.main()

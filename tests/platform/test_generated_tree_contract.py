#!/usr/bin/env python3
"""The build artifact contains public pages and compatibility routes."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.catalog import make_catalog, read_yaml  # noqa: E402
from stack_atlas.links import validate_internal_links  # noqa: E402
from stack_atlas.redirects import validate_legacy_redirects  # noqa: E402
from stack_atlas.render import render_site  # noqa: E402


class GeneratedTreeContractTests(unittest.TestCase):
    def test_public_knowledge_experiences_render_their_expected_entry_points(self):
        domains, categories, paths, articles, errors = make_catalog()
        self.assertEqual(errors, [])
        populated_topic = next(
            domain for domain in domains
            if any(article.get("domain") == domain["id"] for article in articles)
        )
        representative_article = next(
            article for article in articles
            if article.get("domain") == populated_topic["id"]
        )
        learning_path = paths[0]

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_site(domains, categories, paths, articles, output, read_yaml(ROOT / "content/site.yaml"))
            home = (output / "index.html").read_text(encoding="utf-8")
            topic_index = (output / "topics/index.html").read_text(encoding="utf-8")
            topic = (output / f"topics/{populated_topic['id']}/index.html").read_text(encoding="utf-8")
            article = (output / f"{representative_article['url'].strip('/')}/index.html").read_text(encoding="utf-8")
            path_index = (output / "paths/index.html").read_text(encoding="utf-8")
            path = (output / f"paths/{learning_path['id']}/index.html").read_text(encoding="utf-8")

        self.assertIn('id="topics"', home)
        self.assertIn("Learning paths", home)
        self.assertIn("Recently Updated", home)
        self.assertIn("data-continue-learning", home)
        self.assertIn("<h1>Topics</h1>", topic_index)
        self.assertIn(populated_topic["title"], topic)
        self.assertIn(representative_article["title"], topic)
        self.assertIn(f'data-article-id="{representative_article["id"]}"', article)
        self.assertIn(f'data-progress-toggle="{representative_article["id"]}"', article)
        self.assertIn("<h1>Learning Paths</h1>", path_index)
        self.assertIn(f'data-progress-path="{learning_path["id"]}"', path)
        self.assertIn("data-article-id=", path)

    def test_build_contains_static_routes_and_compatibility_redirects(self):
        domains, categories, paths, articles, errors = make_catalog()
        self.assertEqual(errors, [])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_site(domains, categories, paths, articles, output, read_yaml(ROOT / "content/site.yaml"))
            for route in (
                "index.html", "articles", "topics", "paths", "assets/site.css", "assets/tokens.css",
                "assets/site.js", "assets/api-client.js", "assets/progress-store.js", "assets/path-context.js",
                "assets/favicon.svg", "search-index.json", "sitemap.xml", "robots.txt",
            ):
                self.assertTrue((output / route).exists(), route)
            self.assertTrue((output / "season-03-concurrency/01-goroutine.html").is_file())
            self.assertTrue((output / "season-03-concurrency/index.html").is_file())
            self.assertEqual(validate_legacy_redirects(articles, paths, output), [])
            link_errors, _ = validate_internal_links(output)
            self.assertEqual(link_errors, [])


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Check that path pages and article navigation follow path metadata order."""

from copy import deepcopy
from pathlib import Path
import re
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.catalog import make_catalog, path_sequence, read_yaml  # noqa: E402
from stack_atlas.render import render_site  # noqa: E402
from stack_atlas.templates import module_block, render_modern_article  # noqa: E402


class PathOrderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        domains, categories, paths, articles, errors = make_catalog()
        if errors:
            raise AssertionError("\n".join(errors))
        cls.domains = domains
        cls.categories = categories
        cls.paths = {path["id"]: path for path in paths}
        cls.articles = {article["id"]: article for article in articles}

    def test_path_page_sequence_matches_module_article_references(self):
        path = self.paths["golang-backend"]
        expected = [article["id"] for _, article in path_sequence(path)]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_site(self.domains, self.categories, list(self.paths.values()), list(self.articles.values()), output,
                        read_yaml(ROOT / "content/site.yaml"))
            page = (output / "paths/golang-backend/index.html").read_text(encoding="utf-8")
        actual = re.findall(r'data-article-id="([^"]+)"', page)
        self.assertEqual(actual, expected)

    def test_flattened_sequence_is_stable_when_modules_are_reordered(self):
        path = deepcopy(self.paths["golang-backend"])
        expected = [article["id"] for _, article in path_sequence(path)]
        path["modules"].reverse()
        actual = [article["id"] for _, article in path_sequence(path)]
        self.assertEqual(actual, expected)

    def test_canonical_shared_article_starts_path_neutral(self):
        article = self.articles["season-19-kubernetes-for-go-backend-01-kubernetes-mental-model"]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_modern_article(article, self.articles, list(self.paths.values()), output, {"name": "Stack Atlas"}, "")
            page = (output / article["url"].strip("/") / "index.html").read_text(encoding="utf-8")
        self.assertIn("Appears in", page)
        self.assertIn("Golang Backend Engineering", page)
        self.assertIn("Kubernetes Engineer", page)
        self.assertNotIn("Part of Golang Backend Engineering", page)
        self.assertNotIn("data-path-navigation", page)
        self.assertNotIn("article-previous-next", page)

    def test_path_page_links_article_with_selected_context(self):
        path_id = "golang-backend"
        shared_id = "season-19-kubernetes-for-go-backend-01-kubernetes-mental-model"
        path = self.paths[path_id]
        module = next(item for item in path["modules"] if shared_id in item["article_ids"])
        rendered = module_block(module, path_id, "")
        self.assertIn(self.articles[shared_id]["url"] + "?path=" + path_id, rendered)


if __name__ == "__main__":
    unittest.main()

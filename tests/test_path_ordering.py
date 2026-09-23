#!/usr/bin/env python3
"""Check that path pages and article navigation follow path metadata order."""

from copy import deepcopy
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_site  # noqa: E402


class PathOrderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, _, paths, articles, errors = build_site.make_catalog()
        if errors:
            raise AssertionError("\n".join(errors))
        cls.paths = {path["id"]: path for path in paths}
        cls.articles = {article["id"]: article for article in articles}

    def test_path_page_sequence_matches_module_article_references(self):
        path = self.paths["golang-backend"]
        expected = [article["id"] for _, article in build_site.path_sequence(path)]
        page = (build_site.ROOT / "paths/golang-backend/index.html").read_text(encoding="utf-8")
        actual = re.findall(r'data-article-id="([^"]+)"', page)
        self.assertEqual(actual, expected)

    def test_flattened_sequence_is_stable_when_modules_are_reordered(self):
        path = deepcopy(self.paths["golang-backend"])
        expected = [article["id"] for _, article in build_site.path_sequence(path)]
        path["modules"].reverse()
        actual = [article["id"] for _, article in build_site.path_sequence(path)]
        self.assertEqual(actual, expected)

    def test_previous_and_next_follow_the_same_flattened_sequence(self):
        path_id = "golang-backend"
        sequence = [article for _, article in build_site.path_sequence(self.paths[path_id])]
        position = 100
        article = sequence[position]
        page_path = build_site.ROOT / article["url"].strip("/") / "index.html"
        page = page_path.read_text(encoding="utf-8")
        self.assertIn(sequence[position - 1]["url"] + "?path=" + path_id, page)
        self.assertIn(sequence[position + 1]["url"] + "?path=" + path_id, page)


if __name__ == "__main__":
    unittest.main()

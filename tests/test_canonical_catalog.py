#!/usr/bin/env python3
"""Regression checks for season-independent canonical catalog loading."""

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_site  # noqa: E402


class CanonicalCatalogTests(unittest.TestCase):
    def test_catalog_does_not_read_legacy_season_indexes(self):
        original_read_text = Path.read_text

        def reject_season_index(path, *args, **kwargs):
            if path.name == "index.html" and path.parent.name.startswith("season-"):
                raise AssertionError(f"canonical catalog read {path}")
            return original_read_text(path, *args, **kwargs)

        with patch.object(Path, "read_text", reject_season_index):
            domains, categories, paths, articles, errors = build_site.make_catalog()

        self.assertFalse(errors, "\n".join(errors))
        self.assertTrue(domains)
        self.assertTrue(categories)
        self.assertEqual(len(paths[0]["modules"]), 24)
        self.assertEqual(sum(len(module["article_ids"]) for module in paths[0]["modules"]), 341)
        self.assertEqual(len(articles), 346)

    def test_every_legacy_url_is_generated_as_a_redirect(self):
        _, _, _, articles, errors = build_site.make_catalog()
        self.assertFalse(errors, "\n".join(errors))
        for article in articles:
            for legacy_url in article.get("legacy_urls", []):
                redirect = build_site.ROOT / legacy_url.lstrip("/")
                self.assertTrue(redirect.is_file(), legacy_url)
                self.assertIn(article["url"], redirect.read_text(encoding="utf-8"), legacy_url)


if __name__ == "__main__":
    unittest.main()

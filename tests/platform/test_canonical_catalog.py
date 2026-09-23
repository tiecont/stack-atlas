#!/usr/bin/env python3
"""Canonical catalog loading does not depend on legacy season HTML."""

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.catalog import make_catalog  # noqa: E402


class CanonicalCatalogTests(unittest.TestCase):
    def test_catalog_does_not_read_legacy_season_indexes(self):
        original_read_text = Path.read_text

        def reject_season_index(path, *args, **kwargs):
            if path.name == "index.html" and path.parent.name.startswith("season-"):
                raise AssertionError(f"canonical catalog read {path}")
            return original_read_text(path, *args, **kwargs)

        with patch.object(Path, "read_text", reject_season_index):
            domains, categories, paths, articles, errors = make_catalog()

        self.assertFalse(errors, "\n".join(errors))
        self.assertTrue(domains)
        self.assertTrue(categories)
        self.assertEqual(len(paths[0]["modules"]), 24)
        self.assertEqual(sum(len(module["article_ids"]) for module in paths[0]["modules"]), 341)
        self.assertEqual(len(articles), 346)
        self.assertTrue(all(Path(article["metadata_file"]).name == "article.yaml" for article in articles))


if __name__ == "__main__":
    unittest.main()

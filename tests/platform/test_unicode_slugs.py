#!/usr/bin/env python3
"""Readable heading anchors normalize Unicode and disambiguate duplicates."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.templates import article_body  # noqa: E402


class UnicodeSlugTests(unittest.TestCase):
    def test_vietnamese_heading_slug_is_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "article.html"
            source.write_text("<h2>Sau bài này, bạn có thể</h2>", encoding="utf-8")
            body, headings = article_body(source)
        self.assertEqual(headings[0]["id"], "sau-bai-nay-ban-co-the")
        self.assertIn('id="sau-bai-nay-ban-co-the"', body)

    def test_duplicate_headings_receive_stable_numeric_suffixes(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "article.html"
            source.write_text("<h2>Production notes</h2><h3>Production notes</h3><h2>Production notes</h2>", encoding="utf-8")
            _, headings = article_body(source)
        self.assertEqual([item["id"] for item in headings], ["production-notes", "production-notes-2", "production-notes-3"])


if __name__ == "__main__":
    unittest.main()

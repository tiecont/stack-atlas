#!/usr/bin/env python3
"""Legacy URL compatibility rendering tests."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from stack_atlas.catalog import make_catalog, read_json  # noqa: E402
from stack_atlas.templates import render_modern_article  # noqa: E402


class LegacyRedirectTests(unittest.TestCase):
    def test_all_declared_aliases_redirect_to_the_canonical_article(self):
        _, _, paths, articles, errors = make_catalog()
        self.assertFalse(errors, "\n".join(errors))
        article = next(item for item in articles if item.get("legacy_urls"))
        article["legacy_urls"] = [*article["legacy_urls"], "/season-01-fundamentals/old-lesson-name.html"]
        article_by_id = {item["id"]: item for item in articles}
        site = read_json(ROOT / "content/site.json")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_modern_article(article, article_by_id, paths, output, site, "")
            for legacy_url in article["legacy_urls"]:
                redirect = output / legacy_url.lstrip("/")
                self.assertTrue(redirect.is_file(), legacy_url)
                html = redirect.read_text(encoding="utf-8")
                self.assertIn(article["url"], html)
                self.assertIn("http-equiv=\"refresh\"", html)


if __name__ == "__main__":
    unittest.main()

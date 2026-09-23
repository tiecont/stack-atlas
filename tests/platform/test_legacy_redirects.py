#!/usr/bin/env python3
"""Legacy URL compatibility rendering tests."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.catalog import make_catalog, read_yaml  # noqa: E402
from stack_atlas.redirects import build_legacy_redirects, validate_legacy_redirects  # noqa: E402
from stack_atlas.render import render_site  # noqa: E402


class LegacyRedirectTests(unittest.TestCase):
    def test_every_declared_lesson_route_and_season_index_is_generated(self):
        domains, categories, paths, articles, errors = make_catalog()
        self.assertFalse(errors, "\n".join(errors))
        site = read_yaml(ROOT / "content/site.yaml")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_site(domains, categories, paths, articles, output, site)
            lesson_redirects, index_redirects = build_legacy_redirects(articles, paths)
            errors = validate_legacy_redirects(articles, paths, output)
            self.assertEqual(errors, [])
            self.assertEqual(len(lesson_redirects), 341)
            self.assertEqual(len(index_redirects), 24)
            for redirect in lesson_redirects:
                page = (output / redirect.route.lstrip("/")).read_text(encoding="utf-8")
                self.assertIn('data-legacy-redirect="lesson"', page)
                self.assertIn(redirect.target, page)
            for redirect in index_redirects:
                page = (output / redirect.route.lstrip("/")).read_text(encoding="utf-8")
                self.assertIn('data-legacy-redirect="season-index"', page)
                self.assertIn(redirect.target, page)


if __name__ == "__main__":
    unittest.main()

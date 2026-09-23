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
            inventory = {}
            for line in (ROOT / "docs/audits/legacy-url-inventory.md").read_text(encoding="utf-8").splitlines():
                if line.startswith("## Lesson route inventory"):
                    break
                if line.startswith("| `/season-"):
                    route, target = [cell.strip().strip("`") for cell in line.split("|")[1:3]]
                    inventory[route] = target
            self.assertEqual({item.route: item.target for item in index_redirects}, inventory)
            concurrency = next(item for item in index_redirects if item.route == "/season-03-concurrency/index.html")
            self.assertEqual(concurrency.target, "/paths/golang-backend/#module-go-concurrency")
            for redirect in lesson_redirects:
                page = (output / redirect.route.lstrip("/")).read_text(encoding="utf-8")
                self.assertIn('data-legacy-redirect="lesson"', page)
                self.assertIn(redirect.target, page)
            for redirect in index_redirects:
                page = (output / redirect.route.lstrip("/")).read_text(encoding="utf-8")
                self.assertIn('data-legacy-redirect="season-index"', page)
                self.assertIn(redirect.target, page)

    def test_index_redirect_uses_explicit_module_metadata(self):
        articles = [{
            "id": "lesson-a",
            "url": "/articles/demo/lesson-a/",
            "legacy_urls": ["/season-01-old/01-lesson.html"],
        }]
        paths = [{
            "id": "demo-path",
            "modules": [{
                "id": "expanded-module",
                "article_ids": ["lesson-a", "new-lesson"],
                "legacy_index_urls": ["/season-01-old/index.html"],
            }],
        }]
        lessons, indexes = build_legacy_redirects(articles, paths)
        self.assertEqual(len(lessons), 1)
        self.assertEqual(indexes[0].route, "/season-01-old/index.html")
        self.assertEqual(indexes[0].target, "/paths/demo-path/#module-expanded-module")

    def test_duplicate_legacy_index_alias_is_rejected(self):
        path = {
            "id": "demo-path",
            "modules": [
                {"id": "first", "legacy_index_urls": ["/season-01-old/index.html"]},
                {"id": "second", "legacy_index_urls": ["/season-01-old/index.html"]},
            ],
        }
        with self.assertRaisesRegex(ValueError, "Duplicate legacy season-index URL"):
            build_legacy_redirects([], [path])

    def test_invalid_legacy_index_aliases_are_rejected(self):
        for route in (
            "/season-01-old/../index.html",
            "/archive/season-01-old/index.html",
            "season-01-old/index.html",
            "/season-01-old/index.html?next=/",
        ):
            with self.subTest(route=route), self.assertRaisesRegex(ValueError, "Invalid or unsafe season index URL"):
                build_legacy_redirects([], [{
                    "id": "demo-path",
                    "modules": [{"id": "module", "legacy_index_urls": [route]}],
                }])

    def test_index_alias_requires_valid_module_and_target_ids(self):
        route = "/season-01-old/index.html"
        with self.assertRaisesRegex(ValueError, "missing its module ID"):
            build_legacy_redirects([], [{"id": "demo-path", "modules": [{"legacy_index_urls": [route]}]}])
        with self.assertRaisesRegex(ValueError, "Invalid legacy index redirect target path ID"):
            build_legacy_redirects([], [{"id": "../escape", "modules": [{"id": "module", "legacy_index_urls": [route]}]}])
        with self.assertRaisesRegex(ValueError, "Invalid legacy index redirect target module ID"):
            build_legacy_redirects([], [{"id": "demo-path", "modules": [{"id": "bad/module", "legacy_index_urls": [route]}]}])


if __name__ == "__main__":
    unittest.main()

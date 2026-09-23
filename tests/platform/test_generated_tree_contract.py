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
    def test_build_contains_static_routes_and_compatibility_redirects(self):
        domains, categories, paths, articles, errors = make_catalog()
        self.assertEqual(errors, [])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_site(domains, categories, paths, articles, output, read_yaml(ROOT / "content/site.yaml"))
            for route in (
                "index.html", "articles", "topics", "paths", "assets/site.css",
                "assets/site.js", "assets/progress-store.js", "assets/path-context.js",
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

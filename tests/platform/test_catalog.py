#!/usr/bin/env python3
"""Catalog metadata validation regressions."""

from pathlib import Path
import json
import sys
import tempfile
import unittest
from unittest.mock import patch

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas import catalog  # noqa: E402


class CatalogValidationTests(unittest.TestCase):
    def load_fixture(self, root: Path, *, duplicate_id=False, unknown_domain=False, unknown_path_article=False,
                     duplicate_placement=False, invalid_date=False):
        content = root / "content"
        (content / "articles/demo/one").mkdir(parents=True)
        (content / "domains").mkdir()
        (content / "paths").mkdir()
        (content / "domains/demo.yaml").write_text(yaml.safe_dump({
            "id": "demo", "title": "Demo", "description": "Demo domain"
        }))
        (content / "categories.yaml").write_text(yaml.safe_dump([{"id": "basics", "title": "Basics"}]))
        (content / "articles/demo/one/article.html").write_text("<h2>One</h2>")
        article = {
            "id": "demo-one", "title": "One", "description": "First article",
            "type": "article", "domain": "missing" if unknown_domain else "demo",
            "category": "basics", "learning_paths": [{"path_id": "demo-path", "module_id": "first"}],
            "prerequisites": [], "related": [], "status": "published",
            "url": "/articles/demo/one/",
        }
        if invalid_date:
            article["created_at"] = 20260920
        (content / "articles/demo/one/article.yaml").write_text(yaml.safe_dump(article))
        modules = [{"id": "first", "title": "First", "order": 1, "domain": "demo",
                    "category": "basics", "article_ids": ["not-found"] if unknown_path_article else ["demo-one"]}]
        if duplicate_placement:
            modules.append({"id": "second", "title": "Second", "order": 2, "domain": "demo",
                            "category": "basics", "article_ids": ["demo-one"]})
        path = {"id": "demo-path", "title": "Demo path", "description": "A test path",
                "status": "published", "modules": modules}
        (content / "paths/demo-path.yaml").write_text(yaml.safe_dump(path))
        if duplicate_id:
            duplicate = dict(article, title="Duplicate one", url="/articles/demo/duplicate/")
            (content / "articles/demo/two").mkdir()
            (content / "articles/demo/two/article.html").write_text("<h2>Two</h2>")
            (content / "articles/demo/two/article.yaml").write_text(yaml.safe_dump(duplicate))

    def catalog_result(self, **options):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.load_fixture(root, **options)
            with patch.object(catalog, "ROOT", root), patch.object(catalog, "CONTENT", root / "content"):
                return catalog.make_catalog()

    def catalog_errors(self, **options):
        return self.catalog_result(**options)[-1]

    def test_duplicate_article_id_is_rejected(self):
        self.assertTrue(any("Duplicate article IDs" in error for error in self.catalog_errors(duplicate_id=True)))

    def test_unknown_domain_is_rejected(self):
        self.assertTrue(any("unknown domain 'missing'" in error for error in self.catalog_errors(unknown_domain=True)))

    def test_unknown_article_reference_is_rejected(self):
        self.assertTrue(any("unknown article 'not-found'" in error for error in self.catalog_errors(unknown_path_article=True)))

    def test_duplicate_path_placement_is_rejected(self):
        self.assertTrue(any("placed more than once" in error for error in self.catalog_errors(duplicate_placement=True)))

    def test_unquoted_yaml_dates_normalize_to_json_safe_iso_strings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.load_fixture(root)
            article_file = root / "content/articles/demo/one/article.yaml"
            article_file.write_text(
                "id: demo-one\n"
                "title: One\n"
                "description: First article\n"
                "type: article\n"
                "domain: demo\n"
                "category: basics\n"
                "learning_paths:\n"
                "  - path_id: demo-path\n"
                "    module_id: first\n"
                "prerequisites: []\n"
                "related: []\n"
                "status: published\n"
                "url: /articles/demo/one/\n"
                "created_at: 2026-09-20\n"
                "updated_at: 2026-09-23\n"
                "review:\n"
                "  last_reviewed: 2026-09-23\n"
                "custom_metadata:\n"
                "  nested:\n"
                "    reviewed_at: 2026-09-24T11:15:00Z\n"
                "  dates:\n"
                "    - 2026-09-25\n",
                encoding="utf-8",
            )
            with patch.object(catalog, "ROOT", root), patch.object(catalog, "CONTENT", root / "content"):
                domains, categories, paths, articles, errors = catalog.make_catalog()

        self.assertEqual(errors, [])
        article = articles[0]
        self.assertEqual(article["created_at"], "2026-09-20")
        self.assertEqual(article["updated_at"], "2026-09-23")
        self.assertEqual(article["review"]["last_reviewed"], "2026-09-23")
        self.assertEqual(article["custom_metadata"]["nested"]["reviewed_at"], "2026-09-24T11:15:00+00:00")
        self.assertEqual(article["custom_metadata"]["dates"], ["2026-09-25"])
        json.dumps(article)

    def test_date_fields_must_be_iso_date_strings(self):
        self.assertTrue(any(
            "created_at must use YYYY-MM-DD" in error
            for error in self.catalog_errors(invalid_date=True)
        ))


if __name__ == "__main__":
    unittest.main()

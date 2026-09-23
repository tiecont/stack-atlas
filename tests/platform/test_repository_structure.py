#!/usr/bin/env python3
"""Repository V2 source/output layout invariants."""

from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))
from stack_atlas.validate import validate_catalog, validate_repository_structure  # noqa: E402


class RepositoryStructureTests(unittest.TestCase):
    def test_no_legacy_season_directories_exist_at_root(self):
        self.assertEqual(list(ROOT.glob("season-*")), [])

    def test_no_generated_website_files_are_source_control_candidates(self):
        self.assertEqual(validate_repository_structure(ROOT), [])

    def test_dist_is_ignored_and_never_tracked(self):
        ignore_rules = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("dist/", ignore_rules)
        tracked = subprocess.run(
            ["git", "ls-files", "--", "dist/"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(tracked.stdout.strip(), "")

    def test_catalog_uses_folder_articles_and_yaml_metadata(self):
        domains, categories, paths, articles, errors = validate_catalog()
        self.assertEqual(errors, [])
        self.assertEqual((len(domains), len(categories), len(paths), len(articles)), (19, 23, 2, 346))
        for article in articles:
            metadata = ROOT / article["metadata_file"]
            self.assertEqual(metadata.name, "article.yaml")
            self.assertEqual(metadata.parent / "article.html", ROOT / article["source"])
        self.assertTrue((ROOT / "content/categories.yaml").is_file())
        self.assertTrue((ROOT / "content/site.yaml").is_file())


if __name__ == "__main__":
    unittest.main()

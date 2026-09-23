#!/usr/bin/env python3
"""Local URL, base-path, and fragment validation tests."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from stack_atlas.links import validate_internal_links  # noqa: E402


class LinkValidationTests(unittest.TestCase):
    def test_base_path_routes_and_fragments_resolve(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "topics/demo").mkdir(parents=True)
            (root / "assets").mkdir()
            (root / "assets/site.js").write_text("// asset")
            (root / "index.html").write_text('<a href="/stack-atlas/topics/demo/#details">Open</a><script src="/stack-atlas/assets/site.js"></script>')
            (root / "topics/demo/index.html").write_text('<section id="details"></section>')
            errors, _ = validate_internal_links(root, "/stack-atlas")
        self.assertEqual(errors, [])

    def test_missing_fragment_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "topics/demo").mkdir(parents=True)
            (root / "index.html").write_text('<a href="/topics/demo/#missing">Open</a>')
            (root / "topics/demo/index.html").write_text("<section></section>")
            errors, _ = validate_internal_links(root)
        self.assertTrue(any("missing fragment 'missing'" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

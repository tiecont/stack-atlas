#!/usr/bin/env python3
"""Two equivalent static builds produce byte-identical output trees."""

import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


class BuildDeterminismTests(unittest.TestCase):
    def test_repeated_base_path_builds_match(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outputs = [root / "first", root / "second"]
            for output in outputs:
                subprocess.run(
                    [sys.executable, str(ROOT / "scripts/build_site.py"), "--output", str(output), "--base-path", "/stack-atlas"],
                    cwd=ROOT,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
            self.assertEqual(tree_hash(outputs[0]), tree_hash(outputs[1]))


if __name__ == "__main__":
    unittest.main()

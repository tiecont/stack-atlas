"""The generated site exposes stable shared design tokens."""

from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DesignTokenTests(unittest.TestCase):
    def test_spacing_typography_and_focus_tokens_are_declared(self):
        tokens = (ROOT / "platform/assets/styles/tokens.css").read_text(encoding="utf-8")
        declared = set(re.findall(r"(--[a-z0-9-]+)\s*:", tokens))
        self.assertTrue(
            {
                "--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8",
                "--font-size-xs", "--font-size-sm", "--font-size-base", "--font-size-lg",
                "--content-readable", "--focus-ring",
            }.issubset(declared)
        )

    def test_shared_template_loads_tokens_before_site_rules(self):
        template = (ROOT / "platform/templates/base.html").read_text(encoding="utf-8")
        self.assertLess(template.index("__TOKENS_CSS_URL__"), template.index("__CSS_URL__"))


if __name__ == "__main__":
    unittest.main()

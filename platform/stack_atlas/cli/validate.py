"""Validate source structure and the canonical content catalog."""

from __future__ import annotations

import sys

from stack_atlas.catalog import ROOT
from stack_atlas.validate import validate_catalog


def main() -> int:
    domains, categories, paths, articles, errors = validate_catalog()
    if errors:
        print("Validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"Validated {len(articles)} article folders, {len(domains)} domains, {len(categories)} categories, and {len(paths)} learning paths.")
    print(f"Repository structure is source-only at {ROOT}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

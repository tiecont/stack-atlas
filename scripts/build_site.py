#!/usr/bin/env python3
"""Orchestrate catalog validation, static rendering and link checks."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from stack_atlas.catalog import CONTENT, ROOT, make_catalog, read_json
from stack_atlas.links import validate_internal_links
from stack_atlas.render import render_site


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=".", help="output directory (default: repository root)")
    parser.add_argument("--base-path", help="URL prefix for project sites, such as /stack-atlas")
    parser.add_argument("--site-url", help="public site origin used for canonical URLs and sitemap")
    parser.add_argument("--skip-link-check", action="store_true", help="skip validation of local HTML links")
    args = parser.parse_args()
    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output
    site = read_json(CONTENT / "site.json")
    if args.base_path is not None:
        site["base_path"] = args.base_path.rstrip("/")
    if args.site_url is not None:
        site["base_url"] = args.site_url.rstrip("/")
    domains, categories, paths, articles, errors = make_catalog()
    if errors:
        print("Content validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    render_site(domains, categories, paths, articles, output, site)
    link_errors = []
    html_count = 0
    if not args.skip_link_check:
        check_root = ROOT if output.resolve() == ROOT.resolve() else output
        link_errors, html_count = validate_internal_links(check_root, site.get("base_path", ""))
    if link_errors:
        print("Internal link validation failed:", file=sys.stderr)
        for error in link_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"✓ {len(articles)} articles")
    print(f"✓ {sum(len(path.get('modules', [])) for path in paths)} modules across {len(paths)} learning path(s)")
    print(f"✓ {len(domains)} domains · {len(categories)} categories")
    print("✓ No duplicate IDs or broken metadata references")
    if not args.skip_link_check:
        print(f"✓ Local links and fragments checked across {html_count} HTML pages")
    print(f"Built static site at {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

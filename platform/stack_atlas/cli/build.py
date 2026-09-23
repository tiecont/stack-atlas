"""Build and validate the Stack Atlas static site in dist/."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from stack_atlas.catalog import CONTENT, ROOT, read_yaml
from stack_atlas.links import validate_internal_links
from stack_atlas.redirects import validate_legacy_redirects
from stack_atlas.render import render_site
from stack_atlas.validate import validate_catalog


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="dist", help="build destination (default: dist)")
    parser.add_argument("--base-path", help="URL prefix for project sites, such as /stack-atlas")
    parser.add_argument("--site-url", help="public site origin used for canonical URLs and sitemap")
    args = parser.parse_args(argv)

    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output
    output = output.resolve()
    if output == ROOT.resolve() or output == CONTENT.resolve() or output.is_relative_to(CONTENT.resolve()):
        print("Build output cannot overwrite repository source.", file=sys.stderr)
        return 2

    domains, categories, paths, articles, errors = validate_catalog()
    if errors:
        print("Content validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    site = read_yaml(CONTENT / "site.yaml")
    if args.base_path is not None:
        site["base_path"] = args.base_path.rstrip("/")
    if args.site_url is not None:
        site["base_url"] = args.site_url.rstrip("/")

    if output == (ROOT / "dist").resolve() and output.exists():
        shutil.rmtree(output)
    render_site(domains, categories, paths, articles, output, site)
    link_errors, html_count = validate_internal_links(output, site.get("base_path", ""))
    redirect_errors = validate_legacy_redirects(articles, paths, output)
    errors = [*link_errors, *redirect_errors]
    if errors:
        print("Generated-site validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    legacy_count = sum(len(article.get("legacy_urls", [])) for article in articles)
    print(f"✓ {len(articles)} articles")
    print(f"✓ {len(paths)} learning paths · {sum(len(path.get('modules', [])) for path in paths)} modules")
    print(f"✓ {legacy_count} legacy lesson redirects")
    print(f"✓ Local links and fragments checked across {html_count} HTML pages")
    print(f"Built static site at {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Generate and validate compatibility redirects for retired public routes."""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from stack_atlas.files import write_file
from stack_atlas.templates import site_url


@dataclass(frozen=True)
class Redirect:
    route: str
    target: str
    kind: str
    article_id: str | None = None


def build_legacy_redirects(articles: list[dict], paths: list[dict]) -> tuple[list[Redirect], list[Redirect]]:
    """Return lesson and explicit season-index redirects from canonical metadata."""
    lesson_redirects = []
    seen_lesson_routes = set()
    for article in articles:
        legacy_urls = article.get("legacy_urls", [])
        if not isinstance(legacy_urls, list):
            raise ValueError(f"{article.get('id', '<unknown>')}: legacy_urls must be a list")
        for route in legacy_urls:
            if not isinstance(route, str):
                raise ValueError(f"Invalid season legacy route: {route!r}")
            if route in seen_lesson_routes:
                raise ValueError(f"Duplicate legacy route: {route}")
            seen_lesson_routes.add(route)
            parsed = urlsplit(route)
            parts = parsed.path.strip("/").split("/")
            if (
                not route.startswith("/")
                or parsed.scheme
                or parsed.netloc
                or parsed.query
                or parsed.fragment
                or parsed.path != route
                or len(parts) != 2
                or not re.fullmatch(r"season-\d{2}-[a-z0-9-]+", parts[0])
                or not parts[1].endswith(".html")
            ):
                raise ValueError(f"Invalid season legacy route: {route}")
            if ".." in parts or "\\" in route:
                raise ValueError(f"Unsafe season legacy route: {route}")
            lesson_redirects.append(Redirect(route, article["url"], "lesson", article["id"]))

    index_redirects = []
    seen_index_routes = set()
    for path in paths:
        path_id = path.get("id")
        for module in path.get("modules", []):
            legacy_index_urls = module.get("legacy_index_urls", [])
            if not isinstance(legacy_index_urls, list):
                raise ValueError(f"{path_id}/{module.get('id', '<unknown>')}: legacy_index_urls must be a list")
            if not legacy_index_urls:
                continue
            module_id = module.get("id")
            if not isinstance(module_id, str) or not module_id:
                raise ValueError(f"{path_id}: module with a legacy index URL is missing its module ID")
            if not isinstance(path_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", path_id):
                raise ValueError(f"Invalid legacy index redirect target path ID: {path_id!r}")
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", module_id):
                raise ValueError(f"Invalid legacy index redirect target module ID: {module_id!r}")
            target = f"/paths/{path_id}/#module-{module_id}"
            target_parts = urlsplit(target)
            if target_parts.path != f"/paths/{path_id}/" or target_parts.fragment != f"module-{module_id}":
                raise ValueError(f"Invalid legacy index redirect target: {target}")
            for route in legacy_index_urls:
                if (
                    not isinstance(route, str)
                    or not re.fullmatch(r"/season-\d{2}-[a-z0-9-]+/index\.html", route)
                    or ".." in route.split("/")
                    or "\\" in route
                ):
                    raise ValueError(f"Invalid or unsafe season index URL: {route!r}")
                if route in seen_index_routes:
                    raise ValueError(f"Duplicate legacy season-index URL: {route}")
                seen_index_routes.add(route)
                index_redirects.append(Redirect(route, target, "season-index"))
    return lesson_redirects, index_redirects


def _redirect_page(target: str, base_path: str, base_url: str, kind: str) -> str:
    target_url = site_url(target, base_path)
    canonical = ""
    if base_url:
        canonical = f'<link rel="canonical" href="{html.escape(base_url.rstrip("/") + target_url, quote=True)}">'
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="robots" content="noindex,follow">'
        f'<meta data-legacy-redirect="{kind}" http-equiv="refresh" content="0;url={html.escape(target_url, quote=True)}">'
        f"{canonical}<title>Page moved · Stack Atlas</title></head><body>"
        f'<p>This page moved to <a href="{html.escape(target_url, quote=True)}">Stack Atlas</a>.</p>'
        f'<script>window.location.replace({json.dumps(target_url)} + window.location.search + window.location.hash);</script>'
        "</body></html>\n"
    )


def render_legacy_redirects(articles: list[dict], paths: list[dict], output: Path, site: dict) -> tuple[list[Redirect], list[Redirect]]:
    lessons, indexes = build_legacy_redirects(articles, paths)
    base_path = site.get("base_path", "").rstrip("/")
    base_url = site.get("base_url", "").rstrip("/")
    for redirect in [*lessons, *indexes]:
        destination = (output / redirect.route.lstrip("/")).resolve()
        if not destination.is_relative_to(output.resolve()):
            raise ValueError(f"Unsafe redirect route: {redirect.route}")
        write_file(destination, _redirect_page(redirect.target, base_path, base_url, redirect.kind))
    return lessons, indexes


class _Ids(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.redirect_kinds = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if attrs.get("data-legacy-redirect"):
            self.redirect_kinds.append(attrs["data-legacy-redirect"])


def validate_legacy_redirects(articles: list[dict], paths: list[dict], output: Path) -> list[str]:
    """Require exact lesson-route coverage and valid lesson/index targets."""
    errors = []
    try:
        lessons, indexes = build_legacy_redirects(articles, paths)
    except ValueError as exc:
        return [str(exc)]
    expected = {redirect.route for redirect in lessons}
    generated_files = {
        "/" + file.relative_to(output).as_posix()
        for season_dir in output.glob("season-*") if season_dir.is_dir()
        for file in season_dir.rglob("*.html")
        if file.name != "index.html"
    }
    if expected != generated_files:
        missing = sorted(expected - generated_files)
        unexpected = sorted(generated_files - expected)
        if missing:
            errors.append("Missing legacy lesson redirects: " + ", ".join(missing[:8]))
        if unexpected:
            errors.append("Unexpected legacy lesson routes: " + ", ".join(unexpected[:8]))

    expected_index_routes = {redirect.route for redirect in indexes}
    generated_index_routes = {
        "/" + file.relative_to(output).as_posix()
        for season_dir in output.glob("season-*") if season_dir.is_dir()
        for file in season_dir.glob("index.html")
    }
    if expected_index_routes != generated_index_routes:
        missing = sorted(expected_index_routes - generated_index_routes)
        unexpected = sorted(generated_index_routes - expected_index_routes)
        if missing:
            errors.append("Missing legacy season-index redirects: " + ", ".join(missing[:8]))
        if unexpected:
            errors.append("Unexpected legacy season-index routes: " + ", ".join(unexpected[:8]))

    article_by_id = {article["id"]: article for article in articles}
    for redirect in lessons:
        file = output / redirect.route.lstrip("/")
        if not file.is_file():
            errors.append(f"Missing generated redirect file {redirect.route}")
            continue
        parser = _Ids()
        parser.feed(file.read_text(encoding="utf-8"))
        if parser.redirect_kinds != ["lesson"]:
            errors.append(f"{redirect.route}: generated file is not marked as a lesson redirect")
        target = urlsplit(redirect.target).path
        target_file = output / target.strip("/") / "index.html"
        if not target_file.is_file():
            errors.append(f"{redirect.route}: target page does not exist: {target}")
        if not redirect.article_id or article_by_id.get(redirect.article_id, {}).get("url") != redirect.target:
            errors.append(f"{redirect.route}: target article identity does not match metadata")

    for redirect in indexes:
        file = output / redirect.route.lstrip("/")
        if not file.is_file():
            errors.append(f"Missing generated season index redirect {redirect.route}")
            continue
        parser = _Ids()
        parser.feed(file.read_text(encoding="utf-8"))
        if parser.redirect_kinds != ["season-index"]:
            errors.append(f"{redirect.route}: generated file is not marked as a season-index redirect")
        parts = urlsplit(redirect.target)
        target_file = output / parts.path.strip("/") / "index.html"
        if not target_file.is_file():
            errors.append(f"{redirect.route}: target page does not exist: {parts.path}")
        elif parts.fragment:
            target_parser = _Ids()
            target_parser.feed(target_file.read_text(encoding="utf-8"))
            if unquote(parts.fragment) not in target_parser.ids:
                errors.append(f"{redirect.route}: target fragment does not exist: {parts.fragment}")
    return errors

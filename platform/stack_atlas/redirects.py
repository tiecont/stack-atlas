"""Generate and validate compatibility redirects for retired public routes."""

from __future__ import annotations

import html
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from stack_atlas.catalog import ROOT
from stack_atlas.files import write_file
from stack_atlas.templates import site_url


@dataclass(frozen=True)
class Redirect:
    route: str
    target: str
    kind: str
    article_id: str | None = None


def build_legacy_redirects(articles: list[dict], paths: list[dict]) -> tuple[list[Redirect], list[Redirect]]:
    """Return lesson redirects and season-index redirects from article metadata."""
    lesson_redirects = []
    article_by_id = {article["id"]: article for article in articles}
    season_articles: dict[str, set[str]] = defaultdict(set)
    seen_routes = set()
    for article in articles:
        for route in article.get("legacy_urls", []):
            if route in seen_routes:
                raise ValueError(f"Duplicate legacy route: {route}")
            seen_routes.add(route)
            parsed = urlsplit(route)
            parts = parsed.path.strip("/").split("/")
            if (
                parsed.query
                or parsed.fragment
                or len(parts) != 2
                or not re.fullmatch(r"season-\d{2}-[a-z0-9-]+", parts[0])
                or not parts[1].endswith(".html")
            ):
                raise ValueError(f"Invalid season legacy route: {route}")
            season_articles[parts[0]].add(article["id"])
            lesson_redirects.append(Redirect(route, article["url"], "lesson", article["id"]))

    path_modules = [(path, module) for path in paths for module in path.get("modules", [])]
    index_redirects = []
    for season, article_ids in sorted(season_articles.items()):
        candidates = [
            (path, module)
            for path, module in path_modules
            if article_ids == set(module.get("article_ids", []))
        ]
        if len(candidates) != 1:
            raise ValueError(f"{season}: expected one learning-path module for its {len(article_ids)} lesson routes, found {len(candidates)}")
        path, module = candidates[0]
        if not module.get("id"):
            raise ValueError(f"{season}: mapped path module has no ID")
        index_redirects.append(Redirect(
            f"/{season}/index.html",
            f"/paths/{path['id']}/#module-{module['id']}",
            "season-index",
        ))
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

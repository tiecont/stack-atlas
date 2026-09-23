#!/usr/bin/env python3
"""Extract selected legacy lesson bodies into canonical article fragments."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

from build_site import ROOT, clean_text, read_json, slug


class CardParser(HTMLParser):
    """Read lesson cards only while explicitly migrating legacy season pages."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.card = None
        self.field = None
        self.cards = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.card is None and tag == "a" and {"card", "lesson"} & set(attrs.get("class", "").split()):
            self.card = {"href": attrs.get("href"), "title": "", "description": ""}
            return
        if self.card is not None:
            if tag in ("h2", "h3") and not self.card["title"]:
                self.field = "title"
            elif tag == "p" and not self.card["description"]:
                self.field = "description"

    def handle_data(self, data):
        if self.card is not None and self.field:
            self.card[self.field] += data

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "p"):
            self.field = None
        if tag == "a" and self.card is not None:
            self.cards.append({key: " ".join(value.split()) if isinstance(value, str) else value
                               for key, value in self.card.items()})
            self.card = None
            self.field = None


class ArticleMetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.description = ""
        self.title = ""
        self.capture_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = attrs.get("content", "")
        if tag == "h1" and not self.title:
            self.capture_title = True

    def handle_endtag(self, tag):
        if tag == "h1":
            self.capture_title = False

    def handle_data(self, data):
        if self.capture_title:
            self.title += data


def strip_lesson_nav(body: str):
    return re.sub(
        r'<(nav|div)\b(?=[^>]*\bclass=["\'][^"\']*\blesson-nav\b[^"\']*["\'])[^>]*>.*?</\1\s*>',
        "",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()


def extract_fragment(page: str, legacy_path: Path):
    match = re.search(r"<article\b[^>]*>(.*?)</article\s*>", page, re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError(f"{legacy_path.relative_to(ROOT)}: cannot find article body")
    body = strip_lesson_nav(match.group(1))
    if not body:
        raise ValueError(f"{legacy_path.relative_to(ROOT)}: article body is empty")
    return body


def collect_batch(season_names):
    path_file = ROOT / "content/paths/golang-backend.json"
    learning_path = read_json(path_file)
    module_by_season = {module["season"]: module for module in learning_path["modules"]}
    unknown = sorted(set(season_names) - set(module_by_season))
    if unknown:
        raise ValueError("Unknown season(s): " + ", ".join(unknown))

    order_by_source = {}
    order = 0
    for module in learning_path["modules"]:
        season_dir = ROOT / module["season"]
        index_path = season_dir / "index.html"
        if not index_path.is_file():
            raise ValueError(f"Missing {index_path.relative_to(ROOT)}")
        cards = CardParser()
        cards.feed(index_path.read_text(encoding="utf-8"))
        for card in cards.cards:
            order += 1
            order_by_source[(module["season"], card["href"])] = order

    records = []
    used_urls = set()
    for season in season_names:
        module = module_by_season[season]
        index_path = ROOT / season / "index.html"
        cards = CardParser()
        cards.feed(index_path.read_text(encoding="utf-8"))
        for card in cards.cards:
            legacy_path = (ROOT / season / card["href"]).resolve()
            if not legacy_path.is_file() or not legacy_path.is_relative_to(ROOT):
                raise ValueError(f"Missing or unsafe legacy source: {season}/{card['href']}")
            article_id = slug(f"{season}-{Path(card['href']).stem}")
            filename_slug = re.sub(r"^\d{2}-", "", Path(card["href"]).stem)
            source_slug = slug(Path(card["href"]).stem)
            candidates = [slug(filename_slug), source_slug]
            candidates.extend(f"{source_slug}-{number}" for number in range(2, 100))
            selected = None
            already_migrated = False
            for canonical_slug in candidates:
                canonical_url = f"/articles/{module['domain']}/{canonical_slug}/"
                body_file = Path("content/articles") / module["domain"] / f"{canonical_slug}.html"
                metadata_file = Path("content/articles") / module["domain"] / f"{canonical_slug}.json"
                if canonical_url in used_urls:
                    continue
                if body_file.exists() and metadata_file.exists():
                    existing = read_json(metadata_file)
                    if existing.get("id") == article_id:
                        selected = (canonical_slug, canonical_url, body_file, metadata_file)
                        already_migrated = True
                        break
                    continue
                if body_file.exists() or metadata_file.exists():
                    continue
                selected = (canonical_slug, canonical_url, body_file, metadata_file)
                break
            if selected is None:
                raise ValueError(f"Could not assign a unique canonical URL for {season}/{card['href']}")
            canonical_slug, canonical_url, body_file, metadata_file = selected
            used_urls.add(canonical_url)
            if already_migrated:
                continue
            original = legacy_path.read_text(encoding="utf-8")
            metadata = ArticleMetadataParser()
            metadata.feed(original)
            title = clean_text(metadata.title) or clean_text(card["title"])
            description = clean_text(metadata.description) or clean_text(card["description"])
            if not title or not description:
                raise ValueError(f"{legacy_path.relative_to(ROOT)}: missing title or description")
            fragment = extract_fragment(original, legacy_path)
            order = order_by_source[(season, card["href"])]
            record = {
                "id": article_id,
                "title": title,
                "description": description,
                "type": "article",
                "domain": module["domain"],
                "category": module["category"],
                "tags": list(dict.fromkeys([module["domain"], module["category"]])),
                "difficulty": "unspecified",
                "learning_paths": [{"path_id": learning_path["id"], "module_id": module["id"], "order": order}],
                "path_order": order,
                "prerequisites": [],
                "related": [],
                "status": "published",
                "url": canonical_url,
                "source": body_file.as_posix(),
                "legacy_urls": ["/" + (Path(season) / card["href"]).as_posix()],
                "authors": ["tiecont"],
            }
            records.append((body_file, metadata_file, fragment, record))
    return records


def canonicalize_path_references(seasons):
    """Convert selected legacy season modules to explicit canonical ID lists."""
    path_file = ROOT / "content/paths/golang-backend.json"
    learning_path = read_json(path_file)
    selected = set(seasons)
    metadata_by_legacy_url = {}
    metadata_files = sorted((ROOT / "content/articles").rglob("*.json"))
    for metadata_file in metadata_files:
        metadata = read_json(metadata_file)
        legacy_urls = metadata.get("legacy_urls", [])
        if metadata.get("legacy_url"):
            legacy_urls = [*legacy_urls, metadata["legacy_url"]]
        for legacy_url in legacy_urls:
            metadata_by_legacy_url[legacy_url] = (metadata_file, metadata)

    updated_metadata = {}
    for module_order, module in enumerate(learning_path["modules"], start=1):
        module.setdefault("order", module_order)
        season = module.get("season")
        if season not in selected:
            continue
        index_file = ROOT / season / "index.html"
        cards = CardParser()
        cards.feed(index_file.read_text(encoding="utf-8"))
        article_ids = []
        for card in cards.cards:
            legacy_url = "/" + (Path(season) / unquote(card["href"])).as_posix()
            match = metadata_by_legacy_url.get(legacy_url)
            if not match:
                raise ValueError(f"No canonical article metadata preserves {legacy_url}")
            metadata_file, metadata = match
            article_ids.append(metadata["id"])
            normalized_urls = list(dict.fromkeys([*metadata.get("legacy_urls", []), legacy_url]))
            metadata.pop("legacy_url", None)
            metadata["legacy_urls"] = normalized_urls
            updated_metadata[metadata_file] = metadata
        if len(article_ids) != len(set(article_ids)):
            raise ValueError(f"{season}: duplicate article reference in the legacy lesson index")
        module["article_ids"] = article_ids
        module.pop("season", None)

    remaining = [module.get("season") for module in learning_path["modules"] if module.get("season")]
    return path_file, learning_path, updated_metadata, remaining


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="+", required=True, help="season directory names to migrate")
    parser.add_argument("--dry-run", action="store_true", help="report the batch without writing content")
    args = parser.parse_args()
    try:
        records = collect_batch(args.seasons)
        path_file, learning_path, updated_metadata, remaining = canonicalize_path_references(args.seasons)
        if args.dry_run:
            lesson_count = sum(len(module.get("article_ids", [])) for module in learning_path["modules"] if not module.get("season"))
            print(f"Ready to write {len(records)} article sources and canonical references for {lesson_count} lessons.")
            print(f"Will normalize legacy URL metadata in {len(updated_metadata)} article records.")
            if remaining:
                print("Legacy season modules remain: " + ", ".join(remaining))
            for body, _, _, record in records:
                print(f"  {record['legacy_urls'][0]} -> {record['url']} ({record['title']})")
            return 0
        for body_file, metadata_file, fragment, record in records:
            body_file.parent.mkdir(parents=True, exist_ok=True)
            body_file.write_text(fragment + "\n", encoding="utf-8")
            metadata_file.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for metadata_file, metadata in updated_metadata.items():
            metadata_file.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        path_file.write_text(json.dumps(learning_path, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Extracted {len(records)} articles from {', '.join(args.seasons)}")
        if remaining:
            print("Legacy season modules remain: " + ", ".join(remaining))
        else:
            print("Every Golang path module now references canonical article IDs.")
        print("Run scripts/build_site.py to generate canonical pages and legacy redirects.")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

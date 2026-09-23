#!/usr/bin/env python3
"""Extract selected legacy lesson bodies into canonical article fragments."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from build_site import CardParser, ROOT, clean_text, read_json, slug


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
                "legacy_url": "/" + (Path(season) / card["href"]).as_posix(),
                "authors": ["tiecont"],
            }
            records.append((body_file, metadata_file, fragment, record))
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="+", required=True, help="season directory names to migrate")
    parser.add_argument("--dry-run", action="store_true", help="report the batch without writing content")
    args = parser.parse_args()
    try:
        records = collect_batch(args.seasons)
        if args.dry_run:
            print(f"Ready to migrate {len(records)} articles from {', '.join(args.seasons)}")
            for body, _, _, record in records:
                print(f"  {record['legacy_url']} -> {record['url']} ({record['title']})")
            return 0
        for body_file, metadata_file, fragment, record in records:
            body_file.parent.mkdir(parents=True, exist_ok=True)
            body_file.write_text(fragment + "\n", encoding="utf-8")
            metadata_file.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Extracted {len(records)} articles from {', '.join(args.seasons)}")
        print("Run scripts/build_site.py to generate canonical pages and legacy redirects.")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Find same-domain canonical article pairs that may cover overlapping concepts."""

from __future__ import annotations

import argparse
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content/articles"
OUTPUT = ROOT / "docs/audits/canonical-duplicates.md"


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"^\d+[-_.\s]*", "", value.lower().strip())
    return " ".join(re.findall(r"[a-z0-9]+", value))


def tokens(value: str) -> set[str]:
    return set(normalize(value).split())


def overlap(left: set[str], right: set[str]) -> float:
    return len(left & right) / len(left | right) if left or right else 0.0


def article_slug(article: dict) -> str:
    return normalize(article.get("url", "").strip("/").split("/")[-1])


def load_articles() -> list[dict]:
    articles = []
    for path in sorted(CONTENT.rglob("*.json")):
        article = json.loads(path.read_text(encoding="utf-8"))
        article["_metadata_file"] = path.relative_to(ROOT).as_posix()
        articles.append(article)
    return articles


def find_candidates(articles: list[dict]) -> list[dict]:
    candidates = []
    articles = sorted(articles, key=lambda item: (item.get("domain", ""), item.get("id", "")))
    for index, left in enumerate(articles):
        for right in articles[index + 1:]:
            if left.get("domain") != right.get("domain"):
                continue
            left_title = normalize(left.get("title", ""))
            right_title = normalize(right.get("title", ""))
            title_similarity = SequenceMatcher(None, left_title, right_title).ratio()
            slug_match = bool(article_slug(left)) and article_slug(left) == article_slug(right)
            tag_overlap = overlap(set(left.get("tags", [])), set(right.get("tags", [])))
            description_overlap = overlap(tokens(left.get("description", "")), tokens(right.get("description", "")))
            signals = []
            if left_title == right_title:
                signals.append("same normalized title")
            if slug_match:
                signals.append("same slug after numeric-prefix removal")
            if title_similarity >= 0.82:
                signals.append(f"similar title ({title_similarity:.2f})")
            if tag_overlap >= 0.75:
                signals.append(f"tag overlap ({tag_overlap:.2f})")
            if description_overlap >= 0.55:
                signals.append(f"description overlap ({description_overlap:.2f})")
            if slug_match or left_title == right_title or (title_similarity >= 0.82 and tag_overlap >= 0.25) or (tag_overlap >= 0.75 and description_overlap >= 0.55 and title_similarity >= 0.45):
                candidates.append({
                    "left": left,
                    "right": right,
                    "signals": signals,
                    "title_similarity": title_similarity,
                    "tag_overlap": tag_overlap,
                    "description_overlap": description_overlap,
                })
    return candidates


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="list candidates without writing the audit")
    args = parser.parse_args()
    candidates = find_candidates(load_articles())
    if args.preview:
        for candidate in candidates:
            left, right = candidate["left"], candidate["right"]
            print(f"{left['id']} <> {right['id']} | {', '.join(candidate['signals'])}")
        print(f"{len(candidates)} candidate pairs")
        return 0

    classifications = {
        frozenset(("season-10-distributed-systems-10-consensus-problem", "season-21-consensus-coordination-01-consensus-problem")): (
            "B", "Same concept, different depth. Keep both for now; rename the fundamentals lesson and state clearly that it covers agreement and safety while the other article develops quorum, epochs and production context."
        ),
        frozenset(("season-10-distributed-systems-04-consistency-models", "season-20-distributed-data-05-consistency-models")): (
            "B", "Same concept, different depth. Preserve the broad consistency-contract treatment and the shorter data-store application lesson; make the latter's scope explicit in its title and opening."
        ),
        frozenset(("season-10-distributed-systems-13-distributed-locks", "season-20-distributed-data-11-distributed-locks")): (
            "B", "Same concept, different depth. Keep the failure-model overview and the focused lease/fencing treatment; rename the focused lesson so its additional scope is clear."
        ),
        frozenset(("season-10-distributed-systems-09-partitioning-sharding", "season-20-distributed-data-06-partitioning-sharding")): (
            "B", "Same concept, different depth. Retain the concise hash-versus-range introduction and the broader lesson covering shard keys, consistent hashing, rebalancing, and production trade-offs; clarify these scopes in the titles or openings."
        ),
        frozenset(("season-03-concurrency-04-mutex", "season-03-concurrency-05-rwmutex")): (
            "C", "Related but distinct synchronization tools. Keep both: the Mutex lesson covers exclusive critical sections and safe ownership, while RWMutex covers concurrent readers, exclusive writers, workload trade-offs, and benchmarking. Make the relationship explicit in cross-links."
        ),
    }
    missing = [candidate for candidate in candidates if frozenset((candidate["left"]["id"], candidate["right"]["id"])) not in classifications]
    if missing:
        print(f"{len(missing)} candidate pair(s) need manual classification; run with --preview.", file=sys.stderr)
        return 1

    lines = [
        "# Canonical article overlap audit",
        "",
        "Generated by `python3 scripts/audit_duplicate_articles.py`. Candidate generation is a review aid; it never merges articles or changes IDs, routes, content, or path membership.",
        "",
        "## Classification key",
        "",
        "- **A — True duplicate:** consolidate only after preserving unique material, memberships, and every historical URL.",
        "- **B — Same concept, different depth:** retain both and make their scopes explicit.",
        "- **C — Related but distinct:** retain both and explain the relationship.",
        "- **D — False positive:** no content change is needed.",
        "",
        "## Candidates and decisions",
        "",
        "| Classification | Candidate articles | Evidence | Decision / follow-up |",
        "|---|---|---|---|",
    ]
    for candidate in candidates:
        left, right = candidate["left"], candidate["right"]
        classification, decision = classifications[frozenset((left["id"], right["id"]))]
        refs = f"[`{left['id']}`]({left['url']}) / [`{right['id']}`]({right['url']})"
        titles = f"{left['title']} / {right['title']}"
        evidence = "; ".join(candidate["signals"])
        lines.append(f"| **{classification}** | {refs}<br>{titles} | {evidence} | {decision} |")
    lines += [
        "",
        "## URL and content handling",
        "",
        "No consolidation is proposed by this audit. All current canonical IDs and URLs remain stable. Each historical lesson URL remains in the article's `legacy_urls` metadata and continues to generate a redirect. If a future consolidation is approved, move all useful material and path memberships to the retained article before redirecting the retired canonical URL; retain every old season URL as an alias.",
        "",
        f"The current candidate set contains {len(candidates)} pairs across {len(load_articles())} published article records.",
        "",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(candidates)} classified candidate pairs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

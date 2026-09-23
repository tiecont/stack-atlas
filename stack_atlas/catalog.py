"""Load and validate the canonical Stack Atlas catalog."""

from __future__ import annotations

import html
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced", "all", "unspecified"}

def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read {path.relative_to(ROOT)}: {exc}") from exc

def read_yaml(path: Path):
    try:
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise ValueError(f"Cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: expected a YAML object")
    return value

def read_domains():
    domains = read_json(CONTENT / "domains.json")
    domains.extend(read_yaml(path) for path in sorted((CONTENT / "domains").glob("*.yaml")))
    return domains

def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).casefold().strip()
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = re.sub(r"[^\w]+|_+", "-", value, flags=re.UNICODE)
    return value.strip("-")

def clean_text(value: str) -> str:
    return " ".join(html.unescape(value).split())

def ordered_modules(path: dict) -> list[dict]:
    return sorted(path.get("modules", []), key=lambda module: module["order"])

def path_sequence(path: dict) -> list[tuple[dict, dict]]:
    """Return the one authoritative module/article sequence declared by a path."""
    return [(module, article) for module in ordered_modules(path) for article in module.get("articles", [])]

def make_catalog():
    domains = read_domains()
    categories = read_json(CONTENT / "categories.json")
    path_files = sorted((CONTENT / "paths").glob("*.json")) + sorted((CONTENT / "paths").glob("*.yaml"))
    paths = [read_yaml(path) if path.suffix == ".yaml" else read_json(path) for path in path_files]
    domain_by_id = {item["id"]: item for item in domains}
    category_by_id = {item["id"]: item for item in categories}
    path_by_id = {item["id"]: item for item in paths}
    errors = []
    explicit = []
    for file in sorted((CONTENT / "articles").rglob("*.json")):
        record = read_json(file)
        if not isinstance(record, dict):
            errors.append(f"{file.relative_to(ROOT)}: article metadata must be an object")
            continue
        record["metadata_file"] = file.relative_to(ROOT).as_posix()
        explicit.append(record)
    for kind, items in (("domain", domains), ("category", categories), ("learning path", paths)):
        ids = [item.get("id") for item in items]
        if len(ids) != len(set(ids)):
            errors.append(f"Duplicate {kind} IDs")
        for item in items:
            if not item.get("id") or not item.get("title"):
                errors.append(f"{kind} is missing an ID or title")
            if kind != "category" and not item.get("description"):
                errors.append(f"{kind} {item.get('id')!r} is missing a description")

    articles = explicit
    article_ids = [article.get("id") for article in articles]
    if len(article_ids) != len(set(article_ids)):
        duplicates = sorted({item for item in article_ids if article_ids.count(item) > 1})
        errors.append("Duplicate article IDs: " + ", ".join(duplicates))
    article_by_id = {article.get("id"): article for article in articles}
    article_urls = [article.get("url") for article in articles if article.get("url")]
    if len(article_urls) != len(set(article_urls)):
        errors.append("Duplicate article URLs")

    placements = defaultdict(list)
    for path in paths:
        modules = path.get("modules", [])
        module_ids = set()
        module_orders = set()
        for module in modules:
            module_id = module.get("id")
            if not module_id or module_id in module_ids:
                errors.append(f"{path['id']}: missing or duplicate module ID {module_id!r}")
            module_ids.add(module_id)
            module_order = module.get("order")
            if not isinstance(module_order, int) or module_order < 1 or module_order in module_orders:
                errors.append(f"{path['id']}: invalid or duplicate module order {module_order!r}")
            module_orders.add(module_order)
            if module.get("domain") not in domain_by_id:
                errors.append(f"{path['id']}/{module_id}: unknown domain {module.get('domain')!r}")
            if module.get("category") not in category_by_id:
                errors.append(f"{path['id']}/{module_id}: unknown category {module.get('category')!r}")
            module_articles = module.get("article_ids", [])
            if not isinstance(module_articles, list):
                errors.append(f"{path['id']}/{module_id}: article_ids must be a list")
                module_articles = []
            if len(module_articles) != len(set(module_articles)):
                errors.append(f"{path['id']}/{module_id}: duplicate article placement")
            for article_id in module_articles:
                placements[(path["id"], article_id)].append(module_id)
                if article_id not in article_by_id:
                    errors.append(f"{path['id']}/{module_id}: unknown article {article_id!r}")
            module["articles"] = [article_by_id[item] for item in module_articles if item in article_by_id]

    for (path_id, article_id), module_ids in placements.items():
        if len(module_ids) > 1:
            errors.append(f"{path_id}: article {article_id} is placed more than once")
        elif article_id in article_by_id:
            declared_pairs = {
                (item.get("path_id"), item.get("module_id"))
                for item in article_by_id[article_id].get("learning_paths", [])
                if isinstance(item, dict)
            }
            if (path_id, module_ids[0]) not in declared_pairs:
                errors.append(f"{article_id}: path {path_id} references it without matching article membership")

    legacy_url_owners = {}
    for article in explicit:
        if article.get("schema_version", 1) != 1:
            errors.append(f"{article.get('metadata_file')}: unsupported schema_version {article.get('schema_version')!r}")
        for field in ("id", "title", "description", "domain", "status", "url", "source"):
            if not article.get(field):
                errors.append(f"{article.get('metadata_file')}: missing {field}")
        if article.get("domain") not in domain_by_id:
            errors.append(f"{article.get('metadata_file')}: unknown domain {article.get('domain')!r}")
        if article.get("type", "article") != "article":
            errors.append(f"{article.get('metadata_file')}: type must be 'article'")
        if article.get("status") != "published":
            errors.append(f"{article.get('metadata_file')}: only published articles can enter the static catalog")
        if article.get("category") and article["category"] not in category_by_id:
            errors.append(f"{article.get('metadata_file')}: unknown category {article.get('category')!r}")
        if article.get("difficulty", "unspecified") not in VALID_DIFFICULTIES:
            errors.append(f"{article.get('metadata_file')}: invalid difficulty {article.get('difficulty')!r}")
        source = article.get("source")
        if source and not (ROOT / source).is_file():
            errors.append(f"{article.get('metadata_file')}: missing source file {source}")
        if source and Path(source).suffix.lower() != ".html":
            errors.append(f"{article.get('metadata_file')}: source must be an HTML fragment")
        if article.get("url") and (not article["url"].startswith("/articles/") or not article["url"].endswith("/")):
            errors.append(f"{article.get('metadata_file')}: canonical article URL must look like /articles/domain/slug/")
        if "legacy_urls" in article and not isinstance(article["legacy_urls"], list):
            errors.append(f"{article.get('metadata_file')}: legacy_urls must be a list")
        for legacy_url in article.get("legacy_urls", []):
            if not isinstance(legacy_url, str) or not legacy_url.startswith("/season-"):
                errors.append(f"{article.get('metadata_file')}: each legacy URL must preserve an original season URL")
                continue
            if ".." in Path(legacy_url).parts or not legacy_url.endswith(".html"):
                errors.append(f"{article.get('metadata_file')}: unsafe legacy redirect path {legacy_url!r}")
            owner = legacy_url_owners.get(legacy_url)
            if owner and owner != article.get("id"):
                errors.append(f"Legacy URL {legacy_url} is assigned to both {owner} and {article.get('id')}")
            legacy_url_owners[legacy_url] = article.get("id")
        for relation in ("learning_paths", "prerequisites", "related", "tags", "authors"):
            if relation in article and not isinstance(article[relation], list):
                errors.append(f"{article.get('metadata_file')}: {relation} must be a list")
        if "labs" in article:
            if not isinstance(article["labs"], list):
                errors.append(f"{article.get('metadata_file')}: labs must be a list")
            else:
                for lab in article["labs"]:
                    lab_path = (ROOT / "labs" / str(lab)).resolve()
                    if not lab_path.is_relative_to(ROOT / "labs") or not (lab_path / "README.md").is_file():
                        errors.append(f"{article.get('metadata_file')}: unknown lab {lab!r}")
        review = article.get("review")
        if review is not None:
            if not isinstance(review, dict):
                errors.append(f"{article.get('metadata_file')}: review must be an object")
            elif review.get("last_reviewed") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(review["last_reviewed"])):
                errors.append(f"{article.get('metadata_file')}: review.last_reviewed must use YYYY-MM-DD")
        for date_field in ("created_at", "updated_at"):
            if article.get(date_field) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(article[date_field])):
                errors.append(f"{article.get('metadata_file')}: {date_field} must use YYYY-MM-DD")

    for article in articles:
        for relation in ("prerequisites", "related"):
            for reference in article.get(relation, []):
                if reference not in article_by_id:
                    errors.append(f"{article.get('id')}: unknown {relation} article {reference!r}")
        membership_keys = set()
        for membership in article.get("learning_paths", []):
            if not isinstance(membership, dict):
                errors.append(f"{article.get('id')}: invalid learning path membership {membership!r}")
                continue
            path_id = membership.get("path_id")
            membership_key = (path_id, membership.get("module_id"))
            if membership_key in membership_keys:
                errors.append(f"{article.get('id')}: duplicate learning path membership {membership_key!r}")
            membership_keys.add(membership_key)
            if path_id not in path_by_id:
                errors.append(f"{article.get('id')}: unknown learning path {path_id!r}")
            else:
                module_id = membership.get("module_id")
                path_modules = path_by_id[path_id].get("modules", [])
                module_ids = {module["id"] for module in path_modules}
                if not module_id:
                    errors.append(f"{article.get('id')}: module_id is required for membership in {path_id}")
                if module_id and module_id not in module_ids:
                    errors.append(f"{article.get('id')}: unknown module {module_id!r} in {path_id}")
                if module_id:
                    module = next((item for item in path_modules if item["id"] == module_id), None)
                    if module and article.get("id") not in module.get("article_ids", []):
                        errors.append(f"{article.get('id')}: module {module_id} in {path_id} does not reference this article")
        article["tags"] = article.get("tags", [])
        article.setdefault("learning_paths", [])
        article.setdefault("prerequisites", [])
        article.setdefault("related", [])
        article.setdefault("difficulty", "unspecified")

    return domains, categories, paths, articles, errors

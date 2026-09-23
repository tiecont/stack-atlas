#!/usr/bin/env python3
"""Build Stack Atlas discovery pages while preserving legacy lesson URLs."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sys
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.sax.saxutils import escape as xml_escape

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
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


class CardParser(HTMLParser):
    """Read lesson cards from both generations of legacy season indexes."""

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


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "href" in attrs:
            self.hrefs.append(attrs["href"])
        if "id" in attrs:
            self.ids.add(attrs["id"])


def clean_text(value: str) -> str:
    return " ".join(html.unescape(value).split())


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
    explicit_by_id = {item.get("id"): item for item in explicit}
    included_explicit = set()

    for kind, items in (("domain", domains), ("category", categories), ("learning path", paths)):
        ids = [item.get("id") for item in items]
        if len(ids) != len(set(ids)):
            errors.append(f"Duplicate {kind} IDs")
        for item in items:
            if not item.get("id") or not item.get("title"):
                errors.append(f"{kind} is missing an ID or title")
            if kind != "category" and not item.get("description"):
                errors.append(f"{kind} {item.get('id')!r} is missing a description")

    articles = []
    path_members = defaultdict(list)
    global_path_order = defaultdict(int)
    for path in paths:
        modules = path.get("modules", [])
        module_ids = set()
        module_orders = set()
        for module in modules:
            module_id = module.get("id")
            if not module_id or module_id in module_ids:
                errors.append(f"{path['id']}: missing or duplicate module ID {module_id!r}")
            module_ids.add(module_id)
            module_order = module.get("order", len(module_ids))
            if not isinstance(module_order, int) or module_order < 1 or module_order in module_orders:
                errors.append(f"{path['id']}: invalid or duplicate module order {module_order!r}")
            module_orders.add(module_order)
            if module.get("domain") not in domain_by_id:
                errors.append(f"{path['id']}/{module_id}: unknown domain {module.get('domain')!r}")
            if module.get("category") not in category_by_id:
                errors.append(f"{path['id']}/{module_id}: unknown category {module.get('category')!r}")
            season = module.get("season")
            if season:
                index_file = ROOT / season / "index.html"
                if not index_file.is_file():
                    errors.append(f"{path['id']}/{module_id}: missing source {season}/index.html")
                    continue
                parser = CardParser()
                parser.feed(index_file.read_text(encoding="utf-8"))
                if not parser.cards:
                    errors.append(f"{path['id']}/{module_id}: no article cards found in {season}/index.html")
                for card in parser.cards:
                    href = card.get("href")
                    target = (ROOT / season / unquote(href or "")).resolve()
                    if not href or not target.is_file() or not target.is_relative_to(ROOT):
                        errors.append(f"{path['id']}/{module_id}: missing article source {season}/{href}")
                        continue
                    title = clean_text(card.get("title", ""))
                    description = clean_text(card.get("description", ""))
                    if not title or not description:
                        errors.append(f"{path['id']}/{module_id}: article {href} needs a title and description")
                        continue
                    article_id = slug(f"{season}-{Path(href).stem}")
                    global_path_order[path["id"]] += 1
                    migrated_article = explicit_by_id.get(article_id)
                    if migrated_article:
                        membership = next((item for item in migrated_article.get("learning_paths", [])
                                           if isinstance(item, dict) and item.get("path_id") == path["id"]
                                           and item.get("module_id") == module_id), None)
                        if not membership:
                            errors.append(f"{article_id}: migrated source must include its path and module membership")
                            continue
                        if membership.get("order") != global_path_order[path["id"]]:
                            errors.append(f"{article_id}: path order should be {global_path_order[path['id']]}")
                        migrated_article["path_order"] = membership.get("order")
                        articles.append(migrated_article)
                        path_members[(path["id"], module_id)].append(migrated_article)
                        included_explicit.add(article_id)
                        continue
                    article = {
                        "id": article_id,
                        "title": title,
                        "description": description,
                        "type": "article",
                        "domain": module["domain"],
                        "category": module["category"],
                        "tags": [module["domain"], module["category"]],
                        "difficulty": "unspecified",
                        "learning_paths": [{"path_id": path["id"], "module_id": module_id,
                                            "order": global_path_order[path["id"]]}],
                        "path_order": global_path_order[path["id"]],
                        "prerequisites": [],
                        "related": [],
                        "status": "published",
                        "url": "/" + (Path(season) / href).as_posix(),
                        "source_file": (Path(season) / href).as_posix(),
                        "legacy": True,
                    }
                    articles.append(article)
                    path_members[(path["id"], module_id)].append(article)
            else:
                for article_id in module.get("article_ids", []):
                    path_members[(path["id"], module_id)].append({"id": article_id})

        for module in modules:
            module["articles"] = path_members[(path["id"], module["id"])]
            module["order"] = modules.index(module) + 1

    articles.extend(article for article in explicit if article.get("id") not in included_explicit)
    article_ids = [article.get("id") for article in articles]
    if len(article_ids) != len(set(article_ids)):
        duplicates = sorted({item for item in article_ids if article_ids.count(item) > 1})
        errors.append("Duplicate article IDs: " + ", ".join(duplicates))
    article_by_id = {article.get("id"): article for article in articles}
    article_urls = [article.get("url") for article in articles if article.get("url")]
    if len(article_urls) != len(set(article_urls)):
        errors.append("Duplicate article URLs")
    path_orders = defaultdict(set)

    for path in paths:
        for module in path.get("modules", []):
            module["articles"] = [article_by_id.get(item.get("id"), item) for item in module.get("articles", [])]
    for article in explicit:
        for membership in article.get("learning_paths", []):
            if isinstance(membership, str):
                continue
            path_id = membership.get("path_id")
            module_id = membership.get("module_id")
            if path_id in path_by_id and module_id:
                module = next((item for item in path_by_id[path_id].get("modules", []) if item["id"] == module_id), None)
                if module and all(item.get("id") != article.get("id") for item in module.get("articles", [])):
                    article["path_order"] = membership.get("order", article.get("path_order"))
                    module["articles"].append(article)
                    module["articles"].sort(key=lambda item: item.get("path_order", 1_000_000))

    for article in explicit:
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
        if article.get("legacy_url") and not article["legacy_url"].startswith("/season-"):
            errors.append(f"{article.get('metadata_file')}: legacy_url must preserve the original season URL")
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

    for article in articles:
        for relation in ("prerequisites", "related"):
            for reference in article.get(relation, []):
                if reference not in article_by_id:
                    errors.append(f"{article.get('id')}: unknown {relation} article {reference!r}")
        for membership in article.get("learning_paths", []):
            if not isinstance(membership, (str, dict)):
                errors.append(f"{article.get('id')}: invalid learning path membership {membership!r}")
                continue
            path_id = membership if isinstance(membership, str) else membership.get("path_id")
            if path_id not in path_by_id:
                errors.append(f"{article.get('id')}: unknown learning path {path_id!r}")
            elif isinstance(membership, str):
                path_modules = path_by_id[path_id].get("modules", [])
                placed = any(any(item.get("id") == article.get("id") for item in module.get("articles", [])) for module in path_modules)
                if not placed:
                    errors.append(f"{article.get('id')}: add it to a module in {path_id} using article_ids")
                order = article.get("path_order")
                if not isinstance(order, int) or order < 1:
                    errors.append(f"{article.get('id')}: string path membership requires a positive path_order")
                elif order in path_orders[path_id]:
                    errors.append(f"{path_id}: duplicate article order {order}")
                else:
                    path_orders[path_id].add(order)
            elif isinstance(membership, dict):
                module_id = membership.get("module_id")
                path_modules = path_by_id[path_id].get("modules", [])
                module_ids = {module["id"] for module in path_modules}
                if not module_id:
                    errors.append(f"{article.get('id')}: module_id is required for membership in {path_id}")
                if module_id and module_id not in module_ids:
                    errors.append(f"{article.get('id')}: unknown module {module_id!r} in {path_id}")
                if module_id:
                    module = next((item for item in path_modules if item["id"] == module_id), None)
                    if module and not any(item.get("id") == article.get("id") for item in module.get("articles", [])):
                        errors.append(f"{article.get('id')}: module {module_id} in {path_id} does not reference this article")
                if not isinstance(membership.get("order"), int) or membership["order"] < 1:
                    errors.append(f"{article.get('id')}: invalid path order for {path_id}")
                else:
                    if membership["order"] in path_orders[path_id]:
                        errors.append(f"{path_id}: duplicate article order {membership['order']}")
                    path_orders[path_id].add(membership["order"])
        article["tags"] = article.get("tags", [])
        article.setdefault("learning_paths", [])
        article.setdefault("prerequisites", [])
        article.setdefault("related", [])
        article.setdefault("difficulty", "unspecified")

    for path in paths:
        for module in path.get("modules", []):
            for article_id in module.get("article_ids", []):
                if article_id not in article_by_id:
                    errors.append(f"{path['id']}/{module['id']}: unknown article {article_id!r}")

    return domains, categories, paths, articles, errors


def site_url(path: str, base_path: str) -> str:
    clean_path = "/" + path.lstrip("/")
    return base_path.rstrip("/") + clean_path


def page_head(title: str, description: str, canonical_path: str, site: dict) -> str:
    canonical = ""
    if site.get("base_url"):
        canonical_url = site["base_url"].rstrip("/") + site.get("base_path", "").rstrip("/") + canonical_path
        canonical = f'<link rel="canonical" href="{html.escape(canonical_url, quote=True)}">'
    safe_title = html.escape(title)
    title_tag = safe_title if title == site.get("name") else f"{safe_title} · {html.escape(site.get('name', 'Stack Atlas'))}"
    safe_description = html.escape(description, quote=True)
    return f'''<!doctype html>
<html lang="{html.escape(site.get('language', 'en'))}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title_tag}</title><meta name="description" content="{safe_description}">
  <meta property="og:title" content="{title_tag}"><meta property="og:description" content="{safe_description}">
  <meta property="og:type" content="website">{canonical}
  <link rel="icon" href="{html.escape(site_url('/assets/favicon.svg', site.get('base_path', '')), quote=True)}" type="image/svg+xml">
  <link rel="stylesheet" href="{html.escape(site_url('/assets/site.css', site.get('base_path', '')), quote=True)}">
  <script defer src="{html.escape(site_url('/assets/site.js', site.get('base_path', '')), quote=True)}"></script>
</head>'''


def shared_ui(content: str, title: str, description: str, canonical_path: str, site: dict, base_path: str) -> str:
    base = lambda path: html.escape(site_url(path, base_path), quote=True)
    return f'''{page_head(title, description, canonical_path, site)}
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="{base('/')}" aria-label="Stack Atlas home"><span class="brand-icon">S</span><span>Stack Atlas</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
    <nav class="primary-nav" id="primary-nav" aria-label="Main navigation">
      <a href="{base('/#topics')}">Explore</a><a href="{base('/paths/')}">Learning Paths</a><a href="{base('/topics/')}">Topics</a><a href="{base('/articles/')}">Blog</a>
      <button class="search-open" type="button" data-open-search>Search</button><button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme">Dark mode</button>
    </nav>
  </div></header>
  {content}
  <footer class="site-footer"><div><a class="footer-brand" href="{base('/')}">Stack Atlas</a><span>Engineering knowledge, from code to infrastructure.</span></div><nav aria-label="Footer navigation"><a href="{base('/topics/')}">Topics</a><a href="{base('/paths/')}">Learning Paths</a><a href="{base('/articles/')}">Articles</a><a href="{base('/about/')}">About</a></nav><small>Static, open and built for curious engineers.</small></footer>
  <dialog class="search-dialog" aria-labelledby="search-title" id="search-dialog">
    <form method="dialog" class="dialog-top"><div><span class="eyebrow">Stack Atlas</span><h2 id="search-title">Search the Atlas</h2></div><button class="icon-button" aria-label="Close search">×</button></form>
    <label class="search-label" for="site-search">Search topics, articles and learning paths</label>
    <input id="site-search" type="search" placeholder="Try “goroutine” or “PostgreSQL”" autocomplete="off">
    <div class="search-filters" role="group" aria-label="Filter search results"><button class="filter-button is-active" data-search-filter="all">All</button><button class="filter-button" data-search-filter="article">Articles</button><button class="filter-button" data-search-filter="topic">Topics</button><button class="filter-button" data-search-filter="path">Learning Paths</button></div>
    <div class="search-results" id="search-results" aria-live="polite"><p class="empty-state">Start typing to search articles and topics.</p></div>
  </dialog>
</body></html>'''


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def article_card(article: dict, base_path: str) -> str:
    url = site_url(article["url"], base_path)
    domain = article.get("domain", "")
    category = article.get("category", "")
    return f'''<article class="article-card"><a href="{esc(url)}"><span class="card-kicker">{esc(domain.replace('-', ' ').title())} · {esc(category.replace('-', ' ').title())}</span><h3>{esc(article['title'])}</h3><p>{esc(article['description'])}</p><span class="text-link">Read article <span aria-hidden="true">↗</span></span></a></article>'''


def path_card(path: dict, base_path: str) -> str:
    lesson_count = sum(len(module.get("articles", [])) for module in path.get("modules", []))
    url = site_url("/paths/" + path["id"] + "/", base_path)
    return f'''<a class="path-card" href="{esc(url)}"><span class="eyebrow">{esc(path.get('status', 'published').title())} · Learning Path</span><h3>{esc(path['title'])}</h3><p>{esc(path['description'])}</p><span class="path-meta">{len(path.get('modules', []))} modules · {lesson_count} lessons</span><span class="text-link">View path <span aria-hidden="true">↗</span></span></a>'''


def article_body(source_path: Path):
    body = source_path.read_text(encoding="utf-8")
    headings = []
    pattern = re.compile(r"<h([23])([^>]*)>(.*?)</h\1>", re.IGNORECASE | re.DOTALL)
    for match in list(pattern.finditer(body)):
        level, attrs, raw_title = match.group(1), match.group(2), match.group(3)
        title = clean_text(re.sub(r"<[^>]+>", " ", raw_title))
        id_match = re.search(r'\bid=["\']([^"\']+)["\']', attrs)
        heading_id = id_match.group(1) if id_match else slug(title)
        if not id_match:
            replacement = f'<h{level}{attrs} id="{esc(heading_id)}">{raw_title}</h{level}>'
            body = body.replace(match.group(0), replacement, 1)
        headings.append({"level": int(level), "id": heading_id, "title": title})
    return body, headings


def render_modern_article(article: dict, article_by_id: dict, paths: list, output: Path, site: dict, base_path: str):
    source = ROOT / article["source"]
    body, headings = article_body(source)
    domain_url = site_url("/topics/" + article["domain"] + "/", base_path)
    category_title = article.get("category", "")
    path_memberships = article.get("learning_paths", [])
    category_url = domain_url + "#category-" + category_title if category_title else domain_url
    category_crumb = f'<span>/</span><a href="{esc(category_url)}">{esc(category_title.replace("-", " ").title())}</a>' if category_title else ""
    crumbs = f'<a href="{esc(domain_url)}">{esc(article["domain"].replace("-", " ").title())}</a>{category_crumb}'
    contents = "".join(f'<a class="toc-level-{item["level"]}" href="#{esc(item["id"])}">{esc(item["title"])}</a>' for item in headings)
    prereqs = "".join(f'<a class="related-link" href="{esc(site_url(article_by_id[item]["url"], base_path))}">{esc(article_by_id[item]["title"])}</a>' for item in article.get("prerequisites", []) if item in article_by_id)
    related = "".join(f'<a class="related-link" href="{esc(site_url(article_by_id[item]["url"], base_path))}">{esc(article_by_id[item]["title"])}</a>' for item in article.get("related", []) if item in article_by_id)
    lab_links = "".join(
        f'<a class="related-link" href="{esc(site_url("/labs/" + lab + "/README.md", base_path))}">Open {esc(lab.split("/")[-1].replace("-", " ").title())} lab guide</a>'
        for lab in article.get("labs", [])
    )
    labs_section = f'<section class="article-related"><h2>Hands-on Labs</h2><div>{lab_links}</div></section>' if lab_links else ""
    path_context = ""
    prev_next = ""
    membership = next((item for item in path_memberships if isinstance(item, dict)), None)
    if not membership:
        simple_path_id = next((item for item in path_memberships if isinstance(item, str)), None)
        simple_path = next((item for item in paths if item["id"] == simple_path_id), None)
        simple_module = next((module for module in simple_path.get("modules", []) if any(member.get("id") == article["id"] for member in module.get("articles", []))), None) if simple_path else None
        if simple_path and simple_module:
            membership = {"path_id": simple_path_id, "module_id": simple_module["id"]}
    if membership:
        path = next((item for item in paths if item["id"] == membership.get("path_id")), None)
        module = next((item for item in path.get("modules", []) if item["id"] == membership.get("module_id")), None) if path else None
        if path and module:
            def selected_path_order(item):
                current_membership = next((entry for entry in item.get("learning_paths", [])
                                           if isinstance(entry, dict) and entry.get("path_id") == path["id"]), None)
                return current_membership.get("order", 1_000_000) if current_membership else item.get("path_order", 1_000_000)
            path_articles = sorted((item for current_module in path.get("modules", []) for item in current_module.get("articles", [])), key=selected_path_order)
            path_position = next((index for index, item in enumerate(path_articles) if item.get("id") == article["id"]), -1)
            module_articles = module.get("articles", [])
            module_position = next((index for index, item in enumerate(module_articles) if item.get("id") == article["id"]), -1)
            path_context = f'<a class="path-context" data-path-context="{esc(path["id"])}" href="{esc(site_url("/paths/" + path["id"] + "/", base_path))}"><span>Part of {esc(path["title"])}</span><strong>{esc(module["title"])} · Lesson {max(module_position + 1, 1):02d}</strong></a>'
            previous = path_articles[path_position - 1] if path_position > 0 else None
            following = path_articles[path_position + 1] if 0 <= path_position < len(path_articles) - 1 else None
            previous_url = site_url(previous["url"] + "?path=" + path["id"], base_path) if previous else ""
            following_url = site_url(following["url"] + "?path=" + path["id"], base_path) if following else ""
            prev_link = f'<a href="{esc(previous_url)}"><small>Previous</small><strong>{esc(previous["title"])}</strong></a>' if previous else '<span></span>'
            next_link = f'<a href="{esc(following_url)}"><small>Next</small><strong>{esc(following["title"])}</strong></a>' if following else '<span></span>'
            prev_next = f'<nav class="article-previous-next" data-path-navigation="{esc(path["id"])}" aria-label="Learning path navigation">{prev_link}{next_link}</nav>'
    status_date = article.get("updated_at") or article.get("last_reviewed") or article.get("review", {}).get("last_reviewed")
    article_level = article.get("difficulty") if article.get("difficulty") != "unspecified" else ""
    eyebrow = " · ".join(part for part in (article["domain"].replace("-", " ").title(), category_title.replace("-", " ").title(), article_level.title()) if part)
    article_html = f'''<main id="main" class="page-shell article-page" data-article-id="{esc(article["id"])}"><div class="breadcrumbs"><a href="{esc(site_url("/", base_path))}">Stack Atlas</a><span>/</span>{crumbs}<span>/</span>{esc(article["title"])}</div><header class="article-header"><span class="eyebrow">{esc(eyebrow)}</span><h1>{esc(article["title"])}</h1><p>{esc(article["description"])}</p><div class="article-meta"><span>{esc(article["domain"].replace("-", " ").title())}</span>{f'<span>Updated {esc(status_date)}</span>' if status_date else ''}<button class="complete-toggle" type="button" data-progress-toggle="{esc(article["id"])}" aria-pressed="false">Mark complete</button></div></header><div class="article-layout"><aside class="article-sidebar">{f'<nav class="article-toc"><strong>On this page</strong>{contents}</nav>' if contents else ''}{path_context}</aside><article class="article-body">{body}{labs_section}{f'<section class="article-related"><h2>Before reading</h2><div>{prereqs}</div></section>' if prereqs else ''}{f'<section class="article-related"><h2>Related Articles</h2><div>{related}</div></section>' if related else ''}{prev_next}</article></div></main>'''
    route = article["url"].strip("/")
    destination = output / route / "index.html"
    write_file(destination, shared_ui(article_html, article["title"], article["description"], article["url"], site, base_path))
    legacy_url = article.get("legacy_url")
    if legacy_url:
        redirect_url = site_url(article["url"], base_path)
        canonical = ""
        if site.get("base_url"):
            canonical_url = site["base_url"].rstrip("/") + base_path + article["url"]
            canonical = f'<link rel="canonical" href="{esc(canonical_url)}">'
        redirect_page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={esc(redirect_url)}">{canonical}<title>Article moved · Stack Atlas</title></head><body><p>This article moved to <a href="{esc(redirect_url)}">{esc(article["title"])}</a>.</p><script>window.location.replace({json.dumps(redirect_url)} + window.location.search + window.location.hash);</script></body></html>'''
        write_file(output / legacy_url.lstrip("/"), redirect_page)


def topic_card(domain: dict, count: int, base_path: str) -> str:
    url = site_url(f"/topics/{domain['id']}/", base_path)
    status = "Coming soon" if domain.get("status") == "planned" else f"{count} articles"
    return f'''<a class="topic-card" href="{esc(url)}"><span class="topic-mark">{esc(domain['title'][:1])}</span><span><strong>{esc(domain['title'])}</strong><small>{esc(status)}</small></span><span class="arrow" aria-hidden="true">↗</span></a>'''


def module_block(module: dict, path_id: str, base_path: str) -> str:
    articles = module.get("articles", [])
    rows = []
    for index, article in enumerate(articles, start=1):
        number = f"{index:02d}"
        article_url = article.get("url", "#")
        if any(isinstance(item, dict) and item.get("path_id") == path_id for item in article.get("learning_paths", [])):
            article_url += "?path=" + path_id
        url = site_url(article_url, base_path)
        rows.append(f'''<div class="path-article" data-article-id="{esc(article['id'])}"><a class="path-article-link" href="{esc(url)}"><span class="article-number">{number}</span><span class="article-copy"><strong>{esc(article.get('title', article['id']))}</strong><span>{esc(article.get('description', ''))}</span></span></a><button class="complete-toggle" type="button" data-progress-toggle="{esc(article['id'])}" aria-pressed="false">Mark complete</button></div>''')
    return f'''<section class="module-card"><div class="module-heading"><div><span class="module-label">Module {module['order']:02d} · {esc(module.get('domain', '').replace('-', ' ').title())}</span><h3>{esc(module['title'])}</h3><p>{len(articles)} lessons · {esc(module.get('category', '').replace('-', ' ').title())}</p></div><span class="module-count">{module['order']:02d}</span></div><div class="path-articles">{''.join(rows)}</div></section>'''


def render_site(domains, categories, paths, articles, output: Path, site: dict):
    base_path = site.get("base_path", "").rstrip("/")
    by_domain = defaultdict(list)
    by_category = {item["id"]: item for item in categories}
    for article in articles:
        by_domain[article.get("domain", "")].append(article)
    output.mkdir(parents=True, exist_ok=True)

    if output.resolve() != ROOT.resolve():
        for legacy_dir in sorted(ROOT.glob("season-*")):
            destination = output / legacy_dir.name
            shutil.copytree(legacy_dir, destination, dirs_exist_ok=True)
        for share_dir in ("labs", "examples/atlas-demo-api", "tests/kubernetes"):
            if (ROOT / share_dir).is_dir():
                shutil.copytree(ROOT / share_dir, output / share_dir, dirs_exist_ok=True)

    write = lambda relative, content: write_file(output / relative, content)
    write("assets/site.css", CSS + ARTICLE_CSS)
    write("assets/site.js", JS.replace("__BASE_PATH__", json.dumps(base_path)))
    write("assets/favicon.svg", FAVICON)
    search_domains = [{"id": item["id"], "title": item["title"], "description": item["description"], "status": item.get("status"), "url": f"/topics/{item['id']}/"} for item in domains]
    search_paths = [{"id": item["id"], "title": item["title"], "description": item["description"], "status": item.get("status"), "url": f"/paths/{item['id']}/", "modules": [{"id": module["id"], "title": module["title"], "order": module["order"], "article_ids": [article["id"] for article in module.get("articles", [])]} for module in item.get("modules", [])]} for item in paths]
    write("search-index.json", json.dumps({"articles": articles, "domains": search_domains, "paths": search_paths}, ensure_ascii=False, indent=2) + "\n")

    published_domains = [domain for domain in domains if by_domain[domain["id"]] or domain.get("status") == "planned"]
    topic_grid = "".join(topic_card(domain, len(by_domain[domain["id"]]), base_path) for domain in published_domains)
    path_cards = "".join(path_card(path, base_path) for path in paths if path.get("status") == "published")
    newest = list(reversed(articles))[:8]
    continue_path = site_url(f"/paths/{paths[0]['id']}/" if paths else "/paths/", base_path)
    continue_refs = "".join(f'<span hidden data-article-id="{esc(article["id"])}" data-article-url="{esc(article["url"])}" data-article-title="{esc(article["title"])}"></span>' for module in (paths[0].get("modules", []) if paths else []) for article in module.get("articles", []))
    home = f'''<main id="main">
      <section class="hero-wrap"><div class="hero"><div class="hero-copy"><span class="eyebrow"><span class="status-dot"></span> Engineering Knowledge Base</span><h1>Engineering knowledge,<br><em>from code to infrastructure.</em></h1><p>Explore practical articles, deep dives and structured learning paths across the systems engineers build and run.</p><div class="hero-actions"><a class="button button-primary" href="{esc(site_url('/topics/', base_path))}">Explore topics <span aria-hidden="true">→</span></a><button class="button button-secondary" type="button" data-open-search>Search the Atlas <kbd>/</kbd></button></div><div class="hero-proof"><span><strong>{len(articles)}</strong> articles</span><span><strong>{len([d for d in domains if by_domain[d['id']]])}</strong> topics with content</span><span><strong>{sum(len(p.get('modules', [])) for p in paths)}</strong> learning modules</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit-core"><span class="core-symbol">S</span><b>STACK<br>ATLAS</b></div><span class="orbit-node node-code">{{</span><span class="orbit-node node-data">DB</span><span class="orbit-node node-cloud">☁</span><span class="orbit-node node-ops">⌘</span><span class="orbit-caption">one map · many routes</span></div></div></section>
      <section class="section section-soft" id="topics"><div class="section-heading"><div><span class="eyebrow">Explore the Atlas</span><h2>Explore by topic</h2><p>Find knowledge by the technology or engineering subject you want to understand.</p></div><a class="text-link" href="{esc(site_url('/topics/', base_path))}">All topics <span aria-hidden="true">→</span></a></div><div class="topic-grid">{topic_grid}</div></section>
      <section class="section"><div class="section-heading"><div><span class="eyebrow">Curated routes</span><h2>Learning paths</h2><p>Study selected articles in an order that builds useful mental models.</p></div><a class="text-link" href="{esc(site_url('/paths/', base_path))}">All paths <span aria-hidden="true">→</span></a></div><div class="path-grid">{path_cards}</div></section>
      <section class="section section-soft" id="latest"><div class="section-heading"><div><span class="eyebrow">From the library</span><h2>Latest articles</h2><p>Browse the current library, including every lesson retained from the original site.</p></div><a class="text-link" href="{esc(site_url('/articles/', base_path))}">Browse all {len(articles)} articles <span aria-hidden="true">→</span></a></div><div class="article-grid">{''.join(article_card(article, base_path) for article in newest)}</div></section>
      <section class="section continue-section" data-continue-learning data-progress-path="{esc(paths[0]['id'] if paths else '')}"><div class="continue-card"><div><span class="eyebrow">Your learning</span><h2>Continue learning</h2><p data-continue-copy>Progress is saved in this browser.</p><div class="progress-track"><span data-progress-bar></span></div><small data-progress-label>0 lessons completed</small></div><a class="button button-primary" data-continue-link href="{esc(continue_path)}">Open learning path <span aria-hidden="true">→</span></a></div>{continue_refs}</section>
    </main>'''
    write("index.html", shared_ui(home, site["name"], site["description"], "/", site, base_path))

    topic_index = f'''<main id="main" class="page-shell"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span>Topics</div><header class="page-intro"><span class="eyebrow">Explore the Atlas</span><h1>Topics</h1><p>Browse engineering knowledge by domain. Each topic page gathers its articles, categories and learning paths.</p></header><div class="topic-grid topic-grid-large">{topic_grid}</div></main>'''
    write("topics/index.html", shared_ui(topic_index, "Topics", "Browse engineering topics in Stack Atlas.", "/topics/", site, base_path))

    path_index_cards = "".join(path_card(path, base_path) for path in paths)
    path_index = f'''<main id="main" class="page-shell"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span>Learning Paths</div><header class="page-intro"><span class="eyebrow">Curated routes</span><h1>Learning Paths</h1><p>Follow a structured route or open any article on its own. Articles remain canonical knowledge nodes that can be reused across paths.</p></header><div class="path-grid">{path_index_cards}</div></main>'''
    write("paths/index.html", shared_ui(path_index, "Learning Paths", "Structured routes through engineering knowledge.", "/paths/", site, base_path))

    for path in paths:
        groups = []
        group_order = []
        for module in path.get("modules", []):
            if module.get("group") not in group_order:
                group_order.append(module.get("group"))
        for group in group_order:
            modules = [module for module in path.get("modules", []) if module.get("group") == group]
            groups.append(f'<section class="path-group"><div class="group-heading"><span class="eyebrow">Learning path section</span><h2>{esc(group)}</h2></div>{"".join(module_block(module, path["id"], base_path) for module in modules)}</section>')
        lesson_count = sum(len(module.get("articles", [])) for module in path.get("modules", []))
        path_html = f'''<main id="main" class="page-shell path-page" data-progress-path="{esc(path['id'])}"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span><a href="{esc(site_url('/paths/', base_path))}">Learning Paths</a><span>/</span>{esc(path['title'])}</div><header class="path-hero"><div><span class="eyebrow">Learning Path · {len(path.get('modules', []))} modules</span><h1>{esc(path['title'])}</h1><p>{esc(path['description'])}</p><div class="path-stats"><span>{lesson_count} lessons</span><span>Progress saved on this device</span></div></div><div class="path-progress"><strong data-progress-label>0 / {lesson_count} complete</strong><div class="progress-track"><span data-progress-bar></span></div><small>Pick up where you left off anytime.</small></div></header><div class="path-content">{''.join(groups)}</div></main>'''
        write(f"paths/{path['id']}/index.html", shared_ui(path_html, path["title"], path["description"], f"/paths/{path['id']}/", site, base_path))

    for domain in domains:
        items = by_domain[domain["id"]]
        domain_paths = [path for path in paths if any(module.get("domain") == domain["id"] for module in path.get("modules", []))]
        category_ids = list(dict.fromkeys(article.get("category") for article in items if article.get("category")))
        categories_html = "".join(f'<a class="category-chip" href="#category-{esc(category_id)}">{esc(by_category.get(category_id, {}).get("title", category_id))}<span>{sum(1 for article in items if article.get("category") == category_id)}</span></a>' for category_id in category_ids)
        path_links = "".join(f'<a class="inline-path" href="{esc(site_url("/paths/" + path["id"] + "/", base_path))}">{esc(path["title"])} <span aria-hidden="true">↗</span></a>' for path in domain_paths)
        grouped_articles = []
        for category_id in category_ids:
            group_articles = [article for article in items if article.get("category") == category_id]
            grouped_articles.append(f'<section class="topic-article-group" id="category-{esc(category_id)}"><div class="section-heading compact"><div><span class="eyebrow">Category</span><h2>{esc(by_category.get(category_id, {}).get("title", category_id))}</h2></div><span class="count-label">{len(group_articles)} articles</span></div><div class="article-grid">{"".join(article_card(article, base_path) for article in group_articles)}</div></section>')
        state = "Planned topic" if not items else f"{len(items)} articles in the library"
        domain_html = f'''<main id="main" class="page-shell"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span><a href="{esc(site_url('/topics/', base_path))}">Topics</a><span>/</span>{esc(domain['title'])}</div><header class="topic-hero"><span class="topic-mark topic-mark-large">{esc(domain['title'][:1])}</span><div><span class="eyebrow">{esc(state)}</span><h1>{esc(domain['title'])}</h1><p>{esc(domain['description'])}</p></div></header>{f'<section class="topic-section"><h2>Learning Paths</h2><div class="inline-paths">{path_links}</div></section>' if domain_paths else ''}{f'<section class="topic-section"><h2>Topics</h2><div class="category-list">{categories_html}</div></section>' if category_ids else ''}{''.join(grouped_articles) if grouped_articles else '<section class="empty-topic"><h2>Content is being prepared</h2><p>This topic is ready for new articles and learning paths.</p><a class="text-link" href="'+esc(site_url('/topics/', base_path))+'">Explore other topics →</a></section>'}</main>'''
        write(f"topics/{domain['id']}/index.html", shared_ui(domain_html, domain["title"], domain["description"], f"/topics/{domain['id']}/", site, base_path))

    article_listing = "".join(article_card(article, base_path) for article in reversed(articles))
    article_page = f'''<main id="main" class="page-shell"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span>Articles</div><header class="page-intro"><span class="eyebrow">Knowledge library</span><h1>Articles</h1><p>Standalone articles and learning-path lessons share one searchable library. Open any article directly or explore a curated route.</p><div class="listing-search"><button class="button button-secondary" type="button" data-open-search>Search {len(articles)} articles <kbd>/</kbd></button></div></header><div class="article-grid article-grid-list">{article_listing}</div></main>'''
    write("articles/index.html", shared_ui(article_page, "Articles", "Articles and deep dives across the Stack Atlas engineering library.", "/articles/", site, base_path))

    about = f'''<main id="main" class="page-shell"><div class="breadcrumbs"><a href="{esc(site_url('/', base_path))}">Stack Atlas</a><span>/</span>About</div><header class="page-intro"><span class="eyebrow">About Stack Atlas</span><h1>Understand systems,<br>not just APIs.</h1><p>Stack Atlas is an engineering knowledge base for people who build and operate software. Articles are the canonical units of knowledge; learning paths are optional routes through them.</p></header><section class="about-grid"><article class="info-card"><span class="eyebrow">The Atlas</span><h2>One library, many domains</h2><p>Explore programming languages, databases, infrastructure, reliability and system design from one place.</p></article><article class="info-card"><span class="eyebrow">Learning</span><h2>Choose a route or roam</h2><p>Follow a learning path when sequence helps. Read any standalone article when you already know what you need.</p></article><article class="info-card"><span class="eyebrow">Publishing</span><h2>Static by design</h2><p>Pages are generated from versioned content and metadata. Search and local learning progress work in the browser.</p></article></section></main>'''
    write("about/index.html", shared_ui(about, "About", "Stack Atlas is an engineering knowledge base and learning platform.", "/about/", site, base_path))

    article_by_id = {article["id"]: article for article in articles}
    for article in articles:
        if not article.get("legacy") and article.get("source"):
            render_modern_article(article, article_by_id, paths, output, site, base_path)

    base_url = site.get("base_url", "").rstrip("/")
    sitemap_paths = ["/", "/topics/", "/paths/", "/articles/", "/about/"]
    sitemap_paths += [f"/topics/{domain['id']}/" for domain in domains]
    sitemap_paths += [f"/paths/{path['id']}/" for path in paths]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    if base_url:
        public_root = base_url + base_path
        sitemap += "\n" + "\n".join(f"  <url><loc>{xml_escape(public_root + path)}</loc></url>" for path in sitemap_paths)
        sitemap += "\n" + "\n".join(f"  <url><loc>{xml_escape(public_root + article['url'])}</loc></url>" for article in articles if not article.get("legacy"))
    sitemap += "\n</urlset>\n"
    write("sitemap.xml", sitemap)
    robots = "User-agent: *\nAllow: /\n"
    if base_url:
        robots += f"Sitemap: {base_url + base_path}/sitemap.xml\n"
    write("robots.txt", robots)


def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def validate_internal_links(root: Path, base_path: str = ""):
    errors = []
    documents = {}
    html_files = sorted(root.rglob("*.html"))
    excluded = {".git", ".github", "_site", "dist", "node_modules"}
    html_files = [file for file in html_files if not excluded.intersection(file.relative_to(root).parts)
                  and file.relative_to(root).parts[:2] != ("content", "articles")]
    for file in html_files:
        parser = LinkParser()
        try:
            parser.feed(file.read_text(encoding="utf-8"))
            documents[file.resolve()] = parser
        except OSError as exc:
            errors.append(f"Cannot read {file.relative_to(root)}: {exc}")
    for file, parser in documents.items():
        for href in parser.hrefs:
            parts = urlsplit(href)
            if parts.scheme or parts.netloc or href.startswith("//"):
                continue
            path_text = unquote(parts.path)
            if base_path and (path_text == base_path or path_text.startswith(base_path + "/")):
                path_text = path_text[len(base_path):] or "/"
            target = (root / path_text.lstrip("/")) if path_text.startswith("/") else (file.parent / path_text)
            if not path_text:
                target = file
            target = target.resolve()
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                errors.append(f"{file.relative_to(root)}: broken local link {href!r}")
                continue
            if parts.fragment and target.suffix.lower() == ".html":
                target_parser = documents.get(target)
                if target_parser is None:
                    target_parser = LinkParser()
                    target_parser.feed(target.read_text(encoding="utf-8"))
                    documents[target] = target_parser
                if unquote(parts.fragment) not in target_parser.ids:
                    errors.append(f"{file.relative_to(root)}: missing fragment {parts.fragment!r} in {target.relative_to(root)}")
    return errors, len(html_files)


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


CSS = r'''/* Stack Atlas shared design system */
:root{color-scheme:light;--bg:#f5f7fa;--surface:#fff;--surface-soft:#edf2f5;--surface-raised:#fff;--text:#17232d;--muted:#65737d;--line:#dce4e7;--brand:#087f70;--brand-strong:#05685d;--accent:#c8f36a;--ink:#14252c;--shadow:0 18px 55px rgba(20,37,44,.08);--radius:20px;--max:1160px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);line-height:1.65}a{color:inherit;text-decoration:none}button,input{font:inherit}button{color:inherit}.skip-link{position:absolute;left:-9999px;top:10px;background:var(--surface);padding:10px 14px;z-index:100}.skip-link:focus{left:12px}.site-header{height:72px;position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.header-inner{height:100%;max-width:var(--max);margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:800;letter-spacing:-.04em;color:var(--ink)}.brand-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:var(--accent);font-size:17px}.primary-nav{display:flex;align-items:center;gap:25px;font-size:13px;font-weight:650;color:var(--muted)}.primary-nav a:hover,.search-open:hover{color:var(--brand)}.primary-nav button{border:0;background:transparent;font-size:13px;font-weight:650;cursor:pointer}.search-open{padding:8px 12px;border:1px solid var(--line)!important;border-radius:9px}.theme-toggle{padding:8px 0}.menu-toggle{display:none;border:1px solid var(--line);background:var(--surface);padding:8px 12px;border-radius:9px}.hero-wrap{padding:74px 24px 78px;background:var(--surface);border-bottom:1px solid var(--line)}.hero{max-width:var(--max);min-height:440px;margin:auto;display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:54px}.eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--brand);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.status-dot{width:7px;height:7px;border-radius:99px;background:#8dbb54;box-shadow:0 0 0 4px #e7f2d7}.hero h1,.page-intro h1,.topic-hero h1,.path-hero h1{color:var(--ink);font-size:clamp(42px,6.4vw,76px);line-height:1.04;letter-spacing:-.065em;margin:20px 0}.hero h1 em{font-family:Georgia,serif;font-weight:500;color:var(--brand);letter-spacing:-.07em}.hero-copy>p{max-width:580px;color:var(--muted);font-size:17px}.hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;gap:14px;padding:12px 16px;border:1px solid transparent;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer}.button-primary{background:var(--brand);color:white}.button-primary:hover{background:var(--brand-strong)}.button-secondary{background:var(--surface);border-color:var(--line);color:var(--text)}kbd{font:600 11px ui-monospace,monospace;padding:2px 6px;border:1px solid var(--line);border-radius:5px;color:var(--muted)}.hero-proof{display:flex;flex-wrap:wrap;gap:23px;margin-top:34px;color:var(--muted);font-size:11px}.hero-proof span{display:grid;gap:0}.hero-proof strong{color:var(--ink);font-size:18px}.hero-art{position:relative;aspect-ratio:1.1/1;max-width:440px;width:100%;justify-self:end;display:grid;place-items:center;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--brand) 12%,var(--surface)) 0,transparent 68%)}.orbit{position:absolute;border:1px solid var(--line);border-radius:50%;transform:rotate(-28deg)}.orbit-one{width:94%;height:52%}.orbit-two{width:74%;height:88%;transform:rotate(42deg)}.orbit-core{z-index:1;width:142px;height:142px;border-radius:44px;background:var(--ink);color:white;display:grid;place-content:center;text-align:center;box-shadow:var(--shadow);transform:rotate(-7deg)}.core-symbol{color:var(--accent);font-size:40px;font-weight:900;line-height:1}.orbit-core b{font-size:10px;letter-spacing:.2em;line-height:1.2;margin-top:5px}.orbit-node{position:absolute;z-index:2;width:43px;height:43px;display:grid;place-items:center;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--brand);font-size:13px;font-weight:800;box-shadow:var(--shadow)}.node-code{top:13%;left:25%}.node-data{top:30%;right:5%}.node-cloud{bottom:20%;right:20%}.node-ops{bottom:24%;left:9%}.orbit-caption{position:absolute;bottom:1%;right:13%;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted)}.section{padding:78px 24px;max-width:var(--max);margin:auto}.section-soft{max-width:none;background:var(--surface-soft)}.section-soft>*{max-width:var(--max);margin-left:auto;margin-right:auto}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:27px}.section-heading h2,.topic-section h2,.group-heading h2{color:var(--ink);font-size:clamp(27px,3vw,38px);letter-spacing:-.05em;line-height:1.1;margin:9px 0}.section-heading p{max-width:550px;margin:8px 0 0;color:var(--muted);font-size:14px}.text-link{color:var(--brand);font-size:12px;font-weight:800;white-space:nowrap}.topic-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.topic-card{display:flex;align-items:center;gap:12px;min-height:78px;padding:14px;border:1px solid var(--line);border-radius:13px;background:var(--surface);transition:transform .18s,border-color .18s}.topic-card:hover,.article-card:hover,.path-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--brand) 40%,var(--line))}.topic-mark{width:37px;height:37px;flex:0 0 auto;display:grid;place-items:center;border-radius:11px;background:var(--surface-soft);color:var(--brand);font-weight:850}.topic-card>span:nth-child(2){display:grid;gap:2px;min-width:0}.topic-card strong{font-size:12px;color:var(--ink)}.topic-card small{font-size:10px;color:var(--muted)}.topic-card .arrow{margin-left:auto;color:var(--muted);font-size:12px}.path-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.path-card{display:flex;flex-direction:column;align-items:flex-start;min-height:220px;padding:25px;border:1px solid var(--line);border-radius:16px;background:var(--surface);transition:transform .18s,border-color .18s}.path-card h2,.path-card h3{font-size:24px;line-height:1.2;letter-spacing:-.04em;color:var(--ink);margin:14px 0 6px}.path-card p{margin:0;color:var(--muted);font-size:13px}.path-meta{margin-top:auto;padding-top:22px;color:var(--muted);font-size:11px}.path-card .text-link{margin-top:12px}.article-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.article-card{min-width:0;border:1px solid var(--line);border-radius:14px;background:var(--surface);transition:transform .18s,border-color .18s}.article-card>a{height:100%;min-height:210px;padding:18px;display:flex;flex-direction:column;align-items:flex-start}.card-kicker{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);font-weight:800}.article-card h3{font-size:16px;line-height:1.3;letter-spacing:-.025em;color:var(--ink);margin:13px 0 7px}.article-card p{font-size:11px;line-height:1.55;color:var(--muted);margin:0 0 14px}.article-card .text-link{margin-top:auto;font-size:10px}.continue-section{padding-top:35px}.continue-card{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:29px 32px;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.continue-card h2{font-size:23px;letter-spacing:-.04em;margin:8px 0 2px;color:var(--ink)}.continue-card p,.continue-card small{font-size:11px;color:var(--muted)}.progress-track{height:7px;width:min(380px,55vw);overflow:hidden;border-radius:999px;background:var(--surface-soft);margin-top:15px}.progress-track span{display:block;height:100%;width:0;border-radius:inherit;background:var(--brand);transition:width .2s}.page-shell{max-width:var(--max);margin:auto;padding:28px 24px 85px}.breadcrumbs{display:flex;flex-wrap:wrap;gap:9px;color:var(--muted);font-size:11px;margin:0 0 45px}.breadcrumbs a{color:var(--brand)}.page-intro{max-width:760px;margin-bottom:34px}.page-intro h1{font-size:clamp(40px,6vw,65px);margin:13px 0}.page-intro p{color:var(--muted);font-size:15px}.topic-grid-large{grid-template-columns:repeat(3,minmax(0,1fr))}.topic-hero{display:flex;align-items:center;gap:20px;padding:27px;background:var(--surface);border:1px solid var(--line);border-radius:17px;margin-bottom:32px}.topic-mark-large{width:58px;height:58px;font-size:22px;border-radius:16px}.topic-hero h1{font-size:42px;margin:5px 0}.topic-hero p{margin:0;color:var(--muted);font-size:13px}.topic-section{padding:19px 0 30px;border-bottom:1px solid var(--line)}.topic-section h2{font-size:21px;margin:0 0 14px}.inline-paths,.category-list{display:flex;flex-wrap:wrap;gap:8px}.inline-path,.category-chip{padding:9px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-size:11px;font-weight:700}.inline-path{color:var(--brand)}.category-chip{color:var(--text)}.category-chip span{margin-left:9px;color:var(--muted);font-size:10px}.topic-article-group{padding-top:25px}.section-heading.compact{align-items:center;margin-bottom:13px}.section-heading.compact h2{font-size:23px}.count-label{color:var(--muted);font-size:11px}.empty-topic{padding:50px 20px;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:17px}.empty-topic p{color:var(--muted)}.path-hero{display:grid;grid-template-columns:1fr 300px;gap:45px;align-items:end;padding:30px 32px;background:var(--ink);color:white;border-radius:20px;margin-bottom:48px}.path-hero h1{color:white;font-size:clamp(34px,5vw,55px);margin:12px 0}.path-hero p{max-width:650px;color:#c5d1d3;font-size:14px}.path-hero .eyebrow{color:var(--accent)}.path-stats{display:flex;gap:16px;margin-top:22px;color:#d4e0e1;font-size:11px}.path-progress{padding:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:13px}.path-progress strong,.path-progress small{display:block;font-size:11px}.path-progress .progress-track{width:100%;background:rgba(255,255,255,.15)}.path-progress .progress-track span{background:var(--accent)}.path-progress small{margin-top:10px;color:#b3c2c5}.path-group{margin:37px 0}.group-heading{display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid var(--line);margin-bottom:12px;padding-bottom:8px}.group-heading h2{font-size:26px}.module-card{padding:21px 22px;margin:12px 0;border:1px solid var(--line);border-radius:15px;background:var(--surface)}.module-heading{display:flex;justify-content:space-between;align-items:center;padding-bottom:15px}.module-heading h3{margin:3px 0;color:var(--ink);font-size:18px;letter-spacing:-.03em}.module-heading p{margin:0;color:var(--muted);font-size:10px}.module-label{font-size:9px;letter-spacing:.1em;color:var(--brand);font-weight:800;text-transform:uppercase}.module-count{font-size:25px;color:var(--line);font-weight:800}.path-article{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 0;border-top:1px solid var(--line)}.path-article-link{display:flex;align-items:flex-start;gap:12px;min-width:0}.article-number{width:27px;height:27px;display:grid;place-items:center;flex:0 0 auto;border-radius:8px;background:var(--surface-soft);font-size:9px;font-weight:800;color:var(--brand)}.article-copy{display:grid;gap:3px}.article-copy strong{font-size:12px;color:var(--ink)}.article-copy>span{font-size:10px;line-height:1.45;color:var(--muted)}.complete-toggle{flex:0 0 auto;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:7px 9px;font-size:9px;color:var(--muted);cursor:pointer}.complete-toggle[aria-pressed="true"]{border-color:#9acb83;background:#eff8e9;color:#42692e}.article-grid-list{grid-template-columns:repeat(3,minmax(0,1fr))}.listing-search{margin-top:21px}.about-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.info-card{padding:23px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}.info-card h2{font-size:19px;letter-spacing:-.04em;color:var(--ink)}.info-card p{font-size:12px;color:var(--muted)}.site-footer{padding:28px max(24px,calc((100vw - var(--max))/2));display:grid;grid-template-columns:1fr auto;gap:15px;background:var(--ink);color:white}.site-footer>div{display:flex;align-items:center;gap:14px}.footer-brand{font-size:15px;font-weight:850}.site-footer>div span,.site-footer small{font-size:10px;color:#afc0c2}.site-footer nav{display:flex;gap:17px;font-size:10px;color:#d0dddd}.site-footer small{grid-column:1/-1}.search-dialog{width:min(640px,calc(100% - 28px));max-height:min(80vh,700px);padding:0;border:1px solid var(--line);border-radius:17px;background:var(--surface);color:var(--text);box-shadow:0 30px 100px rgba(0,0,0,.23)}.search-dialog::backdrop{background:rgba(13,27,32,.55);backdrop-filter:blur(4px)}.dialog-top{display:flex;justify-content:space-between;align-items:start;padding:22px 23px 4px}.dialog-top h2{margin:4px 0;font-size:23px;letter-spacing:-.04em;color:var(--ink)}.icon-button{width:32px;height:32px;border:1px solid var(--line);border-radius:9px;background:var(--surface);font-size:22px;line-height:1;cursor:pointer}.search-label{position:absolute;left:-9999px}.search-dialog input{display:block;width:calc(100% - 46px);margin:12px 23px;padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);outline-color:var(--brand)}.search-filters{display:flex;gap:7px;padding:0 23px 14px}.filter-button{padding:6px 10px;border:1px solid var(--line);border-radius:99px;background:var(--surface);font-size:10px;cursor:pointer}.filter-button.is-active{background:var(--ink);border-color:var(--ink);color:white}.search-results{max-height:43vh;overflow:auto;padding:0 23px 20px}.search-result{display:block;padding:11px 0;border-top:1px solid var(--line)}.search-result strong{display:block;font-size:13px;color:var(--ink)}.search-result small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.result-kind{font-size:8px!important;text-transform:uppercase;letter-spacing:.1em;color:var(--brand)!important;font-weight:800}.empty-state{padding:15px;color:var(--muted);font-size:12px}[data-theme="dark"]{color-scheme:dark;--bg:#0e171b;--surface:#142126;--surface-soft:#192a30;--surface-raised:#1b2c31;--text:#dce7e5;--muted:#9aadaa;--line:#2a3d41;--brand:#67c6b4;--brand-strong:#80d8c5;--accent:#c8f36a;--ink:#e6efed;--shadow:0 18px 55px rgba(0,0,0,.22)}[data-theme="dark"] .brand-icon,[data-theme="dark"] .path-hero,[data-theme="dark"] .site-footer{background:#071014}[data-theme="dark"] .path-hero h1,[data-theme="dark"] .site-footer{color:#e6efed}[data-theme="dark"] .site-footer>div span,[data-theme="dark"] .site-footer small,[data-theme="dark"] .site-footer nav{color:#a5b6b6}[data-theme="dark"] .complete-toggle[aria-pressed="true"]{background:#263b2b;color:#b9e79e}[data-theme="dark"] .search-result strong{color:var(--ink)}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:12px}.hero-art{justify-self:center;max-width:350px}.topic-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.article-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.path-hero{grid-template-columns:1fr}.path-progress{max-width:440px}.topic-grid-large{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.site-header{height:auto;min-height:64px}.header-inner{min-height:64px;flex-wrap:wrap;padding:10px 18px}.menu-toggle{display:block;margin-left:auto}.primary-nav{display:none;order:3;width:100%;padding:8px 0 12px;flex-wrap:wrap;gap:13px 18px}.primary-nav.is-open{display:flex}.hero-wrap{padding:48px 20px}.hero{min-height:0}.hero h1{font-size:43px}.hero-proof{gap:17px}.section{padding:52px 20px}.section-heading{align-items:start;flex-direction:column}.topic-grid,.topic-grid-large{grid-template-columns:repeat(2,minmax(0,1fr))}.path-grid{grid-template-columns:1fr}.article-grid,.article-grid-list{grid-template-columns:1fr}.article-card>a{min-height:165px}.continue-card{align-items:flex-start;flex-direction:column;padding:22px}.progress-track{width:min(380px,75vw)}.page-shell{padding:22px 18px 60px}.breadcrumbs{margin-bottom:28px}.topic-hero{align-items:flex-start;padding:20px}.topic-hero h1{font-size:34px}.topic-mark-large{width:45px;height:45px}.path-hero{padding:23px 19px;gap:20px}.path-stats{flex-direction:column;gap:3px}.module-card{padding:15px 13px}.path-article{align-items:flex-start;flex-direction:column;gap:9px}.complete-toggle{margin-left:39px}.about-grid{grid-template-columns:1fr}.site-footer{grid-template-columns:1fr;padding:26px 20px}.site-footer>div{align-items:flex-start;flex-direction:column;gap:4px}.site-footer nav{flex-wrap:wrap}.site-footer small{grid-column:auto}}
@media(max-width:390px){.topic-grid,.topic-grid-large{grid-template-columns:1fr}.hero h1{font-size:37px}.hero-actions{align-items:stretch;flex-direction:column}}
'''


ARTICLE_CSS = r'''
.article-header{max-width:850px;margin:0 auto 35px;padding:28px 34px 30px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}.article-header h1{font-size:clamp(35px,5vw,58px);line-height:1.08;letter-spacing:-.06em;color:var(--ink);margin:13px 0}.article-header>p{font-size:16px;color:var(--muted);margin:0}.article-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:20px;color:var(--muted);font-size:10px}.article-meta>span{padding:5px 8px;border:1px solid var(--line);border-radius:99px}.article-meta .complete-toggle{margin-left:auto}.article-layout{max-width:1000px;margin:auto;display:grid;grid-template-columns:210px minmax(0,1fr);gap:36px;align-items:start}.article-sidebar{position:sticky;top:96px;display:grid;gap:13px}.article-toc,.path-context{padding:17px;border:1px solid var(--line);border-radius:13px;background:var(--surface)}.article-toc strong{display:block;margin-bottom:8px;color:var(--ink);font-size:11px}.article-toc a{display:block;margin:7px 0;color:var(--muted);font-size:10px;line-height:1.45}.article-toc .toc-level-3{padding-left:10px}.path-context{display:grid;gap:5px}.path-context span,.path-context strong{font-size:10px}.path-context span{color:var(--muted)}.path-context strong{color:var(--brand)}.article-body{min-width:0;padding:31px 38px;border:1px solid var(--line);border-radius:17px;background:var(--surface);font-size:15px;line-height:1.8}.article-body h2{scroll-margin-top:90px;margin:38px 0 12px;font-size:27px;line-height:1.2;letter-spacing:-.04em;color:var(--ink)}.article-body h2:first-child{margin-top:0}.article-body h3{margin:27px 0 8px;font-size:19px;line-height:1.3;color:var(--ink)}.article-body p,.article-body li{color:var(--text)}.article-body a:not(.related-link){color:var(--brand);text-decoration:underline;text-underline-offset:3px}.article-body pre{position:relative;overflow:auto;padding:17px;border:1px solid #27383d;border-radius:11px;background:#0b1519;color:#e3eeee;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}.article-body code{padding:2px 5px;border-radius:4px;background:var(--surface-soft);font:.9em ui-monospace,SFMono-Regular,Consolas,monospace}.article-body pre code{padding:0;background:transparent}.article-body .code-label{position:absolute;top:8px;right:12px;color:#9aa8bf;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.article-body blockquote{margin:20px 0;padding:12px 17px;border-left:3px solid var(--brand);background:var(--surface-soft);color:var(--muted)}.article-body table{display:block;max-width:100%;overflow:auto;border-collapse:collapse;font-size:12px}.article-body th,.article-body td{padding:8px 10px;border:1px solid var(--line);text-align:left}.article-body th{background:var(--surface-soft)}.article-body .figure{margin:24px 0;padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--surface-soft);overflow:auto}.article-body .figure svg{display:block;width:100%;height:auto}.article-body .figure figcaption{margin-top:9px;color:var(--muted);text-align:center;font-size:10px}.article-body .callout{margin:22px 0;padding:16px 18px;border:1px solid color-mix(in srgb,var(--brand) 25%,var(--line));border-radius:12px;background:color-mix(in srgb,var(--brand) 7%,var(--surface))}.article-body .callout strong{display:block;margin-bottom:4px;color:var(--brand)}.article-body .warn{border-color:#e8c89e;background:color-mix(in srgb,#f0a743 9%,var(--surface))}.article-body .warn strong{color:#9a5c13}.article-body .note{border-color:#c9b7ea;background:color-mix(in srgb,#9771d2 8%,var(--surface))}.article-body .note strong{color:#7050a2}.article-body .checklist{padding-left:0;list-style:none}.article-body .checklist li{position:relative;padding:7px 0 7px 26px}.article-body .checklist li:before{content:"✓";position:absolute;left:0;color:var(--brand);font-weight:900}.article-body .refs{color:var(--muted);font-size:12px}.article-related{margin-top:34px;padding-top:19px;border-top:1px solid var(--line)}.article-related h2{margin:0 0 11px;font-size:20px}.article-related>div{display:flex;flex-wrap:wrap;gap:8px}.related-link{padding:7px 10px;border:1px solid var(--line);border-radius:8px;color:var(--brand);font-size:11px}.article-previous-next{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:35px;padding-top:17px;border-top:1px solid var(--line)}.article-previous-next>a{display:grid;gap:3px;padding:12px;border:1px solid var(--line);border-radius:9px}.article-previous-next>a:last-child{text-align:right}.article-previous-next small{color:var(--muted);font-size:9px}.article-previous-next strong{font-size:11px;color:var(--brand)}
@media(max-width:760px){.article-layout{grid-template-columns:1fr;gap:14px}.article-sidebar{position:static}.article-header{padding:23px 20px}.article-body{padding:24px 20px}.article-meta .complete-toggle{margin-left:0}}
'''


JS = r'''(() => {
  const BASE_PATH = __BASE_PATH__;
  const progressKey = 'stack-atlas-progress-v1';
  const memoryStore = { completed: [] };
  const LocalStorageProgressStore = {
    async getProgress() {
      try { return JSON.parse(localStorage.getItem(progressKey) || '{"completed":[]}'); }
      catch (_) { return memoryStore; }
    },
    async markComplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = [...new Set([...(progress.completed || []), articleId])];
      try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { Object.assign(memoryStore, progress); }
      return progress;
    },
    async markIncomplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = (progress.completed || []).filter(id => id !== articleId);
      try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { Object.assign(memoryStore, progress); }
      return progress;
    }
  };

  const themeButton = document.querySelector('[data-theme-toggle]');
  const savedTheme = localStorage.getItem('stack-atlas-theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
  const updateThemeButton = () => { if (themeButton) themeButton.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  updateThemeButton();
  themeButton?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    localStorage.setItem('stack-atlas-theme', dark ? 'dark' : 'light'); updateThemeButton();
  });

  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('is-open', open);
  });

  const dialog = document.querySelector('#search-dialog');
  const searchInput = document.querySelector('#site-search');
  document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => {
    if (dialog && !dialog.open) { dialog.showModal(); setTimeout(() => searchInput?.focus(), 30); }
  }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); dialog?.showModal(); searchInput?.focus(); }
    if (event.key === 'Escape' && dialog?.open) dialog.close();
  });
  let searchIndex = null;
  let searchFilter = 'all';
  const results = document.querySelector('#search-results');
  const renderResults = () => {
    if (!results || !searchInput) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    if (!query) { results.innerHTML = '<p class="empty-state">Type to search articles, topics and learning paths.</p>'; return; }
    if (!searchIndex) { results.innerHTML = '<p class="empty-state">Loading the library…</p>'; return; }
    const all = [
      ...(searchIndex.articles || []).map(item => ({...item, kind: 'article', label: 'Article'})),
      ...(searchIndex.domains || []).map(item => ({...item, kind: 'topic', url: `/topics/${item.id}/`, label: 'Topic'})),
      ...(searchIndex.paths || []).map(item => ({...item, kind: 'path', url: `/paths/${item.id}/`, label: 'Learning Path'}))
    ];
    const matches = all.filter(item => (searchFilter === 'all' || searchFilter === item.kind) && `${item.title} ${item.description || ''} ${item.domain || ''} ${(item.tags || []).join(' ')}`.toLocaleLowerCase().includes(query)).slice(0, 20);
    if (!matches.length) { results.innerHTML = '<p class="empty-state">No matches. Try another term.</p>'; return; }
    results.innerHTML = matches.map(item => `<a class="search-result" href="${BASE_PATH}${item.url}"><span class="result-kind">${item.label}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || item.domain || '')}</small></a>`).join('');
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  searchInput?.addEventListener('input', renderResults);
  document.querySelectorAll('[data-search-filter]').forEach(button => button.addEventListener('click', () => {
    searchFilter = button.dataset.searchFilter;
    document.querySelectorAll('[data-search-filter]').forEach(item => item.classList.toggle('is-active', item === button)); renderResults();
  }));
  const syncPathNavigation = () => {
    const navigation = document.querySelector('[data-path-navigation]');
    const articlePage = document.querySelector('.article-page[data-article-id]');
    if (!navigation || !articlePage || !searchIndex) return;
    const requestedPath = new URLSearchParams(location.search).get('path') || navigation.dataset.pathNavigation;
    const path = (searchIndex.paths || []).find(item => item.id === requestedPath);
    if (!path) return;
    const articleId = articlePage.dataset.articleId;
    const sequence = (searchIndex.articles || []).flatMap(item => (item.learning_paths || []).filter(member => member === requestedPath || (typeof member === 'object' && member.path_id === requestedPath)).map(member => {
      const moduleId = typeof member === 'object' ? member.module_id : path.modules.find(module => module.article_ids.includes(item.id))?.id;
      return {...item, order: typeof member === 'object' ? member.order : item.path_order, module_id: moduleId};
    })).sort((a, b) => a.order - b.order);
    const position = sequence.findIndex(item => item.id === articleId);
    if (position < 0) return;
    const makeLink = (item, label, side) => {
      if (!item) return document.createElement('span');
      const anchor = document.createElement('a');
      anchor.href = `${BASE_PATH}${item.url}?path=${encodeURIComponent(requestedPath)}`;
      if (side === 'next') anchor.style.textAlign = 'right';
      const small = document.createElement('small'); small.textContent = label;
      const strong = document.createElement('strong'); strong.textContent = item.title;
      anchor.append(small, strong);
      return anchor;
    };
    navigation.replaceChildren(makeLink(sequence[position - 1], 'Previous', 'previous'), makeLink(sequence[position + 1], 'Next', 'next'));
    navigation.dataset.pathNavigation = requestedPath;
    const context = document.querySelector('[data-path-context]');
    if (context) {
      const currentModule = path.modules.find(module => module.id === sequence[position].module_id);
      const modulePosition = currentModule?.article_ids.indexOf(articleId) ?? -1;
      context.href = `${BASE_PATH}${path.url}`;
      context.querySelector('span').textContent = `Part of ${path.title}`;
      context.querySelector('strong').textContent = currentModule ? `${currentModule.title} · Lesson ${String(modulePosition + 1).padStart(2, '0')}` : path.title;
    }
  };
  if (dialog) fetch(`${BASE_PATH}/search-index.json`).then(response => response.json()).then(index => { searchIndex = index; renderResults(); syncPathNavigation(); }).catch(() => { if (results) results.innerHTML = '<p class="empty-state">Search is temporarily unavailable.</p>'; });

  const paintProgress = async () => {
    const progress = await LocalStorageProgressStore.getProgress();
    const completed = new Set(progress.completed || []);
    document.querySelectorAll('[data-progress-toggle]').forEach(button => {
      const done = completed.has(button.dataset.progressToggle);
      button.setAttribute('aria-pressed', String(done)); button.textContent = done ? '✓ Completed' : 'Mark complete';
    });
    document.querySelectorAll('[data-progress-path]').forEach(container => {
      const ids = [...container.querySelectorAll('[data-article-id]')].map(item => item.dataset.articleId);
      const count = ids.filter(id => completed.has(id)).length;
      const percent = ids.length ? Math.round(count / ids.length * 100) : 0;
      container.querySelectorAll('[data-progress-bar]').forEach(bar => bar.style.width = `${percent}%`);
      container.querySelectorAll('[data-progress-label]').forEach(label => label.textContent = container.classList.contains('path-page') ? `${count} / ${ids.length} complete` : `${count} of ${ids.length} lessons completed`);
      const continueLink = container.querySelector('[data-continue-link]');
      const continueCopy = container.querySelector('[data-continue-copy]');
      if (continueLink && ids.length) {
        const firstIncomplete = [...container.querySelectorAll('[data-article-id]')].find(item => !completed.has(item.dataset.articleId));
        const nextLink = firstIncomplete?.querySelector('.path-article-link');
        if (firstIncomplete) { continueLink.href = nextLink?.href || `${BASE_PATH}${firstIncomplete.dataset.articleUrl}`; continueLink.innerHTML = 'Continue learning <span aria-hidden="true">→</span>'; continueCopy.textContent = firstIncomplete.querySelector('strong')?.textContent || firstIncomplete.dataset.articleTitle || 'Resume your learning path.'; }
        else { continueLink.href = `${BASE_PATH}/paths/`; continueLink.innerHTML = 'Explore learning paths <span aria-hidden="true">→</span>'; continueCopy.textContent = 'You completed this path. Choose another route through the Atlas.'; }
      }
    });
  };
  document.querySelectorAll('[data-progress-toggle]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.progressToggle;
    if (button.getAttribute('aria-pressed') === 'true') await LocalStorageProgressStore.markIncomplete(id); else await LocalStorageProgressStore.markComplete(id);
    paintProgress();
  }));
  paintProgress();
})();
'''


FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#14252c"/><path d="M18 14h30v8H27v8h18v8H27v12h-9z" fill="#c8f36a"/></svg>\n'''


if __name__ == "__main__":
    raise SystemExit(main())

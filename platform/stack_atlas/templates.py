"""Reusable HTML templates and canonical page rendering helpers."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from stack_atlas.catalog import ROOT, clean_text, ordered_modules, slug
from stack_atlas.files import write_file

def site_url(path: str, base_path: str) -> str:
    clean_path = "/" + path.lstrip("/")
    return base_path.rstrip("/") + clean_path

def shared_ui(content: str, title: str, description: str, canonical_path: str, site: dict, base_path: str) -> str:
    safe_title = html.escape(title)
    title_tag = safe_title if title == site.get("name") else f"{safe_title} · {html.escape(site.get('name', 'Stack Atlas'))}"
    canonical = ""
    if site.get("base_url"):
        canonical_url = site["base_url"].rstrip("/") + base_path.rstrip("/") + canonical_path
        canonical = f'<link rel="canonical" href="{html.escape(canonical_url, quote=True)}">'
    template = (ROOT / "platform/templates/base.html").read_text(encoding="utf-8")
    values = {
        "__LANGUAGE__": html.escape(site.get("language", "en"), quote=True),
        "__TITLE__": title_tag,
        "__DESCRIPTION__": html.escape(description, quote=True),
        "__CANONICAL__": canonical,
        "__FAVICON_URL__": html.escape(site_url("/assets/favicon.svg", base_path), quote=True),
        "__TOKENS_CSS_URL__": html.escape(site_url("/assets/tokens.css", base_path), quote=True),
        "__CSS_URL__": html.escape(site_url("/assets/site.css", base_path), quote=True),
        "__PROGRESS_JS_URL__": html.escape(site_url("/assets/progress-store.js", base_path), quote=True),
        "__PATH_CONTEXT_JS_URL__": html.escape(site_url("/assets/path-context.js", base_path), quote=True),
        "__API_CLIENT_JS_URL__": html.escape(site_url("/assets/api-client.js", base_path), quote=True),
        "__JS_URL__": html.escape(site_url("/assets/site.js", base_path), quote=True),
        "__HOME_URL__": html.escape(site_url("/", base_path), quote=True),
        "__EXPLORE_URL__": html.escape(site_url("/#topics", base_path), quote=True),
        "__PATHS_URL__": html.escape(site_url("/paths/", base_path), quote=True),
        "__TOPICS_URL__": html.escape(site_url("/topics/", base_path), quote=True),
        "__ARTICLES_URL__": html.escape(site_url("/articles/", base_path), quote=True),
        "__ABOUT_URL__": html.escape(site_url("/about/", base_path), quote=True),
    }
    for token, value in values.items():
        template = template.replace(token, value)
    return template.replace("__CONTENT__", content).replace("</body>\n</html>", "</body></html>").rstrip("\n")

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
    matches = list(pattern.finditer(body))
    reserved_ids = {
        found.group(1)
        for match in matches
        if (found := re.search(r'\bid=["\']([^"\']+)["\']', match.group(2)))
    }
    used_ids = set()
    slug_counts = {}
    for match in matches:
        level, attrs, raw_title = match.group(1), match.group(2), match.group(3)
        title = clean_text(re.sub(r"<[^>]+>", " ", raw_title))
        id_match = re.search(r'\bid=["\']([^"\']+)["\']', attrs)
        if id_match:
            heading_id = id_match.group(1)
            used_ids.add(heading_id)
        else:
            base_id = slug(title) or "section"
            candidate = base_id
            suffix = slug_counts.get(base_id, 1)
            while candidate in used_ids or candidate in reserved_ids:
                suffix += 1
                candidate = f"{base_id}-{suffix}"
            heading_id = candidate
            slug_counts[base_id] = suffix
            used_ids.add(heading_id)
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
    membership_links = []
    for membership in path_memberships:
        path_id = membership.get("path_id") if isinstance(membership, dict) else membership
        path = next((item for item in paths if item["id"] == path_id), None)
        module_id = membership.get("module_id") if isinstance(membership, dict) else None
        module = next((item for item in path.get("modules", []) if item["id"] == module_id), None) if path else None
        if not path or not module or not any(item.get("id") == article["id"] for item in module.get("articles", [])):
            continue
        label = path["title"]
        if len(path_memberships) > 1:
            label += f" · {module['title']}"
        href = site_url(article["url"] + "?path=" + path_id, base_path)
        membership_links.append(f'<a class="related-link" href="{esc(href)}">{esc(label)}</a>')
    path_context = (
        f'<section class="article-path-memberships" data-article-paths><strong>Appears in</strong><div>{"".join(membership_links)}</div></section>'
        if membership_links else ""
    )
    updated_date = article.get("updated_at")
    review = article.get("review") or {}
    review_date = article.get("last_reviewed") or review.get("last_reviewed")
    status_date = updated_date or review_date
    status_label = "Updated" if updated_date else "Reviewed"
    article_level = article.get("difficulty") if article.get("difficulty") != "unspecified" else ""
    eyebrow = " · ".join(part for part in (article["domain"].replace("-", " ").title(), category_title.replace("-", " ").title(), article_level.title()) if part)
    article_html = f'''<main id="main" class="page-shell article-page" data-article-id="{esc(article["id"])}"><div class="breadcrumbs"><a href="{esc(site_url("/", base_path))}">Stack Atlas</a><span>/</span>{crumbs}<span>/</span>{esc(article["title"])}</div><header class="article-header"><span class="eyebrow">{esc(eyebrow)}</span><h1>{esc(article["title"])}</h1><p>{esc(article["description"])}</p><div class="article-meta"><span>{esc(article["domain"].replace("-", " ").title())}</span>{f'<span>{status_label} {esc(status_date)}</span>' if status_date else ''}<button class="complete-toggle" type="button" data-progress-toggle="{esc(article["id"])}" aria-pressed="false">Mark complete</button></div></header><div class="article-layout"><aside class="article-sidebar">{f'<nav class="article-toc"><strong>On this page</strong>{contents}</nav>' if contents else ''}{path_context}</aside><article class="article-body">{body}{labs_section}{f'<section class="article-related"><h2>Before reading</h2><div>{prereqs}</div></section>' if prereqs else ''}{f'<section class="article-related"><h2>Related Articles</h2><div>{related}</div></section>' if related else ''}</article></div></main>'''
    route = article["url"].strip("/")
    destination = output / route / "index.html"
    write_file(destination, shared_ui(article_html, article["title"], article["description"], article["url"], site, base_path))
    for legacy_url in article.get("legacy_urls", []):
        redirect_url = site_url(article["url"], base_path)
        canonical = ""
        if site.get("base_url"):
            canonical_url = site["base_url"].rstrip("/") + base_path + article["url"]
            canonical = f'<link rel="canonical" href="{esc(canonical_url)}">'
        redirect_page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={esc(redirect_url)}">{canonical}<title>Article moved · Stack Atlas</title></head><body><p>This article moved to <a href="{esc(redirect_url)}">{esc(article["title"])}</a>.</p><script>window.location.replace({json.dumps(redirect_url)} + window.location.search + window.location.hash);</script></body></html>'''
        redirect_path = (output / legacy_url.lstrip("/")).resolve()
        if redirect_path.is_relative_to(output.resolve()):
            write_file(redirect_path, redirect_page)

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
    return f'''<section class="module-card" id="module-{esc(module['id'])}"><div class="module-heading"><div><span class="module-label">Module {module['order']:02d} · {esc(module.get('domain', '').replace('-', ' ').title())}</span><h3>{esc(module['title'])}</h3><p>{len(articles)} lessons · {esc(module.get('category', '').replace('-', ' ').title())}</p></div><span class="module-count">{module['order']:02d}</span></div><div class="path-articles">{''.join(rows)}</div></section>'''

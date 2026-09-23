"""Render the validated catalog into deterministic static routes."""

from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from stack_atlas.catalog import ROOT, ordered_modules, path_sequence
from stack_atlas.files import write_file
from stack_atlas.search import build_search_index
from stack_atlas.templates import (
    article_card, esc, module_block, path_card, render_modern_article, shared_ui,
    site_url, topic_card,
)

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
    css = (ROOT / "src/styles/site.css").read_text(encoding="utf-8")
    javascript = (ROOT / "src/scripts/site.js").read_text(encoding="utf-8")
    progress_store = (ROOT / "src/scripts/progress-store.js").read_text(encoding="utf-8")
    path_context = (ROOT / "src/scripts/path-context.js").read_text(encoding="utf-8")
    favicon = (ROOT / "src/assets/favicon.svg").read_text(encoding="utf-8")
    write("assets/site.css", "/* GENERATED FILE — edit src/styles/site.css */\n" + css)
    write("assets/progress-store.js", "// GENERATED FILE — edit src/scripts/progress-store.js\n" + progress_store)
    write("assets/path-context.js", "// GENERATED FILE — edit src/scripts/path-context.js\n" + path_context)
    write("assets/site.js", "// GENERATED FILE — edit src/scripts/site.js\n" + javascript.replace("__BASE_PATH__", json.dumps(base_path)))
    write("assets/favicon.svg", favicon)
    write("search-index.json", json.dumps(build_search_index(domains, paths, articles), ensure_ascii=False, indent=2) + "\n")

    published_domains = [domain for domain in domains if by_domain[domain["id"]] or domain.get("status") == "planned"]
    topic_grid = "".join(topic_card(domain, len(by_domain[domain["id"]]), base_path) for domain in published_domains)
    path_cards = "".join(path_card(path, base_path) for path in paths if path.get("status") == "published")
    recently_updated = sorted(
        (article for article in articles if article.get("updated_at")),
        key=lambda article: article["updated_at"],
        reverse=True,
    )[:8]
    recent_articles_markup = (
        f'<div class="article-grid">{"".join(article_card(article, base_path) for article in recently_updated)}</div>'
        if recently_updated else '<p class="empty-state">No article update dates have been recorded yet.</p>'
    )
    home = f'''<main id="main">
      <section class="hero-wrap"><div class="hero"><div class="hero-copy"><span class="eyebrow"><span class="status-dot"></span> Engineering Knowledge Base</span><h1>Engineering knowledge,<br><em>from code to infrastructure.</em></h1><p>Explore practical articles, deep dives and structured learning paths across the systems engineers build and run.</p><div class="hero-actions"><a class="button button-primary" href="{esc(site_url('/topics/', base_path))}">Explore topics <span aria-hidden="true">→</span></a><button class="button button-secondary" type="button" data-open-search>Search the Atlas <kbd>/</kbd></button></div><div class="hero-proof"><span><strong>{len(articles)}</strong> articles</span><span><strong>{len([d for d in domains if by_domain[d['id']]])}</strong> topics with content</span><span><strong>{sum(len(p.get('modules', [])) for p in paths)}</strong> learning modules</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit-core"><span class="core-symbol">S</span><b>STACK<br>ATLAS</b></div><span class="orbit-node node-code">{{</span><span class="orbit-node node-data">DB</span><span class="orbit-node node-cloud">☁</span><span class="orbit-node node-ops">⌘</span><span class="orbit-caption">one map · many routes</span></div></div></section>
      <section class="section section-soft" id="topics"><div class="section-heading"><div><span class="eyebrow">Explore the Atlas</span><h2>Explore by topic</h2><p>Find knowledge by the technology or engineering subject you want to understand.</p></div><a class="text-link" href="{esc(site_url('/topics/', base_path))}">All topics <span aria-hidden="true">→</span></a></div><div class="topic-grid">{topic_grid}</div></section>
      <section class="section"><div class="section-heading"><div><span class="eyebrow">Curated routes</span><h2>Learning paths</h2><p>Study selected articles in an order that builds useful mental models.</p></div><a class="text-link" href="{esc(site_url('/paths/', base_path))}">All paths <span aria-hidden="true">→</span></a></div><div class="path-grid">{path_cards}</div></section>
      <section class="section section-soft" id="latest"><div class="section-heading"><div><span class="eyebrow">From the library</span><h2>Recently Updated</h2><p>Articles appear here after their update date is recorded.</p></div><a class="text-link" href="{esc(site_url('/articles/', base_path))}">Browse all {len(articles)} articles <span aria-hidden="true">→</span></a></div>{recent_articles_markup}</section>
      <section class="section continue-section" data-continue-learning><div class="continue-card" data-active-path-panel hidden><div><span class="eyebrow">Your active path</span><h2 data-active-path-title>Continue learning</h2><p data-continue-copy>Progress is saved in this browser.</p><div class="progress-track"><span data-progress-bar></span></div><small data-progress-label>0 lessons completed</small></div><a class="button button-primary" data-continue-link href="{esc(site_url('/paths/', base_path))}">Continue learning <span aria-hidden="true">→</span></a></div><div data-path-choices><div class="section-heading"><div><span class="eyebrow">Your learning</span><h2>Choose a learning path</h2><p>Open a path to make it active and keep your place as you learn.</p></div></div><div class="path-grid">{path_cards}</div></div></section>
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
        for module in ordered_modules(path):
            if module.get("group") not in group_order:
                group_order.append(module.get("group"))
        for group in group_order:
            modules = [module for module in ordered_modules(path) if module.get("group") == group]
            groups.append(f'<section class="path-group"><div class="group-heading"><span class="eyebrow">Learning path section</span><h2>{esc(group)}</h2></div>{"".join(module_block(module, path["id"], base_path) for module in modules)}</section>')
        lesson_count = len(path_sequence(path))
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

"""Validate generated local routes and document fragments."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute in ("href", "src"):
            if attribute in attrs:
                self.hrefs.append(attrs[attribute])
        if "id" in attrs:
            self.ids.add(attrs["id"])

def validate_internal_links(root: Path, base_path: str = ""):
    errors = []
    documents = {}
    html_files = sorted(root.rglob("*.html"))
    excluded = {".git", ".github", "_site", "dist", "node_modules"}
    html_files = [file for file in html_files if not excluded.intersection(file.relative_to(root).parts)
                  and file.relative_to(root).parts[:2] not in {("content", "articles"), ("src", "templates")}]
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

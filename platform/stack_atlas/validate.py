"""Repository, content-catalog, and generated-tree validation."""

from __future__ import annotations

from pathlib import Path

from stack_atlas.catalog import CONTENT, ROOT, make_catalog


GENERATED_ROOT_DIRS = {"about", "articles", "assets", "paths", "topics"}
GENERATED_ROOT_FILES = {"index.html", "search-index.json", "sitemap.xml", "robots.txt"}


def validate_repository_structure(root: Path = ROOT) -> list[str]:
    errors = []
    seasons = sorted(path.name for path in root.glob("season-*") if path.is_dir())
    if seasons:
        errors.append("Legacy season directories must not exist at repository root: " + ", ".join(seasons))
    generated_dirs = sorted(name for name in GENERATED_ROOT_DIRS if (root / name).exists())
    if generated_dirs:
        errors.append("Generated site directories must not exist at repository root: " + ", ".join(generated_dirs))
    generated_files = sorted(name for name in GENERATED_ROOT_FILES if (root / name).exists())
    if generated_files:
        errors.append("Generated site files must not exist at repository root: " + ", ".join(generated_files))
    for legacy_name in ("src", "stack_atlas", "requirements.txt"):
        if (root / legacy_name).exists():
            errors.append(f"Legacy layout path remains at repository root: {legacy_name}")

    flat_metadata = sorted((CONTENT / "articles").rglob("*.json"))
    if flat_metadata:
        errors.append(f"Flat JSON article metadata remains ({len(flat_metadata)} files)")
    flat_bodies = sorted(path for path in (CONTENT / "articles").rglob("*.html") if path.name != "article.html")
    if flat_bodies:
        errors.append(f"Flat HTML article bodies remain ({len(flat_bodies)} files)")
    return errors


def validate_catalog() -> tuple[list, list, list, list, list[str]]:
    domains, categories, paths, articles, errors = make_catalog()
    errors.extend(validate_repository_structure())
    if (CONTENT / "domains.json").exists() or (CONTENT / "categories.json").exists() or (CONTENT / "site.json").exists():
        errors.append("Human-authored catalog metadata must use YAML")
    if any((CONTENT / "paths").glob("*.json")):
        errors.append("Learning-path metadata must use YAML")
    if not errors:
        from stack_atlas.redirects import build_legacy_redirects

        try:
            build_legacy_redirects(articles, paths)
        except ValueError as exc:
            errors.append(str(exc))
    return domains, categories, paths, articles, errors

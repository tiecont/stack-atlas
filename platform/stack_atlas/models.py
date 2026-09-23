"""Typed shapes for the human-authored content catalog."""

from __future__ import annotations

from typing import TypedDict


class PathMembership(TypedDict):
    path_id: str
    module_id: str


class PathModule(TypedDict, total=False):
    id: str
    title: str
    order: int
    domain: str
    category: str
    group: str
    article_ids: list[str]


class LearningPath(TypedDict, total=False):
    id: str
    title: str
    description: str
    status: str
    modules: list[PathModule]


class Article(TypedDict, total=False):
    schema_version: int
    id: str
    title: str
    description: str
    type: str
    domain: str
    category: str
    tags: list[str]
    difficulty: str
    learning_paths: list[PathMembership]
    prerequisites: list[str]
    related: list[str]
    labs: list[str]
    status: str
    url: str
    legacy_urls: list[str]
    review: dict

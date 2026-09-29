'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchKind, SearchResult } from '@/lib/content/search';
import { sitePath } from '@/lib/site-path';

const filters: Array<{ id: SearchKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'article', label: 'Articles' },
  { id: 'topic', label: 'Topics' },
  { id: 'path', label: 'Learning Paths' },
];

export function SearchTrigger({ children = 'Search the Atlas' }: { children?: ReactNode }) {
  return (
    <button
      className="button button-secondary"
      type="button"
      data-open-search
      onClick={() => document.dispatchEvent(new Event('stack-atlas:open-search'))}
    >
      {children}
    </button>
  );
}

export function SearchDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchKind | 'all'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const open = () => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
      window.setTimeout(() => input.current?.focus(), 20);
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener('stack-atlas:open-search', open);
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('stack-atlas:open-search', open);
      document.removeEventListener('keydown', keydown);
    };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const params = new URLSearchParams({ q: normalized, kind: filter });
        const response = await fetch(sitePath(`/api/search?${params}`), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search returned ${response.status}`);
        const payload = (await response.json()) as { results: SearchResult[] };
        setResults(payload.results);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, filter]);

  const openSearch = () => document.dispatchEvent(new Event('stack-atlas:open-search'));
  return (
    <>
      <button className="search-open" type="button" data-open-search onClick={openSearch}>
        Search
      </button>
      <dialog
        className="search-dialog"
        aria-labelledby="search-title"
        id="search-dialog"
        ref={dialog}
      >
        <form method="dialog" className="dialog-top">
          <div>
            <span className="eyebrow">Stack Atlas</span>
            <h2 id="search-title">Search the Atlas</h2>
          </div>
          <button className="icon-button" aria-label="Close search">
            ×
          </button>
        </form>
        <label className="search-label" htmlFor="site-search">
          Search topics, articles and learning paths
        </label>
        <input
          id="site-search"
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “goroutine” or “PostgreSQL”"
          autoComplete="off"
        />
        <div className="search-filters" role="group" aria-label="Filter search results">
          {filters.map((item) => (
            <button
              className={`filter-button${filter === item.id ? ' is-active' : ''}`}
              data-search-filter={item.id}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="search-results" id="search-results" aria-live="polite">
          {!query.trim() ? (
            <p className="empty-state">Type to search article text, topics and learning paths.</p>
          ) : loading ? (
            <p className="empty-state">Searching the library…</p>
          ) : failed ? (
            <p className="empty-state">Search is temporarily unavailable.</p>
          ) : results.length ? (
            results.map((item) => (
              <Link
                className="search-result"
                href={sitePath(item.url)}
                key={`${item.kind}:${item.id}`}
                onClick={() => dialog.current?.close()}
              >
                <span className="result-kind">{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.description || item.domain || ''}</small>
              </Link>
            ))
          ) : (
            <p className="empty-state">No matches. Try another term.</p>
          )}
        </div>
      </dialog>
    </>
  );
}

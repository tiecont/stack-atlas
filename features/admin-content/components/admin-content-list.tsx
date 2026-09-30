'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from '../admin-content.module.css';
import {
  CONTENT_STATUSES,
  createAdminContentService,
  type ContentItem,
  type ContentStatus,
} from '../admin-content.service';
import { AdminContentError } from './admin-content-error';
import { contentStatusText, ContentStatusLabel } from './content-status';

const service = createAdminContentService();
const EMPTY_ITEMS: ContentItem[] = [];

export function AdminContentList() {
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<{
    key: string;
    items: ContentItem[];
    nextCursor: string | null;
    error: unknown | null;
  }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = `${status}:${refreshKey}`;
  const currentResult = result?.key === requestKey ? result : undefined;
  const items = currentResult?.items ?? EMPTY_ITEMS;
  const nextCursor = currentResult?.nextCursor ?? null;
  const error = currentResult?.error ?? null;
  const loading = currentResult === undefined;

  useEffect(() => {
    let current = true;
    void service
      .listContent({ status: status || undefined })
      .then((page) => {
        if (!current) return;
        setResult({ key: requestKey, items: page.items, nextCursor: page.nextCursor, error: null });
      })
      .catch((cause: unknown) => {
        if (current) setResult({ key: requestKey, items: [], nextCursor: null, error: cause });
      });
    return () => {
      current = false;
    };
  }, [requestKey, status]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.title, item.contentKey, item.slug].some((value) =>
        value.toLocaleLowerCase().includes(term),
      ),
    );
  }, [items, search]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await service.listContent({ status: status || undefined, cursor: nextCursor });
      setResult((current) => {
        if (!current || current.key !== requestKey) return current;
        const existing = new Set(current.items.map((item) => item.contentId));
        return {
          ...current,
          items: [...current.items, ...page.items.filter((item) => !existing.has(item.contentId))],
          nextCursor: page.nextCursor,
          error: null,
        };
      });
    } catch (cause) {
      setResult((current) =>
        current?.key === requestKey ? { ...current, error: cause } : current,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className="eyebrow">Authoring</span>
          <h1>Content</h1>
          <p>Manage structured content, immutable revisions, and publication records.</p>
        </div>
        <Link className={styles.primaryLink} href="/admin/content/new/">
          New content
        </Link>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.fieldLabel}>
          Search content
          <input
            aria-label="Search content"
            className={styles.input}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, content key, or slug"
            type="search"
            value={search}
          />
        </label>
        <label className={styles.fieldLabel}>
          Status
          <select
            aria-label="Filter by status"
            className={styles.select}
            onChange={(event) => setStatus(parseStatusFilter(event.target.value))}
            value={status}
          >
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((contentStatus) => (
              <option key={contentStatus} value={contentStatus}>
                {contentStatusText(contentStatus)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && !items.length ? (
        <AdminContentError
          action="read content"
          error={error}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
      ) : loading ? (
        <div aria-busy="true" className={styles.loadingState} role="status">
          <p>Loading content…</p>
        </div>
      ) : !visibleItems.length ? (
        <section className={styles.emptyState}>
          <h2>{search ? 'No matching content' : 'No content found'}</h2>
          <p>
            {search
              ? 'Try another title, content key, or slug.'
              : 'Create a content item to begin.'}
          </p>
        </section>
      ) : (
        <>
          <div className={styles.tableFrame}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Content key</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Status</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Published</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.contentId}>
                    <td>
                      <Link
                        className={styles.titleLink}
                        href={`/admin/content/${encodeURIComponent(item.contentId)}/`}
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td>
                      <code>{item.contentKey}</code>
                    </td>
                    <td>
                      <span className={styles.slug}>{item.slug}</span>
                    </td>
                    <td>
                      <ContentStatusLabel status={item.status} />
                    </td>
                    <td>{item.latestRevisionNumber ? `R${item.latestRevisionNumber}` : '—'}</td>
                    <td>
                      {item.publishedRevisionId ? (
                        <code title={item.publishedRevisionId}>
                          {shortId(item.publishedRevisionId)}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span>
              Showing {visibleItems.length} of {items.length} loaded records
            </span>
            {nextCursor && (
              <button
                className={styles.secondaryButton}
                disabled={loadingMore}
                onClick={loadMore}
                type="button"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
          {error && (
            <AdminContentError action="read more content" error={error} onRetry={loadMore} />
          )}
        </>
      )}
    </>
  );
}

function shortId(value: string): string {
  return `${value.slice(0, 8)}…`;
}

function parseStatusFilter(value: string): ContentStatus | '' {
  return CONTENT_STATUSES.find((status) => status === value) ?? '';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

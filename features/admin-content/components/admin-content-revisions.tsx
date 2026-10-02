'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../admin-content.module.css';
import {
  createAdminContentService,
  type ContentItem,
  type ContentRevisionSummary,
} from '../admin-content.service';
import { AdminContentError } from './admin-content-error';
import { ContentStatusLabel } from './content-status';
import { RevisionRows } from './admin-content-detail';

const service = createAdminContentService();

export function AdminContentRevisions({ contentId }: { contentId: string }) {
  const [result, setResult] = useState<{
    key: string;
    item: ContentItem | null;
    revisions: ContentRevisionSummary[];
    nextCursor: string | null;
    error: unknown | null;
  }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = `${contentId}:${refreshKey}`;
  const currentResult = result?.key === requestKey ? result : undefined;
  const item = currentResult?.item ?? null;
  const revisions = currentResult?.revisions ?? [];
  const nextCursor = currentResult?.nextCursor ?? null;
  const error = currentResult?.error ?? null;
  const loading = currentResult === undefined;

  useEffect(() => {
    let current = true;
    void Promise.all([service.getContent(contentId), service.listRevisions(contentId)])
      .then(([content, history]) => {
        if (current) {
          setResult({
            key: requestKey,
            item: content,
            revisions: history.items,
            nextCursor: history.nextCursor,
            error: null,
          });
        }
      })
      .catch((cause: unknown) => {
        if (current) {
          setResult({
            key: requestKey,
            item: null,
            revisions: [],
            nextCursor: null,
            error: cause,
          });
        }
      });
    return () => {
      current = false;
    };
  }, [contentId, requestKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore || !currentResult) return;
    setLoadingMore(true);
    try {
      const page = await service.listRevisions(contentId, nextCursor);
      setResult((current) =>
        current?.key === requestKey
          ? {
              ...current,
              revisions: [...current.revisions, ...page.items],
              nextCursor: page.nextCursor,
              error: null,
            }
          : current,
      );
    } catch (cause) {
      setResult((current) =>
        current?.key === requestKey ? { ...current, error: cause } : current,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" className={styles.loadingState} role="status">
        <p>Loading revisions…</p>
      </div>
    );
  }
  if (error && !item) {
    return (
      <AdminContentError
        action="read revision history"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );
  }
  if (!item) return null;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className="eyebrow">Content history</span>
          <h1>{item.title}</h1>
          <p>
            <ContentStatusLabel status={item.status} />{' '}
            <span className={styles.slug}>{item.slug}</span>
          </p>
        </div>
        <Link className={styles.backLink} href={`/admin/content/${encodeURIComponent(contentId)}/`}>
          Back to content
        </Link>
      </header>
      <div className={styles.sectionHeader}>
        <h2>Revisions</h2>
        <span className={styles.revisionMeta}>{revisions.length} loaded</span>
      </div>
      <RevisionRows revisions={revisions} />
      {error && <AdminContentError action="read more revisions" error={error} onRetry={loadMore} />}
      {nextCursor && (
        <div className={styles.tableFooter}>
          <span>Immutable revision records</span>
          <button
            className={styles.secondaryButton}
            disabled={loadingMore}
            onClick={loadMore}
            type="button"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}

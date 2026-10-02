'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import styles from '../admin-content.module.css';
import {
  createAdminContentService,
  type ContentItem,
  type ContentRevisionSummary,
} from '../admin-content.service';
import { AdminContentError } from './admin-content-error';
import { ContentStatusLabel } from './content-status';

const service = createAdminContentService();

export function AdminContentDetail({ contentId }: { contentId: string }) {
  const [result, setResult] = useState<{
    key: string;
    item: ContentItem | null;
    revisions: ContentRevisionSummary[];
    error: unknown | null;
  }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = `${contentId}:${refreshKey}`;
  const currentResult = result?.key === requestKey ? result : undefined;
  const item = currentResult?.item ?? null;
  const revisions = currentResult?.revisions ?? [];
  const loading = currentResult === undefined;

  useEffect(() => {
    let current = true;
    void Promise.all([service.getContent(contentId), service.listRevisions(contentId)])
      .then(([content, history]) => {
        if (current)
          setResult({ key: requestKey, item: content, revisions: history.items, error: null });
      })
      .catch((cause: unknown) => {
        if (current) setResult({ key: requestKey, item: null, revisions: [], error: cause });
      });
    return () => {
      current = false;
    };
  }, [contentId, requestKey]);

  if (loading) {
    return (
      <div aria-busy="true" className={styles.loadingState} role="status">
        <p>Loading content…</p>
      </div>
    );
  }
  if (currentResult?.error) {
    return (
      <AdminContentError
        action="read content"
        error={currentResult.error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );
  }
  if (!item) return null;

  const publications = revisions.filter((revision) => revision.publishedAt !== null);

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className="eyebrow">Content item</span>
          <h1>{item.title}</h1>
          <p>{item.slug}</p>
        </div>
        <Link
          className={styles.primaryLink}
          href={`/admin/content/${encodeURIComponent(contentId)}/revisions/`}
        >
          Revision history
        </Link>
      </header>

      <dl className={styles.detailsGrid}>
        <DetailCell label="Content key">
          <code>{item.contentKey}</code>
        </DetailCell>
        <DetailCell label="Status">
          <ContentStatusLabel status={item.status} />
        </DetailCell>
        <DetailCell label="Latest revision">
          {item.latestRevisionNumber ? `R${item.latestRevisionNumber}` : 'None'}
          {item.latestRevisionId && (
            <small className={styles.revisionCode}> · {shortId(item.latestRevisionId)}</small>
          )}
        </DetailCell>
        <DetailCell label="Published revision">
          {item.publishedRevisionId ? (
            <code title={item.publishedRevisionId}>{shortId(item.publishedRevisionId)}</code>
          ) : (
            'None'
          )}
        </DetailCell>
        <DetailCell label="Created">
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </DetailCell>
        <DetailCell label="Updated">
          <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
        </DetailCell>
      </dl>

      <section aria-labelledby="recent-revisions-heading">
        <div className={styles.sectionHeader}>
          <h2 id="recent-revisions-heading">Revision history</h2>
          <Link
            className={styles.textLink}
            href={`/admin/content/${encodeURIComponent(contentId)}/revisions/`}
          >
            View all
          </Link>
        </div>
        <RevisionRows revisions={revisions.slice(0, 8)} />
      </section>

      <section aria-labelledby="publication-history-heading">
        <div className={styles.sectionHeader}>
          <h2 id="publication-history-heading">Publication history</h2>
        </div>
        {publications.length ? (
          <RevisionRows revisions={publications} publicationOnly />
        ) : (
          <p className={styles.fieldHint}>No publication records are available.</p>
        )}
      </section>
    </>
  );
}

function DetailCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.detailCell}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RevisionRows({
  revisions,
  publicationOnly = false,
}: {
  revisions: ContentRevisionSummary[];
  publicationOnly?: boolean;
}) {
  if (!revisions.length) {
    return (
      <p className={styles.fieldHint}>
        {publicationOnly ? 'No publication records are available.' : 'No revisions are available.'}
      </p>
    );
  }
  return (
    <ol className={styles.revisionList}>
      {revisions.map((revision) => (
        <li className={styles.revisionItem} key={revision.revisionId}>
          <strong>Revision {revision.revisionNumber}</strong>
          <span className={styles.revisionCode} title={revision.revisionId}>
            {shortId(revision.revisionId)}
          </span>
          <span className={styles.revisionMeta}>
            {publicationOnly ? (
              <time className={styles.publishedMark} dateTime={revision.publishedAt ?? undefined}>
                Published {revision.publishedAt ? formatDate(revision.publishedAt) : ''}
              </time>
            ) : (
              <time dateTime={revision.createdAt}>{formatDate(revision.createdAt)}</time>
            )}
          </span>
          <span className={revision.publishedAt ? styles.publishedMark : styles.revisionMeta}>
            {publicationOnly
              ? revision.publishedBy
                ? `By ${shortId(revision.publishedBy)}`
                : 'Publisher unavailable'
              : revision.publishedAt
                ? 'Published'
                : 'Draft'}
          </span>
        </li>
      ))}
    </ol>
  );
}

function shortId(value: string): string {
  return `${value.slice(0, 8)}…`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

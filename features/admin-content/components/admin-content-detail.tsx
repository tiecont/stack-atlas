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
import { AdminContentPublishingWorkflow } from './admin-content-publishing-workflow';
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
  const currentResult = result?.key.startsWith(`${contentId}:`) ? result : undefined;
  const refreshing = currentResult !== undefined && currentResult.key !== requestKey;
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
        if (current) {
          setResult((previous) =>
            previous?.key.startsWith(`${contentId}:`) && previous.item
              ? { ...previous, key: requestKey, error: cause }
              : { key: requestKey, item: null, revisions: [], error: cause },
          );
        }
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
  if (currentResult?.error && !item) {
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
        <div className={styles.editorHeaderActions}>
          {item.status === 'DRAFT' && (
            <Link
              className={styles.primaryLink}
              href={`/admin/content/${encodeURIComponent(contentId)}/edit/`}
            >
              Edit draft
            </Link>
          )}
          <Link
            className={styles.primaryLink}
            href={`/admin/content/${encodeURIComponent(contentId)}/revisions/`}
          >
            Revision history
          </Link>
        </div>
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

      {currentResult?.error && (
        <AdminContentError
          action="refresh content state"
          error={currentResult.error}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
      )}

      <AdminContentPublishingWorkflow
        item={item}
        onRefresh={() => setRefreshKey((value) => value + 1)}
        refreshing={refreshing || currentResult?.error !== null}
        revisions={revisions}
      />

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
            <time
              className={publicationOnly ? styles.publishedMark : undefined}
              dateTime={publicationOnly ? (revision.publishedAt ?? undefined) : revision.createdAt}
            >
              {publicationOnly && revision.publishedAt
                ? `Published ${formatDate(revision.publishedAt)}`
                : formatDate(revision.createdAt)}
            </time>
          </span>
          <span
            className={styles.revisionMeta}
            title={
              publicationOnly
                ? (revision.publishedBy ?? undefined)
                : (revision.revisionCreatedBy ?? undefined)
            }
          >
            {publicationOnly
              ? (revision.publishedBy ?? 'Publisher unavailable')
              : (revision.revisionCreatedBy ?? 'Creator unavailable')}
          </span>
          <span className={revision.publishedAt ? styles.publishedMark : styles.revisionMeta}>
            {revision.publishedAt ? 'Published' : 'Draft'}
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

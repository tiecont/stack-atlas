'use client';

import { useEffect, useRef, useState } from 'react';
import { BlockRenderer } from '@/features/content-renderer';
import {
  createAdminContentService,
  type ContentItem,
  type ContentRevision,
  type ContentRevisionSummary,
} from '../admin-content.service';
import { describeAdminContentError } from '../admin-content-errors';
import styles from '../admin-content.module.css';
import { AdminContentError } from './admin-content-error';

const service = createAdminContentService();

type WorkflowAction = 'publish' | 'archive';

type WorkflowOutcome =
  | { kind: 'published'; revisionNumber: number; verified: true }
  | { kind: 'published'; revisionNumber: number; verified: false; message: string }
  | { kind: 'archived'; archivedAt: string | null };

export function AdminContentPublishingWorkflow({
  item,
  revisions,
  refreshing,
  onRefresh,
}: {
  item: ContentItem;
  revisions: ContentRevisionSummary[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const initialRevisionId = item.latestRevisionId ?? revisions[0]?.revisionId ?? '';
  const [selection, setSelection] = useState<{
    contentId: string;
    latestRevisionId: string | null;
    revisionId: string;
  }>();
  const selectedRevisionId =
    selection?.contentId === item.contentId && selection.latestRevisionId === item.latestRevisionId
      ? selection.revisionId
      : initialRevisionId;
  const [previewResult, setPreviewResult] = useState<
    | { contentId: string; revisionId: string; revision: ContentRevision; error: null }
    | { contentId: string; revisionId: string; revision: null; error: unknown }
  >();
  const [confirmAction, setConfirmAction] = useState<WorkflowAction | null>(null);
  const [operation, setOperation] = useState<WorkflowAction | null>(null);
  const [actionError, setActionError] = useState<{ action: WorkflowAction; cause: unknown }>();
  const [outcome, setOutcome] = useState<WorkflowOutcome>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const preview =
    previewResult?.contentId === item.contentId && previewResult.revisionId === selectedRevisionId
      ? previewResult
      : undefined;
  const selectedSummary = revisions.find((revision) => revision.revisionId === selectedRevisionId);
  const busy = operation !== null || refreshing;

  useEffect(() => {
    if (!selectedRevisionId) return;
    let active = true;
    void service
      .getRevision(item.contentId, selectedRevisionId)
      .then((revision) => {
        if (active)
          setPreviewResult({
            contentId: item.contentId,
            revisionId: selectedRevisionId,
            revision,
            error: null,
          });
      })
      .catch((cause: unknown) => {
        if (active)
          setPreviewResult({
            contentId: item.contentId,
            revisionId: selectedRevisionId,
            revision: null,
            error: cause,
          });
      });
    return () => {
      active = false;
    };
  }, [item.contentId, selectedRevisionId]);

  function chooseAction(action: WorkflowAction) {
    setActionError(undefined);
    setOutcome(undefined);
    setConfirmAction(action);
    dialogRef.current?.showModal();
  }

  async function confirm() {
    const action = confirmAction;
    if (!action || busy || (!selectedRevisionId && action === 'publish')) return;
    setOperation(action);
    setActionError(undefined);
    setOutcome(undefined);
    try {
      if (action === 'publish') {
        const published = await service.publishRevision(item.contentId, selectedRevisionId);
        if (published.contentId !== item.contentId || published.revisionId !== selectedRevisionId) {
          throw new TypeError('The API published a different content revision than requested.');
        }
        onRefresh();
        try {
          const publicContent = await service.getPublicContent(item.slug);
          const verified =
            publicContent.contentId === item.contentId &&
            publicContent.slug === item.slug &&
            publicContent.publishedRevisionId === selectedRevisionId;
          setOutcome(
            verified
              ? { kind: 'published', revisionNumber: published.revisionNumber, verified: true }
              : {
                  kind: 'published',
                  revisionNumber: published.revisionNumber,
                  verified: false,
                  message:
                    publicContent.contentId !== item.contentId || publicContent.slug !== item.slug
                      ? 'Public read returned another content item.'
                      : `Public read still serves revision ${publicContent.publishedRevisionId}.`,
                },
          );
        } catch (cause) {
          setOutcome({
            kind: 'published',
            revisionNumber: published.revisionNumber,
            verified: false,
            message: describeAdminContentError(cause, 'verify the published revision').message,
          });
        }
      } else {
        const archived = await service.archiveContent(item.contentId);
        if (archived.contentId !== item.contentId || archived.status !== 'ARCHIVED') {
          throw new TypeError('The API did not confirm that this content item was archived.');
        }
        setOutcome({ kind: 'archived', archivedAt: archived.archivedAt });
        onRefresh();
      }
    } catch (cause) {
      setActionError({ action, cause });
    } finally {
      setOperation(null);
      setConfirmAction(null);
      if (dialogRef.current?.open) dialogRef.current.close();
    }
  }

  return (
    <section aria-labelledby="publishing-workflow-heading" className={styles.workflowSection}>
      <div className={styles.sectionHeader}>
        <h2 id="publishing-workflow-heading">Preview and publishing</h2>
        {item.publishedRevisionId && (
          <span className={styles.publishedMark}>
            Published revision {revisionNumberLabel(revisions, item.publishedRevisionId)}
          </span>
        )}
      </div>

      <div className={styles.workflowToolbar}>
        <label className={styles.fieldLabel} htmlFor="preview-revision">
          Revision to preview
          <select
            className={styles.select}
            disabled={busy || revisions.length === 0}
            id="preview-revision"
            onChange={(event) => {
              setSelection({
                contentId: item.contentId,
                latestRevisionId: item.latestRevisionId,
                revisionId: event.target.value,
              });
              setActionError(undefined);
              setOutcome(undefined);
            }}
            value={selectedRevisionId}
          >
            {revisions.map((revision) => (
              <option key={revision.revisionId} value={revision.revisionId}>
                Revision {revision.revisionNumber}
                {revision.publishedAt ? ' · Published' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.workflowActions}>
          {item.status !== 'ARCHIVED' && (
            <button
              className={styles.primaryButton}
              disabled={busy || !selectedSummary || !preview?.revision}
              onClick={() => chooseAction('publish')}
              type="button"
            >
              Publish selected revision
            </button>
          )}
          {item.status !== 'ARCHIVED' && (
            <button
              className={styles.dangerButton}
              disabled={busy}
              onClick={() => chooseAction('archive')}
              type="button"
            >
              Archive content
            </button>
          )}
        </div>
      </div>

      {item.status === 'ARCHIVED' && (
        <p className={styles.notice} role="status">
          Archived{item.archivedAt ? ` on ${formatDate(item.archivedAt)}` : ''}.
        </p>
      )}
      {actionError && (
        <AdminContentError
          action={actionError.action === 'publish' ? 'publish this revision' : 'archive content'}
          error={actionError.cause}
        />
      )}
      {outcome?.kind === 'published' && (
        <section
          aria-live="polite"
          className={outcome.verified ? styles.workflowSuccess : styles.workflowWarning}
          role={outcome.verified ? 'status' : 'alert'}
        >
          <h3>Revision {outcome.revisionNumber} published</h3>
          <p>
            {outcome.verified
              ? 'Public content now serves this revision.'
              : `Publication succeeded, but public verification did not match: ${outcome.message}`}
          </p>
        </section>
      )}
      {outcome?.kind === 'archived' && (
        <p className={styles.workflowSuccess} role="status">
          Content archived{outcome.archivedAt ? ` on ${formatDate(outcome.archivedAt)}` : ''}.
        </p>
      )}

      {preview && preview.revision === null && (
        <AdminContentError action="load the selected revision preview" error={preview.error} />
      )}
      {!selectedRevisionId && <p className={styles.fieldHint}>No revisions are available.</p>}
      {selectedRevisionId && !preview && (
        <p aria-live="polite" className={styles.fieldHint} role="status">
          Loading revision preview…
        </p>
      )}
      {preview?.revision && (
        <div className={styles.previewSurface}>
          <header className={styles.previewHeading}>
            <h3>{preview.revision.document.title}</h3>
            <p>{preview.revision.document.description}</p>
          </header>
          <BlockRenderer document={preview.revision.document} mode="preview" />
        </div>
      )}

      <dialog
        aria-labelledby="workflow-confirm-heading"
        className={styles.workflowDialog}
        onClose={() => setConfirmAction(null)}
        ref={dialogRef}
      >
        <h2 id="workflow-confirm-heading">
          {confirmAction === 'publish'
            ? `Publish revision ${selectedSummary?.revisionNumber ?? ''}?`
            : 'Archive this content?'}
        </h2>
        <p>
          {confirmAction === 'publish'
            ? 'The selected immutable revision will become the public version.'
            : 'This content will no longer be available through public content reads.'}
        </p>
        <div className={styles.formFooter}>
          <button
            className={styles.secondaryButton}
            disabled={operation !== null}
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Cancel
          </button>
          <button
            className={confirmAction === 'archive' ? styles.dangerButton : styles.primaryButton}
            disabled={operation !== null}
            onClick={() => void confirm()}
            type="button"
          >
            {operation
              ? 'Working…'
              : confirmAction === 'publish'
                ? 'Publish revision'
                : 'Archive content'}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function revisionNumberLabel(revisions: ContentRevisionSummary[], revisionId: string): string {
  const revision = revisions.find((candidate) => candidate.revisionId === revisionId);
  return revision ? `R${revision.revisionNumber}` : revisionId.slice(0, 8);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

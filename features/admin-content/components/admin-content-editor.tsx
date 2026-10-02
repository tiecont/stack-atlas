'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  CONTENT_BLOCK_TYPES_V1,
  isContentBlock,
  type ContentBlock,
  type ContentBlockTypeV1,
  type ContentDocumentV1,
} from '@/features/content-renderer/types';
import { ApiError } from '@/lib/api/client';
import styles from '../admin-content.module.css';
import {
  createAdminContentService,
  type ContentItem,
  type ContentRevision,
} from '../admin-content.service';
import {
  createDefaultBlock,
  duplicateBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  validateEditorDocument,
  type EditorValidationIssue,
} from '../content-editor-model';
import { AdminContentError } from './admin-content-error';
import { ContentEditorBlockFields } from './content-editor-block-fields';
import { ContentStatusLabel } from './content-status';

const service = createAdminContentService();

interface EditorDocument extends ContentDocumentV1 {
  blocks: ContentBlock[];
}

interface EditorState {
  contentId: string;
  item: ContentItem;
  revision: ContentRevision;
  document: EditorDocument;
  savedDocument: string;
  error: unknown | null;
  busy: boolean;
  blocked: boolean;
  savedMessage: string;
}

const BLOCK_LABELS: Record<ContentBlockTypeV1, string> = {
  rich_text: 'Rich text',
  heading: 'Heading',
  code: 'Code',
  callout: 'Callout',
  image: 'Image',
  table: 'Table',
  divider: 'Divider',
  related_content: 'Related content',
};

export function AdminContentEditor({ contentId }: { contentId: string }) {
  const [state, setState] = useState<EditorState>();
  const [loadError, setLoadError] = useState<{ contentId: string; cause: unknown }>();
  const [refresh, setRefresh] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [newBlockType, setNewBlockType] = useState<ContentBlockTypeV1>('rich_text');
  const [issues, setIssues] = useState<EditorValidationIssue[]>([]);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addBlockButtonRef = useRef<HTMLButtonElement | null>(null);
  const outlineButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = state?.contentId === contentId ? state : undefined;
  const currentLoadError = loadError?.contentId === contentId ? loadError.cause : null;

  useEffect(() => {
    let active = true;
    setLoadError(undefined);
    void loadEditor(contentId)
      .then((loaded) => {
        if (active) {
          setState(loaded);
          setSelectedBlockId(loaded.document.blocks[0]?.id ?? null);
          setIssues([]);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadError({ contentId, cause });
          setState((value) => (value?.contentId === contentId ? { ...value, busy: false } : value));
        }
      });
    return () => {
      active = false;
    };
  }, [contentId, refresh]);

  const dirty = current ? JSON.stringify(current.document) !== current.savedDocument : false;
  const editable = current?.item.status === 'DRAFT' && current.revision.status === 'DRAFT';

  function updateDocument(update: (document: EditorDocument) => EditorDocument) {
    setState((value) =>
      value?.contentId === contentId
        ? { ...value, document: update(value.document), savedMessage: '' }
        : value,
    );
  }

  function updateBlock(blockId: string, replacement: ContentBlock) {
    updateDocument((document) => ({
      ...document,
      blocks: document.blocks.map((block) => (block.id === blockId ? replacement : block)),
    }));
  }

  function addBlock() {
    if (!current || current.document.blocks.length >= 500) return;
    const id = createBlockId(current.document.blocks);
    const block = createDefaultBlock(newBlockType, id);
    updateDocument((document) => ({ ...document, blocks: insertBlock(document.blocks, block) }));
    setSelectedBlockId(id);
  }

  function reorderBlock(blockId: string, offset: -1 | 1) {
    updateDocument((document) => ({
      ...document,
      blocks: moveBlock(document.blocks, blockId, offset),
    }));
  }

  function duplicateSelected(blockId: string) {
    if (!current || current.document.blocks.length >= 500) return;
    const id = createBlockId(current.document.blocks);
    updateDocument((document) => ({
      ...document,
      blocks: duplicateBlock(document.blocks, blockId, id),
    }));
    setSelectedBlockId(id);
  }

  function requestDelete(blockId: string, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    setDeleteBlockId(blockId);
    dialogRef.current?.showModal();
  }

  function confirmDelete() {
    if (!deleteBlockId) return;
    const index = current?.document.blocks.findIndex((block) => block.id === deleteBlockId) ?? -1;
    updateDocument((document) => ({
      ...document,
      blocks: removeBlock(document.blocks, deleteBlockId),
    }));
    if (selectedBlockId === deleteBlockId) {
      const fallback = current?.document.blocks[index + 1] ?? current?.document.blocks[index - 1];
      setSelectedBlockId(fallback?.id ?? null);
    }
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    setDeleteBlockId(null);
    requestAnimationFrame(() => {
      if (deleteTriggerRef.current?.isConnected) deleteTriggerRef.current.focus();
      else addBlockButtonRef.current?.focus();
    });
  }

  async function saveDraft() {
    if (!current || !editable || current.busy) return;
    const nextIssues = validateEditorDocument(current.document);
    setIssues(nextIssues);
    if (nextIssues.length) {
      window.document.getElementById(nextIssues[0]?.target ?? '')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    setState((value) =>
      value?.contentId === contentId
        ? { ...value, busy: true, error: null, savedMessage: '' }
        : value,
    );
    try {
      const saved = await service.appendRevision(
        contentId,
        current.revision.revisionId,
        current.document,
      );
      const savedDocument = toEditorDocument(saved.document);
      setState((value) =>
        value?.contentId === contentId
          ? {
              ...value,
              revision: saved,
              document: savedDocument,
              savedDocument: JSON.stringify(savedDocument),
              busy: false,
              error: null,
              savedMessage: `Saved as revision ${saved.revisionNumber}.`,
            }
          : value,
      );
      setIssues([]);
    } catch (cause) {
      setState((value) =>
        value?.contentId === contentId
          ? {
              ...value,
              busy: false,
              error: cause,
              blocked: isBlocked(cause),
            }
          : value,
      );
    }
  }

  function reloadLatestRevision() {
    if (!current || current.busy) return;
    setLoadError(undefined);
    setState((value) =>
      value?.contentId === contentId
        ? { ...value, busy: true, error: null, savedMessage: '' }
        : value,
    );
    setRefresh((value) => value + 1);
  }

  if (!current) {
    if (currentLoadError) {
      return (
        <AdminContentError
          action="load content for editing"
          error={currentLoadError}
          onRetry={() => setRefresh((value) => value + 1)}
        />
      );
    }
    return (
      <div aria-busy="true" className={styles.loadingState} role="status">
        <p>Loading draft…</p>
      </div>
    );
  }

  const revision = current.revision;
  const document = current.document;
  const staleConflict = current.error instanceof ApiError && current.error.status === 409;
  const blockIssue = (id: string) => issues.find((issue) => issue.target === `editor-block-${id}`);
  const metadataIssue = (target: string) => issues.find((issue) => issue.target === target);
  const deleteBlock = document.blocks.find((block) => block.id === deleteBlockId);

  return (
    <>
      <header className={styles.editorHeader}>
        <div>
          <span className="eyebrow">Content editor</span>
          <h1>{document.title || 'Untitled draft'}</h1>
          <p>
            <ContentStatusLabel status={current.item.status} />
            <span className={styles.editorSlug}>{current.item.slug}</span>
            <span>Revision {revision.revisionNumber}</span>
          </p>
        </div>
        <div className={styles.editorHeaderActions}>
          <Link
            className={styles.backLink}
            href={`/admin/content/${encodeURIComponent(contentId)}/`}
          >
            Back to content
          </Link>
          <button
            className={styles.primaryButton}
            disabled={!editable || !dirty || current.busy || current.blocked}
            onClick={() => void saveDraft()}
            type="button"
          >
            {current.busy ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </header>

      {current.error && (
        <div className={styles.editorError}>
          {staleConflict ? (
            <section className={styles.editorConflict} role="alert">
              <h2>This draft changed after you opened it</h2>
              <p>
                The save was rejected. Your local edits are still here and were not retried.
                Reloading replaces them with the latest server revision.
              </p>
              <button
                className={styles.secondaryButton}
                disabled={current.busy}
                onClick={reloadLatestRevision}
                type="button"
              >
                Reload latest revision
              </button>
            </section>
          ) : (
            <AdminContentError action="save this draft" error={current.error} />
          )}
          {dirty && (
            <p className={styles.editorPreserved} role="status">
              Your unsaved edits are still in this editor.
            </p>
          )}
        </div>
      )}
      {currentLoadError && (
        <div className={styles.editorError}>
          <AdminContentError
            action="reload the latest revision"
            error={currentLoadError}
            onRetry={reloadLatestRevision}
          />
          {dirty && (
            <p className={styles.editorPreserved} role="status">
              Your local edits remain in this editor because reload did not complete.
            </p>
          )}
        </div>
      )}
      {current.busy && current.blocked && (
        <p className={styles.fieldHint} role="status">
          Loading the latest revision…
        </p>
      )}
      {current.savedMessage && (
        <p className={styles.editorSuccess} role="status">
          {current.savedMessage}
        </p>
      )}
      {!editable && (
        <p className={styles.notice} role="status">
          Revisions can only be saved while this content is a draft.
        </p>
      )}
      {issues.length > 0 && (
        <section
          aria-labelledby="editor-errors-heading"
          className={styles.editorValidation}
          id="document-validation"
          role="alert"
        >
          <h2 id="editor-errors-heading">Review these fields</h2>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.target}-${index}`}>
                <a href={`#${issue.target}`}>{issue.message}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.editorLayout}>
        <aside aria-label="Block outline" className={styles.editorOutline}>
          <div className={styles.editorPanelHeading}>
            <h2>Outline</h2>
            <span>{document.blocks.length}</span>
          </div>
          {document.blocks.length ? (
            <ol className={styles.outlineList}>
              {document.blocks.map((block, index) => (
                <li key={block.id}>
                  <button
                    aria-current={selectedBlockId === block.id ? 'location' : undefined}
                    aria-label={`${index + 1}. ${BLOCK_LABELS[block.type]}`}
                    aria-pressed={selectedBlockId === block.id}
                    className={
                      selectedBlockId === block.id ? styles.outlineItemSelected : styles.outlineItem
                    }
                    onClick={() => setSelectedBlockId(block.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                      event.preventDefault();
                      const nextIndex = Math.max(
                        0,
                        Math.min(
                          document.blocks.length - 1,
                          index + (event.key === 'ArrowDown' ? 1 : -1),
                        ),
                      );
                      setSelectedBlockId(document.blocks[nextIndex]?.id ?? block.id);
                      outlineButtonRefs.current[nextIndex]?.focus();
                    }}
                    ref={(element) => {
                      outlineButtonRefs.current[index] = element;
                    }}
                    type="button"
                  >
                    <span className={styles.outlineIndex}>{index + 1}</span>
                    <span>{BLOCK_LABELS[block.type]}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.fieldHint}>No blocks yet.</p>
          )}
          <div className={styles.blockAdder} id="block-adder">
            <label className={styles.fieldLabel} htmlFor="new-block-type">
              Block type
            </label>
            <select
              className={styles.select}
              disabled={!editable || current.busy || document.blocks.length >= 500}
              id="new-block-type"
              onChange={(event) => {
                const type = CONTENT_BLOCK_TYPES_V1.find(
                  (candidate) => candidate === event.target.value,
                );
                if (type) setNewBlockType(type);
              }}
              value={newBlockType}
            >
              {CONTENT_BLOCK_TYPES_V1.map((type) => (
                <option key={type} value={type}>
                  {BLOCK_LABELS[type]}
                </option>
              ))}
            </select>
            <button
              className={styles.secondaryButton}
              disabled={!editable || current.busy || document.blocks.length >= 500}
              onClick={addBlock}
              ref={addBlockButtonRef}
              type="button"
            >
              Add block
            </button>
          </div>
        </aside>

        <main aria-label="Document blocks" className={styles.editorCanvas}>
          <div className={styles.editorPanelHeading}>
            <h2>Document blocks</h2>
            <span>{dirty ? 'Unsaved changes' : `Saved revision ${revision.revisionNumber}`}</span>
          </div>
          {document.blocks.map((block, index) => {
            const issue = blockIssue(block.id);
            const issueId = issue ? `editor-block-${block.id}-error` : undefined;
            return (
              <article
                aria-label={`Block ${index + 1}: ${BLOCK_LABELS[block.type]}`}
                aria-describedby={issueId}
                className={
                  selectedBlockId === block.id ? styles.editorBlockSelected : styles.editorBlock
                }
                data-invalid={issue ? 'true' : undefined}
                id={`editor-block-${block.id}`}
                key={block.id}
                onFocus={() => setSelectedBlockId(block.id)}
              >
                <header className={styles.editorBlockHeader}>
                  <div>
                    <span className={styles.editorBlockNumber}>Block {index + 1}</span>
                    <h3>{BLOCK_LABELS[block.type]}</h3>
                    <code>{block.id}</code>
                  </div>
                  <div className={styles.blockActions}>
                    <button
                      aria-label={`Move ${BLOCK_LABELS[block.type]} up`}
                      className={styles.editorTextButton}
                      disabled={!editable || current.busy || index === 0}
                      onClick={() => reorderBlock(block.id, -1)}
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      aria-label={`Move ${BLOCK_LABELS[block.type]} down`}
                      className={styles.editorTextButton}
                      disabled={!editable || current.busy || index === document.blocks.length - 1}
                      onClick={() => reorderBlock(block.id, 1)}
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      aria-label={`Duplicate ${BLOCK_LABELS[block.type]}`}
                      className={styles.editorTextButton}
                      disabled={!editable || current.busy || document.blocks.length >= 500}
                      onClick={() => duplicateSelected(block.id)}
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      aria-label={`Remove ${BLOCK_LABELS[block.type]}`}
                      className={styles.editorTextButtonDanger}
                      disabled={!editable || current.busy}
                      onClick={(event) => requestDelete(block.id, event.currentTarget)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </header>
                {issue && (
                  <p className={styles.blockIssue} id={issueId} role="alert">
                    {issue.message}
                  </p>
                )}
                <ContentEditorBlockFields
                  block={block}
                  disabled={!editable || current.busy}
                  issueId={issueId}
                  onChange={(updated) => updateBlock(block.id, updated)}
                />
              </article>
            );
          })}
        </main>

        <aside aria-label="Document settings" className={styles.editorSettings}>
          <div className={styles.editorPanelHeading}>
            <h2>Document</h2>
          </div>
          <label className={styles.fieldLabel} htmlFor="document-title">
            Title
          </label>
          <input
            aria-describedby={metadataIssue('document-title') ? 'document-title-error' : undefined}
            aria-invalid={metadataIssue('document-title') ? true : undefined}
            className={styles.input}
            disabled={!editable || current.busy}
            id="document-title"
            maxLength={160}
            onChange={(event) =>
              updateDocument((value) => ({ ...value, title: event.target.value }))
            }
            value={document.title}
          />
          {metadataIssue('document-title') && (
            <p className={styles.fieldError} id="document-title-error" role="alert">
              {metadataIssue('document-title')?.message}
            </p>
          )}
          <label className={styles.fieldLabel} htmlFor="document-description">
            Description
          </label>
          <textarea
            aria-describedby={
              metadataIssue('document-description') ? 'document-description-error' : undefined
            }
            aria-invalid={metadataIssue('document-description') ? true : undefined}
            className={styles.textarea}
            disabled={!editable || current.busy}
            id="document-description"
            maxLength={500}
            onChange={(event) =>
              updateDocument((value) => ({ ...value, description: event.target.value }))
            }
            value={document.description}
          />
          {metadataIssue('document-description') && (
            <p className={styles.fieldError} id="document-description-error" role="alert">
              {metadataIssue('document-description')?.message}
            </p>
          )}
          <dl className={styles.readonlyMetadata}>
            <div>
              <dt>Slug</dt>
              <dd>{current.item.slug}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <ContentStatusLabel status={current.item.status} />
              </dd>
            </div>
            <div>
              <dt>Content key</dt>
              <dd>
                <code>{current.item.contentKey}</code>
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <dialog
        aria-labelledby="delete-block-heading"
        className={styles.editorDialog}
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <h2 id="delete-block-heading">Remove this block?</h2>
        <p>
          {deleteBlock
            ? `${BLOCK_LABELS[deleteBlock.type]} (${deleteBlock.id}) will be removed from this draft.`
            : 'This block will be removed from this draft.'}
        </p>
        <div className={styles.formFooter}>
          <button
            className={styles.secondaryButton}
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Cancel
          </button>
          <button className={styles.dangerButton} onClick={confirmDelete} type="button">
            Remove block
          </button>
        </div>
      </dialog>
    </>
  );
}

async function loadEditor(contentId: string): Promise<EditorState> {
  const item = await service.getContent(contentId);
  if (!item.latestRevisionId) throw new TypeError('This content does not have a revision to edit.');
  const revision = await service.getRevision(contentId, item.latestRevisionId);
  if (revision.contentId !== contentId || revision.revisionId !== item.latestRevisionId) {
    throw new TypeError('The latest content revision does not match its content item.');
  }
  const document = toEditorDocument(revision.document);
  return {
    contentId,
    item,
    revision,
    document,
    savedDocument: JSON.stringify(document),
    error: null,
    busy: false,
    blocked: false,
    savedMessage: '',
  };
}

function toEditorDocument(document: ContentDocumentV1): EditorDocument {
  const blocks: ContentBlock[] = [];
  for (const block of document.blocks) {
    if (!isContentBlock(block))
      throw new TypeError('The revision contains a block outside Content Document V1.');
    blocks.push(block);
  }
  return {
    schema_version: 1,
    title: document.title,
    description: document.description,
    blocks,
  };
}

function createBlockId(blocks: readonly ContentBlock[]): string {
  let id = `block-${crypto.randomUUID().toLowerCase()}`;
  while (blocks.some((block) => block.id === id)) id = `block-${crypto.randomUUID().toLowerCase()}`;
  return id;
}

function isBlocked(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 401 || error.status === 403 || error.status === 409)
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import styles from '../admin-content.module.css';
import { ApiError } from '@/lib/api/client';
import {
  isPermissionDenied,
  createAdminContentService,
  type CreateContentInput,
} from '../admin-content.service';
import { AdminContentError } from './admin-content-error';

const service = createAdminContentService();
const SLUG_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;
const RESERVED_ROUTE_SEGMENTS = new Set(['api', 'admin', 'login', 'register', 'account', '_next']);

export function AdminContentCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const contentKey = useRef<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [validationError, setValidationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blockedStatus, setBlockedStatus] = useState<401 | 403 | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationError('');
    const normalizedSlug = normalizeSlug(slug);
    if (!title.trim() || !description.trim()) {
      setValidationError('Enter a title and description.');
      return;
    }
    if (!normalizedSlug || normalizedSlug.length > 255 || !SLUG_PATTERN.test(normalizedSlug)) {
      setValidationError('Use lowercase URL segments separated by slashes.');
      return;
    }
    if (
      normalizedSlug.includes('..') ||
      RESERVED_ROUTE_SEGMENTS.has(normalizedSlug.split('/', 1)[0] ?? '')
    ) {
      setValidationError('This slug contains an invalid or reserved route segment.');
      return;
    }

    const input: CreateContentInput = {
      contentKey: (contentKey.current ??= `article:${crypto.randomUUID()}`),
      slug: normalizedSlug,
      document: {
        schema_version: 1,
        title: title.trim(),
        description: description.trim(),
        blocks: [
          {
            id: 'body',
            type: 'rich_text',
            version: 1,
            props: {
              nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }],
            },
          },
        ],
      },
    };

    setBusy(true);
    try {
      const created = await service.createContent(input);
      router.push(`/admin/content/${encodeURIComponent(created.contentId)}/`);
      router.refresh();
    } catch (cause) {
      setError(cause);
      if (isPermissionDenied(cause) || (cause instanceof ApiError && cause.status === 401)) {
        setBlockedStatus(cause instanceof ApiError && cause.status === 401 ? 401 : 403);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className="eyebrow">Authoring</span>
          <h1>New content</h1>
          <p>Create an article identity and its first immutable draft revision.</p>
        </div>
      </header>
      {error && <AdminContentError action="create content" error={error} />}
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formField}>
          <label htmlFor="content-title">Title</label>
          <input
            autoComplete="off"
            className={styles.input}
            id="content-title"
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <div className={styles.formField}>
          <label htmlFor="content-description">Description</label>
          <textarea
            className={styles.textarea}
            id="content-description"
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            required
            value={description}
          />
        </div>
        <div className={styles.formField}>
          <label htmlFor="content-slug">Slug</label>
          <input
            autoCapitalize="none"
            className={styles.input}
            id="content-slug"
            maxLength={255}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="engineering/new-guide"
            required
            value={slug}
          />
          {validationError && (
            <p className={styles.notice} role="alert">
              {validationError}
            </p>
          )}
        </div>
        {blockedStatus !== null && (
          <p className={styles.notice}>
            {blockedStatus === 401
              ? 'Sign in to continue. The create control is disabled until this session is renewed.'
              : 'The API denied this action. The create control is disabled for this session.'}
          </p>
        )}
        <div className={styles.formFooter}>
          <button
            className={styles.primaryButton}
            disabled={busy || blockedStatus !== null}
            type="submit"
          >
            {busy ? 'Creating…' : 'Create draft'}
          </button>
          <Link className={styles.backLink} href="/admin/content/">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '-');
}

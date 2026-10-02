import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ContentDocumentV1 } from '@/features/content-renderer/types';
import { createAdminContentService, type ApiTransport } from './admin-content.service';

const item = {
  contentId: 'content-1',
  contentKey: 'article:systems-basics',
  slug: 'engineering/systems-basics',
  status: 'DRAFT',
  latestRevisionId: 'revision-1',
  publishedRevisionId: null,
  createdBy: 'account-1',
  archivedAt: null,
  archivedBy: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const document: ContentDocumentV1 = {
  schema_version: 1,
  title: 'Systems Basics',
  description: 'A systems guide.',
  blocks: [
    {
      id: 'body',
      type: 'rich_text',
      version: 1,
      props: { nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
    },
  ],
};

const revision = {
  contentId: 'content-1',
  contentKey: 'article:systems-basics',
  slug: 'engineering/systems-basics',
  status: 'DRAFT',
  contentType: 'article',
  revisionId: 'revision-1',
  revisionNumber: 2,
  checksumSha256: 'a'.repeat(64),
  revisionCreatedBy: 'account-1',
  createdBy: 'account-1',
  createdAt: '2026-09-02T10:00:00.000Z',
  publishedAt: null,
  publishedBy: null,
  document,
};

test('admin content service encodes filters, cursors, and revision identity through the API client', async () => {
  const calls: string[] = [];
  const client: ApiTransport = {
    async get(path) {
      calls.push(path);
      if (path.startsWith('admin/content?')) {
        return { items: [item], nextCursor: 'cursor+/=' };
      }
      return revision;
    },
    async post(path) {
      calls.push(path);
      return revision;
    },
  };

  const service = createAdminContentService(client);
  const page = await service.listContent({ status: 'DRAFT', cursor: 'next + page' });

  assert.equal(calls[0], 'admin/content?limit=25&status=DRAFT&cursor=next+%2B+page');
  assert.equal(calls[1], 'admin/content/content-1/revisions/revision-1');
  assert.equal(page.items[0]?.title, 'Systems Basics');
  assert.equal(page.items[0]?.latestRevisionNumber, 2);
  assert.equal(page.nextCursor, 'cursor+/=');
});

test('admin content service posts the API-owned create request shape and validates revision responses', async () => {
  let requestPath = '';
  let requestBody: unknown;
  const client: ApiTransport = {
    async get() {
      return revision;
    },
    async post(path, body) {
      requestPath = path;
      requestBody = body;
      return revision;
    },
  };
  const service = createAdminContentService(client);
  const document = revision.document;
  const created = await service.createContent({
    contentKey: 'article:systems-basics',
    slug: 'engineering/systems-basics',
    document,
  });

  assert.equal(requestPath, 'admin/content');
  assert.deepEqual(requestBody, {
    contentKey: 'article:systems-basics',
    slug: 'engineering/systems-basics',
    document,
  });
  assert.equal(created.document.title, 'Systems Basics');
});

test('admin content service appends a revision with its required optimistic concurrency base', async () => {
  let requestPath = '';
  let requestBody: unknown;
  const client: ApiTransport = {
    async get() {
      return revision;
    },
    async post(path, body) {
      requestPath = path;
      requestBody = body;
      return { ...revision, revisionId: 'revision-2', revisionNumber: 3 };
    },
  };
  const service = createAdminContentService(client);
  const updated = await service.appendRevision('content/1', 'revision-1', document);

  assert.equal(requestPath, 'admin/content/content%2F1/revisions');
  assert.deepEqual(requestBody, { baseRevisionId: 'revision-1', document });
  assert.equal(updated.revisionId, 'revision-2');
  assert.equal(updated.revisionNumber, 3);
});

test('malformed API content data fails closed', async () => {
  const client: ApiTransport = {
    async get() {
      return { items: [{ ...item, status: 'SUPERADMIN' }], nextCursor: null };
    },
    async post() {
      return revision;
    },
  };
  await assert.rejects(
    createAdminContentService(client).listContent(),
    /Content status is not supported/,
  );
});

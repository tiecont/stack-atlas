import { expect, test, type Page, type Route } from '@playwright/test';
import { isContentDocumentV1, type ContentDocumentV1 } from '@/features/content-renderer/types';

type ApiReply = { status: number; body: unknown; problem?: boolean };
type ApiMock = (method: string, path: string, search: URLSearchParams, body: unknown) => ApiReply;

const publishedItem = makeItem('content-1', 'revision-2', 'revision-1', 'PUBLISHED');

test('content list shows API records and applies status and text filters', async ({ page }) => {
  const requestedStatuses: string[] = [];
  await mockAdminApi(page, (method, path, search) => {
    if (method === 'GET' && path === 'admin/content') {
      const status = search.get('status') ?? '';
      requestedStatuses.push(status);
      if (search.get('cursor') === 'cursor-next') {
        return {
          status: 200,
          body: {
            items: [makeItem('content-older', 'revision-older', null, 'DRAFT')],
            nextCursor: null,
          },
        };
      }
      const items =
        status === 'DRAFT'
          ? [makeItem('content-draft', 'revision-draft', null, 'DRAFT')]
          : [publishedItem, makeItem('content-draft', 'revision-draft', null, 'DRAFT')];
      return { status: 200, body: { items, nextCursor: status ? null : 'cursor-next' } };
    }
    if (method === 'GET' && path.includes('/revisions/')) {
      const revisionId = path.split('/').at(-1) ?? '';
      const title =
        revisionId === 'revision-draft'
          ? 'Draft Systems Note'
          : revisionId === 'revision-older'
            ? 'Older Systems Guide'
            : 'Systems Architecture';
      return {
        status: 200,
        body: makeRevision(revisionId, title, revisionId === 'revision-draft' ? 1 : 2),
      };
    }
    return notFound();
  });

  await page.goto('/admin/content/');
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Systems Architecture' })).toBeVisible();
  await expect(page.getByText('article:systems-guide')).toBeVisible();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('link', { name: 'Older Systems Guide' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search content' }).fill('systems-guide');
  await expect(page.getByRole('link', { name: 'Systems Architecture' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Draft Systems Note' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search content' }).fill('');
  await page.getByLabel('Filter by status').selectOption('DRAFT');
  await expect(page.getByRole('link', { name: 'Draft Systems Note' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Systems Architecture' })).toHaveCount(0);
  expect(requestedStatuses).toContain('DRAFT');
});

test('new content submits the API request contract and opens the created item', async ({
  page,
}) => {
  let createBody: unknown;
  let createdItem = makeItem('content-new', 'revision-new', null, 'DRAFT');

  await mockAdminApi(page, (method, path, _search, body) => {
    if (method === 'POST' && path === 'admin/content') {
      createBody = body;
      if (
        isRecord(body) &&
        typeof body['contentKey'] === 'string' &&
        typeof body['slug'] === 'string'
      ) {
        createdItem = { ...createdItem, contentKey: body['contentKey'], slug: body['slug'] };
      }
      return {
        status: 201,
        body: makeRevision('revision-new', 'Concurrency Guide', 1, createdItem),
      };
    }
    if (method === 'GET' && path === 'admin/content/content-new') {
      return { status: 200, body: createdItem };
    }
    if (method === 'GET' && path === 'admin/content/content-new/revisions') {
      return {
        status: 200,
        body: { items: [makeSummary('content-new', 'revision-new', 1, null)], nextCursor: null },
      };
    }
    if (method === 'GET' && path === 'admin/content/content-new/revisions/revision-new') {
      return {
        status: 200,
        body: makeRevision('revision-new', 'Concurrency Guide', 1, createdItem),
      };
    }
    return notFound();
  });

  await page.goto('/admin/content/new/');
  await page.getByLabel('Title').fill('Concurrency Guide');
  await page.getByLabel('Description').fill('A guide to safe concurrent updates.');
  await page.getByLabel('Slug').fill('Engineering / New Guide');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page).toHaveURL(/\/admin\/content\/content-new\/$/);
  await expect(page.getByRole('heading', { name: 'Concurrency Guide', level: 1 })).toBeVisible();
  expect(createBody).toMatchObject({
    slug: 'engineering/new-guide',
    document: {
      schema_version: 1,
      title: 'Concurrency Guide',
      description: 'A guide to safe concurrent updates.',
      blocks: [
        {
          id: 'body',
          type: 'rich_text',
          version: 1,
          props: { nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
        },
      ],
    },
  });
  expect(isRecord(createBody) && typeof createBody['contentKey'] === 'string').toBe(true);
  if (!isRecord(createBody) || typeof createBody['contentKey'] !== 'string') {
    throw new Error('Create request omitted its content key.');
  }
  expect(createBody['contentKey']).toMatch(/^article:[0-9a-f-]{36}$/);
});

test('content detail shows identity and revision and publication history', async ({ page }) => {
  await mockAdminApi(page, (method, path) => {
    if (method === 'GET' && path === 'admin/content/content-1')
      return { status: 200, body: publishedItem };
    if (method === 'GET' && path === 'admin/content/content-1/revisions') {
      return {
        status: 200,
        body: {
          items: [
            makeSummary('content-1', 'revision-2', 2, null),
            makeSummary('content-1', 'revision-1', 1, '2026-09-03T10:00:00.000Z'),
          ],
          nextCursor: null,
        },
      };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-2')) {
      return { status: 200, body: makeRevision('revision-2', 'Systems Architecture', 2) };
    }
    return notFound();
  });

  await page.goto('/admin/content/content-1/');
  await expect(page.getByRole('heading', { name: 'Systems Architecture', level: 1 })).toBeVisible();
  await expect(page.getByText('article:systems-guide')).toBeVisible();
  await expect(page.locator('strong').filter({ hasText: 'Revision 2' })).toBeVisible();
  await expect(page.getByText('account-1').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publication history' })).toBeVisible();
  await expect(page.getByText(/Published/).first()).toBeVisible();

  await page.getByRole('link', { name: 'Revision history' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/content-1\/revisions\/$/);
  await expect(page.getByRole('heading', { name: 'Revisions' })).toBeVisible();
  await expect(page.getByText('Revision 1')).toBeVisible();
});

test('API denial disables create after a permission response and shows Problem Details', async ({
  page,
}) => {
  await mockAdminApi(page, (method, path) => {
    if (method === 'POST' && path === 'admin/content') {
      return problem(
        403,
        'Access denied',
        'The current session does not have permission to perform this action.',
      );
    }
    return notFound();
  });

  await page.goto('/admin/content/new/');
  await page.getByLabel('Title').fill('Protected guide');
  await page.getByLabel('Description').fill('A protected draft.');
  await page.getByLabel('Slug').fill('engineering/protected-guide');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create draft' })).toBeDisabled();
});

test('401, 404, and 409 responses render their Problem Details states', async ({ page }) => {
  await mockAdminApi(page, (method, path) => {
    if (method === 'GET' && path === 'admin/content') {
      return problem(401, 'Unauthorized', 'A valid session is required.');
    }
    return notFound();
  });
  await page.goto('/admin/content/');
  await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login/');

  await mockAdminApi(page, (method, path) => {
    if (method === 'GET' && path === 'admin/content/missing') {
      return problem(404, 'Not Found', 'The requested content item was not found.');
    }
    return notFound();
  });
  await page.goto('/admin/content/missing/');
  await expect(page.getByRole('heading', { name: 'Content not found' })).toBeVisible();

  await mockAdminApi(page, (method, path) => {
    if (method === 'POST' && path === 'admin/content') {
      return problem(409, 'Conflict', 'Another active content item already uses this slug.');
    }
    return notFound();
  });
  await page.goto('/admin/content/new/');
  await page.getByLabel('Title').fill('Duplicate');
  await page.getByLabel('Description').fill('Duplicate content.');
  await page.getByLabel('Slug').fill('engineering/systems-guide');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { name: 'Content conflict' })).toBeVisible();
  await expect(page.getByText('Another active content item already uses this slug.')).toBeVisible();
});

test('draft editor updates Content V1 blocks and saves against the loaded revision', async ({
  page,
}) => {
  const draft = makeItem('content-draft', 'revision-1', null, 'DRAFT');
  const original = makeRevision('revision-1', 'Draft Systems Guide', 1, draft);
  let appendBody: unknown;
  await mockAdminApi(page, (method, path, _search, body) => {
    if (method === 'GET' && path === 'admin/content/content-draft') {
      return { status: 200, body: draft };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-1')) {
      return { status: 200, body: original };
    }
    if (method === 'POST' && path === 'admin/content/content-draft/revisions') {
      appendBody = body;
      const document = isRecord(body) ? body['document'] : original.document;
      return {
        status: 201,
        body: { ...original, revisionId: 'revision-2', revisionNumber: 2, document },
      };
    }
    return notFound();
  });

  await page.goto('/admin/content/content-draft/edit/');
  await expect(page.getByRole('heading', { name: 'Draft Systems Guide' })).toBeVisible();
  const blockEditor = (name: string, position: number) =>
    page.getByRole('article', { name: `Block ${position}: ${name}` });
  await page.locator('#document-title').fill('Edited Systems Guide');
  await blockEditor('Rich text', 1)
    .getByLabel('Text', { exact: true })
    .fill('Introduction to the system.');
  await blockEditor('Rich text', 1).getByLabel('Format').selectOption('bold');

  const addBlock = async (type: string) => {
    await page.getByLabel('Block type').selectOption(type);
    await page.getByRole('button', { name: 'Add block', exact: true }).click();
  };

  await addBlock('heading');
  await blockEditor('Heading', 2).getByLabel('Text', { exact: true }).fill('Architecture');
  await addBlock('code');
  await blockEditor('Code', 3).getByLabel('Language').fill('typescript');
  await blockEditor('Code', 3).getByLabel('Code', { exact: true }).fill('const ready = true;');
  await addBlock('callout');
  await blockEditor('Callout', 4).getByLabel('Tone').selectOption('warning');
  await blockEditor('Callout', 4).locator('textarea').fill('Protect the revision base.');
  await addBlock('image');
  await blockEditor('Image', 5).getByLabel('Source').fill('/images/architecture.png');
  await blockEditor('Image', 5).getByLabel('Alt text').fill('System architecture diagram');
  await addBlock('table');
  await blockEditor('Table', 6).getByLabel('Header 1').fill('Layer');
  await blockEditor('Table', 6).getByLabel('Row 1, column 1').fill('API');
  await addBlock('divider');
  await addBlock('related_content');
  await blockEditor('Related content', 8)
    .getByLabel('Title', { exact: true })
    .fill('Related guide');
  await blockEditor('Related content', 8).getByLabel('URL').fill('/articles/related-guide/');

  const firstOutlineItem = page.getByRole('button', { name: '1. Rich text' });
  await firstOutlineItem.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: '2. Heading' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status')).toContainText('Saved as revision 2.');
  expect(appendBody).toMatchObject({
    baseRevisionId: 'revision-1',
    document: {
      schema_version: 1,
      title: 'Edited Systems Guide',
      blocks: [
        {
          type: 'rich_text',
          props: { nodes: [{ type: 'paragraph', children: [{ type: 'bold' }] }] },
        },
        { type: 'heading', props: { text: 'Architecture' } },
        { type: 'code', props: { language: 'typescript', code: 'const ready = true;' } },
        { type: 'callout', props: { tone: 'warning', text: 'Protect the revision base.' } },
        {
          type: 'image',
          props: { src: '/images/architecture.png', alt: 'System architecture diagram' },
        },
        { type: 'table', props: { headers: ['Layer'], rows: [['API']] } },
        { type: 'divider', props: {} },
        {
          type: 'related_content',
          props: { items: [{ title: 'Related guide', href: '/articles/related-guide/' }] },
        },
      ],
    },
  });
});

test('stale revision conflict preserves local editor changes', async ({ page }) => {
  let latestRevisionId = 'revision-1';
  let appendCalls = 0;
  const firstDraft = makeItem('content-draft', latestRevisionId, null, 'DRAFT');
  const concurrentDraft = makeItem('content-draft', 'revision-2', null, 'DRAFT');
  await mockAdminApi(page, (method, path) => {
    if (method === 'GET' && path === 'admin/content/content-draft') {
      const item = latestRevisionId === 'revision-1' ? firstDraft : concurrentDraft;
      return { status: 200, body: item };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-1')) {
      return {
        status: 200,
        body: makeRevision('revision-1', 'Draft Systems Guide', 1, firstDraft),
      };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-2')) {
      return {
        status: 200,
        body: makeRevision('revision-2', 'Concurrent revision', 2, concurrentDraft),
      };
    }
    if (method === 'POST' && path === 'admin/content/content-draft/revisions') {
      appendCalls += 1;
      latestRevisionId = 'revision-2';
      return problem(409, 'Conflict', 'The base revision is no longer current.');
    }
    return notFound();
  });

  await page.goto('/admin/content/content-draft/edit/');
  await page.locator('#document-title').fill('Keep these local edits');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Your unsaved edits are still in this editor.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'This draft changed after you opened it' }),
  ).toBeVisible();
  await expect(page.locator('#document-title')).toHaveValue('Keep these local edits');
  await page.getByRole('button', { name: 'Reload latest revision' }).click();
  await expect(page.locator('#document-title')).toHaveValue('Concurrent revision');
  expect(appendCalls).toBe(1);
});

test('admin saves, previews, publishes, and verifies the public revision', async ({ page }) => {
  let latestRevisionId = 'revision-1';
  let publishedRevisionId: string | null = null;
  let currentStatus: 'DRAFT' | 'PUBLISHED' = 'DRAFT';
  let currentDocument: ContentDocumentV1 = {
    schema_version: 1,
    title: 'Draft Systems Guide',
    description: 'A guide to system design.',
    blocks: [
      {
        id: 'body',
        type: 'rich_text',
        version: 1,
        props: { nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
      },
    ],
  };
  let appendCalls = 0;
  let publishBody: unknown;
  const currentItem = () =>
    makeItem('content-draft', latestRevisionId, publishedRevisionId, currentStatus);
  const currentRevision = (revisionId: string) => {
    const revisionNumber = revisionId === 'revision-1' ? 1 : 2;
    return {
      ...makeRevision(revisionId, currentDocument.title, revisionNumber, currentItem()),
      status: currentStatus,
      document: currentDocument,
      publishedAt: publishedRevisionId === revisionId ? '2026-09-05T10:00:00.000Z' : null,
      publishedBy: publishedRevisionId === revisionId ? 'account-publisher' : null,
    };
  };

  await mockAdminApi(page, (method, path, _search, body) => {
    if (method === 'GET' && path === 'admin/content/content-draft') {
      return { status: 200, body: currentItem() };
    }
    if (method === 'GET' && path === 'admin/content/content-draft/revisions') {
      return {
        status: 200,
        body: {
          items: [
            makeSummary(
              'content-draft',
              'revision-2',
              2,
              publishedRevisionId === 'revision-2' ? '2026-09-05T10:00:00.000Z' : null,
            ),
            makeSummary(
              'content-draft',
              'revision-1',
              1,
              publishedRevisionId === 'revision-1' ? '2026-09-03T10:00:00.000Z' : null,
            ),
          ],
          nextCursor: null,
        },
      };
    }
    if (method === 'GET' && path.endsWith(`/revisions/${latestRevisionId}`)) {
      return { status: 200, body: currentRevision(latestRevisionId) };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-1')) {
      return {
        status: 200,
        body: makeRevision(
          'revision-1',
          'Draft Systems Guide',
          1,
          makeItem('content-draft', latestRevisionId, publishedRevisionId, currentStatus),
        ),
      };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-2')) {
      return { status: 200, body: currentRevision('revision-2') };
    }
    if (method === 'POST' && path === 'admin/content/content-draft/revisions') {
      appendCalls += 1;
      latestRevisionId = 'revision-2';
      if (isRecord(body) && isContentDocumentV1(body['document'])) {
        currentDocument = body['document'];
      }
      return { status: 201, body: currentRevision('revision-2') };
    }
    if (method === 'POST' && path === 'admin/content/content-draft/publish') {
      publishBody = body;
      publishedRevisionId =
        isRecord(body) && typeof body['revisionId'] === 'string' ? body['revisionId'] : null;
      currentStatus = 'PUBLISHED';
      return { status: 200, body: currentRevision(publishedRevisionId ?? latestRevisionId) };
    }
    return notFound();
  });

  await page.route('**/api/v1/content/**', async (route) => {
    const request = route.request();
    const headers = corsHeaders(request.headers()['origin'] ?? 'http://127.0.0.1:3102');
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (!publishedRevisionId) {
      await route.fulfill({
        status: 404,
        headers: { ...headers, 'content-type': 'application/problem+json' },
        body: JSON.stringify(problem(404, 'Not Found', 'Published content was not found.').body),
      });
      return;
    }
    const revision = currentRevision(publishedRevisionId);
    await route.fulfill({
      status: 200,
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        contentId: 'content-draft',
        contentKey: 'article:draft-note',
        contentType: 'article',
        slug: 'engineering/draft-note',
        publishedRevisionId,
        document: revision.document,
        seo: { title: revision.document.title, description: revision.document.description },
        publishedAt: '2026-09-05T10:00:00.000Z',
      }),
    });
  });

  await page.goto('/admin/content/content-draft/');
  await page.getByRole('link', { name: 'Edit draft' }).click();
  await page.locator('#document-title').fill('Systems Guide for Publication');
  await page
    .getByRole('article', { name: 'Block 1: Rich text' })
    .getByLabel('Text', { exact: true })
    .fill('Published learner copy.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status')).toContainText('Saved as revision 2.');
  expect(latestRevisionId).toBe('revision-2');
  expect(publishedRevisionId).toBeNull();
  expect(appendCalls).toBe(1);

  await page.getByRole('link', { name: 'Back to content' }).click();
  await expect(
    page.getByRole('heading', { name: 'Systems Guide for Publication', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Published learner copy.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish selected revision' }).click();
  const publishDialog = page.getByRole('dialog');
  await expect(publishDialog.getByRole('heading', { name: 'Publish revision 2?' })).toBeVisible();
  await publishDialog.getByRole('button', { name: 'Publish revision', exact: true }).click();

  await expect(page.getByText('Public content now serves this revision.')).toBeVisible();
  expect(publishBody).toEqual({ revisionId: 'revision-2' });
  expect(publishedRevisionId).toBe('revision-2');
  expect(appendCalls).toBe(1);
});

test('archive requires confirmation and displays the archived state', async ({ page }) => {
  const draft = makeItem('content-draft', 'revision-1', null, 'DRAFT');
  let archiveCalls = 0;
  let archivedItem: unknown = null;
  await mockAdminApi(page, (method, path) => {
    if (method === 'GET' && path === 'admin/content/content-draft') {
      return { status: 200, body: archivedItem ?? draft };
    }
    if (method === 'GET' && path === 'admin/content/content-draft/revisions') {
      return {
        status: 200,
        body: { items: [makeSummary('content-draft', 'revision-1', 1, null)], nextCursor: null },
      };
    }
    if (method === 'GET' && path.endsWith('/revisions/revision-1')) {
      return { status: 200, body: makeRevision('revision-1', 'Draft Systems Guide', 1, draft) };
    }
    if (method === 'POST' && path === 'admin/content/content-draft/archive') {
      archiveCalls += 1;
      archivedItem = {
        ...draft,
        status: 'ARCHIVED',
        archivedAt: '2026-09-05T10:00:00.000Z',
        archivedBy: 'account-archiver',
      };
      return {
        status: 200,
        body: archivedItem,
      };
    }
    return notFound();
  });

  await page.goto('/admin/content/content-draft/');
  await page.getByRole('button', { name: 'Archive content' }).click();
  const archiveDialog = page.getByRole('dialog');
  await expect(archiveDialog.getByRole('heading', { name: 'Archive this content?' })).toBeVisible();
  await archiveDialog.getByRole('button', { name: 'Cancel' }).click();
  expect(archiveCalls).toBe(0);

  await page.getByRole('button', { name: 'Archive content' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive content' }).click();
  await expect(page.getByText(/^Content archived on /)).toBeVisible();
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  expect(archiveCalls).toBe(1);
});

async function mockAdminApi(page: Page, mock: ApiMock): Promise<void> {
  await page.unroute('**/api/v1/admin/content**').catch(() => undefined);
  await page.route('**/api/v1/admin/content**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const marker = '/api/v1/';
    const pathStart = url.pathname.indexOf(marker);
    const path = pathStart < 0 ? url.pathname : url.pathname.slice(pathStart + marker.length);
    const headers = corsHeaders(request.headers()['origin'] ?? 'http://127.0.0.1:3102');
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    const reply = mock(request.method(), path, url.searchParams, body);
    await route.fulfill({
      status: reply.status,
      headers: {
        ...headers,
        'content-type': reply.problem ? 'application/problem+json' : 'application/json',
      },
      body: JSON.stringify(reply.body),
    });
  });
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, accept',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
}

function makeItem(
  contentId: string,
  latestRevisionId: string,
  publishedRevisionId: string | null,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
) {
  return {
    contentId,
    contentKey: contentId === 'content-draft' ? 'article:draft-note' : 'article:systems-guide',
    slug: contentId === 'content-draft' ? 'engineering/draft-note' : 'engineering/systems-guide',
    status,
    latestRevisionId,
    publishedRevisionId,
    createdBy: 'account-1',
    archivedAt: null,
    archivedBy: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-05T10:00:00.000Z',
  };
}

function makeRevision(
  revisionId: string,
  title: string,
  revisionNumber: number,
  content = publishedItem,
) {
  return {
    contentId: content.contentId,
    contentKey: content.contentKey,
    slug: content.slug,
    status: content.status,
    contentType: 'article',
    revisionId,
    revisionNumber,
    checksumSha256: 'a'.repeat(64),
    revisionCreatedBy: 'account-1',
    createdBy: 'account-1',
    createdAt: '2026-09-04T10:00:00.000Z',
    publishedAt: content.publishedRevisionId === revisionId ? '2026-09-03T10:00:00.000Z' : null,
    publishedBy: content.publishedRevisionId === revisionId ? 'account-1' : null,
    document: {
      schema_version: 1,
      title,
      description: 'A guide to system design.',
      blocks: [
        {
          id: 'body',
          type: 'rich_text',
          version: 1,
          props: { nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
        },
      ],
    },
  };
}

function makeSummary(
  contentId: string,
  revisionId: string,
  revisionNumber: number,
  publishedAt: string | null,
) {
  return {
    contentId,
    revisionId,
    revisionNumber,
    checksumSha256: 'a'.repeat(64),
    revisionCreatedBy: 'account-1',
    createdAt: '2026-09-04T10:00:00.000Z',
    publishedAt,
    publishedBy: publishedAt ? 'account-1' : null,
  };
}

function notFound(): ApiReply {
  return problem(404, 'Not Found', 'The requested content item was not found.');
}

function problem(status: number, title: string, detail: string): ApiReply {
  return {
    status,
    problem: true,
    body: { type: 'about:blank', title, status, detail },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

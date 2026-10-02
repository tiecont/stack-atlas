import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '@/lib/api/client';
import {
  contentSlugCacheTag,
  createPublicContentService,
  PublicContentUnavailableError,
} from './public-content.service';

const contentId = '00000000-0000-4000-8000-000000000001';
const revisionId = '00000000-0000-4000-8000-000000000002';
const slug = 'articles/golang/types-zero-values';
const publishedAt = '2026-09-30T00:00:00.000Z';

const document = {
  schema_version: 1,
  title: 'Types, Variables và Zero Value',
  description: 'A guide to Go zero values.',
  blocks: [
    {
      id: 'heading-intro',
      type: 'heading',
      version: 1,
      props: { level: 2, text: 'Zero values', anchor: 'uu-điem' },
    },
    {
      id: 'intro',
      type: 'rich_text',
      version: 1,
      props: {
        nodes: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Every type has a useful default.' }],
          },
        ],
      },
    },
  ],
};

const publishedContent = {
  contentId,
  contentKey: 'article:season-01-fundamentals-02-types-zero-values',
  contentType: 'article',
  slug,
  publishedRevisionId: revisionId,
  document,
  seo: {
    title: document.title,
    description: document.description,
  },
  publishedAt,
};

function clientReturning(value: unknown) {
  const calls: Array<{ path: string; options: unknown }> = [];
  return {
    calls,
    client: {
      get: async (path: string, options?: unknown) => {
        calls.push({ path, options });
        return value;
      },
    },
  };
}

test('loads an encoded published slug with bounded, revision-aware caching', async () => {
  const mock = clientReturning(publishedContent);
  const service = createPublicContentService(mock.client);

  assert.deepEqual(await service.getPublishedContent(slug), publishedContent);
  assert.equal(mock.calls[0]?.path, 'content/articles%2Fgolang%2Ftypes-zero-values');
  assert.deepEqual(mock.calls[0]?.options, {
    cache: 'force-cache',
    next: {
      revalidate: 60,
      tags: ['published-content-v1', contentSlugCacheTag(slug)],
    },
    signal: (mock.calls[0]?.options as { signal: AbortSignal }).signal,
  });
  assert.ok((mock.calls[0]?.options as { signal: AbortSignal }).signal instanceof AbortSignal);
  assert.ok(contentSlugCacheTag(slug).length < 80);
});

test('maps API 404 to missing content and never falls back to filesystem data', async () => {
  let calls = 0;
  const service = createPublicContentService({
    get: async () => {
      calls += 1;
      throw new ApiError(404, { type: 'about:blank', title: 'Not found', status: 404 });
    },
  });

  assert.equal(await service.getPublishedContent(slug), null);
  assert.equal(await service.getPublishedContent('../private'), null);
  assert.equal(calls, 1);
});

test('rejects invalid API responses and maps upstream failures to a safe error', async () => {
  const malformed = createPublicContentService(clientReturning({ ...publishedContent, html: '<p>x</p>' }).client);
  await assert.rejects(
    malformed.getPublishedContent(slug),
    PublicContentUnavailableError,
  );

  const failed = createPublicContentService({
    get: async () => {
      throw new ApiError(503, { type: 'about:blank', title: 'Unavailable', status: 503 });
    },
  });
  await assert.rejects(failed.getPublishedContent(slug), PublicContentUnavailableError);
});

test('searches published summaries through the API client and handles empty queries locally', async () => {
  const item = {
    contentId,
    contentKey: 'article:season-01-fundamentals-02-types-zero-values',
    contentType: 'article',
    slug,
    publishedRevisionId: revisionId,
    title: document.title,
    description: document.description,
    publishedAt,
  };
  const mock = clientReturning({ items: [item] });
  const service = createPublicContentService(mock.client);

  assert.deepEqual(await service.searchPublishedContent('  zero values  '), [item]);
  assert.equal(mock.calls[0]?.path, 'content/search?q=zero+values');
  assert.equal((await service.searchPublishedContent('   ')).length, 0);
  assert.equal(mock.calls.length, 1);
});

test('rejects unsafe search destinations and oversized search inputs', async () => {
  const mock = clientReturning({
    items: [
      {
        contentId,
        contentKey: 'article:unsafe',
        contentType: 'article',
        slug: 'javascript/alert/1',
        publishedRevisionId: revisionId,
        title: 'Unsafe',
        description: 'Unsafe URL',
        publishedAt,
      },
    ],
  });
  const service = createPublicContentService(mock.client);

  await assert.rejects(service.searchPublishedContent('unsafe'), PublicContentUnavailableError);
  await assert.rejects(service.searchPublishedContent('x'.repeat(161)), TypeError);
  assert.equal(mock.calls.length, 1);
});

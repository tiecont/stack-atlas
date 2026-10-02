import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSearchHandler } from '../../app/api/search/route.ts';

const item = {
  contentId: '00000000-0000-4000-8000-000000000001',
  contentKey: 'article:transactional-outbox',
  contentType: 'article',
  slug: 'articles/architecture/transactional-outbox',
  publishedRevisionId: '00000000-0000-4000-8000-000000000002',
  title: 'Transactional Outbox',
  description: 'Reliable ownership changes.',
  publishedAt: '2026-09-30T00:00:00.000Z',
};

function request(query, kind = 'all') {
  const params = new URLSearchParams({ q: query, kind });
  return new Request(`http://localhost/api/search?${params}`);
}

test('uses API published articles and keeps topic and path results available', async () => {
  const calls = [];
  const handler = createSearchHandler(async (query) => {
    calls.push(query);
    return [item];
  });

  const articleResponse = await handler(request('outbox', 'article'));
  assert.deepEqual(await articleResponse.json(), {
    results: [
      {
        id: 'transactional-outbox',
        title: item.title,
        description: item.description,
        url: '/articles/architecture/transactional-outbox/',
        kind: 'article',
        label: 'Article',
        domain: 'architecture',
      },
    ],
  });
  assert.deepEqual(calls, ['outbox']);

  const topicResponse = await handler(request('distributed systems', 'topic'));
  const topicPayload = await topicResponse.json();
  assert.ok(topicPayload.results.some((result) => result.id === 'distributed-systems'));
  assert.deepEqual(calls, ['outbox']);
});

test('does not expose partial results or upstream details when published search fails', async () => {
  const handler = createSearchHandler(async () => {
    throw new Error('private upstream details');
  });
  const response = await handler(request('ownership'));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Search is temporarily unavailable.' });
});

test('validates public search input before calling the API', async () => {
  let calls = 0;
  const handler = createSearchHandler(async () => {
    calls += 1;
    return [item];
  });

  assert.equal((await handler(request('x'.repeat(161)))).status, 400);
  assert.equal((await handler(request('x', 'unknown'))).status, 400);
  assert.deepEqual(await (await handler(request('   '))).json(), { results: [] });
  assert.equal(calls, 0);
});

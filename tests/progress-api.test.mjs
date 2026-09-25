import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../lib/api/client.ts';
import { readProgress } from '../features/progress/progress-store.ts';
import fixture from './fixtures/problem-details.v1.json' with { type: 'json' };

test('migrates v1 local progress and keeps path-specific resume state', () => {
  const values = new Map([
    ['stack-atlas-progress-v1', JSON.stringify({ completed: ['shared', 'go', 'shared'] })],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const migrated = readProgress(storage);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.completed, ['shared', 'go']);
  assert.equal(migrated.activePath, null);
  assert.deepEqual(JSON.parse(values.get('stack-atlas-progress-v2')), migrated);
});

test('uses configured API base, JSON headers, credentials and Problem Details', async () => {
  const calls = [];
  const client = createApiClient('https://api.example.test/api/v1', async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: 'fixture' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  });
  assert.deepEqual(await client.post('account', { email: 'member@example.test' }), {
    id: 'fixture',
  });
  assert.equal(calls[0].url, 'https://api.example.test/api/v1/account');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(
    calls[0].options.headers.get('Accept'),
    'application/json, application/problem+json',
  );
  assert.equal(calls[0].options.headers.get('Content-Type'), 'application/json');

  const problemClient = createApiClient(
    'https://api.example.test/api/v1/',
    async () =>
      new Response(JSON.stringify({ ...fixture, extension_from_future_api: true }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json; charset=utf-8' },
      }),
  );
  await assert.rejects(problemClient.get('articles/missing'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, fixture.status);
    assert.equal(error.problem.instance, fixture.instance);
    assert.equal(error.problem.extension_from_future_api, true);
    return true;
  });
});

test('rejects API URL escape attempts and handles empty and 204 responses', async () => {
  let fetchCalled = false;
  const client = createApiClient('https://api.example.test/api/v1/', async () => {
    fetchCalled = true;
    return new Response(null, { status: 204 });
  });
  assert.equal(await client.delete('account'), null);
  assert.equal(fetchCalled, true);
  fetchCalled = false;
  await assert.rejects(client.get('../../admin'), TypeError);
  await assert.rejects(client.get('https://other.example/path'), TypeError);
  await assert.rejects(client.get('//other.example/path'), TypeError);
  assert.equal(fetchCalled, false);
});

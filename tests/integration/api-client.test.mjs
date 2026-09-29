import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../../lib/api/client.ts';
import fixture from '../fixtures/problem-details.v1.json' with { type: 'json' };

const baseUrl = process.env.API_BASE_URL;
if (!baseUrl) {
  process.stderr.write('API_BASE_URL is required; set it to the API /api/v1/ base.\n');
  process.exit(2);
}

test('Web API client matches health and Problem Details endpoints', async () => {
  const client = createApiClient(baseUrl);
  assert.deepEqual(await client.get('health'), { status: 'ok' });
  assert.deepEqual(await client.get('health/ready'), {
    status: 'ok',
    dependencies: { postgres: 'ok' },
  });
  await assert.rejects(client.get('articles/missing'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, fixture.status);
    assert.deepEqual(error.problem, fixture);
    return true;
  });
});

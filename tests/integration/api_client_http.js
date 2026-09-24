const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const baseUrl = process.env.API_BASE_URL;

if (!baseUrl) {
  console.log('Skipped API HTTP integration; set API_BASE_URL to the API /api/v1/ base.');
  process.exit(0);
}

const window = {};
vm.runInNewContext(
  fs.readFileSync(path.join(root, 'platform/assets/scripts/api-client.js'), 'utf8'),
  {window, URL, Headers, fetch},
);

const fixture = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/fixtures/problem-details.v1.json'), 'utf8'),
);
const {ApiError, createClient} = window.StackAtlasApi;

(async () => {
  const client = createClient({baseUrl});
  assert.deepEqual(JSON.parse(JSON.stringify(await client.get('health'))), {status: 'ok'});
  assert.deepEqual(
    JSON.parse(JSON.stringify(await client.get('health/ready'))),
    {status: 'ok', dependencies: {postgres: 'ok'}},
  );

  await assert.rejects(client.get('articles/missing'), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, fixture.status);
    assert.deepEqual(JSON.parse(JSON.stringify(error.problem)), fixture);
    return true;
  });
  console.log('API HTTP integration contract passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

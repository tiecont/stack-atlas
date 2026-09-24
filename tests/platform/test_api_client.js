const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const window = {};
vm.runInNewContext(
  fs.readFileSync(path.join(root, 'platform/assets/scripts/api-client.js'), 'utf8'),
  {window, URL, Headers, fetch: async () => { throw new Error('unexpected fetch'); }},
);

const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/problem-details.v1.json'), 'utf8'));
const {ApiError, createClient} = window.StackAtlasApi;

async function testJsonRequestUsesConfiguredBase() {
  const calls = [];
  const client = createClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {
        ok: true,
        status: 200,
        json: async () => ({status: 'ok'}),
      };
    },
  });

  assert.deepEqual(await client.get('/health'), {status: 'ok'});
  assert.equal(calls[0].url, 'https://api.example.test/api/v1/health');
  assert.equal(calls[0].options.headers.get('Accept'), 'application/json, application/problem+json');
}

async function testPostSerializesJsonAndKeepsProblemDetails() {
  const calls = [];
  const client = createClient({
    baseUrl: 'https://api.example.test/api/v1/',
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, status: 201, json: async () => ({id: 'fixture-id'})};
    },
  });

  assert.deepEqual(await client.post('submissions', {source: 'package main'}), {id: 'fixture-id'});
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.get('Content-Type'), 'application/json');
  assert.equal(calls[0].options.body, JSON.stringify({source: 'package main'}));

  const failingClient = createClient({
    baseUrl: 'https://api.example.test/api/v1/',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {get: () => 'application/problem+json; charset=utf-8'},
      json: async () => ({...fixture, extension_from_future_api: true}),
    }),
  });
  await assert.rejects(failingClient.get('articles/missing'), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(error.problem.instance, fixture.instance);
    assert.equal(error.problem.extension_from_future_api, true);
    return true;
  });
}

async function testPathsCannotEscapeTheConfiguredBase() {
  let fetchCalled = false;
  const client = createClient({
    baseUrl: 'https://api.example.test/api/v1/',
    fetchImpl: async () => { fetchCalled = true; },
  });
  const isTypeError = error => error?.name === 'TypeError';
  await assert.rejects(client.get('../../admin'), isTypeError);
  await assert.rejects(client.get('https://other.example/path'), isTypeError);
  await assert.rejects(client.get('//other.example/path'), isTypeError);
  assert.equal(fetchCalled, false);
}

(async () => {
  await testJsonRequestUsesConfiguredBase();
  await testPostSerializesJsonAndKeepsProblemDetails();
  await testPathsCannotEscapeTheConfiguredBase();
  console.log('API client contract regressions passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

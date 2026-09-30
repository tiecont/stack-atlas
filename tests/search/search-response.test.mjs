import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSearchResponse } from '../../features/search/search-response.ts';

test('validates the search response before exposing result links to the UI', () => {
  assert.deepEqual(
    parseSearchResponse({
      results: [
        {
          id: 'goroutines',
          title: 'Goroutines',
          description: 'Go concurrency',
          url: '/articles/golang/goroutines/',
          kind: 'article',
          label: 'Article',
        },
      ],
    }),
    [
      {
        id: 'goroutines',
        title: 'Goroutines',
        description: 'Go concurrency',
        url: '/articles/golang/goroutines/',
        kind: 'article',
        label: 'Article',
      },
    ],
  );
});

test('rejects malformed payloads and non-local result destinations', () => {
  assert.throws(() => parseSearchResponse({ results: 'not a list' }), TypeError);
  assert.throws(
    () =>
      parseSearchResponse({
        results: [
          {
            id: 'unsafe',
            title: 'Unsafe',
            description: '',
            url: 'javascript:alert(1)',
            kind: 'article',
            label: 'Article',
          },
        ],
      }),
    TypeError,
  );
});

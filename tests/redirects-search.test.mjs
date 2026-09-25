import assert from 'node:assert/strict';
import { test } from 'node:test';
import nextConfig from '../next.config.ts';
import { loadCatalog } from '../lib/content/loader.ts';
import { buildLegacyRedirects, validateLegacyRedirects } from '../lib/content/redirects.ts';
import { searchCatalog } from '../lib/content/search.ts';

const catalog = loadCatalog();
const unwrap = (value) => {
  while (value && typeof value === 'object' && 'default' in value) value = value.default;
  return value;
};

test('derives all 341 article and 24 historical module redirects from metadata', async () => {
  const redirects = buildLegacyRedirects(catalog);
  assert.equal(redirects.filter((item) => item.kind === 'article').length, 341);
  assert.equal(redirects.filter((item) => item.kind === 'path-module').length, 24);
  assert.equal(new Set(redirects.map((item) => item.source)).size, redirects.length);
  assert.deepEqual(validateLegacyRedirects(catalog), []);
  const configured = await unwrap(nextConfig).redirects();
  assert.equal(configured.length, redirects.length);
  assert.ok(configured.every((item) => item.permanent));
  for (const article of catalog.articles) {
    for (const source of article.legacy_urls) {
      assert.ok(
        configured.some((item) => item.source === source && item.destination === article.url),
      );
    }
  }
});

test('legacy season index aliases resolve to their module anchors', () => {
  for (const learningPath of catalog.paths) {
    for (const pathModule of learningPath.modules) {
      for (const source of pathModule.legacy_index_urls ?? []) {
        assert.ok(
          buildLegacyRedirects(catalog).some(
            (item) =>
              item.source === source &&
              item.destination === `/paths/${learningPath.id}/#module-${pathModule.id}`,
          ),
        );
      }
    }
  }
});

test('search covers article text, topics, paths, tags, titles and descriptions', () => {
  const articleResults = searchCatalog('ownership', 'article', 100);
  assert.ok(
    articleResults.some((item) => item.id === 'season-01-fundamentals-02-types-zero-values'),
  );
  assert.ok(
    searchCatalog('distributed systems', 'topic').some((item) => item.id === 'distributed-systems'),
  );
  assert.ok(
    searchCatalog('backend engineering', 'path').some((item) => item.id === 'golang-backend'),
  );
  assert.deepEqual(searchCatalog('   '), []);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleContent } from '../features/content/components/article-content.tsx';
import { analyzeArticleHtml } from '../lib/content/html.ts';
import { loadCatalog, orderedModules, pathSequence } from '../lib/content/loader.ts';
import { validateCatalog } from '../lib/content/validation.ts';

const catalog = loadCatalog();

test('loads and validates the full canonical content catalog', () => {
  assert.equal(catalog.articles.length, 346);
  assert.equal(catalog.topics.length, 19);
  assert.equal(catalog.paths.length, 2);
  assert.equal(
    new Set(catalog.articles.map((article) => article.id)).size,
    catalog.articles.length,
  );
  assert.equal(
    new Set(catalog.articles.map((article) => article.url)).size,
    catalog.articles.length,
  );
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(
    catalog.articles.every((article) => article.bodyHtml.length > 0 && article.bodyText.length > 0),
  );
});

test('preserves declared module and article ordering', () => {
  const golang = catalog.pathById.get('golang-backend');
  assert.ok(golang);
  const modules = orderedModules(golang);
  assert.equal(modules.length, 24);
  assert.equal(modules[0].order, 1);
  assert.equal(modules.at(-1).order, 24);
  assert.equal(pathSequence(golang).length, 341);
  assert.equal(modules[0].articles[0].id, 'season-01-fundamentals-01-go-program');
  const shared = catalog.pathById
    .get('kubernetes-engineer')
    .modules.flatMap((pathModule) => pathModule.article_ids);
  assert.ok(shared.includes('season-19-kubernetes-for-go-backend-01-kubernetes-mental-model'));
});

test('renders authored article fragments as React markup including SVG diagrams', () => {
  const article = catalog.articleById.get('season-01-fundamentals-02-types-zero-values');
  assert.ok(article);
  const markup = renderToStaticMarkup(
    React.createElement(ArticleContent, { html: article.bodyHtml }),
  );
  assert.match(markup, /<h2 id="s1">1\. Mental model<\/h2>/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 900 300"/);
  assert.match(markup, /<figcaption>/);
  assert.doesNotMatch(markup, /dangerouslySetInnerHTML/);
});

test('every canonical article body remains renderable through the React sanitizer', () => {
  let count = 0;
  for (const article of catalog.articles) {
    const markup = renderToStaticMarkup(
      React.createElement(ArticleContent, { html: article.bodyHtml }),
    );
    assert.ok(markup.length > 0, `${article.id} rendered empty markup`);
    assert.doesNotMatch(markup, /<script\b|<iframe\b/i, article.id);
    count += 1;
  }
  assert.equal(count, 346);
});

test('sanitizes unsafe authored fragment elements, attributes and links', () => {
  const markup = renderToStaticMarkup(
    React.createElement(ArticleContent, {
      html: '<p onclick="alert(1)">Safe <a href="javascript:alert(1)">text</a></p><script>alert(2)</script><iframe src="https://bad.invalid"></iframe>',
    }),
  );
  assert.equal(markup, '<p>Safe <a>text</a></p>');
});

test('adds stable IDs to headings without authored IDs', () => {
  const analysis = analyzeArticleHtml('<h2>Résumé &amp; scope</h2><h3>Next step</h3>');
  assert.deepEqual(analysis.headings, [
    { level: 2, id: 'resume-scope', title: 'Résumé & scope' },
    { level: 3, id: 'next-step', title: 'Next step' },
  ]);
  assert.ok(analysis.ids.has('resume-scope'));
});

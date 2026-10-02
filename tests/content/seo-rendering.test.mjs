import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '../../app/page.tsx';
import TopicPage, { generateMetadata as topicMetadata } from '../../app/topics/[topic]/page.tsx';
import PathPage, { generateMetadata as pathMetadata } from '../../app/paths/[path]/page.tsx';
import sitemap from '../../app/sitemap.ts';
import robots from '../../app/robots.ts';
import { loadCatalog } from '../../lib/content/loader.ts';
import { examples } from '../../lib/examples/registry.ts';
import { labs } from '../../lib/labs/registry.ts';

const unwrap = (value) => {
  while (value && typeof value === 'object' && 'default' in value) value = value.default;
  return value;
};

test('React renders homepage, topic and path routes', async () => {
  const home = renderToStaticMarkup(React.createElement(unwrap(HomePage)));
  assert.match(home, /Engineering knowledge,/);
  assert.match(home, /Explore by topic/);
  assert.match(home, /Learning paths/);

  const topicPage = await unwrap(TopicPage)({ params: Promise.resolve({ topic: 'golang' }) });
  const topic = renderToStaticMarkup(topicPage);
  assert.match(topic, /<h1>Golang<\/h1>/);
  assert.match(topic, /Types, Variables/);

  const pathPage = await unwrap(PathPage)({ params: Promise.resolve({ path: 'golang-backend' }) });
  const learningPath = renderToStaticMarkup(pathPage);
  assert.match(learningPath, /<h1>Golang Backend Engineering<\/h1>/);
  assert.match(learningPath, /id="module-go-fundamentals"/);
  assert.match(learningPath, /Mark complete/);

});

test('topic and path metadata include canonical and Open Graph fields', async () => {
  const topic = await topicMetadata({ params: Promise.resolve({ topic: 'golang' }) });
  assert.equal(topic.title, 'Golang');
  assert.equal(topic.alternates.canonical, '/topics/golang/');

  const learningPath = await pathMetadata({ params: Promise.resolve({ path: 'golang-backend' }) });
  assert.equal(learningPath.title, 'Golang Backend Engineering');
  assert.equal(learningPath.alternates.canonical, '/paths/golang-backend/');
});

test('sitemap and robots derive public URLs from the typed catalog', () => {
  const catalog = loadCatalog();
  const entries = unwrap(sitemap)();
  assert.equal(
    entries.length,
    5 +
      catalog.topics.length +
      catalog.paths.length +
      catalog.articles.length +
      labs.length +
      examples.length,
  );
  assert.ok(entries.every((item) => /^https:\/\//.test(item.url)));
  assert.ok(entries.some((item) => item.url.endsWith('/articles/golang/types-zero-values/')));
  assert.deepEqual(unwrap(robots)().rules, { userAgent: '*', allow: '/' });
  assert.match(unwrap(robots)().sitemap, /\/sitemap\.xml$/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '../app/page.tsx';
import ArticlePage, {
  generateMetadata as articleMetadata,
  generateStaticParams as articleParams,
} from '../app/articles/[domain]/[slug]/page.tsx';
import TopicPage, { generateMetadata as topicMetadata } from '../app/topics/[topic]/page.tsx';
import PathPage, { generateMetadata as pathMetadata } from '../app/paths/[path]/page.tsx';
import sitemap from '../app/sitemap.ts';
import robots from '../app/robots.ts';
import { loadCatalog } from '../lib/content/loader.ts';

const unwrap = (value) => {
  while (value && typeof value === 'object' && 'default' in value) value = value.default;
  return value;
};

test('React renders homepage, topic, path and representative article routes', async () => {
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

  const articlePage = await unwrap(ArticlePage)({
    params: Promise.resolve({ domain: 'golang', slug: 'types-zero-values' }),
    searchParams: Promise.resolve({ path: 'golang-backend' }),
  });
  const article = renderToStaticMarkup(articlePage);
  assert.match(article, /<h1>Types, Variables và Zero Value<\/h1>/);
  assert.match(article, /On this page/);
  assert.match(article, /Part of Golang Backend Engineering/);
  assert.match(article, /Learning path navigation/);
});

test('article, topic and path metadata include canonical and Open Graph fields', async () => {
  const article = await articleMetadata({
    params: Promise.resolve({ domain: 'golang', slug: 'types-zero-values' }),
  });
  assert.equal(
    article.description,
    'Hiểu type system đơn giản của Go và tại sao zero value làm API dễ dùng hơn.',
  );
  assert.equal(article.alternates.canonical, '/articles/golang/types-zero-values/');
  assert.equal(article.openGraph.type, 'article');

  const topic = await topicMetadata({ params: Promise.resolve({ topic: 'golang' }) });
  assert.equal(topic.title, 'Golang');
  assert.equal(topic.alternates.canonical, '/topics/golang/');

  const learningPath = await pathMetadata({ params: Promise.resolve({ path: 'golang-backend' }) });
  assert.equal(learningPath.title, 'Golang Backend Engineering');
  assert.equal(learningPath.alternates.canonical, '/paths/golang-backend/');
});

test('Next registers every canonical article URL', () => {
  const catalog = loadCatalog();
  const params = unwrap(articleParams)();
  const routeUrls = params.map(({ domain, slug }) => `/articles/${domain}/${slug}/`).sort();
  const canonicalUrls = catalog.articles.map((article) => article.url).sort();
  assert.equal(params.length, 346);
  assert.deepEqual(routeUrls, canonicalUrls);
});

test('sitemap and robots derive public URLs from the typed catalog', () => {
  const catalog = loadCatalog();
  const entries = unwrap(sitemap)();
  assert.equal(
    entries.length,
    5 + catalog.topics.length + catalog.paths.length + catalog.articles.length,
  );
  assert.ok(entries.every((item) => /^https:\/\//.test(item.url)));
  assert.ok(entries.some((item) => item.url.endsWith('/articles/golang/types-zero-values/')));
  assert.deepEqual(unwrap(robots)().rules, { userAgent: '*', allow: '/' });
  assert.match(unwrap(robots)().sitemap, /\/sitemap\.xml$/);
});

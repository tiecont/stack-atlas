import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ExamplePage from '../app/examples/[example]/page.tsx';
import { GET as getExampleFile } from '../app/examples/[example]/files/[...path]/route.ts';
import ArticlePage from '../app/articles/[domain]/[slug]/page.tsx';
import LabPage from '../app/labs/[lab]/page.tsx';
import { GET as getLabFile } from '../app/labs/[lab]/files/[...path]/route.ts';
import nextConfig from '../next.config.ts';
import { loadCatalog } from '../lib/content/loader.ts';
import { validateCatalog } from '../lib/content/validation.ts';
import { examples, exampleRuntimeFiles } from '../lib/examples/registry.ts';
import { labs, labRuntimeFiles } from '../lib/labs/registry.ts';
import { unregisteredRuntimeFiles } from '../lib/public-content-files.ts';
import { buildPublicContentRedirects } from '../lib/public-content-redirects.ts';

const unwrap = (value) => {
  while (value && typeof value === 'object' && 'default' in value) value = value.default;
  return value;
};

test('registered lab and example guides render from their explicit definitions', async () => {
  const lab = await unwrap(LabPage)({
    params: Promise.resolve({ lab: 'kubernetes-foundations' }),
  });
  const labMarkup = renderToStaticMarkup(lab);
  assert.match(labMarkup, /Kubernetes foundations/);
  assert.match(labMarkup, /Explore the API objects/);

  const example = await unwrap(ExamplePage)({
    params: Promise.resolve({ example: 'atlas-demo-api' }),
  });
  const exampleMarkup = renderToStaticMarkup(example);
  assert.match(exampleMarkup, /atlas-demo-api/);
  assert.match(exampleMarkup, /GET \/health\/live/);
});

test('article lab references link to the registered guide route', async () => {
  const article = await unwrap(ArticlePage)({
    params: Promise.resolve({ domain: 'kubernetes', slug: 'local-kind-cluster' }),
    searchParams: Promise.resolve({}),
  });
  const markup = renderToStaticMarkup(article);
  assert.match(markup, /href="\/labs\/kubernetes-cluster\/"/);
  assert.match(markup, /Version matrix/);
});

test('lab and example downloads return only registered public files', async () => {
  const knownLab = await getLabFile(new Request('http://local.test'), {
    params: Promise.resolve({
      lab: 'kubernetes-foundations',
      path: ['manifests', '10-deployment.yaml'],
    }),
  });
  assert.equal(knownLab.status, 200);
  assert.match(await knownLab.text(), /kind: Deployment/);

  const privateLabFile = await getLabFile(new Request('http://local.test'), {
    params: Promise.resolve({ lab: 'kubernetes-foundations', path: ['Makefile'] }),
  });
  assert.equal(privateLabFile.status, 404);
  assert.ok(existsSync(new URL('../labs/kubernetes/01-foundations/Makefile', import.meta.url)));

  const privateExampleFile = await getExampleFile(new Request('http://local.test'), {
    params: Promise.resolve({
      example: 'atlas-demo-api',
      path: ['cmd', 'server', 'main_test.go'],
    }),
  });
  assert.equal(privateExampleFile.status, 404);
  assert.ok(
    existsSync(new URL('../examples/atlas-demo-api/cmd/server/main_test.go', import.meta.url)),
  );
});

test('article links resolve only to canonical routes, redirects, and registered assets', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.articles.length, 346);
  assert.deepEqual(validateCatalog(catalog), []);

  const target = catalog.articleById.get('k8s-local-kind-cluster');
  assert.ok(target);
  for (const href of [
    '/labs/kubernetes-foundations/files/Makefile',
    '/examples/atlas-demo-api/files/cmd/server/main_test.go',
  ]) {
    const changedArticle = {
      ...target,
      bodyHtml: `<p><a href="${href}">Private file</a></p>`,
    };
    const changedArticles = catalog.articles.map((article) =>
      article.id === target.id ? changedArticle : article,
    );
    const changedCatalog = {
      ...catalog,
      articles: changedArticles,
      articleById: new Map(changedArticles.map((article) => [article.id, article])),
      articleByUrl: new Map(changedArticles.map((article) => [article.url, article])),
    };
    assert.ok(
      validateCatalog(changedCatalog).some((error) =>
        error.includes(`broken local link ${JSON.stringify(href)}`),
      ),
      `${href} should be rejected even though the source file exists`,
    );
  }
});

test('public content redirects and production tracing follow the allowlists', async () => {
  const redirects = buildPublicContentRedirects();
  assert.ok(
    redirects.some(
      ({ source, destination }) =>
        source === '/labs/kubernetes/01-foundations/README.md' &&
        destination === '/labs/kubernetes-foundations/',
    ),
  );
  assert.ok(
    redirects.some(
      ({ source, destination }) =>
        source === '/examples/atlas-demo-api/README.md' &&
        destination === '/examples/atlas-demo-api/',
    ),
  );

  const config = unwrap(nextConfig);
  const tracing = config.outputFileTracingIncludes;
  const exclusions = config.outputFileTracingExcludes;
  assert.ok(!Object.keys(tracing).some((route) => route.startsWith('/tests')));
  assert.deepEqual(
    tracing['/labs/*'],
    labs.flatMap(({ directory, guide, publicFiles }) => [
      `./labs/${directory}/${guide}`,
      ...publicFiles.map((file) => `./labs/${directory}/${file}`),
    ]),
  );
  assert.deepEqual(
    tracing['/examples/*'],
    examples.flatMap(({ directory, guide, publicFiles }) => [
      `./examples/${directory}/${guide}`,
      ...publicFiles.map((file) => `./examples/${directory}/${file}`),
    ]),
  );
  assert.ok(labRuntimeFiles().every((file) => !file.includes('*')));
  assert.ok(exampleRuntimeFiles().every((file) => !file.includes('*')));
  assert.deepEqual(exclusions['/labs/*'], unregisteredRuntimeFiles('labs', labs));
  assert.deepEqual(exclusions['/examples/*'], unregisteredRuntimeFiles('examples', examples));
  assert.ok(exclusions['/labs/*'].some((file) => file.endsWith('/Makefile')));
  assert.ok(exclusions['/examples/*'].some((file) => file.endsWith('/main_test.go')));
  assert.equal(existsSync(new URL('../app/tests/[...path]/route.ts', import.meta.url)), false);
  assert.equal(
    readFileSync(
      new URL('../content/articles/kubernetes/local-kind-cluster/article.html', import.meta.url),
      'utf8',
    ).includes('/labs/kubernetes-cluster/files/version-matrix.yaml'),
    true,
  );
});

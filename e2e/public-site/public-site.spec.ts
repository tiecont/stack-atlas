import { expect, test } from '@playwright/test';

test('homepage, topic, path, and API-published canonical article render', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Engineering knowledge,/ })).toBeVisible();

  await page.goto('/topics/golang/');
  await expect(page.getByRole('heading', { name: 'Golang' })).toBeVisible();

  await page.goto('/paths/golang-backend/');
  await expect(page.getByRole('heading', { name: 'Golang Backend Engineering' })).toBeVisible();

  const articlePath = '/articles/golang/types-zero-values/?path=golang-backend';
  const serverResponse = await request.get(articlePath);
  expect(serverResponse.status()).toBe(200);
  expect(await serverResponse.text()).toContain('Every type has a useful default value.');

  const response = await page.goto(articlePath);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Types, Variables và Zero Value/);
  await expect(page.getByRole('heading', { name: 'Types, Variables và Zero Value' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute(
    'data-content-id',
    '00000000-0000-4000-8000-000000000001',
  );
  await expect(page.getByRole('heading', { name: 'Zero values' })).toHaveAttribute('id', 'uu-điem');
  await expect(page.getByText('Every type has a useful default value.')).toBeVisible();
  await expect(page.getByText('Part of Golang Backend Engineering')).toBeVisible();
});

test('search returns published API articles and Git-backed topic results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search the Atlas' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('ownership');
  await expect(dialog.getByRole('link', { name: /Data Ownership/ }).first()).toBeVisible();

  await dialog.getByRole('searchbox').fill('distributed systems');
  await dialog.getByRole('button', { name: 'Topics' }).click();
  await expect(dialog.getByRole('link', { name: /Distributed Systems/ })).toBeVisible();
});

test('API article blocks keep registered lab links', async ({ page }) => {
  await page.goto('/articles/kubernetes/local-kind-cluster/');
  await expect(
    page.getByRole('heading', { name: 'Tạo Kubernetes lab cluster local bằng kind' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Version matrix' })).toHaveAttribute(
    'href',
    '/labs/kubernetes-cluster/files/version-matrix.yaml',
  );
  await expect(
    page.getByRole('link', { name: 'Open Local kind cluster lab guide' }),
  ).toHaveAttribute('href', '/labs/kubernetes-cluster/');
});

test('legacy article and historical module URLs redirect to canonical targets', async ({
  page,
}) => {
  await page.goto('/season-01-fundamentals/02-types-zero-values.html');
  await expect(page).toHaveURL(/\/articles\/golang\/types-zero-values\/$/);

  await page.goto('/season-01-fundamentals/index.html');
  await expect(page).toHaveURL(/\/paths\/golang-backend\/#module-go-fundamentals$/);
});

test('lab guides and example downloads expose only registered public files', async ({
  request,
}) => {
  const labGuide = await request.get('/labs/kubernetes-foundations/');
  expect(labGuide.status()).toBe(200);
  expect(await labGuide.text()).toContain('Explore the API objects');

  const publicLabFile = await request.get(
    '/labs/kubernetes-foundations/files/manifests/10-deployment.yaml',
  );
  expect(publicLabFile.status()).toBe(200);
  expect(await publicLabFile.text()).toContain('kind: Deployment');

  const privateLabFile = await request.get('/labs/kubernetes-foundations/files/Makefile');
  expect(privateLabFile.status()).toBe(404);

  const privateExampleFile = await request.get(
    '/examples/atlas-demo-api/files/cmd/server/main_test.go',
  );
  expect(privateExampleFile.status()).toBe(404);

  const legacyLabGuide = await request.get('/labs/kubernetes/01-foundations/README.md');
  expect(legacyLabGuide.status()).toBe(200);
  expect(legacyLabGuide.url()).toMatch(/\/labs\/kubernetes-foundations\/$/);

  const legacyLabManifest = await request.get(
    '/labs/kubernetes/01-foundations/manifests/10-deployment.yaml',
  );
  expect(legacyLabManifest.status()).toBe(200);
  expect(legacyLabManifest.url()).toMatch(
    /\/labs\/kubernetes-foundations\/files\/manifests\/10-deployment\.yaml$/,
  );

  const exampleGuide = await request.get('/examples/atlas-demo-api/');
  expect(exampleGuide.status()).toBe(200);
  expect(await exampleGuide.text()).toContain('GET /health/live');

  const removedTestsRoute = await request.get('/tests/kubernetes/version-matrix.yaml');
  expect(removedTestsRoute.status()).toBe(404);
});

test('auth screens, metadata endpoints, health, and not-found route respond', async ({
  page,
  request,
}) => {
  await page.goto('/login/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/register/');
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

  await page.goto('/articles/golang/types-zero-values/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/articles\/golang\/types-zero-values\/$/,
  );

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('/articles/golang/types-zero-values/');

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Sitemap:');

  const health = await request.get('/api/healthz/');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toEqual({ status: 'ok' });

  const missing = await page.goto('/articles/golang/missing-content/');
  expect(missing?.status()).toBe(404);

  const unpublishedGitArticle = await page.goto('/articles/golang/graceful-shutdown/');
  expect(unpublishedGitArticle?.status()).toBe(404);

  const unavailable = await page.goto('/articles/golang/upstream-failure/');
  expect(unavailable?.status()).toBe(500);
  await expect(
    page.getByRole('heading', { name: 'Article temporarily unavailable' }),
  ).toBeVisible();

  const learnerAdminRoute = await request.get('/admin/');
  expect(learnerAdminRoute.status()).toBe(404);
});

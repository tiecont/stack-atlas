import { expect, test } from '@playwright/test';

test('homepage, topic, path, and canonical article render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Engineering knowledge,/ })).toBeVisible();

  await page.goto('/topics/golang/');
  await expect(page.getByRole('heading', { name: 'Golang' })).toBeVisible();

  await page.goto('/paths/golang-backend/');
  await expect(page.getByRole('heading', { name: 'Golang Backend Engineering' })).toBeVisible();

  await page.goto('/articles/golang/types-zero-values/');
  await expect(page).toHaveTitle(/Types, Variables và Zero Value/);
  await expect(page.getByRole('heading', { name: 'Types, Variables và Zero Value' })).toBeVisible();
});

test('search returns results from authored article content', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search the Atlas' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('ownership');
  await expect(dialog.getByRole('link', { name: /Data Ownership/ }).first()).toBeVisible();
});

test('legacy article and historical module URLs redirect to canonical targets', async ({
  page,
}) => {
  await page.goto('/season-01-fundamentals/02-types-zero-values.html');
  await expect(page).toHaveURL(/\/articles\/golang\/types-zero-values\/$/);

  await page.goto('/season-01-fundamentals/index.html');
  await expect(page).toHaveURL(/\/paths\/golang-backend\/#module-go-fundamentals$/);
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
});

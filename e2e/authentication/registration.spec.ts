import { expect, test } from '@playwright/test';

const account = {
  id: '4aa6cf31-06cf-4422-a9b3-c508f71ef6f5',
  email: 'reader@example.test',
  createdAt: '2026-09-27T00:00:00.000Z',
};

test('registers, signs in, loads the account, and signs out through the API client', async ({
  page,
}) => {
  const calls: Array<{
    method: string;
    path: string;
    body: unknown;
  }> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : undefined;
    calls.push({ method: request.method(), path, body });

    if (path.endsWith('/account') && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(account),
      });
      return;
    }
    if (path.endsWith('/auth/login') && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(account),
      });
      return;
    }
    if (path.endsWith('/account/me') && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(account),
      });
      return;
    }
    if (path.endsWith('/auth/logout') && request.method() === 'POST') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ status: 404, body: 'Unexpected API request.' });
  });

  await page.goto('/register/');
  await page.getByLabel('Email').fill('reader@example.test');
  await page.getByLabel('Password').fill('a-test-password-with-enough-length');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/account\/?$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);

  const registration = calls.find((call) => call.path.endsWith('/account'));
  const login = calls.find((call) => call.path.endsWith('/auth/login'));
  const accountRead = calls.find((call) => call.path.endsWith('/account/me'));
  const logout = calls.find((call) => call.path.endsWith('/auth/logout'));
  expect(registration).toMatchObject({
    method: 'POST',
    body: {
      email: 'reader@example.test',
      password: 'a-test-password-with-enough-length',
    },
  });
  expect(login).toMatchObject({ method: 'POST' });
  expect(accountRead).toMatchObject({ method: 'GET' });
  expect(logout).toMatchObject({ method: 'POST' });
  const registrationIndex = calls.findIndex((call) => call.path.endsWith('/account'));
  const loginIndex = calls.findIndex((call) => call.path.endsWith('/auth/login'));
  const accountReadIndex = calls.findIndex((call) => call.path.endsWith('/account/me'));
  const logoutIndex = calls.findIndex((call) => call.path.endsWith('/auth/logout'));
  expect(registrationIndex).toBeLessThan(loginIndex);
  expect(loginIndex).toBeLessThan(accountReadIndex);
  expect(accountReadIndex).toBeLessThan(logoutIndex);
});

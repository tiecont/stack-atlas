import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT ?? '3001';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: baseURL,
    env: { PORT: port, WEB_HOST: '127.0.0.1' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

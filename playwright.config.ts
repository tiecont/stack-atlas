import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT ?? '3001';
const baseURL = `http://127.0.0.1:${port}`;
const apiPort = process.env.E2E_API_PORT ?? '3917';
const apiBaseURL = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/admin-content/**',
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
  webServer: [
    {
      command: 'node e2e/support/public-content-api.mjs',
      url: `${apiBaseURL}/healthz`,
      env: { E2E_API_PORT: apiPort },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run start',
      url: baseURL,
      env: {
        PORT: port,
        WEB_HOST: '127.0.0.1',
        STACK_ATLAS_WEB_PLATFORM: 'learner',
        API_BASE_URL: `${apiBaseURL}/api/v1/`,
        NEXT_PUBLIC_API_BASE_URL: `${apiBaseURL}/api/v1/`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

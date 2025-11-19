import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  timeout: 60_000,
  use: {
    // Point tests at the locally running preview server
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pc',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],
  // Start the built client preview before running tests so we "see" the dev branch locally
  webServer: {
    command: 'pnpm --filter client preview:prod',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});


import { defineConfig } from '@playwright/test';
import { BASE } from './e2e/server.mjs';

// browser tests for the whole app (npm run test:e2e).
// one worker and no retries: the cases run in order and share one account, like the uat sessions
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: BASE,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});

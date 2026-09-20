import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'sorting.spec.ts',
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 5_000 },
  reporter: [['json']],
  outputDir: process.env.PILOT_OUTPUT_DIR || '../private/revision-s02/test-results',
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'zh-CN',
    viewport: { width: 1440, height: 1000 },
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: process.env.PROBE_CANDIDATE_DIR,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['json', { outputFile: process.env.PROBE_REPORT_PATH }]],
  use: {
    headless: true,
    launchOptions: { executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE },
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  },
});

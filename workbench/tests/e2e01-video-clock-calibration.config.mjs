import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e01-video-clock-calibration.spec.mjs',
  outputDir: process.env.E2E01_CALIBRATION_OUTPUT || '.local/e2e01-video-clock-calibration',
  reporter: 'list',
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: true,
    launchOptions: { executablePath: process.env.E2E01_CALIBRATION_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
    video: 'on',
    trace: 'on',
  },
});

import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const localRoot = path.resolve(here, '../../.local/ui-six-cases/reference');

export default defineConfig({
  testDir: here,
  testMatch: 'six-cases.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: path.join(localRoot, 'artifacts'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(localRoot, 'raw-report.json') }],
    ['html', { outputFolder: path.join(localRoot, 'html-report'), open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4320',
    browserName: 'chromium',
    headless: true,
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  webServer: {
    command: 'node ../server.mjs',
    cwd: here,
    url: 'http://127.0.0.1:4320/ui/a',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});

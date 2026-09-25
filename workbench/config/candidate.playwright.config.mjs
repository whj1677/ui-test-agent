import { defineConfig } from '@playwright/test';

async function readPrivateAuthState() {
  const channel = process.env.PROBE_AUTH_STATE_CHANNEL;
  if (!channel) return undefined;
  let response;
  try { response = await fetch(channel, { signal: AbortSignal.timeout(5000) }); }
  catch { throw new Error('AUTH_STATE_CHANNEL_UNAVAILABLE'); }
  if (!response.ok) throw new Error('AUTH_STATE_CHANNEL_UNAVAILABLE');
  const state = await response.json();
  if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) throw new Error('AUTH_STATE_INVALID');
  return state;
}
const authStorageState = await readPrivateAuthState();

export default defineConfig({
  testDir: process.env.PROBE_CANDIDATE_DIR,
  outputDir: process.env.PROBE_OUTPUT_DIR,
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
    ...(authStorageState ? { storageState: authStorageState } : {}),
    screenshot: 'on',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'on',
  },
});

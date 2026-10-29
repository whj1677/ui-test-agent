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
    headless: process.env.PROBE_RECORD_WINDOW !== '1',
    launchOptions: {
      executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
      ...(process.env.PROBE_NETWORK_POLICY_ENABLED === '1' ? { args: [
        '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${process.env.PROBE_CDP_DEBUGGING_PORT}`,
      ] } : {}),
    },
    // Formal whole-window recording follows the native window; generation self-tests stay fixed.
    viewport: process.env.PROBE_RECORD_WINDOW === '1' ? null : { width: 1280, height: 720 },
    locale: 'zh-CN',
    ...(authStorageState ? { storageState: authStorageState } : {}),
    ...((authStorageState || process.env.PROBE_NETWORK_POLICY_ENABLED === '1') ? { serviceWorkers: 'block' } : {}),
    screenshot: 'on',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    // Authenticated network traces can retain Cookie and Authorization headers.
    trace: authStorageState ? 'off' : 'on',
  },
});

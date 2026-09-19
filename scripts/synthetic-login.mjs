// Test-only orchestration: owns the synthetic fixture and the BrowserSession.
// Not an HTTP product endpoint, never a generic login-policy exception.
import { startLab } from '../manual-lab/serve.mjs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function verifyFixture(url) {
  const expected = digest(
    await fs.readFile(new URL('../manual-lab/public/index.html', import.meta.url)),
  );
  const get = async (route) => {
    const response = await fetch(url + route, {
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error('SYNTHETIC_FIXTURE_MISMATCH');
    return response;
  };
  const health = await (await get('/healthz')).json();
  if (health.site !== 'complex-manual-lab' || health.version !== 1)
    throw Error('SYNTHETIC_FIXTURE_MISMATCH');
  for (const route of ['/', '/overview', '/assets', '/tariffs', '/work-orders', '/audit']) {
    if (digest(Buffer.from(await (await get(route)).arrayBuffer())) !== expected)
      throw Error('SYNTHETIC_FIXTURE_MISMATCH');
  }
}

export async function startSyntheticLoginFixture({ port = 0, reuseVerified = false } = {}) {
  let fixture;
  try {
    fixture = await startLab(port);
  } catch (error) {
    if (!reuseVerified || !port || error.code !== 'EADDRINUSE') throw error;
    const url = `http://127.0.0.1:${port}`;
    await verifyFixture(url);
    fixture = { url, close: async () => {}, reused: true };
  }
  return {
    url: fixture.url,
    reused: fixture.reused === true,
    close: fixture.close,
    async enter(browser, task) {
      if (
        task.target !== fixture.url + '/' ||
        !browser.active(task.id) ||
        new URL(browser.loginPage.url()).origin !== fixture.url
      )
        throw Object.assign(new Error('SYNTHETIC_LOGIN_SCOPE_MISMATCH'), {
          code: 'SYNTHETIC_LOGIN_SCOPE_MISMATCH',
        });
      // Revalidate borrowed bytes before clicking, without stopping or resetting its server.
      if (fixture.reused) await verifyFixture(fixture.url);
      const page = browser.loginPage;
      const entry = page.getByRole('button', { name: '进入演示', exact: true });
      if (await entry.isVisible()) await entry.click({ timeout: 5000 });
      await page.getByRole('heading', { name: '运营总览', exact: true }).waitFor({ timeout: 5000 });
      const evidence = await browser.loginEvidence(task);
      const index = evidence.markers.findIndex(
        (m) => m.role === 'heading' && m.name === '运营总览',
      );
      if (index < 0) throw new Error('SYNTHETIC_LOGIN_EVIDENCE_MISSING');
      return browser.confirmLoginEvidence(task, evidence.token, index);
    },
  };
}

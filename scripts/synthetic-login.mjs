// Test-only orchestration: owns the synthetic fixture and the BrowserSession.
// Not an HTTP product endpoint, never a generic login-policy exception.
import { startLab } from '../manual-lab/serve.mjs';

export async function startSyntheticLoginFixture() {
  const fixture = await startLab(0);
  return {
    url: fixture.url,
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

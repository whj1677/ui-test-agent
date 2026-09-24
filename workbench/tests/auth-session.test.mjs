import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createAuthFixture } from '../auth-fixture/server.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { localAuthEnvironments } from '../server/auth/catalog.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport } from '../server/build/report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const projectId = 'project-auth01-engineering';

test('AUTH-01 server-backed login, roles, CDP identity and two independent executor contexts', async () => {
  const fixture = createAuthFixture();
  const origin = await fixture.listen(0);
  const environments = localAuthEnvironments(origin);
  const sessions = new TargetAuthSessions({ environments, browserExecutable: executable, headless: true });
  const scope = { project_id: projectId, environment_id: environments[0].environment_id, role: 'inspector' };
  const localRoot = path.join(root, '.local');
  await fs.mkdir(localRoot, { recursive: true });
  const workspace = await fs.mkdtemp(path.join(localRoot, 'auth01-session-test-'));
  try {
    assert.equal(sessions.status(scope).status, 'NOT_LOGGED_IN');
    const opened = await sessions.open(scope);
    assert.equal(opened.status, 'AWAITING_LOGIN');
    assert.equal((await sessions.check(scope)).status, 'AWAITING_LOGIN');
    const item = sessions.sessions.get(JSON.stringify([scope.project_id, scope.environment_id, scope.role]));
    await item.page.getByLabel('账号').fill('inspector');
    await item.page.getByLabel('密码').fill('demo-inspector');
    await item.page.getByRole('button', { name: '登录' }).click();
    await item.page.getByTestId('protected-value').waitFor();
    const valid = await sessions.check(scope);
    assert.equal(valid.status, 'VALID');
    assert.equal(valid.account_id, 'inspector');
    assert.equal(valid.role, 'inspector');
    const endpoint = await sessions.attachEndpoint(scope, valid.session_version);
    const attached = await chromium.connectOverCDP(endpoint);
    try {
      assert.equal(attached.contexts().length, 1, 'MCP attach selects the sole auth context');
      assert.equal(attached.contexts()[0].pages().length, 1);
      assert.equal(attached.contexts()[0].pages()[0].url(), 'about:blank', 'login input tab was discarded before attach');
      await attached.contexts()[0].pages()[0].goto(`${origin}/protected`);
      assert.equal(await attached.contexts()[0].pages()[0].getByTestId('account').textContent(), '账号：inspector');
    } finally { await attached.close(); }

    const candidateDir = path.join(workspace, 'candidate');
    await fs.mkdir(candidateDir);
    const candidatePath = path.join(candidateDir, 'candidate.spec.mjs');
    await fs.writeFile(candidatePath, `import { test, expect } from '@playwright/test';
test('private context reuse', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await expect(page.getByTestId('account')).toHaveText('账号：inspector');
  await expect(page.getByTestId('role')).toHaveText('角色：inspector');
  expect(await page.evaluate(() => sessionStorage.getItem('auth01-page-state'))).toBeNull();
  await page.evaluate(() => sessionStorage.setItem('auth01-page-state', 'only-this-run'));
});`);
    for (let index = 1; index <= 2; index++) {
      const state = await sessions.stateForExecution(scope, valid.session_version);
      assert(state.cookies.some((cookie) => cookie.name === 'auth01_session'));
      if (index === 1) {
        const direct = await chromium.launch({ headless: true, executablePath: executable });
        try {
          const directContext = await direct.newContext({ storageState: state });
          const directPage = await directContext.newPage();
          await directPage.goto(`${origin}/protected`);
          assert.equal(await directPage.getByTestId('account').textContent(), '账号：inspector');
        } finally { await direct.close(); }
      }
      const raw = await verifyWorkbenchCandidate({
        candidatePath, browserExecutable: executable, fixtureUrl: `${origin}/protected`,
        runDirectory: path.join(workspace, `run-${index}`), authStorageState: state,
      });
      const report = await parseCandidateReport(raw.reportPath, raw.process);
      assert.equal(report.test_status, 'PASSED', JSON.stringify({ index, error: raw.process.error, stderr: raw.process.stderr?.slice(-500) }));
      assert.equal(report.complete_pass, true);
      const cookieValue = state.cookies.find((cookie) => cookie.name === 'auth01_session').value;
      assert(!raw.process.stdout.includes(cookieValue), 'session cookie is not ordinary output');
      assert(!(await fs.readFile(raw.reportPath, 'utf8')).includes(cookieValue), 'session cookie is not in JSON report');
    }

    await item.context.request.post(`${origin}/api/expire`);
    assert.equal((await sessions.check(scope)).status, 'EXPIRED');
    await assert.rejects(sessions.stateForExecution(scope, valid.session_version), /AUTH_SESSION_NOT_VALID/);
    assert.equal((await sessions.clear(scope)).status, 'NOT_LOGGED_IN');
    const afterRestart = new TargetAuthSessions({ environments, browserExecutable: executable, headless: true });
    assert.equal(afterRestart.status(scope).status, 'NOT_LOGGED_IN');
    await afterRestart.close();

    const wrong = { ...scope, role: 'supervisor' };
    await sessions.open(wrong);
    const wrongItem = sessions.sessions.get(JSON.stringify([wrong.project_id, wrong.environment_id, wrong.role]));
    await wrongItem.page.getByLabel('账号').fill('inspector');
    await wrongItem.page.getByLabel('密码').fill('demo-inspector');
    await wrongItem.page.getByRole('button', { name: '登录' }).click();
    assert.equal((await sessions.check(wrong)).status, 'ROLE_MISMATCH');
    await assert.rejects(sessions.stateForExecution(wrong, sessions.status(wrong).session_version), /AUTH_SESSION_NOT_VALID/);
    await sessions.clear(wrong);

    const adminEnv = { ...environments[0], environment_id: 'auth01-admin-probe-v1', identity_url: `${origin}/api/admin`, roles: ['inspector'] };
    const permissionSessions = new TargetAuthSessions({ environments: [adminEnv], browserExecutable: executable, headless: true });
    const permissionScope = { ...scope, environment_id: adminEnv.environment_id };
    try {
      await permissionSessions.open(permissionScope);
      const adminItem = permissionSessions.sessions.get(JSON.stringify([permissionScope.project_id, permissionScope.environment_id, permissionScope.role]));
      await adminItem.page.getByLabel('账号').fill('inspector');
      await adminItem.page.getByLabel('密码').fill('demo-inspector');
      await adminItem.page.getByRole('button', { name: '登录' }).click();
      assert.equal((await permissionSessions.check(permissionScope)).status, 'PERMISSION_DENIED');
    } finally { await permissionSessions.close(); }
  } finally {
    await sessions.close();
    await fixture.close();
  }
});

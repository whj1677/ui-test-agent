import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { localAuthEnvironments } from '../server/auth/catalog.mjs';
import { createAuthFixture } from '../auth-fixture/server.mjs';

const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fixture = createAuthFixture();
const fixtureOrigin = await fixture.listen(0);
const local = await fs.mkdtemp(path.join(os.tmpdir(), 'auth01-workbench-browser-'));
const caseStore = new CaseLibraryStore(path.join(local, 'cases'));
await caseStore.init();
const project = await caseStore.createProject({ name: 'AUTH-01 隔离登录项目', description: '仅合成账号' });
const environments = localAuthEnvironments(fixtureOrigin);
const scope = { project_id: project.project_id, environment_id: environments[0].environment_id, role: 'inspector' };
let authSessions = new TargetAuthSessions({ environments, browserExecutable: executable, headless: true });
const emptyStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const buildStore = { async listTasks() { return []; }, async getBudget() { return null; } };
const buildManager = { active: null, diagnostics() { return null; }, async templates() { return []; } };
function makeServer() {
  return createWorkbenchServer({ store: emptyStore, manager: { active: null }, buildStore, buildManager, caseStore, authSessions });
}
async function listen(server) {
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
let server = makeServer();
let origin = await listen(server);
const browser = await chromium.launch({ headless: true, executablePath: executable });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto(`${origin}/workspace/#/projects/${project.project_id}/auth`);
  await page.getByRole('heading', { name: '被测系统登录准备' }).waitFor();
  await page.getByRole('button', { name: '打开专用登录浏览器' }).click();
  await page.getByText('等待人工登录').waitFor();
  const login = authSessions.sessions.get(JSON.stringify([scope.project_id, scope.environment_id, scope.role])).page;
  await login.getByLabel('账号').fill('inspector');
  await login.getByLabel('密码').fill('demo-inspector');
  await login.getByRole('button', { name: '登录' }).click();
  await login.getByTestId('protected-value').waitFor();
  await page.getByRole('button', { name: '检查登录' }).click();
  await page.getByRole('status').getByText(/状态：有效.*账号：inspector/).waitFor();
  const validVersion = authSessions.status(scope).session_version;
  assert(await authSessions.stateForExecution(scope, validVersion));

  await login.context().request.post(`${fixtureOrigin}/api/expire`);
  await page.getByRole('button', { name: '检查登录' }).click();
  await page.getByRole('status').getByText(/状态：已过期/).waitFor();
  await assert.rejects(authSessions.stateForExecution(scope, validVersion), /AUTH_SESSION_NOT_VALID/);
  await page.getByRole('button', { name: '清除会话' }).click();
  await page.getByRole('status').getByText(/状态：未登录/).waitFor();

  await page.getByRole('button', { name: '打开专用登录浏览器' }).click();
  await page.getByRole('status').getByText(/状态：等待人工登录/).waitFor();
  const second = authSessions.sessions.get(JSON.stringify([scope.project_id, scope.environment_id, scope.role])).page;
  await second.getByLabel('账号').fill('inspector');
  await second.getByLabel('密码').fill('demo-inspector');
  await second.getByRole('button', { name: '登录' }).click();
  await page.getByRole('button', { name: '检查登录' }).click();
  await page.getByRole('status').getByText(/状态：有效/).waitFor();
  await authSessions.close();
  await close(server);
  authSessions = new TargetAuthSessions({ environments, browserExecutable: executable, headless: true });
  server = makeServer(); origin = await listen(server);
  await page.goto(`${origin}/workspace/#/projects/${project.project_id}/auth`);
  await page.getByRole('status').getByText(/状态：未登录/).waitFor();
  console.log(JSON.stringify({ status: 'PASS', browser_checks: 9, project_id: project.project_id,
    verified: ['open', 'manual-login', 'identity', 'expiry', 'blocked-reuse', 'clear', 'relogin', 'restart-memory-loss', 'page-readback'] }));
} finally {
  await browser.close();
  await authSessions.close();
  if (server.listening) await close(server);
  await fixture.close();
  await fs.rm(local, { recursive: true, force: true });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ProjectTargetAccess, normalizeProjectTarget, targetBlockedIconDependency, targetBlockedRequestFacts, targetPassiveDataImageAllowed, targetRequestAllowed } from '../server/project-target-access.mjs';
import { frozenTrialEnvironment } from '../server/build/trial-environment.mjs';
import { startProjectTargetBrowser } from '../server/build/project-target-browser.mjs';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { scriptEnvironments } from '../server/build/user-workflow.mjs';

const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const operator = '本机操作者';

test('only blocked icon JSON subresources are nonfatal; documents, writes and other origins stay violations', () => {
  for (const host of ['api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'])
    assert.equal(targetBlockedIconDependency(`https://${host}/ant-design.json?icons=menu,close`, 'Fetch', 'GET'), true);
  for (const [url, type, method] of [
    ['https://api.iconify.design/ant-design.json?icons=menu', 'Document', 'GET'],
    ['https://api.iconify.design/ant-design.json?icons=menu', 'Fetch', 'POST'],
    ['https://api.iconify.design/ant-design.json?icons=menu&token=secret', 'Fetch', 'GET'],
    ['https://api.iconify.design.evil.example/ant-design.json?icons=menu', 'Fetch', 'GET'],
    ['https://api.iconify.design/upload', 'Fetch', 'GET'],
    ['https://outside.example/image.png', 'Image', 'GET'],
  ]) assert.equal(targetBlockedIconDependency(url, type, method), false);
});

test('blocked icon requests preserve a complete self-test and readable warning evidence', async t => {
  const root = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.blocked-icon-'));
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<main>Ready</main><script>fetch('https://api.iconify.design/ant-design.json?icons=menu').catch(()=>document.body.dataset.icon='blocked')</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const identity = { task_id: 'icon-task', executed_case_id: 'icon-case', executed_external_id: 'ICON-1', executed_case_version: 1, executed_content_sha256: digest('icon'), run_id: 'icon-run', candidate_sha256: digest('candidate') };
  const session = new DevelopmentSession({ directory: root, frozenCase: { steps: [{ order: 1, action: 'Open', expected: 'Ready remains visible' }] },
    normalUrl: origin, verify: options => verifyWorkbenchCandidate({ ...options, browserExecutable: executable }), persist: async () => {}, signal: new AbortController().signal,
    evidenceIdentity: identity, browserExecutable: executable, networkPolicy: { origin, path_prefix: '/' } });
  await session.init();
  await session.invoke('write_draft', { previous_sha256: null, code: `import {test,expect} from '@playwright/test'; test('icon',async({page})=>{await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1',async()=>{await expect(page.locator('body')).toHaveAttribute('data-icon','blocked');await expect(page.getByRole('main')).toHaveText('Ready');});});` });
  const run = await session.invoke('self_test');
  assert.equal(run.status, 'EXECUTED', JSON.stringify(run)); assert.equal(run.result.complete_pass, true);
  const warnings = run.media.find(file => file.relative_path.endsWith('/network-blocked-dependencies.ndjson'));
  assert.ok(warnings); assert.match(await fs.readFile(path.join(root, warnings.relative_path), 'utf8'), /ICON_DEPENDENCY_BLOCKED/);
  assert.ok(!run.media.some(file => file.relative_path.endsWith('/network-policy-breach.json')));
  const report = await session.invoke('read_evidence', { execution: 1, kind: 'report' });
  assert.equal(report.status, 'EXECUTED'); assert.equal(report.network_policy_breach, null);
  assert.equal(report.network_warnings[0].code, 'ICON_DEPENDENCY_BLOCKED');
});

test('target input canonicalizes normal loopback URLs and rejects unsafe identity or path scope', () => {
  const target = normalizeProjectTarget({ name: 'books', entry_url: 'http://127.0.0.1:4462', path_prefix: '/',
    operator, confirm_non_production: true });
  assert.equal(target.entry_url, 'http://127.0.0.1:4462/');
  assert.equal(normalizeProjectTarget({ name: 'search', entry_url: 'http://127.0.0.1:4462/books?q=search', path_prefix: '/books',
    operator, confirm_non_production: true }).entry_url, 'http://127.0.0.1:4462/books?q=search');
  for (const patch of [
    { entry_url: 'file:///tmp/site' },
    { entry_url: 'http://user:pass@127.0.0.1:4462/' },
    { entry_url: 'http://127.0.0.1:4322/workspace/' },
    { entry_url: 'http://127.0.0.1:4462/app#fragment' },
    { entry_url: 'http://127.0.0.1:4462/%2e%2e/admin' },
    { path_prefix: '/app/%2fadmin' },
    { operator: '' },
    { confirm_non_production: false },
  ]) assert.throws(() => normalizeProjectTarget({ name: 'books', entry_url: 'http://127.0.0.1:4462/',
    path_prefix: '/app', operator, confirm_non_production: true, ...patch }));
});

test('target request policy rejects cross-origin, out-of-prefix, encoded traversal and double encoding', () => {
  const policy = { origin: 'http://127.0.0.1:4462', path_prefix: '/app' };
  assert.equal(targetRequestAllowed(policy, 'http://127.0.0.1:4462/app/index.html'), true);
  assert.equal(targetRequestAllowed(policy, 'http://127.0.0.1:4462/app/assets/site.css?v=1'), true);
  assert.equal(targetRequestAllowed(policy, 'http://127.0.0.1:4462/app/books?q=search'), true);
  assert.equal(targetRequestAllowed(policy, 'http://127.0.0.1:4462/app2/books'), false);
  assert.equal(targetRequestAllowed(policy, 'ws://127.0.0.1:4462/app/live'), true);
  for (const url of [
    'http://127.0.0.1:4462/application/admin',
    'http://127.0.0.1:4462/admin',
    'http://127.0.0.1:4463/app/',
    'http://user@127.0.0.1:4462/app/',
    'http://127.0.0.1:4462/app/%2e%2e/admin',
    'http://127.0.0.1:4462/app/%252e%252e/admin',
    'http://127.0.0.1:4462/app/%252fadmin',
  ]) assert.equal(targetRequestAllowed(policy, url), false, url);
});

test('only passive base64 raster data images are allowed, and blocked data facts omit payload', () => {
  const png = 'data:image/png;base64,aGVsbG8=';
  for (const mime of ['png', 'jpeg', 'gif', 'webp'])
    assert.equal(targetPassiveDataImageAllowed(`data:image/${mime};base64,aGVsbG8=`, 'Image'), true);
  for (const type of ['Document', 'Script', 'Fetch', 'XHR', 'Font', undefined])
    assert.equal(targetPassiveDataImageAllowed(png, type), false, String(type));
  for (const url of ['data:image/svg+xml;base64,aGVsbG8=', 'data:font/woff;base64,aGVsbG8=',
    'data:text/html;base64,aGVsbG8=', 'data:image/png,aGVsbG8=', 'blob:http://127.0.0.1/id'])
    assert.equal(targetPassiveDataImageAllowed(url, 'Image'), false, url.slice(0, 32));
  assert.deepEqual(targetBlockedRequestFacts(png, 'Script'),
    { origin: 'data:', path: '', channel: 'data', resource_type: 'script', mime: 'image/png' });
  assert.equal(targetRequestAllowed({ origin: 'http://127.0.0.1:4462', path_prefix: '/app' }, png), false);
});

test('registered target check accepts an authorized entry query and rejects changed scope or identity', async () => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async url => {
    fetched.push(String(url));
    return { ok: true, body: { cancel: async () => {} } };
  };
  try {
    const origin = 'http://127.0.0.1:4462';
    const config = { kind: 'registered-user-target', id: 'queried-local-target', origin,
      path_prefix: '/app', normal_url: `${origin}/app/index.html?page=price-config`, configuration_sha256: 'A'.repeat(64) };
    const environment = frozenTrialEnvironment(config);
    assert.equal(await environment.check(), true);
    assert.deepEqual(fetched, [config.normal_url]);
    const lease = await environment.acquire('normal');
    assert.equal(lease.url, config.normal_url);
    assert.equal(lease.identity.path_prefix, '/app');
    await lease.release();

    for (const normal_url of [
      'http://127.0.0.1:4463/app/index.html?page=price-config',
      `${origin}/application/index.html?page=price-config`,
      `${origin}/app/%2e%2e/admin?page=price-config`,
      `${origin}/app/./index.html?page=price-config`,
      `${origin}/app/%252e%252e/admin?page=price-config`,
      `${origin}/app/%2fadmin?page=price-config`,
      `http://user:pass@127.0.0.1:4462/app/index.html?page=price-config`,
      `${origin}/app/index.html?page=price-config#secret`,
      'file:///app/index.html?page=price-config',
    ]) await assert.rejects(frozenTrialEnvironment({ ...config, normal_url }).check(), /PROJECT_TARGET_CONFIGURATION_CHANGED/, normal_url);
    await assert.rejects(frozenTrialEnvironment({ ...config, path_prefix: '/other' }).check(), /PROJECT_TARGET_CONFIGURATION_CHANGED/);
    await assert.rejects(frozenTrialEnvironment({ ...config, origin: 'http://127.0.0.1:4322',
      normal_url: 'http://127.0.0.1:4322/workspace/', path_prefix: '/workspace' }).check(), /PROJECT_TARGET_CONFIGURATION_CHANGED/);
    assert.deepEqual(fetched, [config.normal_url, config.normal_url], 'invalid targets never reach fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('registration persists an explicit operator record and restores only the project scoped environment', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-target-register-'));
  const server = http.createServer((request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<main>books</main>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const project = { project_id: 'project-12345678', name: 'Books', cases: [] };
  const manager = { developmentEnvironments: [], candidateTrialEnvironments: [] };
  const access = new ProjectTargetAccess({ root, buildManager: manager, caseStore: { getProject: async id => id === project.project_id ? project : null } });
  t.after(async () => { await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); await fs.rm(root, { recursive: true, force: true }); });
  const target = await access.register(project.project_id, { name: 'Books local', entry_url: `http://127.0.0.1:${port}`,
    path_prefix: '/', operator, confirm_non_production: true });
  assert.equal(target.ready, true);
  assert.equal(target.operator, operator);
  assert.equal(manager.developmentEnvironments[0].project_id, project.project_id);
  assert.equal(manager.candidateTrialEnvironments[0].configurationIdentity.configuration_sha256, target.configuration_sha256);
  const sameProject = await scriptEnvironments(manager, project.project_id);
  assert.equal(sameProject.environments.length, 1);
  assert.equal(sameProject.environments[0].ready, true);
  assert.equal((await scriptEnvironments(manager, 'project-other-12345678')).environments.length, 0);
  assert.equal((await access.list('project-other-12345678')).targets.length, 0);
  assert.equal((await access.list(project.project_id)).targets.length, 1);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'project-targets.json'), 'utf8'));
  assert.equal(saved.targets[0].creator_confirmation, 'LOCAL_OPERATOR_AUTHORIZED_NON_PRODUCTION_TARGET_TEST');
  const restoredManager = { developmentEnvironments: [], candidateTrialEnvironments: [] };
  await new ProjectTargetAccess({ root, buildManager: restoredManager, caseStore: { getProject: async id => id === project.project_id ? project : null } }).init();
  assert.equal(restoredManager.developmentEnvironments[0].id, target.environment_id);
  saved.targets[0].configuration_sha256 = '0'.repeat(64);
  await fs.writeFile(path.join(root, 'project-targets.json'), JSON.stringify(saved));
  await assert.rejects(new ProjectTargetAccess({ root, buildManager: { developmentEnvironments: [], candidateTrialEnvironments: [] },
    caseStore: { getProject: async () => project } }).init(), /PROJECT_TARGET_STORE_INVALID/);
});

test('CDP attach sees the single guarded task context; in-scope resources work and out-of-scope requests never reach target', async t => {
  try { await fs.access(executable); } catch { return t.skip('A local browser executable is required for the CDP policy probe.'); }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-target-cdp-'));
  let forbiddenRequests = 0;
  let websocketRequests = 0;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/admin')) forbiddenRequests++;
    if (request.url === '/app/') { response.writeHead(302, { location: '/admin' }); response.end(); return; }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(request.url === '/app/index.html' ? '<link rel="icon" href="/app/favicon.ico"><main id="ok">scoped</main>' : '<link rel="icon" href="/app/favicon.ico">asset');
  });
  server.on('upgrade', () => { websocketRequests++; });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let blocked = null, targetBrowser, attached;
  t.after(async () => {
    await attached?.close().catch(() => {});
    await targetBrowser?.close().catch(() => {});
    await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    await fs.rm(root, { recursive: true, force: true });
  });
  targetBrowser = await startProjectTargetBrowser({ origin, path_prefix: '/app', entry_url: `${origin}/app/index.html` }, executable, value => { blocked = value; });
  attached = await chromium.connectOverCDP(targetBrowser.endpoint);
  assert.equal(attached.contexts().length, 1, 'the MCP attach endpoint exposes only the guarded task context');
  const context = attached.contexts()[0];
  assert.equal(context.pages().length, 1);
  const selectedPage = context.pages()[0];
  assert.match(selectedPage.url(), /\/app\/index\.html$/);
  assert.equal(context.pages()[0], selectedPage, 'MCP non-isolated attach selects the existing guarded page');
  await selectedPage.goto(`${origin}/app/next`);
  assert.equal(await selectedPage.locator('body').innerText(), 'asset');
  await selectedPage.evaluate(async url => await new Promise(resolve => { const socket = new WebSocket(url); socket.onerror = resolve; socket.onopen = () => { socket.close(); resolve(); }; setTimeout(resolve, 500); }), origin.replace(/^http/, 'ws') + '/admin').catch(() => {});
  assert.equal(blocked?.code, 'TARGET_WEBSOCKET_BLOCKED', `WebSocket attempt must be visible as an environment guard event; ${JSON.stringify(targetBrowser.diagnostics())}`);
  await selectedPage.goto(`${origin}/admin`).catch(() => {});
  assert.equal(blocked?.code, 'TARGET_SCOPE_REQUEST_BLOCKED');
  assert.equal(forbiddenRequests, 0, `the blocked HTTP navigation must not reach the target server; websocketHandshakes=${websocketRequests}; CDP=${JSON.stringify(targetBrowser.diagnostics())}`);
  assert.equal(websocketRequests, 0, 'an out-of-scope WebSocket handshake must not reach the target server');
  t.diagnostic(`CDP contexts=${attached.contexts().length}; MCP-selected pageURL=${selectedPage.url()}; outOfScopeHttpRequests=${forbiddenRequests}; outOfScopeWebSocketHandshakes=${websocketRequests}; guard=${JSON.stringify(targetBrowser.diagnostics())}`);
});

test('guarded target and final runner load passive data PNG while external HTTP remains blocked', async t => {
  try { await fs.access(executable); } catch { return t.skip('A local browser executable is required for the passive data image probe.'); }
  const root = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.project-target-data-'));
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lOwAAAAASUVORK5CYII=';
  let externalRequests = 0, targetBrowser, attached;
  const external = http.createServer((request, response) => { externalRequests++; response.writeHead(200, { 'content-type': 'image/png' }); response.end(); });
  const local = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<link rel="icon" href="/app/favicon.ico"><main>local</main><img id="passive" src="${png}">`);
  });
  await Promise.all([
    new Promise(resolve => external.listen(0, '127.0.0.1', resolve)),
    new Promise(resolve => local.listen(0, '127.0.0.1', resolve)),
  ]);
  const origin = `http://127.0.0.1:${local.address().port}`;
  const entry = `${origin}/app/index.html`;
  let blocked = null;
  t.after(async () => {
    await attached?.close().catch(() => {});
    await targetBrowser?.close().catch(() => {});
    for (const server of [local, external]) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    await fs.rm(root, { recursive: true, force: true });
  });
  targetBrowser = await startProjectTargetBrowser({ origin, path_prefix: '/app', entry_url: entry }, executable, value => { blocked = value; });
  attached = await chromium.connectOverCDP(targetBrowser.endpoint);
  const page = attached.contexts()[0].pages()[0];
  await page.waitForFunction(() => document.querySelector('#passive')?.complete);
  assert.equal(await page.locator('#passive').evaluate(image => image.naturalWidth), 1);
  assert.equal(blocked, null, 'passive data PNG must not trigger an environment violation');

  const candidatePath = path.join(root, 'passive.spec.mjs');
  await fs.writeFile(candidatePath, `import { test, expect } from '@playwright/test';\ntest('passive data image', async ({ page }) => { await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1', async () => { await expect(page.locator('#passive')).toBeVisible(); await expect(page.locator('#passive')).toHaveJSProperty('naturalWidth', 1); }); });\n`);
  const result = await verifyWorkbenchCandidate({ candidatePath, browserExecutable: executable, fixtureUrl: entry,
    runDirectory: path.join(root, 'runner'), networkPolicy: { origin, path_prefix: '/app' },
    stepObservation: { run_id: 'data-image-run', candidate_sha256: 'A'.repeat(64), executed_case_id: 'case-data-image',
      executed_external_id: 'DATA-IMAGE', executed_case_version: 1, executed_content_sha256: 'B'.repeat(64) } });
  assert.equal(result.success, true, `final runner must allow passive data PNG; ${result.process?.stderr || ''}`);

  const activePath = path.join(root, 'active.spec.mjs');
  await fs.writeFile(activePath, `import { test } from '@playwright/test';\ntest('data script stays blocked', async ({ page }) => { await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1', async () => { await page.evaluate(() => new Promise(resolve => { const script = document.createElement('script'); script.src = 'data:text/javascript;base64,d2luZG93Ll9fZXhlY3V0ZWQ9dHJ1ZQ=='; script.onload = resolve; script.onerror = resolve; document.head.append(script); setTimeout(resolve, 1500); })); }); });\n`);
  const activeRun = path.join(root, 'active-runner');
  await assert.rejects(verifyWorkbenchCandidate({ candidatePath: activePath, browserExecutable: executable,
    fixtureUrl: entry, runDirectory: activeRun, networkPolicy: { origin, path_prefix: '/app' },
    stepObservation: { run_id: 'data-script-run', candidate_sha256: 'C'.repeat(64), executed_case_id: 'case-data-script',
      executed_external_id: 'DATA-SCRIPT', executed_case_version: 1, executed_content_sha256: 'D'.repeat(64) } }), /TARGET_SCOPE_REQUEST_BLOCKED/);
  const breach = JSON.parse(await fs.readFile(path.join(activeRun, 'artifacts', 'step-evidence', 'network-policy-breach.json'), 'utf8'));
  assert.equal(breach.origin, 'data:');
  assert.equal(breach.path, '');
  assert.equal(breach.mime, 'text/javascript');
  assert.equal(JSON.stringify(breach).includes('d2luZG93'), false, 'data payload must never enter saved breach facts');

  const fetchPath = path.join(root, 'data-fetch.spec.mjs');
  await fs.writeFile(fetchPath, `import { test } from '@playwright/test';\ntest('data fetch stays blocked', async ({ page }) => { await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1', async () => { await page.evaluate(() => fetch('data:image/png;base64,aGVsbG8=').catch(() => {})); }); });\n`);
  await assert.rejects(verifyWorkbenchCandidate({ candidatePath: fetchPath, browserExecutable: executable,
    fixtureUrl: entry, runDirectory: path.join(root, 'fetch-runner'), networkPolicy: { origin, path_prefix: '/app' },
    stepObservation: { run_id: 'data-fetch-run', candidate_sha256: 'E'.repeat(64), executed_case_id: 'case-data-fetch',
      executed_external_id: 'DATA-FETCH', executed_case_version: 1, executed_content_sha256: 'F'.repeat(64) } }), /TARGET_SCOPE_REQUEST_BLOCKED/);

  const externalUrl = `http://127.0.0.1:${external.address().port}/private.png?hidden=1`;
  await page.evaluate(url => new Promise(resolve => { const image = new Image(); image.onerror = resolve; image.onload = resolve; image.src = url; }), externalUrl);
  assert.equal(blocked?.code, 'TARGET_SCOPE_REQUEST_BLOCKED');
  assert.equal(externalRequests, 0, 'blocked external request must never reach its listener');
  assert.equal(JSON.stringify(blocked).includes('hidden=1'), false, 'query must not be written to violation facts');
});

test('development self-test and independent final runner both block out-of-scope navigation as environment policy', async t => {
  try { await fs.access(executable); } catch { return t.skip('A local browser executable is required for the network-policy execution probe.'); }
  const root = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.project-target-runner-'));
  let forbiddenRequests = 0;
  const requestedPaths = [];
  const server = http.createServer((request, response) => {
    requestedPaths.push(request.url);
    if (request.url.startsWith('/admin')) forbiddenRequests++;
    if (request.url === '/app/?redirect=1') { response.writeHead(302, { location: '/admin' }); response.end(); return; }
    response.writeHead(200, { 'content-type': 'text/html' }); response.end('<main>scoped target</main><a href="/admin">outside</a>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const policy = { origin, path_prefix: '/app', configuration_sha256: 'A'.repeat(64) };
  const redirectCode = `import { test, expect } from '@playwright/test';\ntest('frozen case', async ({ page }) => {\n  await page.goto(process.env.PROBE_URL);\n  await test.step('CASE_STEP_1', async () => { await expect(page.locator('main')).toBeVisible(); });\n});\n`;
  const afterEachCode = `import { test, expect } from '@playwright/test';\ntest.afterEach(async ({ page }) => { await page.getByRole('link', { name: 'outside' }).click(); });\ntest('frozen case', async ({ page }) => {\n  await page.goto(process.env.PROBE_URL);\n  await test.step('CASE_STEP_1', async () => { await expect(page.locator('main')).toBeVisible(); });\n});\n`;
  const identity = { task_id: 'build-policy-12345678', run_id: 'build-policy-12345678-dev-1',
    candidate_sha256: digest(redirectCode), executed_case_id: 'case-policy', executed_external_id: 'POLICY-1',
    executed_case_version: 1, executed_content_sha256: 'B'.repeat(64) };
  const frozenCase = { steps: [{ order: 1, action: 'open a page', expected: 'visible content' }] };
  t.after(async () => { await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); await fs.rm(root, { recursive: true, force: true }); });
  const session = new DevelopmentSession({ directory: root, frozenCase, normalUrl: `${origin}/app/?redirect=1`, signal: new AbortController().signal,
    networkPolicy: policy, evidenceIdentity: identity, browserExecutable: executable,
    verify: options => verifyWorkbenchCandidate({ ...options, browserExecutable: executable }), persist: async () => {} });
  await session.init();
  await session.invoke('write_draft', { code: redirectCode, previous_sha256: null });
  const selfTest = await session.selfTest();
  let finalError = null, finalResult = null;
  await session.invoke('write_draft', { code: afterEachCode, previous_sha256: session.state.draft_sha256 });
  session.normalUrl = `${origin}/app/?afterEach=1`;
  const hookSelfTest = await session.selfTest();
  try { finalResult = await verifyWorkbenchCandidate({ candidatePath: session.draftPath, browserExecutable: executable,
    fixtureUrl: `${origin}/app/?afterEach=1`, runDirectory: path.join(root, 'final'), networkPolicy: policy,
    stepObservation: { ...identity, run_id: 'build-policy-12345678-final' } }); } catch (error) { finalError = error.message; }
  assert.equal(selfTest.status, 'EXECUTOR_ERROR', /TARGET_SCOPE_REQUEST_BLOCKED/.test(selfTest.error));
  assert.equal(hookSelfTest.status, 'EXECUTOR_ERROR', /TARGET_SCOPE_REQUEST_BLOCKED/.test(hookSelfTest.error));
  assert.ok(selfTest.error.includes('TARGET_SCOPE_REQUEST_BLOCKED'));
  assert.ok(hookSelfTest.error.includes('TARGET_SCOPE_REQUEST_BLOCKED'));
  assert.match(finalError || '', /TARGET_SCOPE_REQUEST_BLOCKED/, JSON.stringify({ finalError, finalResult, requestedPaths, forbiddenRequests }));
  assert.equal(forbiddenRequests, 0, JSON.stringify({ result: selfTest.result, hookSelfTest: hookSelfTest.result, finalError, finalResult,
    stderr: finalResult?.processResult?.stderr || finalResult?.process?.stderr, requestedPaths }));
});

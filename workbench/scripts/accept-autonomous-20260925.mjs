// Explicit, one-use acceptance driver for the user's two authorized logical tasks.
// UI -> production API -> BuildTaskManager -> real Harness/MCP -> production verifier.
// No product assertion is authored here. A copies the historical draft; B starts empty.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { createPaths } from '../server/paths.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { registerDevelopmentAuthorization } from '../server/build/development-authorization.mjs';
import { digest } from '../server/build/development-session.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';

if (process.argv[2] !== '--run-authorized-pair') throw new Error('Explicit --run-authorized-pair required; this starts real model tasks.');
const workbench = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(workbench, '.local/a25');
await fs.mkdir(root, { recursive: true });
// Never reset this receipt to re-draw a task. Rerunning requires inspecting existing evidence.
await fs.writeFile(path.join(root, 'authorization-consumed.json'), JSON.stringify({ started_at: new Date().toISOString(), tasks: ['autodev-20260925-a', 'autodev-20260925-b'] }), { flag: 'wx' });
const local = JSON.parse(await fs.readFile(path.join(workbench, 'scripts/start-workbench.local.json'), 'utf8')).profiles.e2e;
const paths = createPaths({ localRoot: root });
const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
const project = await caseStore.createProject({ name: '20260925 自主建例有界验收' });
const source = JSON.parse(await fs.readFile(path.join(workbench, 'qa/20260924/site/cases.workbench.json'), 'utf8'));
const bindings = [{ external_id: 'NEW-001', logical_id: 'autodev-20260925-a', mode: 'recovery', scene: 'paging', fault_step: 3 }, { external_id: 'NEW-002', logical_id: 'autodev-20260925-b', mode: 'new', scene: 'retry', fault_step: 5 }];
const cases = bindings.map(binding => { const content = source.cases.find(item => item.content.external_id === binding.external_id).content; return { case_id: `case-${randomUUID()}`, external_id: content.external_id, title: content.title, current_version: 1, versions: [{ version: 1, content, content_sha256: contentHash(content) }] }; });
await caseStore.updateProject(project.project_id, 1, value => ({ ...value, cases }));
const siteBytes = await fs.readFile(path.join(workbench, 'qa/20260924/site/index.html'));
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const site = http.createServer((request, response) => { if (!['/', '/index.html'].includes(new URL(request.url, 'http://localhost').pathname)) { response.writeHead(404); response.end(); return; } response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(siteBytes); });
const siteUrl = await listen(site);
const environments = bindings.map(binding => ({ id: `qa-${binding.scene}-20260925`, normal_url: `${siteUrl}/index.html?scene=${binding.scene}&variant=normal`, fault_url: `${siteUrl}/index.html?scene=${binding.scene}&variant=fault`, detection: { kind: 'assertion-mismatch-at-step', step_marker: `CASE_STEP_${binding.fault_step}` } }));
for (const [index, binding] of bindings.entries()) {
  const seed = binding.mode === 'recovery' ? await fs.readFile(path.join(workbench, 'qa/20260924/candidates/NEW-001.spec.mjs'), 'utf8') : null;
  await registerDevelopmentAuthorization(store, { logical_id: binding.logical_id, project_id: project.project_id, case_id: cases[index].case_id, case_version: 1, content_sha256: cases[index].versions[0].content_sha256, mode: binding.mode, environment_id: environments[index].id, ...(seed ? { seed_code: seed, seed_sha256: digest(seed) } : {}) });
}
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const manager = new BuildTaskManager({ paths, store, caseStore, browserExecutable: executable, useStoredDshCredentials: true, harnessDshHome: local.WORKBENCH_DSH_HOME, harnessPatchPath: local.WORKBENCH_HARNESS_PATCH, developmentEnvironments: environments });
const server = createWorkbenchServer({ buildStore: store, buildManager: manager, caseStore });
const base = await listen(server);
await fs.writeFile(path.join(root, 'binding.json'), JSON.stringify({ project_id: project.project_id, site_sha256: digest(siteBytes), base, environments, daily_4322_changed: false }, null, 2));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: executable });
  const page = await browser.newPage();
  for (const binding of bindings) {
    await page.goto(`${base}/workspace/#/projects/${project.project_id}/develop`);
    // Select the authorization by its logical identity, not by a product-specific API whitelist.
    const button = page.locator(`[data-develop="${binding.logical_id}"]`);
    await button.click(); await page.waitForURL(/build-tasks\/build-/);
    const taskId = new URL(page.url()).hash.split('/').at(-1);
    console.log(JSON.stringify({ phase: 'STARTED', logical_id: binding.logical_id, task_id: taskId }));
    const progress = setInterval(async () => { const task = await store.getTask(taskId); console.log(JSON.stringify({ task_id: taskId, status: task.task_status, harness: task.development?.harness_starts, tools: task.development?.tool_calls, self_tests: task.development?.self_tests.map(run => ({ execution: run.execution, status: run.result?.test_status || run.status })) })); }, 30_000);
    let result;
    try { result = await manager.wait(taskId); } finally { clearInterval(progress); }
    await page.reload(); await page.getByTestId('development-status').waitFor();
    await page.screenshot({ path: path.join(root, `${binding.logical_id}-workbench.png`), fullPage: true });
    await fs.writeFile(path.join(root, `${binding.logical_id}-result.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ phase: 'SETTLED', logical_id: binding.logical_id, task_id: taskId, status: result.task_status, error: result.error, harness: result.development.harness_starts, tools: result.development.tool_calls, self_tests: result.development.self_tests.length, final_executions: result.development.final_executions?.length || 0 }));
    if (result.error && result.development.tool_calls === 0) throw new Error('SHARED_STARTUP_FAILURE_STOP_BEFORE_NEXT_AUTHORIZATION');
  }
} finally { await browser?.close(); await manager.settle(); await close(server); await close(site); }

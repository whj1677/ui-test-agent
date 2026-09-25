// One new B logical task; old task identities and ledgers are never modified.
// UI -> production API -> BuildTaskManager -> real Harness/MCP -> production verifier.
// No product assertion or old candidate is supplied. The Agent starts empty.
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
import { startUnfamiliarSite,siteRoot } from './unfamiliar-site-server.mjs';
import { execFileSync } from 'node:child_process';

const lane=process.argv[2];if(!['--run-authorized-a','--run-authorized-b'].includes(lane))throw new Error('One explicit authorized lane required');const flow=lane.endsWith('-a')?'a':'b';
const workbench = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(workbench, `.local/fresh25-${flow}`);
await fs.mkdir(root, { recursive: true });
// Never reset this receipt to re-draw a task. Rerunning requires inspecting existing evidence.
await fs.writeFile(path.join(root, 'authorization-consumed.json'), JSON.stringify({ started_at: new Date().toISOString(), tasks: [`unfamiliar-20260925-${flow}`] }), { flag: 'wx' });
const local = JSON.parse(await fs.readFile(path.join(workbench, 'scripts/start-workbench.local.json'), 'utf8')).profiles.e2e;
const paths = createPaths({ localRoot: root });
const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
const project = await caseStore.createProject({ name: `20260925 陌生流程 ${flow.toUpperCase()}` });
const source = JSON.parse(await fs.readFile(path.join(workbench, 'qa/20260925-unfamiliar/site/cases.workbench.json'), 'utf8'));
const bindings = [{ external_id: `FRESH-${flow.toUpperCase()}`, logical_id: `unfamiliar-20260925-${flow}`, mode: 'new', scene:flow, fault_step:flow==='a'?4:3 }];
const cases = bindings.map(binding => { const content = source.cases.find(item => item.content.external_id === binding.external_id).content; return { case_id: `case-${randomUUID()}`, external_id: content.external_id, title: content.title, current_version: 1, versions: [{ version: 1, content, content_sha256: contentHash(content) }] }; });
await caseStore.updateProject(project.project_id, 1, value => ({ ...value, cases }));
const freeze=JSON.parse(await fs.readFile(path.join(siteRoot,'freeze.json')));
for(const file of freeze.files)if(digest(await fs.readFile(path.join(siteRoot,file.name)))!==file.sha256)throw new Error('FROZEN_SITE_CHANGED');
const productFreeze=JSON.parse(await fs.readFile(path.join(workbench,'qa/20260925-unfamiliar/product-freeze.json')));
for(const file of productFreeze.files)if(digest(await fs.readFile(path.join(workbench,'..',file.name)))!==file.sha256)throw new Error('PRODUCT_CONDITIONS_CHANGED');
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const site=await startUnfamiliarSite();const siteUrl=site.base;
const environments=bindings.map(binding=>({id:`unfamiliar-${flow}-20260925`,normal_url:`${siteUrl}/index.html?flow=${flow}&variant=normal`,fault_url:`${siteUrl}/index.html?flow=${flow}&variant=fault`,detection:{kind:'assertion-mismatch-at-step',step_marker:`CASE_STEP_${binding.fault_step}`}}));
for (const [index, binding] of bindings.entries()) {
  await registerDevelopmentAuthorization(store, { logical_id: binding.logical_id, project_id: project.project_id, case_id: cases[index].case_id, case_version: 1, content_sha256: cases[index].versions[0].content_sha256, mode: 'new', environment_id: environments[index].id, limits: { harness_starts: 1 } });
}
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const manager = new BuildTaskManager({ paths, store, caseStore, browserExecutable: executable, useStoredDshCredentials: true, harnessDshHome: local.WORKBENCH_DSH_HOME, harnessPatchPath: local.WORKBENCH_HARNESS_PATCH, developmentEnvironments: environments });
const server = createWorkbenchServer({ buildStore: store, buildManager: manager, caseStore });
const base = await listen(server);
await fs.writeFile(path.join(root, 'binding.json'), JSON.stringify({ project_id: project.project_id, site_freeze:freeze,product_freeze:productFreeze,source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), base, environments, daily_4322_changed: false }, null, 2));
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
    const progress = setInterval(async () => { const task = await store.getTask(taskId); console.log(JSON.stringify({ task_id: taskId, status: task.task_status, harness: task.development?.harness_starts, tools: task.development?.tool_calls, self_tests: task.development?.self_tests.map(run => ({ execution: run.number, status: run.result?.test_status || run.status })) })); }, 30_000);
    let result;
    try { result = await manager.wait(taskId); } finally { clearInterval(progress); }
    await page.reload(); await page.getByTestId('development-status').waitFor();
    await page.screenshot({ path: path.join(root, `${binding.logical_id}-workbench.png`), fullPage: true });
    await fs.writeFile(path.join(root, `${binding.logical_id}-result.json`), JSON.stringify(result, null, 2));
    const media=[];for(const file of result.files.filter(f=>f.web_visible&&/\.(png|zip)$/.test(f.file_name))){const response=await page.request.get(`${base}/api/build/tasks/${taskId}/files/${file.file_id}`);if(response.status()!==200||digest(await response.body())!==file.sha256)throw new Error('REGISTERED_MEDIA_MISMATCH');media.push({file_id:file.file_id,path:file.relative_path,sha256:file.sha256,http_status:200});}
    await fs.writeFile(path.join(root,'browser-audit.json'),JSON.stringify({task_id:taskId,status:await page.getByTestId('development-status').textContent(),rows:await page.locator('.preview-item h3').allTextContents(),media},null,2));
    console.log(JSON.stringify({ phase: 'SETTLED', logical_id: binding.logical_id, task_id: taskId, status: result.task_status, error: result.error, harness: result.development.harness_starts, tools: result.development.tool_calls, self_tests: result.development.self_tests.length, final_executions: result.development.final_executions?.length || 0 }));
    if (result.error && result.development.tool_calls === 0) throw new Error('SHARED_STARTUP_FAILURE_STOP_BEFORE_NEXT_AUTHORIZATION');
  }
} finally { await browser?.close(); await manager.settle(); await close(server); await site.close(); }

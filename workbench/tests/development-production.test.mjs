import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Client, StreamableHTTPClientTransport } from '../../harness-probe/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { createWorkbenchServer } from '../server/app.mjs';
import { createPaths } from '../server/paths.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { registerDevelopmentAuthorization } from '../server/build/development-authorization.mjs';
import { digest } from '../server/build/development-session.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';

const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => server.close(resolve));
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

for (const normalOnly of [false, true]) test(`production task API + pinned MCP + real Playwright: repair and ${normalOnly ? 'normal-only' : 'paired'} final validation`, async () => {
  const parent = new URL('../.local/', import.meta.url); await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(fileURLToPath(new URL('../.local/dev-engineering-', import.meta.url)));
  const paths = createPaths({ localRoot: root });
  const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const project = await caseStore.createProject({ name: 'Engineering autonomous task' }); const caseId = `case-${randomUUID()}`;
  const content = { external_id: 'ENG-RECOVERY', title: 'Engineering status assertion', status: 'CONFIRMED', module: 'engineering', preconditions: '', test_data: '', steps: [{ order: 1, action: 'Read status', expected: 'Status says good' }] };
  await caseStore.updateProject(project.project_id, 1, value => ({ ...value, cases: [{ case_id: caseId, external_id: content.external_id, title: content.title, current_version: 1, versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }));
  const pageServer = http.createServer((request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end(`<div role="status">${request.url === '/fault' ? 'wrong' : 'good'}</div>`); });
  const origin = await listen(pageServer);
  const code = locator => `import {test,expect} from '@playwright/test';\ntest('engineering',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(${locator}).toHaveText('good');});});\n`;
  const bad = code("page.getByText('missing')"); const good = code("page.getByRole('status')");
  await registerDevelopmentAuthorization(store, { logical_id: 'engineering-recovery', project_id: project.project_id, case_id: caseId, case_version: 1, content_sha256: contentHash(content), mode: 'recovery', environment_id: 'engineering', seed_code: bad, seed_sha256: digest(bad) });
  const observed = [];
  const manager = new BuildTaskManager({ store, caseStore, paths, browserExecutable: executable, useStoredDshCredentials: true,
    harnessPatchPath: path.join(paths.repoRoot, 'harness-probe/config/browser-flash.cordis.yml'),
    developmentEnvironments: [normalOnly ? { id: 'engineering', normal_url: origin + '/normal', validation_mode: 'normal-only' } : { id: 'engineering', normal_url: origin + '/normal', fault_url: origin + '/fault', detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_1' } }],
    adapter: { ensureHarnessRuntime: async () => {}, verifyCandidate: verifyWorkbenchCandidate,
      runHarnessTask: async ({ developmentEndpoint, onLifecycle }) => {
        const client = new Client({ name: 'engineering-agent-adapter', version: '1' }, { versionNegotiation: { mode: 'auto' } });
        try {
          await onLifecycle({ type: 'process_spawn' });
          await client.connect(new StreamableHTTPClientTransport(new URL(developmentEndpoint)));
          async function call(name, args = {}) { await onLifecycle({ type: 'harness_event', event_type: 'tool_call', tool: `mcp__workbench__${name}` }); const response = await client.callTool({ name, arguments: args }); assert.notEqual(response.isError, true, JSON.stringify(response)); const value = JSON.parse(response.content[0].text); observed.push({ name, value }); return value; }
          await call('read_draft');
          const failed = await call('self_test'); assert.equal(failed.result.test_status, 'FAILED'); assert.match(JSON.stringify(failed.result), /missing/);
          await call('write_draft', { code: good, previous_sha256: digest(bad) });
          const passed = await call('self_test'); assert.equal(passed.result.complete_pass, true);
          await call('submit_candidate', { sha256: digest(good), outcome: 'ready', coverage: [{ order: 1, requirement: content.steps[0].expected, check_lines: [2], execution: 2, uncovered: '' }] });
          return { events: observed, assessment: { completed: true, browserToolCalls: 1, engineering_adapter: true } };
        } finally { await client.close(); }
      },
    },
  });
  const server = createWorkbenchServer({ buildStore: store, buildManager: manager, caseStore });
  const base = await listen(server); let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: executable }); const page = await browser.newPage();
    await page.goto(`${base}/workspace/#/projects/${project.project_id}/develop`);
    await page.getByRole('button', { name: '开始已授权任务' }).click();
    await page.waitForURL(/build-tasks\/build-/);
    const taskId = new URL(page.url()).hash.split('/').at(-1);
    const result = await manager.wait(taskId);
    assert.equal(result.task_status, 'WAITING_HUMAN_REVIEW', JSON.stringify(result.error));
    assert.equal(result.development.self_tests.length, 2);
    assert.equal(result.development.final_executions.length, normalOnly ? 1 : 2);
    assert.equal(result.candidates[0].trial_runs[0].complete_pass, true);
    if (!normalOnly) assert.equal(result.candidates[0].trial_runs[1].specified_defect_detected, true);
    else { assert.equal(result.environment_ref.validation_mode, 'normal-only'); assert.equal(result.candidates[0].trial_runs[0].specified_defect_detected, false); assert.equal(result.candidates[0].approval_status, 'NOT_APPROVED'); }
    await page.reload(); await page.getByTestId('development-status').filter({ hasText: '待核对' }).waitFor();
    assert.equal(await page.getByTestId('development-counts').isVisible(),false); await page.getByText('技术详情：开发过程、资源与覆盖核查',{exact:true}).click(); assert.equal(await page.getByTestId('development-counts').isVisible(),true);
    await assert.rejects(manager.submitDevelopment({ logical_id: 'engineering-recovery' }), /ALREADY_CLAIMED/);
    const lifecycle = result.files.find(file => file.kind === 'lifecycle_log');
    assert.equal(lifecycle.sha256, digest(await fs.readFile(path.join(store.taskDirectory(taskId), lifecycle.relative_path))));
    assert.equal(result.human_review_status, 'WAITING_REVIEW');
  } finally { await browser?.close(); await manager.settle(); await close(server); await close(pageServer); await fs.rm(root, { recursive: true, force: true }); }
});

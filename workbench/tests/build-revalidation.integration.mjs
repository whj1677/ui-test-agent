import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import {
  BuildTaskStore,
  M2C_REVALIDATION_AUTHORIZATION_ID,
  M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
} from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';
import { waitForAuthorizedTask, waitForTerminal } from './support/revalidation-driver.mjs';

const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const authorizationId = process.env.M2C_BUILD_AUTHORIZATION_ID;
const paths = createPaths({ localRoot });
const evidenceRoot = path.join(localRoot, 'evidence', 'm2c-wait-fix-validation');
const screenshot = path.join(evidenceRoot, 'm2c-wait-fix-validation-web.png');
const summaryFile = path.join(evidenceRoot, 'm2c-wait-fix-validation-summary.json');
await fs.mkdir(evidenceRoot, { recursive: true });

if (authorizationId !== M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID) throw new Error('M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_REQUIRED');

async function assertLockedRuntime() {
  const required = ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DSH_PROBE_BROWSER_EXECUTABLE'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`M2C_MODEL_CONFIGURATION_REQUIRED:${missing.join(',')}`);
  await fs.access(process.env.DSH_PROBE_BROWSER_EXECUTABLE);
  const expected = new Map([
    ['@deepseek-ai/dsh', '0.1.6-alpha.2'],
    ['@deepseek-ai/dsh-browser-use', '0.1.6-alpha.2'],
    ['@deepseek-ai/dsh-experimental-browser-use-playwright-mcp', '0.1.6-alpha.2'],
  ]);
  for (const [name, version] of expected) {
    const packageFile = path.join(paths.repoRoot, 'harness-probe', 'node_modules', ...name.split('/'), 'package.json');
    const installed = JSON.parse(await fs.readFile(packageFile, 'utf8'));
    assert.equal(installed.version, version, `${name} version changed`);
  }
  const probe = path.join(paths.buildTasksRoot, `.revalidation-write-${process.pid}.tmp`);
  await fs.mkdir(paths.buildTasksRoot, { recursive: true });
  await fs.writeFile(probe, 'write-check', { flag: 'wx' });
  await fs.rm(probe);
}

async function makeRuntime() {
  const store = new WorkbenchStore(paths.dataRoot); await store.init();
  const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId }); await buildStore.init();
  await buildStore.recoverInterrupted();
  const manager = { active: null };
  const buildManager = new BuildTaskManager({
    store: buildStore, paths, browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
    authorizationId, otherActive: () => Boolean(manager.active),
  });
  const server = createWorkbenchServer({ store, manager, buildStore, buildManager });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { store, buildStore, buildManager, server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function closeRuntime(runtime) {
  if (runtime.buildManager.active) await runtime.buildManager.stop(runtime.buildManager.active.taskId).catch(() => {});
  await Promise.race([runtime.buildManager.settle(), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  await new Promise((resolve) => runtime.server.close(resolve));
}

await assertLockedRuntime();
let runtime = await makeRuntime();
let browser;
let page;
let task;
let executionError = null;
const startedAt = new Date().toISOString();
try {
  const oldBudget = await runtime.buildStore.getBudget();
  const authorization = await runtime.buildStore.getRevalidationAuthorization();
  const interruptedTask = await runtime.buildStore.getTask('build-20260921030548-a1bf1358');
  const cancelledTask = await runtime.buildStore.getTask('build-20260921041411-12b52a7b');
  const historicalStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_REVALIDATION_AUTHORIZATION_ID });
  const previousAuthorization = await historicalStore.getRevalidationAuthorization();
  assert.equal(oldBudget.used_starts, 1);
  assert.equal(interruptedTask.task_status, 'INTERRUPTED');
  assert.equal(interruptedTask.error.code, 'SERVICE_RESTARTED');
  assert.equal(cancelledTask.task_status, 'CANCELLED');
  assert.equal(previousAuthorization.used_starts, 1);
  assert.equal(authorization.authorization_id, authorizationId);
  assert.equal(authorization.used_starts, 0);
  assert.equal(runtime.buildManager.active, null);

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'zh-CN' });
  await page.goto(runtime.baseUrl);
  const health = await fetch(`${runtime.baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ready');
  assert.equal(health.active_build_task_id, null);
  assert.equal(health.build_authorization.used_starts, 0);

  const existing = (await runtime.buildStore.listTasks()).filter((item) => item.authorization?.authorization_id === authorizationId);
  assert.equal(existing.length, 0, 'the one-off revalidation already has a task; refusing a replacement start');
  await page.waitForFunction(() => !document.querySelector('[data-testid="build-submit"]').disabled);
  await page.getByTestId('build-submit').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]').disabled);
  await page.getByTestId('build-start').click();
  task = await waitForAuthorizedTask(runtime.buildStore, authorizationId);
  await waitForTerminal(page, task.task_id);
  task = await runtime.buildStore.getTask(task.task_id);
  await page.getByTestId('build-history').locator(`button[data-task-id="${task.task_id}"]`).click();
  await page.screenshot({ path: screenshot, fullPage: true });
} catch (error) {
  executionError = { code: error?.code || error?.message?.split(':')[0] || 'REVALIDATION_DRIVER_ERROR' };
  task = (await runtime.buildStore.listTasks()).find((item) => item.authorization?.authorization_id === authorizationId) || null;
} finally {
  await browser?.close();
  await closeRuntime(runtime);
}

if (!task) throw new Error(executionError?.code || 'M2C_REVALIDATION_TASK_NOT_CREATED');

runtime = await makeRuntime();
browser = await chromium.launch({ headless: true });
page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'zh-CN' });
try {
  await page.goto(runtime.baseUrl);
  await page.getByTestId('build-history').locator(`button[data-task-id="${task.task_id}"]`).waitFor();
  await page.getByTestId('build-history').locator(`button[data-task-id="${task.task_id}"]`).click();
  try { await fs.access(screenshot); } catch { await page.screenshot({ path: screenshot, fullPage: true }); }
  task = await runtime.buildStore.getTask(task.task_id);
  assert.equal((await runtime.buildStore.getBudget()).used_starts, 1, 'historical M2-C budget changed');
  assert.equal((await runtime.buildStore.getRevalidationAuthorization()).used_starts, 1);
  assert.equal(task.attempts.length, 1);
  assert.equal(task.attempts[0].kind, 'initial');
  assert.equal(task.attempts[0].authorization_status, 'CONSUMED_ON_PROCESS_SPAWN');
  assert.equal(task.revision_allowed, false);
} finally {
  await browser.close();
  await closeRuntime(runtime);
}

const candidate = task.candidates.at(-1) || null;
const authorization = await runtime.buildStore.getRevalidationAuthorization();
const lifecycle = await runtime.buildStore.lifecycleSummary(task.task_id, 'attempt-01-initial');
const summary = {
  schema: 'workbench/m2c-wait-fix-validation-summary-v1',
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  authorization: {
    authorization_id: authorization.authorization_id,
    used_starts: authorization.used_starts,
    max_starts: authorization.max_starts,
    claim: authorization.claims[0] || null,
  },
  historical_budget_unchanged: { used_starts: 1, max_starts: 2 },
  task_id: task.task_id,
  task_status: task.task_status,
  generation_status: task.generation_status,
  verification_status: task.verification_status,
  human_review_status: task.human_review_status,
  attempt: task.attempts[0],
  candidate: candidate ? {
    version: candidate.version, sha256: candidate.sha256, bytes: candidate.bytes,
    same_candidate_hash: candidate.same_candidate_hash,
    counterexample_detected: candidate.counterexample_detected,
    normal: candidate.normal, negative: candidate.negative,
  } : null,
  lifecycle,
  registered_files: task.files.map((item) => ({
    file_id: item.file_id, attempt_id: item.attempt_id, kind: item.kind,
    file_name: item.file_name, bytes: item.bytes, sha256: item.sha256, web_visible: item.web_visible,
  })),
  web: { submitted: true, started: true, terminal_display_checked: !executionError, restart_readback_checked: true, screenshot },
  driver_error: executionError,
};
await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  task_id: task.task_id, task_status: task.task_status,
  candidate_sha256: candidate?.sha256 || null,
  authorization: `${authorization.used_starts}/${authorization.max_starts}`,
  summary: summaryFile, screenshot,
}));

if (!['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(task.task_status)) process.exitCode = 2;

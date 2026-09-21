import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const screenshot = path.join(localRoot, 'evidence', 'm2c-build-web.png');
const summaryFile = path.join(localRoot, 'evidence', 'm2c-build-summary.json');
await fs.mkdir(path.dirname(screenshot), { recursive: true });

async function makeRuntime() {
  const store = new WorkbenchStore(paths.dataRoot);
  await store.init();
  const buildStore = new BuildTaskStore(paths.buildTasksRoot);
  await buildStore.init();
  await buildStore.recoverInterrupted();
  const manager = { active: null };
  const buildManager = new BuildTaskManager({
    store: buildStore, paths, browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
    otherActive: () => Boolean(manager.active),
  });
  const server = createWorkbenchServer({ store, manager, buildStore, buildManager });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { store, buildStore, buildManager, server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function waitForTerminal(page, timeout = 660_000) {
  const terminals = ['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED'];
  await page.waitForFunction((states) => {
    const cards = [...document.querySelectorAll('#build-history button strong')].map((node) => node.textContent || '');
    return cards.some((value) => states.some((state) => value.includes(state)));
  }, terminals, { timeout });
}

const startedAt = new Date().toISOString();
let runtime = await makeRuntime();
let browser = await chromium.launch({ headless: true });
let page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, locale: 'zh-CN' });
let task;
let revisionTriggered = false;

try {
  await page.goto(runtime.baseUrl);
  const existing = await runtime.buildStore.listTasks();
  const budgetBefore = await runtime.buildStore.getBudget();
  if (!existing.length) {
    const required = ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DSH_PROBE_BROWSER_EXECUTABLE'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`M2C_MODEL_CONFIGURATION_REQUIRED:${missing.join(',')}`);
    await fs.access(process.env.DSH_PROBE_BROWSER_EXECUTABLE);
    assert.equal(budgetBefore.used_starts, 0, 'budget claims exist without a task; refusing to reset or rerun');
    await page.waitForFunction(() => !document.querySelector('[data-testid="build-submit"]').disabled);
    await page.getByTestId('build-submit').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]').disabled);
    await page.getByTestId('build-start').click();
    await waitForTerminal(page);
  }

  task = (await runtime.buildStore.listTasks())[0];
  if (task.task_status === 'CANDIDATE_VALIDATION_FAILED' && task.revision_allowed) {
    await page.waitForFunction(() => !document.querySelector('[data-testid="build-revise"]').disabled);
    await page.getByTestId('build-revise').click();
    revisionTriggered = true;
    await waitForTerminal(page);
    task = await runtime.buildStore.getTask(task.task_id);
  }

  await page.screenshot({ path: screenshot, fullPage: true });
} finally {
  await browser.close();
  await closeServer(runtime.server);
}

runtime = await makeRuntime();
browser = await chromium.launch({ headless: true });
page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, locale: 'zh-CN' });
try {
  await page.goto(runtime.baseUrl);
  await page.getByTestId('build-history').locator(`button[data-task-id="${task.task_id}"]`).waitFor();
  assert.equal((await fetch(`${runtime.baseUrl}/api/health`).then((response) => response.json())).active_build_task_id, null);
  const persisted = await runtime.buildStore.getTask(task.task_id);
  assert.equal(persisted.task_status, task.task_status);
  assert.equal(persisted.candidates.length, task.candidates.length);
  task = persisted;
} finally {
  await browser.close();
  await closeServer(runtime.server);
}

const budget = await runtime.buildStore.getBudget();
const latest = task.candidates.at(-1) || null;
const summary = {
  schema: 'workbench/m2c-real-integration-summary-v1',
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  task_id: task.task_id,
  task_status: task.task_status,
  generation_status: task.generation_status,
  verification_status: task.verification_status,
  human_review_status: task.human_review_status,
  revision_triggered: revisionTriggered,
  stage_budget: { used_starts: budget.used_starts, max_starts: budget.max_starts },
  attempts: task.attempts.map((attempt) => ({
    attempt_id: attempt.attempt_id, kind: attempt.kind, status: attempt.status,
    max_tool_calls: attempt.max_tool_calls, timeout_ms: attempt.timeout_ms,
    harness: attempt.harness ? {
      assessment: attempt.harness.assessment,
      wall_ms: attempt.harness.wall_ms,
      observable_agent_steps: attempt.harness.observable_agent_steps,
      total_tool_calls: attempt.harness.total_tool_calls,
      browser_tool_calls: attempt.harness.browser_tool_calls,
      provider_request_count: attempt.harness.provider_request_count,
      provider_usage: attempt.harness.provider_usage,
      tool_names: attempt.harness.tool_names,
    } : null,
    error: attempt.error,
  })),
  latest_candidate: latest ? {
    version: latest.version, sha256: latest.sha256, bytes: latest.bytes,
    same_candidate_hash: latest.same_candidate_hash,
    counterexample_detected: latest.counterexample_detected,
    normal: latest.normal,
    negative: latest.negative,
  } : null,
  registered_files: task.files.map((item) => ({
    file_id: item.file_id, kind: item.kind, file_name: item.file_name,
    bytes: item.bytes, sha256: item.sha256, web_visible: item.web_visible,
  })),
  restart_readback: true,
  screenshot,
};
await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  task_id: task.task_id, task_status: task.task_status, candidates: task.candidates.length,
  attempts: task.attempts.length, budget: `${budget.used_starts}/${budget.max_starts}`,
  summary: summaryFile, screenshot,
}));
if (task.task_status !== 'WAITING_HUMAN_REVIEW') process.exitCode = 1;

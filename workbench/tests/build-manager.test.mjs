import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';

function playwrightReport(status, error = null) {
  return { stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status, error }] }] }] }] };
}

function fakeAdapter({ cancellation = false } = {}) {
  let harnessStarts = 0;
  return {
    get harnessStarts() { return harnessStarts; },
    async ensureHarnessRuntime() { return { ready: true }; },
    async startFixtureServer(file) { return { url: file.endsWith('wrong-output.html') ? 'http://127.0.0.1/negative' : 'http://127.0.0.1/normal', async close() {} }; },
    async runHarnessTask({ candidatePath, workspace, signal }) {
      harnessStarts += 1;
      if (cancellation) {
        if (!signal.aborted) await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        return { assessment: { success: false, termination: 'cancelled' }, candidate: null, events: [] };
      }
      await fs.mkdir(path.dirname(candidatePath), { recursive: true });
      await fs.mkdir(path.join(workspace, '.playwright-mcp'), { recursive: true });
      await fs.writeFile(path.join(workspace, '.playwright-mcp', 'page.yml'), 'synthetic');
      const locator = harnessStarts === 1 ? "locator('status')" : "locator('#probe-result')";
      const code = `import { test, expect } from '@playwright/test';\ntest('probe', async ({ page }) => { await page.goto(process.env.PROBE_URL); await page.getByRole('button', { name: '执行探针交互' }).click(); await expect(page.${locator}).toHaveText('PROBE-42'); });\n`;
      await fs.writeFile(candidatePath, code);
      return {
        assessment: { success: true, completed: true, candidateExists: true, exitCode: 0, termination: null, finalPresent: true, turnEndReason: 'completed', toolCalls: 2, maxToolCalls: 30, toolLimitReached: false },
        candidate: { sha256: 'generated' },
        events: [{ type: 'status', phase: 'step_end' }, { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' }, { type: 'tool_call', tool: 'write_file' }],
      };
    },
    async verifyCandidate({ fixtureUrl, runDirectory }) {
      await fs.mkdir(runDirectory, { recursive: true });
      let report;
      if (harnessStarts === 1) report = playwrightReport('failed', { message: "expect(locator('status')).toHaveText('PROBE-42') timed out; locator resolved to 0 elements" });
      else if (fixtureUrl.endsWith('/normal')) report = playwrightReport('passed');
      else report = playwrightReport('failed', { message: 'Expected string: "PROBE-42"\nReceived string: "PROBE-41"' });
      const reportPath = path.join(runDirectory, 'playwright-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report));
      const passed = harnessStarts > 1 && fixtureUrl.endsWith('/normal');
      return { reportPath, process: { exitCode: passed ? 0 : 1, termination: null, error: null } };
    },
  };
}

async function setup(adapter) {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'build-manager-'));
  const paths = createPaths({ localRoot });
  const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
  const manager = new BuildTaskManager({ store, paths, adapter, browserExecutable: 'fake-browser', credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }), idFactory: () => 'build-manager-12345678' });
  return { localRoot, store, manager };
}

test('failed candidate enables exactly one explicit revision and preserves both versions', async () => {
  const adapter = fakeAdapter();
  const { localRoot, store, manager } = await setup(adapter);
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    let result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(result.revision_allowed, true);
    assert.equal(result.candidates.length, 1);
    await manager.revise(task.task_id);
    result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'WAITING_HUMAN_REVIEW');
    assert.equal(result.verification_status, 'PASSED');
    assert.equal(result.human_review_status, 'WAITING_REVIEW');
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[1].counterexample_detected, true);
    assert.equal(result.candidates[1].same_candidate_hash, true);
    assert.equal(adapter.harnessStarts, 2);
    await assert.rejects(() => manager.revise(task.task_id), /BUILD_REVISION_NOT_ALLOWED/);
    assert.equal((await store.getBudget()).used_starts, 2);
  } finally { await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('duplicate start is rejected and cancel closes the owned attempt without restart', async () => {
  const adapter = fakeAdapter({ cancellation: true });
  const { localRoot, manager } = await setup(adapter);
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    await assert.rejects(() => manager.start(task.task_id), /BUILD_TASK_ALREADY_ACTIVE/);
    await manager.stop(task.task_id);
    const result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'CANCELLED');
    assert.equal(result.verification_status, 'NOT_RUN');
    assert.equal(adapter.harnessStarts, 1);
  } finally { await fs.rm(localRoot, { recursive: true, force: true }); }
});

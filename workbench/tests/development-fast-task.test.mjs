import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '../../harness-probe/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { createPaths } from '../server/paths.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { registerDevelopmentAuthorization } from '../server/build/development-authorization.mjs';
import { digest } from '../server/build/development-session.mjs';
import { candidateReadiness } from '../web-v2/workflow.js';
import { developmentRecords } from '../server/build/candidate-trials.mjs';

// Direct manager + real MCP transport, synthetic executor/model. No workbench
// server, browser, credentials or paid model request is started by these tests.
for (const scenario of ['ready', 'missing-data', 'changed-after-submit']) test(`self-test workflow manager/MCP integration: ${scenario}`, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fast-generation-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => String(url) === 'http://127.0.0.1:1/mock-page' ? Promise.resolve(new Response('synthetic test target')) : originalFetch(url, options);
  let manager;
  t.after(async () => { globalThis.fetch = originalFetch; await manager?.settle(); assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('fast-generation-')); await fs.rm(root, { recursive: true, force: true }); });
  const paths = createPaths({ localRoot: root });
  const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const project = await caseStore.createProject({ name: 'Synthetic fast workflow' }), caseId = `case-${randomUUID()}`;
  const content = { external_id: 'FAST-1', title: 'Synthetic status assertion', status: 'CONFIRMED', module: 'status', preconditions: 'Dedicated test data is available.', test_data: '', steps: [{ order: 1, action: 'Read status', expected: 'Status says good' }] };
  await caseStore.updateProject(project.project_id, 1, value => ({ ...value, cases: [{ case_id: caseId, external_id: content.external_id, title: content.title, current_version: 1, versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }));
  await registerDevelopmentAuthorization(store, { logical_id: 'fast-engineering', project_id: project.project_id, case_id: caseId, case_version: 1, content_sha256: contentHash(content), mode: 'new', environment_id: 'fixture', quality_review_mode: 'self-test-v1' });
  const code = "import {test,expect} from '@playwright/test';\ntest('engineering',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('good');});});\n";
  let executions = 0, harnessStarts = 0;
  manager = new BuildTaskManager({ store, caseStore, paths, harnessDshHome: path.join(root, 'no-secrets'),
    harnessPatchPath: path.join(paths.repoRoot, 'harness-probe/config/browser-flash.cordis.yml'),
    developmentEnvironments: [{ id: 'fixture', normal_url: 'http://127.0.0.1:1/mock-page', validation_mode: 'normal-only' }],
    adapter: { ensureHarnessRuntime: async () => {},
      verifyCandidate: async ({ runDirectory }) => {
        executions++; await fs.mkdir(runDirectory, { recursive: true });
        const reportPath = path.join(runDirectory, 'playwright-report.json');
        await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] }] }] }] }] }));
        return { reportPath, process: { exitCode: 0, termination: null } };
      },
      runHarnessTask: async ({ developmentEndpoint, onLifecycle, task: prompt, candidatePath }) => {
        harnessStarts++; assert.match(prompt, /SELF-TEST MODE/); assert.match(prompt, /report_blocker/); assert.doesNotMatch(prompt, /After self_test on the complete current package, call review_candidate/);
        const client = new Client({ name: 'synthetic-author', version: '1' }, { versionNegotiation: { mode: 'auto' } });
        await client.connect(new StreamableHTTPClientTransport(new URL(developmentEndpoint)));
        try {
          await onLifecycle({ type: 'process_spawn' });
          await onLifecycle({ event_type: 'tool_call', tool: 'mcp__playwright-mcp__browser_snapshot', call_id: 'observation' });
          await onLifecycle({ event_type: 'tool_result', call_id: 'observation', tool_status: 'completed' });
          const call = async (name, args = {}) => { const response = await client.callTool({ name, arguments: args }); assert.notEqual(response.isError, true, JSON.stringify(response)); return JSON.parse(response.content[0].text); };
          if (scenario === 'missing-data') {
            assert.equal((await call('report_blocker', { requirement: content.preconditions, observed: 'Required fixture record not located in the checked list.', reason: 'Required fixture record is unavailable.' })).status, 'ENVIRONMENT_BLOCKED');
          } else {
            await call('write_draft', { code, previous_sha256: null });
            assert.equal((await call('self_test')).result.complete_pass, true);
            const result = await call('submit_candidate', { sha256: digest(code), outcome: 'ready', coverage: [{ order: 1, requirement: content.steps[0].expected, check_lines: [2], execution: 1, uncovered: '' }] });
            assert.equal(result.frozen, true); assert.equal(result.approval, 'NOT_REQUIRED');
            if (scenario === 'changed-after-submit') await fs.appendFile(path.join(path.dirname(candidatePath), '../final/candidate.spec.mjs'), '\n// tampered');
          }
          return { events: [], assessment: { completed: true, browserToolCalls: 1 } };
        } finally { await client.close(); }
      },
    },
  });
  manager.modelCredentials = async () => ({});
  manager.qualityReviewer = async () => assert.fail('no review model in fast flow');
  const submitted = await manager.submitDevelopment({ logical_id: 'fast-engineering' });
  const task = await manager.wait(submitted.task_id);
  assert.equal(harnessStarts, 1); assert.equal(task.development.quality_reviews.length, 0);
  assert.equal(task.development.independent_validations.length, 0); assert.equal(task.development.final_executions, undefined);
  if (scenario === 'ready') {
    assert.equal(task.task_status, 'READY', JSON.stringify(task.error)); assert.equal(executions, 1);
    assert.equal(task.human_review_status, 'NOT_REQUIRED'); assert.equal(task.candidates[0].approval_status, 'NOT_REQUIRED');
    assert.equal(task.candidates[0].trial_runs[0].run_id, `${task.task_id}-dev-1`);
    const history = developmentRecords(task);
    assert.equal(history.length, 1, 'reused self-test is one execution, not an independent replay');
    assert.equal(history[0].run_id, `${task.task_id}-dev-1`);
    assert.equal(history[0].origin, 'DEVELOPMENT_SELF_TEST');
    assert.equal(history[0].candidate_version, 1);
    const readiness = candidateReadiness({ applies_to_selected_version: true, technical_status: task.verification_status, human_review_status: task.human_review_status, validation_source: task.candidates[0].validation_source });
    assert.deepEqual(readiness, { runnable: true, label: '自测通过，可运行', reason: '已通过当前脚本的完整自测' });
  } else if (scenario === 'missing-data') {
    assert.equal(task.task_status, 'ENVIRONMENT_BLOCKED', JSON.stringify(task.error)); assert.equal(executions, 0);
    assert.equal(task.candidates.length, 0); assert.equal(task.development.blocker.requirement, content.preconditions);
  } else {
    assert.equal(task.task_status, 'CANDIDATE_VALIDATION_FAILED'); assert.equal(task.verification_status, 'INCOMPLETE'); assert.equal(task.human_review_status, 'NOT_READY');
  }
});

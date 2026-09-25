// Real executor regression, no Harness/model, no workbench server or persisted
// product records. All runs are isolated engineering evidence under .local.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { DevelopmentSession, evidenceFiles } from '../server/build/development-session.mjs';
import { verifyDevelopmentRun } from '../server/build/development-evidence.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { developmentRecords } from '../server/build/candidate-trials.mjs';

const root = await fs.mkdtemp(path.resolve('workbench/.local/development-evidence-'));
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const html = path.join(root, 'target.html');
await fs.writeFile(html, '<!doctype html><meta charset="utf-8"><p>5</p><button>第二步</button>');
const frozenCase = { steps: [
  { order: 1, action: '检查数量', expected: '数量应为 8' },
  { order: 2, action: '检查按钮', expected: '显示第二步按钮' },
] };
const identity = { task_id: 'engineering-captions', executed_case_id: 'case-engineering', executed_external_id: 'ENGINEERING', executed_case_version: 2, executed_content_sha256: 'C'.repeat(64) };
const directory = path.join(root, 'development');
const session = new DevelopmentSession({ directory, frozenCase, normalUrl: pathToFileURL(html).href,
  evidenceIdentity: identity, browserExecutable: executable, signal: new AbortController().signal,
  verify: options => verifyWorkbenchCandidate({ ...options, browserExecutable: executable }), persist: async state => fs.writeFile(path.join(root, 'state.json'), JSON.stringify(state, null, 2)) });
await session.init();
const source = soft => `import {test,expect} from '@playwright/test';
test('real capture engineering',async({page})=>{
 await page.goto(process.env.PROBE_URL);
 await test.step('CASE_STEP_1',async()=>{await expect${soft ? '.soft' : ''}(page.locator('p')).toHaveText('8',{timeout:100});});
 await test.step('CASE_STEP_2',async()=>{await expect(page.getByRole('button')).toHaveText('第二步');});
});`;
await fs.writeFile(session.draftPath, source(true));
const soft = await session.invoke('self_test');
assert.equal(soft.result.test_status, 'FAILED');
assert.deepEqual(soft.coverage.items.map(s => s.execution_status), ['FAILED', 'PASSED']);
assert.equal(soft.step_replay.status, 'READY');
assert.equal(soft.step_replay.evidence_complete, true);
assert.equal(soft.step_replay.steps[0].actual, '5');
assert.equal(soft.step_replay.chapters.length, 2);
assert.equal(soft.changed_after_execution, false);
await fs.writeFile(session.draftPath, source(false));
const hard = await session.invoke('self_test');
assert.deepEqual(hard.coverage.items.map(s => s.execution_status), ['FAILED', 'NOT_EXECUTED']);
assert.equal(hard.step_replay.chapters.length, 1);
assert.equal(hard.step_replay.steps[1].screenshot_file_name, null);
await fs.writeFile(session.draftPath, source(false).replace("toHaveText('8'", "toHaveText('5'"));
const passed = await session.invoke('self_test');
assert.equal(passed.result.test_status, 'PASSED');
assert.equal(passed.step_replay.evidence_complete, true);
assert.equal(passed.step_replay.chapters.length, 2);
await fs.writeFile(session.draftPath, source(false));

// The independent-verification call uses the production helper with its own
// run identity. It must neither reuse the self-test recording nor alter bytes.
const independent = await verifyDevelopmentRun({ verify: verifyWorkbenchCandidate,
  options: { candidatePath: session.draftPath, fixtureUrl: pathToFileURL(html).href, runDirectory: path.join(directory, 'final/normal'), browserExecutable: executable },
  identity: { ...identity, run_id: identity.task_id + '-normal', candidate_sha256: hard.sha256 },
  caseContent: frozenCase, contract: session.contract, browserExecutable: executable });
assert.equal(independent.result.test_status, 'FAILED');
assert.equal(independent.evidence.step_replay.run_id, identity.task_id + '-normal');
assert.equal(independent.evidence.step_replay.status, 'READY');
const files = (await evidenceFiles(directory, root)).map((f,i) => ({ ...f, file_id: 'file-' + i, file_name: path.basename(f.relative_path) }));
const task = { task_id: identity.task_id, source: { project_id: 'engineering', case_id: identity.executed_case_id, external_id: identity.executed_external_id, case_version: 2 }, input_bundle: { snapshot: { content: frozenCase } },
  development: session.state, files, candidates: [{ version: 2, bundle: { sha256: hard.bundle_sha256 }, trial_runs: [{ run_id: identity.task_id + '-normal', run_type: 'normal', status: independent.result.test_status, result: independent.result, step_coverage: independent.coverage, ...independent.evidence }] }] };
const records = developmentRecords(task);
assert.equal(records.length, 4);
for (const r of records) {
  assert.equal(r.evidence_status, 'COMPLETE');
  assert.equal(r.files.filter(f => f.kind === 'development_step_replay_video').length, 1);
  assert.ok(r.files.every(f => f.run_id === r.run_id && f.relative_path.startsWith(r.prefix)));
}
const withoutOriginal = structuredClone(task);
withoutOriginal.files = files.filter(f => !f.relative_path.endsWith('.webm') || f.file_name === 'step-replay-v1.webm');
assert.ok(developmentRecords(withoutOriginal).every(r => r.evidence_status === 'INCOMPLETE'));
const historical = structuredClone(task);
historical.development.self_tests.forEach(r => { delete r.step_replay; delete r.recording; });
assert.equal(developmentRecords(historical)[0].evidence_status, 'LEGACY_STEP_CAPTURES_UNAVAILABLE');

// A renderer failure preserves the true business verdict.
const missingRenderer = await verifyDevelopmentRun({ verify: verifyWorkbenchCandidate,
  options: { candidatePath: session.draftPath, fixtureUrl: pathToFileURL(html).href, runDirectory: path.join(root, 'renderer-failure'), browserExecutable: executable },
  identity: { ...identity, run_id: 'renderer-failure', candidate_sha256: hard.sha256 },
  caseContent: frozenCase, contract: session.contract, browserExecutable: path.join(root, 'missing-browser.exe') });
assert.equal(missingRenderer.result.test_status, 'FAILED');
assert.equal(missingRenderer.evidence.evidence_status, 'INCOMPLETE');
assert.equal(missingRenderer.evidence.step_replay.status, 'UNAVAILABLE');
console.log(JSON.stringify({ status: 'ENGINEERING_REGRESSION_PASSED', checks: ['soft-failure', 'hard-stop', 'passed-execution', 'independent-run', 'media-ownership', 'missing-media', 'historical-fallback', 'renderer-failure-isolation'], model_calls: 0, root }, null, 2));

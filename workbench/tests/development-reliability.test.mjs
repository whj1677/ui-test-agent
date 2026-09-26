import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { safeFeedback } from '../server/build/development-feedback.mjs';
import { checkDomRead } from '../server/build/development-dom-read.mjs';
import { inspectPreStepStateChanges } from '../server/build/development-fidelity.mjs';
import { eventMetadata } from '../../harness-probe/src/harness-runner.mjs';

const code = value => `import { test, expect } from '@playwright/test';\ntest('case',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('${value}');});});\n`;
const frozenCase = { steps: [{ order: 1, action: 'Read status', expected: 'Status is original' }] };
async function fixture(seed, verify, caseContent = frozenCase) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'development-reliability-'));
  const session = new DevelopmentSession({ directory, frozenCase: caseContent, normalUrl: 'http://127.0.0.1:4322/not-visited', signal: new AbortController().signal, persist: async () => {}, verify });
  await session.init(seed);
  return { session, close: () => fs.rm(directory, { recursive: true, force: true }) };
}

test('first recovery execution snapshots authorized complete package despite native file edits', async () => {
  const seed = { entries: [
    { path: 'candidate.spec.mjs', content: Buffer.from(code('original')) },
    { path: 'helper.mjs', content: Buffer.from('export const source = "original";') },
  ] };
  const observed = [];
  const f = await fixture(seed, async ({ candidatePath }) => {
    observed.push({ entry: await fs.readFile(candidatePath, 'utf8'), helper: await fs.readFile(path.join(path.dirname(candidatePath), 'helper.mjs'), 'utf8') });
    throw new Error('STUB_EXECUTOR');
  });
  try {
    await fs.writeFile(f.session.draftPath, code('modified'));
    await fs.writeFile(path.join(path.dirname(f.session.draftPath), 'helper.mjs'), 'export const source = "modified";');
    const first = await f.session.invoke('self_test');
    assert.equal(first.recovery_original, true);
    assert.equal(first.sha256, digest(code('original')));
    assert.match(observed[0].entry, /original/);
    assert.match(observed[0].helper, /original/);
    assert.equal((await fs.readFile(f.session.draftPath, 'utf8')), code('modified'));
  } finally { await f.close(); }
});

test('same failed bundle needs a new observation or revision before another execution', async () => {
  let executions = 0;
  const f = await fixture(code('bad'), async () => { executions++; throw new Error('STUB_EXECUTOR'); });
  try {
    await f.session.invoke('self_test');
    await assert.rejects(f.session.invoke('self_test'), /UNCHANGED_FAILURE_REQUIRES_NEW_EVIDENCE/);
    assert.equal(executions, 1);
    f.session.state.observation_epoch = 1;
    await f.session.invoke('self_test');
    assert.equal(executions, 2);
  } finally { await f.close(); }
});

test('ready submission rejects a finite known obligation gap while review stays unapproved', async () => {
  const caseContent = { steps: [{ order: 1, action: 'Inspect', expected: '重新执行按钮禁用' }] };
  const f = await fixture(code('good'), async ({ runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const reportPath = path.join(runDirectory, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] }] }] }] }] }));
    return { reportPath, process: { exitCode: 0, termination: null } };
  }, caseContent);
  try {
    await f.session.invoke('self_test');
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: [{ order: 1, requirement: caseContent.steps[0].expected, check_lines: [2], execution: 1, uncovered: '' }] }), /READY_WITH_FINITE_FIDELITY_GAP/);
    assert.equal(f.session.state.submission, null);
  } finally { await f.close(); }
});

test('submission persists hash-bound frozen-action review with observed execution', async () => {
  const caseContent = { preconditions: 'Reset fixture', steps: [{ order: 1, action: 'Read status', expected: 'Status is good' }] };
  const f = await fixture(code('good'), async ({ runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const reportPath = path.join(runDirectory, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] }] }] }] }] }));
    return { reportPath, process: { exitCode: 0, termination: null } };
  }, caseContent);
  try {
    await f.session.invoke('self_test');
    await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: [{ order: 1, requirement: caseContent.steps[0].expected, check_lines: [2], execution: 1, uncovered: '' }] });
    const review = JSON.parse(await fs.readFile(path.join(f.session.directory, 'fidelity-review.json'), 'utf8'));
    assert.equal(review.bundle_sha256, f.session.state.submission.bundle.sha256);
    assert.equal(f.session.state.fidelity_review.bundle_sha256, f.session.state.submission.bundle.sha256);
    assert.equal(review.case_preconditions, 'Reset fixture');
    assert.equal(review.steps[0].action, 'Read status');
    assert.equal(f.session.state.fidelity_review.steps[0].action, 'Read status');
    assert.equal(f.session.state.fidelity_review.steps[0].expected, 'Status is good');
    assert.equal(review.steps[0].self_test.execution, 1);
    assert.equal(review.steps[0].action_precondition_review, 'PENDING_INDEPENDENT_REVIEW');
    assert.equal(review.semantic_approval, false);
  } finally { await f.close(); }
});

test('budget feedback and narrow DOM read capability remain bounded', () => {
  const feedback = safeFeedback(new Error('SELF_TEST_BUDGET_EXHAUSTED'), { limits: { self_tests: 3 }, self_tests: [{}, {}, {}], draft_sha256: 'A' });
  assert.equal(feedback.allowed_next_steps.includes('self_test'), false);
  assert.equal(feedback.allowed_next_steps.includes('write_draft'), false);
  assert.doesNotThrow(() => checkDomRead("() => [...document.querySelectorAll('input[type=checkbox]')].map(c => c.value + '=' + c.checked).join(',')"));
  assert.throws(() => checkDomRead("() => { document.querySelector('input').value = 'new'; }"));
});

test('DSH tool call/result projection keeps only correlation and success metadata', () => {
  const call = eventMetadata({ type: 'tool_call', callId: 'call_1', tool: 'mcp__playwright-mcp__browser_snapshot', input: { secret: 'do-not-project' } });
  const success = eventMetadata({ type: 'tool_result', callId: 'call_1', status: 'completed', result: 'page body must stay out' });
  const failure = eventMetadata({ type: 'tool_result', callId: 'call_2', status: 'error', result: 'failure body must stay out' });
  assert.deepEqual({ type: call.event_type, id: call.call_id, tool: call.tool }, { type: 'tool_call', id: 'call_1', tool: 'mcp__playwright-mcp__browser_snapshot' });
  assert.deepEqual({ type: success.event_type, id: success.call_id, status: success.tool_status }, { type: 'tool_result', id: 'call_1', status: 'completed' });
  assert.equal(failure.tool_status, 'error');
  assert.doesNotMatch(JSON.stringify([call, success, failure]), /do-not-project|page body|failure body/);
});

test('finite pre-step review catches historical changed-list examples without case-ID rules', async () => {
  const packageData = JSON.parse(await fs.readFile(new URL('../qa/20260925-kimi-workbench/cases.workbench.json', import.meta.url), 'utf8'));
  const content = id => packageData.cases.find(item => item.package_case_id === id).content;
  for (const id of ['KC-01', 'KC-07', 'KC-10']) {
    const source = await fs.readFile(new URL(`../qa/20260925-kimi-workbench/evidence/${id}/final/candidate.spec.mjs`, import.meta.url), 'utf8');
    assert.equal(inspectPreStepStateChanges(source, content(id)).some(item => item.status === 'BLOCKING_UNREQUESTED_PRE_STEP_STATE_CHANGE'), true, id);
  }
  const source = await fs.readFile(new URL('../qa/20260925-kimi-workbench/evidence/KC-12/final/candidate.spec.mjs', import.meta.url), 'utf8');
  assert.equal(inspectPreStepStateChanges(source, content('KC-12')).some(item => item.status === 'NEEDS_INDEPENDENT_REVIEW'), true);
  const navigation = await fs.readFile(new URL('../qa/20260925-kimi-workbench/evidence/KC-11/final/candidate.spec.mjs', import.meta.url), 'utf8');
  assert.equal(inspectPreStepStateChanges(navigation, content('KC-11')).some(item => item.status === 'BLOCKING_UNREQUESTED_PRE_STEP_STATE_CHANGE'), false);
});

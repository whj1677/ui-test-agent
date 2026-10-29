import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentSession, digest, DEVELOPMENT_LIMITS } from '../server/build/development-session.mjs';
import { CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS } from '../server/quality-review.mjs';

const frozenCase = { steps: [{ order: 1, action: 'Open the page', expected: 'The label is good' }] };
const code = value => `import {test,expect} from '@playwright/test';\ntest('quality',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('${value}');});});\n`;
const coverage = execution => [{ order: 1, requirement: frozenCase.steps[0].expected, check_lines: [2], execution, uncovered: '' }];
function review(input, status = 'NO_FINDINGS', extra = {}) { return { schema: 'workbench/candidate-quality-review-v1', status, case_sha256: input.caseSha256, candidate_sha256: input.candidateSha256, input_sha256: 'a'.repeat(64), findings: status === 'REPAIR_REQUIRED' ? [{ kind: 'MISSING_ASSERTION', message: 'Missing frozen field check' }] : [], steps: [], model: 'fixture', usage: { total_tokens: 12 }, model_calls: 1, semantic_approval: false, ...extra }; }
async function fixture({ reviewer, statuses = [], mode = 'normal-only', reviewMode = 'static-v1', limits = DEVELOPMENT_LIMITS, now, reviewTimeout } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-quality-loop-'));
  const controller = new AbortController(); const saved = []; let executions = 0;
  const verify = async ({ candidatePath, runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const current = await fs.readFile(candidatePath, 'utf8');
    const status = statuses[executions++] || (current.includes("toHaveText('good')") ? 'passed' : 'failed');
    const error = status === 'passed' ? undefined : { message: status === 'timeout' ? 'Timed out' : 'Expected string: "good"\nReceived string: "bad"' };
    const report = { stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'passed' ? 0 : 1, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: status === 'timeout' ? 'timedOut' : status, error, steps: [{ title: 'CASE_STEP_1', category: 'test.step', error }] }] }] }] }] };
    const reportPath = path.join(runDirectory, 'report.json'); await fs.writeFile(reportPath, JSON.stringify(report));
    return { reportPath, process: { exitCode: status === 'passed' ? 0 : 1, termination: null } };
  };
  const session = new DevelopmentSession({ directory, frozenCase, normalUrl: 'http://127.0.0.1:4322/fixture', verify,
    persist: async state => saved.push(state), signal: controller.signal, qualityPolicy: { required: true, validation_mode: mode, quality_review_mode: reviewMode }, qualityReviewer: reviewer, limits, now, reviewTimeout });
  await session.init();
  await session.invoke('write_draft', { code: code('good'), previous_sha256: null });
  return { session, controller, saved, directory, close: () => fs.rm(directory, { recursive: true, force: true }), get executions() { return executions; } };
}

test('review is required, repair stays editable, changed bytes need new self-test and review, then normal validation freezes', async () => {
  let calls = 0;
  const f = await fixture({ reviewer: async input => review(input, ++calls === 1 ? 'REPAIR_REQUIRED' : 'NO_FINDINGS') });
  try {
    await f.session.invoke('self_test');
    const args = { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) };
    assert.equal((await f.session.invoke('submit_candidate', args)).status, 'QUALITY_REVIEW_REQUIRED');
    assert.equal((await f.session.invoke('review_candidate')).status, 'REPAIR_REQUIRED');
    assert.equal((await f.session.invoke('submit_candidate', args)).frozen, false);
    await f.session.invoke('write_draft', { code: code('good') + '\n// reviewed repair\n', previous_sha256: digest(code('good')) });
    await assert.rejects(f.session.invoke('submit_candidate', args), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
    await f.session.invoke('self_test');
    const second = { sha256: digest(code('good') + '\n// reviewed repair\n'), outcome: 'ready', coverage: coverage(2) };
    assert.equal((await f.session.invoke('submit_candidate', second)).status, 'QUALITY_REVIEW_REQUIRED');
    assert.equal((await f.session.invoke('review_candidate')).status, 'NO_FINDINGS');
    assert.equal((await f.session.invoke('submit_candidate', second)).frozen, true);
    assert.equal(f.executions, 3);
    assert.equal(f.session.state.independent_validations.length, 1);
    assert.equal(f.session.state.submission.semantic_approval, false);
  } finally { await f.close(); }
});

test('same reviewed self-test is cached; helper change invalidates review even if entry SHA stays fixed', async () => {
  let calls = 0; const f = await fixture({ reviewer: async input => { calls++; return review(input); } });
  try {
    await f.session.invoke('self_test');
    await f.session.invoke('review_candidate');
    assert.equal((await f.session.invoke('review_candidate')).cached, true);
    assert.equal(calls, 1);
    await fs.writeFile(path.join(f.directory, 'draft', 'helper.mjs'), 'export const value = 1;\n');
    await assert.rejects(f.session.invoke('review_candidate'), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
    const args = { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) };
    await assert.rejects(f.session.invoke('submit_candidate', args), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
  } finally { await f.close(); }
});

test('reviewer absence and wrong identity consume review budget but cannot submit ready', async () => {
  const f = await fixture();
  try {
    await f.session.invoke('self_test');
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'needs_analysis', coverage: coverage(1) })).status, 'QUALITY_REVIEW_REQUIRED');
    const response = await f.session.invoke('review_candidate');
    assert.equal(response.status, 'NEEDS_ANALYSIS');
    assert.equal(response.error_code, 'QUALITY_REVIEWER_UNAVAILABLE');
    assert.equal(f.saved.some(state => state.quality_reviews?.[0]?.status === 'REVIEWING'), true);
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) })).frozen, false);
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'needs_analysis', coverage: coverage(1) })).frozen, true);
    assert.equal(f.session.state.submission.quality_review.error_code, 'QUALITY_REVIEWER_UNAVAILABLE');
    assert.equal(f.session.state.submission.quality_review.status, 'NEEDS_ANALYSIS');
    assert.equal(f.session.state.submission.semantic_approval, false);
    assert.equal(f.session.state.independent_validations.length, 0);
  } finally { await f.close(); }
  const wrong = await fixture({ reviewer: async input => review(input, 'NO_FINDINGS', { candidate_sha256: '0'.repeat(64) }) });
  try { await wrong.session.invoke('self_test'); assert.equal((await wrong.session.invoke('review_candidate')).error_code, 'QUALITY_REVIEW_IDENTITY_INVALID'); }
  finally { await wrong.close(); }
});

test('independent normal failure returns editable evidence; changed bytes can repair and retry within same budgets', async () => {
  const f = await fixture({ reviewer: async input => review(input), statuses: ['passed', 'failed', 'passed', 'passed'] });
  try {
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const first = await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(first.status, 'INDEPENDENT_VALIDATION_FAILED'); assert.equal(first.frozen, false);
    assert.equal(first.evidence.result.error?.type, 'ASSERTION_MISMATCH');
    await f.session.invoke('write_draft', { code: code('good') + '\n// repair wait\n', previous_sha256: digest(code('good')) });
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(code('good') + '\n// repair wait\n'), outcome: 'ready', coverage: coverage(2) })).frozen, true);
    assert.equal(f.session.state.independent_validations.length, 2);
  } finally { await f.close(); }
});

test('timeout or unbound self-test failure cannot be called business difference', async () => {
  const f = await fixture({ reviewer: async input => review(input), statuses: ['timeout', 'failed'] });
  try {
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const answer = await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'business_difference', coverage: coverage(1) });
    assert.equal(answer.frozen, false); assert.equal(answer.status, 'BUSINESS_DIFFERENCE_NOT_REPRODUCED');
  } finally { await f.close(); }
});

test('a failed independent run on identical bundle remains binding after another green self-test', async () => {
  const f = await fixture({ reviewer: async input => review(input), statuses: ['passed', 'failed', 'passed'] });
  try {
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const first = await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(first.status, 'INDEPENDENT_VALIDATION_FAILED');
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const second = await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(2) });
    assert.equal(second.frozen, false); assert.equal(second.status, 'INDEPENDENT_VALIDATION_FAILED');
    assert.equal(f.session.state.independent_validations.length, 1);
    assert.equal(f.executions, 3);
  } finally { await f.close(); }
});

test('helper write during awaited review invalidates NO_FINDINGS while retaining paid usage', async () => {
  let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const f = await fixture({ reviewer: async input => { entered(); await new Promise(resolve => { release = resolve; }); return review(input); } });
  try {
    await f.session.invoke('self_test');
    const pending = f.session.invoke('review_candidate'); await started;
    await fs.writeFile(path.join(f.directory, 'draft', 'helper.mjs'), 'export const added = true;\n'); release();
    const response = await pending;
    assert.equal(response.status, 'NEEDS_ANALYSIS'); assert.equal(response.error_code, 'QUALITY_DRAFT_CHANGED_DURING_REVIEW');
    assert.equal(response.model_calls, 1); assert.equal(response.usage.total_tokens, 12);
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) }), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
  } finally { await f.close(); }
});

test('cancellation during awaited review records the charge and prevents submission', async () => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const timeout = new AbortController();
  const f = await fixture({ reviewTimeout: () => timeout.signal,
    reviewer: async (input) => { entered(); await new Promise(resolve => setTimeout(resolve, 10)); return review(input); } });
  try {
    await f.session.invoke('self_test');
    const pending = f.session.invoke('review_candidate'); await started; f.controller.abort('cancel'); timeout.abort();
    await assert.rejects(pending, /DEVELOPMENT_CANCELLED/);
    assert.equal(f.session.state.quality_reviews.length, 1);
    assert.equal(f.session.state.quality_reviews[0].review.status, 'NEEDS_ANALYSIS');
    assert.equal(f.session.state.quality_reviews[0].review.error_code, 'DEVELOPMENT_CANCELLED');
    assert.equal(f.session.state.quality_reviews[0].review.model_calls, 1);
    assert.equal(f.session.state.quality_reviews[0].review.usage.total_tokens, 12);
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) }), /DEVELOPMENT_CANCELLED/);
  } finally { await f.close(); }
});

for (const reviewMode of ['static-v1', 'dsh-tools-v1']) {
  test(`${reviewMode} uses the shared review limit and rejects a late NO_FINDINGS after local timeout`, async () => {
    const timeout = new AbortController(); const requested = [];
    const f = await fixture({ reviewMode, reviewTimeout: ms => { requested.push(ms); return timeout.signal; },
      reviewer: async input => { timeout.abort(); return review(input); } });
    try {
      await f.session.invoke('self_test');
      const result = await f.session.invoke('review_candidate');
      assert.deepEqual(requested, [CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS]);
      assert.equal(result.status, 'NEEDS_ANALYSIS');
      assert.equal(result.error_code, 'QUALITY_REVIEW_TIMEOUT');
      assert.equal(result.model_calls, 1);
      assert.equal(f.session.state.independent_validations.length, 0);
      assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) })).frozen, false);
    } finally { await f.close(); }
  });
}

test('UI review is capped by the remaining wall time and retains wall-budget error', async () => {
  let clock = 1_000; const requested = []; const timeout = new AbortController();
  const f = await fixture({ now: () => clock, reviewTimeout: ms => { requested.push(ms); return timeout.signal; },
    reviewer: async input => { clock = f.session.state.deadline_at; timeout.abort(); return review(input); } });
  try {
    await f.session.invoke('self_test');
    f.session.state.deadline_at = clock + 1_234;
    await assert.rejects(f.session.invoke('review_candidate'), /DEVELOPMENT_TIME_EXHAUSTED/);
    assert.deepEqual(requested, [1_234]);
    assert.equal(f.session.state.quality_reviews[0].review.error_code, 'DEVELOPMENT_TIME_EXHAUSTED');
  } finally { await f.close(); }
});

test('independent validation cap blocks another changed bundle execution', async () => {
  const f = await fixture({ reviewer: async input => review(input), statuses: ['passed', 'failed', 'passed'], limits: { ...DEVELOPMENT_LIMITS, independent_validations: 1 } });
  try {
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const first = await f.session.invoke('submit_candidate', { sha256: digest(code('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(first.status, 'INDEPENDENT_VALIDATION_FAILED');
    await f.session.invoke('write_draft', { code: code('good') + '\n// altered\n', previous_sha256: digest(code('good')) });
    await f.session.invoke('self_test'); await f.session.invoke('review_candidate');
    const second = await f.session.invoke('submit_candidate', { sha256: digest(code('good') + '\n// altered\n'), outcome: 'ready', coverage: coverage(2) });
    assert.equal(second.frozen, false); assert.equal(second.evidence.status, 'INDEPENDENT_VALIDATION_BUDGET_EXHAUSTED');
    assert.equal(f.executions, 3);
  } finally { await f.close(); }
});

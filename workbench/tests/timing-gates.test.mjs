import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { extractTimingObligations } from '../server/build/timing-obligations.mjs';
import { validateTimingEvidence } from '../server/build/timing-evidence.mjs';

const frozenCase = {
  external_id: 'TIMING-ENGINEERING',
  steps: [{ order: 1, action: '点击“查询”按钮', expected: '加载提示“正在加载…”约 400-600ms 后消失。' }],
};
const candidate = `import { test, expect } from '@playwright/test';
test('timed case', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await test.step('CASE_STEP_1', async () => {
    await page.getByRole('button', { name: '查询' }).click();
    const loading = page.getByText('正在加载…');
    await expect(loading).toBeVisible();
    await expect(loading).toBeHidden({ timeout: 5000 });
  });
});
`;

const timingRequirement = extractTimingObligations(frozenCase)[0];
const identity = { run_id: 'engineering-run-1', candidate_sha256: 'A'.repeat(64) };
function observation(overrides = {}) {
  return {
    id: timingRequirement.id, target: timingRequirement.target,
    min_ms: timingRequirement.min_ms, max_ms: timingRequirement.max_ms,
    tolerance_added_ms: 0, status: 'PASSED', observed_duration_ms: 400,
    cycles: [{ appeared_ms: 100, disappeared_ms: 500, duration_ms: 400 }],
    measurement: 'runner-owned visible duration', ...overrides,
  };
}
function entry(value = observation(), overrides = {}) {
  return { ...identity, step_id: 'CASE_STEP_1', depth: 0, timing_observations: [value], ...overrides };
}
function completeTiming() {
  return validateTimingEvidence([timingRequirement], [entry()], identity);
}

async function fixture({ timing = null } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'timing-gates-'));
  let verified = 0;
  const verify = async ({ runDirectory }) => {
    verified++;
    await fs.mkdir(runDirectory, { recursive: true });
    const reportPath = path.join(runDirectory, 'playwright-report.json');
    const report = { stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [
      { status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] },
    ] }] }] }] };
    await fs.writeFile(reportPath, JSON.stringify(report));
    return { reportPath, process: { exitCode: 0, termination: null }, ...(timing ? { timing } : {}) };
  };
  const session = new DevelopmentSession({ directory, frozenCase, normalUrl: 'http://127.0.0.1:1234/normal',
    verify, persist: async () => {}, signal: new AbortController().signal });
  await session.init();
  return { session, directory, get verified() { return verified; }, close: () => fs.rm(directory, { recursive: true, force: true }) };
}
async function writeCandidate(f, code = candidate) {
  return f.session.invoke('write_draft', { code, previous_sha256: null });
}
function readyArgs(execution, code = candidate) {
  return { sha256: digest(code), outcome: 'ready', coverage: [{ order: 1,
    requirement: frozenCase.steps[0].expected, check_lines: [5], execution, uncovered: '' }] };
}

test('entry write rejects candidate clock; a helper clock cannot bypass self-test or submission', async () => {
  const f = await fixture();
  try {
    const clockedEntry = candidate.replace('const loading =', 'const startedAt = Date.now();\n    const loading =');
    await assert.rejects(writeCandidate(f, clockedEntry), /TIMING_MUST_USE_RUNNER_OBSERVATION/);
    assert.equal(f.session.state.draft_sha256, null);

    const withHelper = candidate.replace("import { test, expect } from '@playwright/test';", "import { test, expect } from '@playwright/test';\nimport './helper.mjs';");
    await writeCandidate(f, withHelper);
    await fs.writeFile(path.join(f.directory, 'draft', 'helper.mjs'), 'export const mark = () => Date.now();\n');
    const run = await f.session.invoke('self_test');
    assert.equal(run.status, 'EXECUTOR_ERROR');
    assert.match(run.error, /TIMING_MUST_USE_RUNNER_OBSERVATION/);
    assert.equal(f.verified, 0);
    await assert.rejects(f.session.invoke('submit_candidate', readyArgs(1, withHelper)), /TIMING_MUST_USE_RUNNER_OBSERVATION/);
    assert.equal(f.session.state.submission, null);
  } finally { await f.close(); }
});

test('passing Playwright report without timing evidence cannot make a candidate ready', async () => {
  const f = await fixture();
  try {
    await writeCandidate(f);
    const run = await f.session.invoke('self_test');
    assert.equal(f.verified, 1);
    const rawReport = JSON.parse(await fs.readFile(path.join(f.directory, run.report_path), 'utf8'));
    assert.equal(rawReport.suites[0].specs[0].tests[0].results[0].status, 'passed');
    assert.equal(run.result.report_status, 'COMPLETE');
    assert.equal(run.result.test_count, 1);
    assert.equal(run.result.complete_pass, false);
    assert.equal(run.result.error.code, 'FROZEN_TIMING_REQUIREMENT_FAILED');
    assert.equal(run.timing_validation.required, true);
    assert.equal(run.timing_validation.complete, false);
    await assert.rejects(f.session.invoke('submit_candidate', readyArgs(1)), /READY_REQUIRES_CURRENT_COMPLETE_SELF_TEST/);
    assert.equal(f.session.state.submission, null);

    // Even if an upstream result erroneously says complete, ready has its own timing gate.
    f.session.state.self_tests[0].result.complete_pass = true;
    await assert.rejects(f.session.invoke('submit_candidate', readyArgs(1)), /READY_REQUIRES_FROZEN_TIMING_EVIDENCE/);
  } finally { await f.close(); }
});

test('timing validator rejects wrong identity, step, duplicates, bounds and invalid cycles', () => {
  assert.equal(completeTiming().complete, true);
  const cases = [
    [entry(observation(), { candidate_sha256: 'B'.repeat(64) })],
    [entry(observation(), { step_id: 'CASE_STEP_2' })],
    [entry(), entry()],
    [entry(observation({ observed_duration_ms: 399 }))],
    [entry(observation({ observed_duration_ms: 601 }))],
    [entry(observation({ cycles: [] }))],
    [entry(observation({ cycles: [{}, {}] }))],
    [entry(observation({ cycles: [{ appeared_ms: 500, disappeared_ms: 100, duration_ms: 400 }] }))],
    [entry(observation({ cycles: [{ appeared_ms: 100, disappeared_ms: 500, duration_ms: 300 }] }))],
    [entry(observation({ tolerance_added_ms: 1 }))],
  ];
  for (const [index, entries] of cases.entries())
    assert.equal(validateTimingEvidence([timingRequirement], entries, identity).complete, false, `invalid timing evidence case ${index + 1}`);
  for (const boundary of [400, 600])
    assert.equal(validateTimingEvidence([timingRequirement], [entry(observation({ observed_duration_ms: boundary,
      cycles: [{ appeared_ms: 100, disappeared_ms: 100 + boundary, duration_ms: boundary }] }))], identity).complete, true);
});

test('complete boundary evidence permits ready submission but never semantic approval', async () => {
  const f = await fixture({ timing: completeTiming() });
  try {
    await writeCandidate(f);
    const run = await f.session.invoke('self_test');
    assert.equal(run.status, 'EXECUTED');
    assert.equal(run.result.complete_pass, true);
    assert.equal(run.coverage.complete, true);
    assert.equal(run.timing_validation.complete, true);
    const submitted = await f.session.invoke('submit_candidate', readyArgs(1));
    assert.equal(submitted.status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
    assert.equal(f.session.state.submission.semantic_approval, false);
    assert.equal(f.session.state.fidelity_review.semantic_approval, false);
    assert.equal(f.session.state.fidelity_review.human_review_required, true);
  } finally { await f.close(); }
});

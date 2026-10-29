import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client, StreamableHTTPClientTransport } from '../../harness-probe/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { DevelopmentSession, digest, DEVELOPMENT_LIMITS } from '../server/build/development-session.mjs';
import { startDevelopmentMcp } from '../server/build/development-mcp.mjs';
import { developmentToolAllowed } from '../server/build/development-tool-guard.mjs';
import { checkDevelopmentCandidate } from '../server/build/development-policy.mjs';

const frozenCase = { steps: [{ order: 1, action: 'Open', expected: 'The label is good' }] };
const draft = value => `import {test,expect} from '@playwright/test';\ntest('engineering',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('${value}');});});\n`;
async function fixture(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'development-engineering-'));
  const controller = new AbortController(); const saved = [];
  const verify = async ({ candidatePath, runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const pass = (await fs.readFile(candidatePath, 'utf8')).includes("toHaveText('good')");
    const error = pass ? undefined : { message: 'Expected string: "bad"\nReceived string: "good"' };
    const report = { stats: { expected: pass ? 1 : 0, unexpected: pass ? 0 : 1, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: pass ? 'passed' : 'failed', error, steps: [{ title: 'CASE_STEP_1', category: 'test.step', error }] }] }] }] }] };
    const reportPath = path.join(runDirectory, 'playwright-report.json'); await fs.writeFile(reportPath, JSON.stringify(report));
    return { reportPath, process: { exitCode: pass ? 0 : 1, termination: null } };
  };
  const session = new DevelopmentSession({ directory, frozenCase, normalUrl: 'http://127.0.0.1:1234/normal', verify, persist: async state => saved.push(state), signal: controller.signal, ...options });
  await session.init(options.seed ?? null);
  return { session, saved, controller, close: () => fs.rm(directory, { recursive: true, force: true }) };
}
function coverage(execution) { return [{ order: 1, requirement: frozenCase.steps[0].expected, check_lines: [2], execution, uncovered: '' }]; }

test('self-test mode freezes a passing package without reviewer or duplicate execution', async () => {
  const f = await fixture({ qualityPolicy: { quality_review_mode: 'self-test-v1', validation_mode: 'normal-only' },
    qualityReviewer: async () => assert.fail('AI review is disabled') });
  try {
    await f.session.invoke('write_draft', { code: draft('good'), previous_sha256: null });
    await f.session.invoke('self_test');
    assert.equal((await f.session.invoke('self_test')).cached, true);
    assert.equal((await f.session.invoke('review_candidate')).status, 'SKIPPED_BY_USER_POLICY');
    const submitted = await f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(submitted.status, 'SELF_TEST_VALIDATED'); assert.equal(submitted.approval, 'NOT_REQUIRED');
    assert.equal(f.session.state.self_tests.length, 1);
    assert.equal(f.session.state.quality_reviews.length, 0); assert.equal(f.session.state.independent_validations.length, 0);
    assert.equal(f.session.state.submission.semantic_approval, false);
    assert.equal(f.session.state.fidelity_review.human_review_required, false);
  } finally { await f.close(); }
});

test('self-test mode still rejects failure, missing coverage and a changed package', async () => {
  const f = await fixture({ qualityPolicy: { quality_review_mode: 'self-test-v1' } });
  try {
    await f.session.invoke('write_draft', { code: draft('bad'), previous_sha256: null });
    await f.session.invoke('self_test');
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(draft('bad')), outcome: 'ready', coverage: coverage(1) }), /READY_REQUIRES_CURRENT_COMPLETE_SELF_TEST/);
    await f.session.invoke('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) });
    await f.session.invoke('self_test');
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: [] }), /COVERAGE_REQUIRED/);
    await fs.writeFile(path.join(f.session.directory, 'draft', 'helper.mjs'), 'export const changed = true;');
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(2) }), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
    assert.equal(f.session.state.submission, null);
  } finally { await f.close(); }
});

test('early prerequisite blocker requires observed evidence and an original prerequisite, creates no passing script', async () => {
  const f = await fixture({ frozenCase: { ...frozenCase, preconditions: 'A dedicated template named Test-A exists.' }, qualityPolicy: { quality_review_mode: 'self-test-v1' }, pageObservationRequired: true });
  try {
    const args = { requirement: 'A dedicated template named Test-A exists.', observed: 'The visible search result for Test-A is empty; global absence has not been established.', reason: 'The required template could not be located.' };
    await assert.rejects(f.session.invoke('report_blocker', args), /NORMAL_PAGE_OBSERVATION_REQUIRED/);
    f.session.state.browser_tool_calls = 1;
    await assert.rejects(f.session.invoke('report_blocker', args), /BLOCKER_REQUIRES_PAGE_OBSERVATION/);
    f.session.state.observation_epoch = 1;
    await assert.rejects(f.session.invoke('report_blocker', { ...args, requirement: 'An invented condition' }), /BLOCKER_REQUIRES_FROZEN_PRECONDITION/);
    const blocked = await f.session.invoke('report_blocker', args);
    assert.equal(blocked.status, 'ENVIRONMENT_BLOCKED'); assert.equal(blocked.candidate_created, false);
    assert.equal(f.session.state.self_tests.length, 0); assert.equal(f.session.state.submission, null);
    assert.equal(blocked.blocker.verified_absence, false);
    await assert.rejects(f.session.invoke('self_test'), /DEVELOPMENT_BLOCKER_RECORDED/);
  } finally { await f.close(); }
});

test('executor failure retains readable report, screenshot and policy evidence without becoming a passing run', async () => {
  const f = await fixture({ verify: async ({ runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    await fs.writeFile(path.join(runDirectory, 'playwright-report.json'), JSON.stringify({ stats: { expected: 1 }, errors: [] }));
    await fs.writeFile(path.join(runDirectory, 'failure.png'), Buffer.from('fixture screenshot'));
    await fs.writeFile(path.join(runDirectory, 'network-policy-breach.json'), JSON.stringify({ code: 'TARGET_SCOPE_REQUEST_BLOCKED', origin: 'https://outside.example', path: '/blocked' }));
    throw Error('TARGET_SCOPE_REQUEST_BLOCKED');
  } });
  try {
    await f.session.invoke('write_draft', { code: draft('good'), previous_sha256: null });
    const run = await f.session.invoke('self_test');
    assert.equal(run.status, 'EXECUTOR_ERROR'); assert.equal(run.result, undefined);
    const report = await f.session.invoke('read_evidence', { execution: 1, kind: 'report' });
    assert.equal(report.error, 'TARGET_SCOPE_REQUEST_BLOCKED');
    assert.equal(report.raw_report.stats.expected, 1);
    assert.equal(report.network_policy_breach.code, 'TARGET_SCOPE_REQUEST_BLOCKED');
    const shot = await f.session.invoke('read_evidence', { execution: 1, kind: 'screenshot' });
    assert.equal(Buffer.from(shot.content[1].data, 'base64').toString(), 'fixture screenshot');
    await assert.rejects(f.session.invoke('submit_candidate', { sha256: run.sha256, outcome: 'ready', coverage: coverage(1) }), /CURRENT_BYTES_REQUIRE_SELF_TEST/);
    await fs.writeFile(path.join(f.session.directory, run.report_path), '{}');
    await assert.rejects(f.session.invoke('read_evidence', { execution: 1, kind: 'report' }), /EVIDENCE_CHANGED/);
  } finally { await f.close(); }
});

test('failure before report creation still exposes its executor reason and cannot invent a screenshot', async () => {
  const f = await fixture({ verify: async () => { throw Error('EXECUTOR_START_FAILED'); } });
  try {
    await f.session.invoke('write_draft', { code: draft('good'), previous_sha256: null });
    await f.session.invoke('self_test');
    const report = await f.session.invoke('read_evidence', { execution: 1, kind: 'report' });
    assert.equal(report.error, 'EXECUTOR_START_FAILED'); assert.equal(report.raw_report, null);
    await assert.rejects(f.session.invoke('read_evidence', { execution: 1, kind: 'screenshot' }), /SCREENSHOT_NOT_AVAILABLE/);
  } finally { await f.close(); }
});

function qualityResult(input, status, errorCode = null) {
  return { schema: 'workbench/candidate-quality-review-v1', status,
    case_sha256: input.caseSha256, candidate_sha256: input.candidateSha256,
    input_sha256: digest('review-input'), findings: [], steps: [], model: null,
    usage: errorCode ? { total_tokens: 9 } : null, model_calls: 1,
    semantic_approval: false, ...(errorCode ? { error_code: errorCode } : {}) };
}

test('technical review failure retries identical bytes within cumulative review budget and caches success', async () => {
  let calls = 0;
  const f = await fixture({ seed: draft('good'), qualityPolicy: { quality_review_mode: 'static-v1' },
    qualityReviewer: async input => qualityResult(input, ++calls === 1 ? 'NEEDS_ANALYSIS' : 'NO_FINDINGS', calls === 1 ? 'MODEL_REQUEST_FAILED' : null) });
  try {
    await f.session.invoke('self_test');
    const failed = await f.session.invoke('review_candidate');
    assert.equal(failed.error_code, 'MODEL_REQUEST_FAILED');
    assert.equal(failed.remaining.quality_reviews, 2);
    const blocked = await f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(blocked.status, 'QUALITY_REVIEW_REQUIRED');
    assert.equal(f.session.state.submission, null);
    const passed = await f.session.invoke('review_candidate');
    assert.equal(passed.status, 'NO_FINDINGS');
    assert.equal(passed.remaining.quality_reviews, 1);
    const cached = await f.session.invoke('review_candidate');
    assert.equal(cached.cached, true);
    assert.equal(calls, 2);
    assert.equal(f.session.state.quality_reviews.length, 2);
  } finally { await f.close(); }
});

test('repeated technical failures consume review budget without a cached success', async () => {
  let calls = 0;
  const f = await fixture({ seed: draft('good'), qualityPolicy: { quality_review_mode: 'static-v1' },
    limits: { ...DEVELOPMENT_LIMITS, quality_reviews: 2 },
    qualityReviewer: async input => { calls++; return qualityResult(input, 'NEEDS_ANALYSIS', 'MODEL_REQUEST_FAILED'); } });
  try {
    await f.session.invoke('self_test');
    await f.session.invoke('review_candidate');
    await f.session.invoke('review_candidate');
    const exhausted = await f.session.invoke('review_candidate');
    assert.equal(exhausted.status, 'QUALITY_REVIEW_BUDGET_EXHAUSTED');
    assert.equal(exhausted.remaining.quality_reviews, 0);
    assert.equal(calls, 2);
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) })).status, 'QUALITY_REVIEW_REQUIRED');
  } finally { await f.close(); }
});

test('semantic repair result remains cached for identical reviewed bytes', async () => {
  let calls = 0;
  const f = await fixture({ seed: draft('good'), qualityPolicy: { quality_review_mode: 'static-v1' },
    qualityReviewer: async input => { calls++; return qualityResult(input, 'REPAIR_REQUIRED'); } });
  try {
    await f.session.invoke('self_test');
    assert.equal((await f.session.invoke('review_candidate')).status, 'REPAIR_REQUIRED');
    const repeated = await f.session.invoke('review_candidate');
    assert.equal(repeated.status, 'REPAIR_REQUIRED');
    assert.equal(repeated.cached, true);
    assert.equal(calls, 1);
    assert.equal((await f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) })).status, 'REPAIR_REQUIRED');
  } finally { await f.close(); }
});

test('cancellation during quality review cannot be cached or submitted', async () => {
  let started; const active = new Promise(resolve => { started = resolve; });
  const f = await fixture({ seed: draft('good'), qualityPolicy: { quality_review_mode: 'static-v1' },
    qualityReviewer: async input => { started(); await new Promise(resolve => input.signal.addEventListener('abort', resolve, { once: true })); return qualityResult(input, 'NO_FINDINGS'); } });
  try {
    await f.session.invoke('self_test');
    const review = f.session.invoke('review_candidate'); await active;
    f.controller.abort();
    await assert.rejects(review, /DEVELOPMENT_CANCELLED/);
    assert.equal(f.session.state.quality_reviews[0].review.error_code, 'DEVELOPMENT_CANCELLED');
    assert.equal(f.session.state.submission, null);
    await assert.rejects(f.session.invoke('review_candidate'), /DEVELOPMENT_CANCELLED/);
  } finally { await f.close(); }
});

test('missing normal page observation is repairable before review or draft freezing', async () => {
  const f = await fixture({ seed: draft('good'), pageObservationRequired: true });
  try {
    const run = await f.session.invoke('self_test'); assert.equal(run.result.complete_pass, true);
    for (const name of ['review_candidate', 'submit_candidate']) {
      await assert.rejects(f.session.invoke(name, { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) }), error => {
        assert.equal(error.message, 'NORMAL_PAGE_OBSERVATION_REQUIRED');
        assert.ok(error.detail.allowed_next_steps.some(step => step.includes('browser'))); return true;
      });
      assert.equal(f.session.state.submission, null);
      assert.equal(f.session.state.quality_reviews.length, 0);
      assert.equal(f.session.state.independent_validations.length, 0);
    }
    // The production lifecycle supplies this count; never candidate arguments.
    f.session.state.browser_tool_calls = 1;
    const submitted = await f.session.invoke('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) });
    assert.equal(submitted.status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
    assert.equal(f.session.state.self_tests.length, 1);
  } finally { await f.close(); }
});

test('pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes', async () => {
  const f = await fixture({ seed: draft('bad') }); const bridge = await startDevelopmentMcp((name, args) => f.session.invoke(name, args));
  const client = new Client({ name: 'zero-model-agent-context', version: '1' }, { versionNegotiation: { mode: 'auto' } });
  const context = [];
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(bridge.url)));
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['check_fidelity','read_draft','read_evidence','report_blocker','review_candidate','run_diagnostic','self_test','submit_candidate','write_draft']);
    async function call(name, args = {}) { const result = await client.callTool({ name, arguments: args }); context.push(result); return result; }
    const denied = await call('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) });
    assert.equal(denied.isError, true);
    const first = await call('self_test'); assert.notEqual(first.isError, true);
    assert.equal(JSON.parse(first.content[0].text).result.error.actual, 'good');
    await call('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) });
    assert.equal((await call('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) })).isError, true);
    const second = await call('self_test'); assert.equal(JSON.parse(second.content[0].text).result.complete_pass, true);
    const final = await call('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(2) });
    assert.equal(JSON.parse(final.content[0].text).status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
    assert.equal(context.length, 6);
    assert.notEqual(f.session.state.self_tests[0].sha256, f.session.state.self_tests[1].sha256);
    await assert.rejects(f.session.invoke('write_draft', { code: draft('bad'), previous_sha256: digest(draft('good')) }), /FROZEN/);
  } finally { await client.close(); await bridge.close(); await f.close(); }
});

test('self-test limit is cumulative and further edits cannot create an unverified final version', async () => {
  const f = await fixture({ seed: draft('bad') });
  try {
    for (let i = 0; i < 3; i++) {
      if (i) await f.session.invoke('write_draft', { code: draft(`bad-${i}`), previous_sha256: digest(draft(i === 1 ? 'bad' : `bad-${i - 1}`)) });
      await f.session.invoke('self_test');
    }
    await assert.rejects(f.session.invoke('self_test'), /BUDGET/);
    await assert.rejects(f.session.invoke('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad-2')) }), /BUDGET/);
    assert.equal(f.saved.at(-1).self_tests.length, 3);
  } finally { await f.close(); }
});

test('cancellation reaches an active execution and later tools stop', async () => {
  let began; const started = new Promise(resolve => { began = resolve; });
  const f = await fixture({ seed: draft('bad'), verify: async ({ signal }) => { began(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw new Error('owned execution cancelled'); } });
  try {
    const running = f.session.invoke('self_test'); await started; f.controller.abort('cancelled'); await running;
    assert.equal(f.session.state.self_tests[0].status, 'CANCELLED');
    await assert.rejects(f.session.invoke('read_draft'), /CANCELLED/);
  } finally { await f.close(); }
});

test('wall budget terminates before another tool or executor admission', async () => {
  let now = 0; const f = await fixture({ now: () => now, limits: { ...DEVELOPMENT_LIMITS, wall_ms: 10 } });
  try { now = 10; await assert.rejects(f.session.invoke('read_draft'), /TIME_EXHAUSTED/); assert.equal(f.session.state.self_tests.length, 0); }
  finally { await f.close(); }
});

test('from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate', async () => {
  const f = await fixture(); const bridge = await startDevelopmentMcp((name, args) => f.session.invoke(name, args));
  const client = new Client({ name: 'empty-draft-engineering', version: '1' }, { versionNegotiation: { mode: 'auto' } });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(bridge.url)));
    const call = code => client.callTool({ name: 'write_draft', arguments: { code, previous_sha256: null } });
    const rejected = await call(draft('good').replace("import {test,expect} from '@playwright/test';", "const {test,expect}=require('@playwright/test');"));
    assert.equal(rejected.isError, true); assert.equal(f.session.state.self_tests.length, 0);
    assert.equal(f.session.state.draft_sha256, null);
    const accepted = await call(draft('good'));
    assert.notEqual(accepted.isError, true); assert.equal(f.session.state.draft_sha256, digest(draft('good')));
  } finally { await client.close(); await bridge.close(); await f.close(); }
});

test('task guard denies arbitrary commands, filesystem, code and alternate navigation', () => {
  const normal = 'http://127.0.0.1:1234/normal';
  assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_navigate', { url: normal }, normal), true);
  for (const [name, args] of [['bash', {}], ['read_file', {}], ['run_code', {}], ['mcp__playwright-mcp__browser_run_code', {}], ['mcp__playwright-mcp__browser_navigate', { url: normal + '?fault=1' }], ['mcp__playwright-mcp__browser_take_screenshot', { filename: '../outside.png' }]]) assert.equal(developmentToolAllowed(name, args, normal), false);
  for (const forbidden of ["test.fail();", "test.skip();", "await fetch('http://other');", "process.env.DEEPSEEK_API_KEY;", "await import('node:fs');"]) assert.throws(() => checkDevelopmentCandidate(draft('good') + forbidden));
});

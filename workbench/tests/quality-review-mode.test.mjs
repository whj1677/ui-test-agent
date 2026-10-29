import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { backendDigest } from '../server/backend/schema.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';

const frozenCase = { steps: [{ order: 1, action: 'Open', expected: 'Ready' }] };
const code = "import { test, expect } from '@playwright/test';\ntest('case', async ({page}) => { await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1', async () => { await expect(page.getByRole('status')).toHaveText('Ready'); }); });\n";
async function fixture({ mode, reviewer }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-review-mode-'));
  const states = [];
  const controller = new AbortController();
  const verify = async ({ runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const reportPath = path.join(runDirectory, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] }] }] }] }] }));
    return { reportPath, process: { exitCode: 0, termination: null } };
  };
  const session = new DevelopmentSession({ directory, frozenCase, normalUrl: 'http://127.0.0.1:1234/normal', verify,
    persist: async state => states.push(state), signal: controller.signal,
    qualityPolicy: { quality_review_mode: mode, required: true, validation_mode: 'normal-only' }, qualityReviewer: reviewer });
  await session.init(code);
  await session.invoke('self_test');
  return { session, states, controller, close: () => fs.rm(directory, { recursive: true, force: true }) };
}

test('B review persists reviewer starts/tools, uses existing independent validation budget and caches same bytes', async () => {
  let calls = 0;
  const f = await fixture({ mode: 'dsh-tools-v1', reviewer: async ({ caseSha256, candidateSha256, reserveStartup, onTool, replay }) => {
    calls++;
    await reserveStartup(); await onTool({ name: 'read', phase: 'before', count: 1 });
    const first = await replay({ signal: new AbortController().signal });
    const cached = await replay({ signal: new AbortController().signal });
    assert.equal(first.number, cached.number);
    return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: digest('review'), findings: [], steps: [], semantic_approval: false,
      model_calls: null, usage: null, investigation: { obligations: [], tool_events: [] } };
  } });
  try {
    const first = await f.session.invoke('review_candidate');
    assert.equal(first.status, 'NO_FINDINGS');
    assert.equal(f.session.state.reviewer_harness_starts, 1);
    assert.equal(f.session.state.reviewer_tool_calls_used, 1);
    assert.equal(f.session.state.tool_calls, 1);
    assert.equal(f.session.state.independent_validations.length, 1);
    const second = await f.session.invoke('review_candidate');
    assert.equal(second.cached, true); assert.equal(calls, 1);
    assert.equal(f.states.at(-1).quality_reviews[0].mode, 'dsh-tools-v1');
  } finally { await f.close(); }
});

test('unknown review mode fails closed and old static mode uses no reviewer tools', async () => {
  const invalid = await fixture({ mode: 'unexpected', reviewer: async () => assert.fail('reviewer must not start') });
  try { await assert.rejects(invalid.session.invoke('review_candidate'), /QUALITY_REVIEW_MODE_INVALID/); }
  finally { await invalid.close(); }
  const legacy = await fixture({ mode: undefined, reviewer: async ({ caseSha256, candidateSha256 }) => ({
    schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
    candidate_sha256: candidateSha256, input_sha256: digest('static'), findings: [], steps: [], semantic_approval: false,
  }) });
  try {
    assert.equal((await legacy.session.invoke('review_candidate')).status, 'NO_FINDINGS');
    assert.equal(legacy.session.state.quality_reviews[0].mode, 'static-v1');
    assert.equal(legacy.session.state.reviewer_harness_starts, 0);
  } finally { await legacy.close(); }
});

test('UI preparation binds the requested mode and rejects an unknown mode before admission', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-review-preflight-'));
  const content = { case_type: 'UI', status: 'CONFIRMED', external_id: 'UI-1', title: 'Example', steps: [{ order: 1, action: 'Open', expected: 'Ready' }] };
  const buildManager = { store: { root }, developmentEnvironments: [{ id: 'normal' }], generationDisabled: true,
    userInitiatedOperations: false, caseAutomation: async () => ({ candidates: [] }), toolQualityReviewer: async () => {} };
  const caseStore = { getProject: async () => ({ cases: [{ case_id: 'case-1', versions: [{ version: 1, content, content_sha256: digest(JSON.stringify(content)) }] }] }) };
  const operations = new ScriptOperations({ root, buildManager, caseStore, records: async () => [] });
  try {
    const input = { mode: 'generate', environment_id: 'normal', items: [{ case_id: 'case-1', case_version: 1 }] };
    assert.equal((await operations.preflight('project-1', input)).quality_review_mode, 'static-v1');
    assert.equal((await operations.preflight('project-1', { ...input, quality_review_mode: 'self-test-v1' })).quality_review_mode, 'self-test-v1');
    assert.equal((await operations.preflight('project-1', { ...input, quality_review_mode: 'dsh-tools-v1' })).quality_review_mode, 'dsh-tools-v1');
    await assert.rejects(operations.preflight('project-1', { ...input, quality_review_mode: 'typo' }), /QUALITY_REVIEW_MODE_INVALID/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('UI cancellation withdraws a late B verdict but retains safe investigation and charged use', async () => {
  let cancel;
  const f = await fixture({ mode: 'dsh-tools-v1', reviewer: async ({ caseSha256, candidateSha256, reserveStartup, onTool }) => {
    await reserveStartup(); await onTool({ name: 'read_case', phase: 'START', count: 1 }); cancel();
    return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: digest('late'), findings: [], steps: [], semantic_approval: false,
      harness_starts: 1, tool_calls: 1, replays: 0, elapsed_ms: 12, provider_requests: null,
      process_diagnostic: { exit_code: 0, termination: 'cancelled' },
      investigation: { obligations: [], tool_events: [{ number: 1, tool: 'read_case', status: 'COMPLETED' }] } };
  } });
  cancel = () => f.controller.abort('cancelled');
  try {
    await assert.rejects(f.session.invoke('review_candidate'), /DEVELOPMENT_CANCELLED/);
    const attempt = f.session.state.quality_reviews[0];
    assert.equal(attempt.review.status, 'NEEDS_ANALYSIS');
    assert.equal(attempt.review.investigation.tool_events.length, 1);
    assert.equal(attempt.review.process_diagnostic.termination, 'cancelled');
    assert.equal(f.session.state.reviewer_harness_starts, 1);
    assert.equal(f.session.state.reviewer_tool_calls_used, 1);
    assert.equal(f.session.state.submission, null);
  } finally { await f.close(); }
});

test('backend B review reserves one reviewer start, charges task tools and preserves usage on cancelled verdict', async () => {
  const frozenCase = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [{ order: 1, action: 'Query', expected: 'Contains BK-001' }] };
  const caseSha = backendDigest(frozenCase).toUpperCase();
  const environment = { id: 'env-00000000-0000-4000-8000-000000000001', environment_id: 'env-00000000-0000-4000-8000-000000000001', name: 'fixture', mode: 'http-json-readonly', base_url: 'http://127.0.0.1:1', non_production: true, authorized: true, allowed_methods: ['GET'], allowed_headers: [], allowed_path_prefixes: ['/api/books/'] };
  const plan = { plan_id: 'plan-1', case_id: 'case-1', case_version: 1, content_sha256: caseSha, quality_review_mode: 'dsh-tools-v1', revision: 1 };
  const context = { caseVersion: { version: 1, content: frozenCase, content_sha256: caseSha }, binding: { version: 1, case_version: 1, case_content_sha256: caseSha, binding_id: 'binding-test', protocol_source_id: 'protocol-test', protocol_sha256: 'a'.repeat(64), status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [{ order: 1, path: '/api/books' }] }, protocol: { segments: [{ text: 'GET /api/books' }] } };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.environment_id, setup: [], cleanup: [], steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/api/books?q=BK-001', assertions: [{ target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'code', value: 'BK-001' }] }] }] };
  const controller = new AbortController();
  const session = new BackendHarnessSession({ plan, context, environment, signal: controller.signal, persist: async () => {},
    execute: async () => ({ status: 'PASSED', complete_pass: true, setup: [], cleanup: [], steps: [{ order: 1, requests: [] }] }),
    qualityReviewer: async ({ caseSha256, candidateSha256, reserveStartup, onTool }) => {
      await reserveStartup(); await onTool({ name: 'read_case', phase: 'START', count: 1 }); controller.abort('cancelled');
      return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256, candidate_sha256: candidateSha256,
        input_sha256: 'a'.repeat(64), findings: [], steps: [], semantic_approval: false, model_calls: null, usage: null,
        harness_starts: 1, tool_calls: 1, replays: 0, elapsed_ms: 20,
        investigation: { obligations: [], tool_events: [{ number: 1, tool: 'read_case', status: 'COMPLETED' }], phase: 'DONE' } };
    } });
  await session.initialize();
  await session.invoke('write_draft', { previous_sha256: null, execution }); await session.invoke('self_test');
  const result = await session.invoke('review_candidate');
  assert.equal(result.status, 'NEEDS_ANALYSIS');
  assert.equal(plan.generation_session.quality_reviews[0].harness_starts, 1);
  assert.equal(plan.generation_session.quality_reviews[0].investigation.tool_events.length, 1);
  assert.equal(plan.generation_session.reviewer_harness_starts, 1);
  assert.equal(plan.generation_session.reviewer_tool_calls_used, 1);
  assert.equal(plan.generation_session.tool_calls_used, 4);
  assert.equal(plan.generation_session.candidate, null);
});

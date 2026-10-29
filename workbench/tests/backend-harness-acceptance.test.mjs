import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { BACKEND_HARNESS_LIMITS, BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { BackendHarnessManager } from '../server/backend/harness-manager.mjs';
import { BackendManager } from '../server/backend-manager.mjs';
import { exampleEnvironment, exampleExecution } from '../server/backend/example.mjs';
import { backendDigest, executeBackendCase } from '../server/backend/execution.mjs';

const copy = value => structuredClone(value);
const passed = () => ({ status: 'PASSED', execution_status: 'FINISHED', complete_pass: true,
  technical_error: null, cleanup_error: null, cleanup: [], steps: [{ order: 1, status: 'PASSED' }] });
const noFindings = async ({ caseSha256, candidateSha256 }) => ({ schema: 'workbench/candidate-quality-review-v1',
  status: 'NO_FINDINGS', case_sha256: caseSha256, candidate_sha256: candidateSha256,
  input_sha256: 'd'.repeat(64), findings: [], steps: [], model: 'mock', usage: {}, model_calls: 0, semantic_approval: false });

function fixture({ execute = async () => passed(), assertCurrent = async () => {}, persist = async () => {}, signal } = {}) {
  const content = { case_type: 'BACKEND', external_id: 'BE-HARNESS-001', title: '只读查询', status: 'CONFIRMED',
    steps: [{ order: 1, action: '按关键词查询图书', expected: '返回匹配图书列表' }] };
  const contentSha = backendDigest(content).toUpperCase();
  const caseVersion = { version: 1, content, content_sha256: contentSha };
  const binding = { project_id: 'project-test', case_id: 'case-test', binding_id: 'binding-test', version: 1,
    case_version: 1, case_content_sha256: contentSha, protocol_source_id: 'protocol-source-test',
    protocol_sha256: 'A'.repeat(64), status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [] };
  const protocol = { segments: [{ text: 'Synthetic confirmed protocol facts.' }] };
  const environment = { id: 'env-test', environment_id: 'env-test', name: 'temporary-readonly-sut', mode: 'http-json-readonly',
    base_url: 'http://127.0.0.1:1', non_production: true, authorized: true, reviewer: 'local-test-operator',
    allowed_methods: ['GET'], allowed_headers: [], allowed_path_prefixes: ['/api/books/'] };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.environment_id,
    setup: [], cleanup: [], request_timeout_ms: 2000, timeout_ms: 10000,
    steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/api/books?keyword=Alpha', assertions: [
      { target: 'json', pointer: '/items', op: 'equals', value: [{ title: 'Alpha' }] },
    ] }] }] };
  const context = { caseVersion, binding, protocol };
  const plan = { schema: 'workbench/backend-plan-v1', plan_id: 'plan-test', project_id: 'project-test',
    case_id: 'case-test', case_version: 1, content_sha256: contentSha, binding_id: binding.binding_id,
    binding_version: binding.version, protocol_sha256: binding.protocol_sha256, environment_id: environment.environment_id,
    environment_sha256: 'B'.repeat(64), revision: 1, state: 'GENERATING', execution: null };
  const session = new BackendHarnessSession({ plan, context, environment, execute, assertCurrent, persist, signal, qualityReviewer: noFindings });
  return { session, plan, context, environment, execution, contentSha, binding, caseVersion };
}

const coverage = (requirement = '返回匹配图书列表') => [{ order: 1, requirement, request_ids: ['query'], uncovered: '' }];

function syntheticFixture({ execute = async () => passed(), assertCurrent = async () => {}, persist = async () => {}, signal } = {}) {
  const content = { case_type: 'BACKEND', external_id: 'BE-HARNESS-SYNTHETIC-001', title: '核对设备台账', status: 'CONFIRMED',
    steps: [{ order: 1, action: '查询设备台账', expected: '唯一记录为DEV-001' }] };
  const contentSha = backendDigest(content).toUpperCase();
  const caseVersion = { version: 1, content, content_sha256: contentSha };
  const binding = { project_id: 'project-test', case_id: 'case-test', binding_id: 'binding-test', version: 1,
    case_version: 1, case_content_sha256: contentSha, protocol_source_id: 'protocol-source-test',
    protocol_sha256: 'A'.repeat(64), status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [] };
  const environment = { ...copy(exampleEnvironment), id: 'env-synthetic-test', environment_id: 'env-synthetic-test',
    name: 'temporary-synthetic-sut', base_url: 'http://127.0.0.1:1' };
  const execution = { ...copy(exampleExecution), environment_id: environment.environment_id,
    steps: [copy(exampleExecution.steps[0])] };
  const context = { caseVersion, binding, protocol: { segments: [{ text: 'Synthetic confirmed protocol facts.' }] } };
  const plan = { schema: 'workbench/backend-plan-v1', plan_id: 'plan-test', project_id: 'project-test',
    case_id: 'case-test', case_version: 1, content_sha256: contentSha, binding_id: binding.binding_id,
    binding_version: binding.version, protocol_sha256: binding.protocol_sha256, environment_id: environment.environment_id,
    environment_sha256: 'B'.repeat(64), revision: 1, state: 'GENERATING', execution: null };
  const session = new BackendHarnessSession({ plan, context, environment, execute, assertCurrent, persist, signal, qualityReviewer: noFindings });
  return { session, plan, context, environment, execution, contentSha, binding, caseVersion };
}

async function syntheticTarget(t, { setupFail = false, businessFail = false, cleanupFail = false } = {}) {
  const namespaces = new Map();
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let text = ''; for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : {};
    const send = (status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
    requests.push({ method: request.method, path: url.pathname });
    if (request.method === 'POST' && url.pathname === '/__control/namespaces') {
      if (setupFail) return send(500, { runId: body.runId, created: false });
      namespaces.set(body.runId, [{ code: 'DEV-001', name: 'fixture-device' }]);
      return send(201, { runId: body.runId, created: true });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/namespaces/')) {
      const runId = url.pathname.split('/')[4], items = namespaces.get(runId) || [];
      return send(200, { runId, items, total: items.length });
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/__control/namespaces/')) {
      const runId = url.pathname.split('/').at(-1);
      if (cleanupFail) return send(500, { runId, deleted: false });
      return send(200, { runId, deleted: true });
    }
    return send(404, { error: 'not-found' });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  return { base: `http://127.0.0.1:${server.address().port}`, requests };
}

const syntheticCoverage = (uncovered = '') => [{ order: 1, requirement: '唯一记录为DEV-001', request_ids: ['before'], uncovered }];

async function backendManagerFixture(t, { runHarness, environmentBaseUrl = 'http://127.0.0.1:1', candidateOutcome = 'READY', mutateExecution = () => {}, execute = async () => passed() } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-harness-integration-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectId = `project-${randomUUID()}`, caseId = `case-${randomUUID()}`;
  const content = { case_type: 'BACKEND', external_id: 'BE-HARNESS-INTEGRATION-001', title: '核对设备台账', status: 'CONFIRMED',
    steps: [{ order: 1, action: '查询设备台账', expected: '唯一记录为DEV-001' }] };
  const contentSha = backendDigest(content).toUpperCase();
  const project = { project_id: projectId, revision: 1,
    cases: [{ case_id: caseId, current_version: 1, versions: [{ version: 1, content, content_sha256: contentSha }] }] };
  const protocolSha = 'C'.repeat(64);
  const binding = { project_id: projectId, case_id: caseId, binding_id: `binding-${randomUUID()}`, version: 1,
    case_version: 1, case_content_sha256: contentSha, protocol_source_id: `source-${randomUUID()}`, protocol_sha256: protocolSha,
    status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [] };
  const protocol = { project_id: projectId, kind: 'PROTOCOL', sha256: protocolSha, segments: [{ text: 'Synthetic confirmed protocol facts.' }] };
  const runs = new Map();
  let harnessManager;
  let structuredExecution;
  const runner = runHarness ? options => runHarness(options, () => harnessManager.active?.session, () => structuredExecution) : async options => {
    await options.onLifecycle({ type: 'process_spawn' });
    const session = harnessManager.active.session;
    const draft = await session.invoke('write_draft', { execution: structuredExecution, previous_sha256: null });
    await session.invoke('self_test', {});
    await session.invoke('review_candidate', {});
    await session.invoke('submit_candidate', { execution_sha256: draft.draft_sha256, outcome: candidateOutcome, coverage: [
      { order: 1, requirement: '唯一记录为DEV-001', request_ids: ['before'], uncovered: '' },
    ] });
    return completedHarnessRun();
  };
  harnessManager = new BackendHarnessManager({ root: path.join(root, 'harness'), dshHome: path.join(root, 'dsh-home'),
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'synthetic-test-key', baseUrl: 'https://api.example.invalid' }),
    ensureRuntime: async () => {},
    probeConfig: async () => ({ exitCode: 0, stdout: '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: backend-workbench-mcp\n- id: backend-tool-guard\n', termination: null, observerError: null }),
    runHarness: runner, qualityReviewer: noFindings });
  const caseStore = { getProject: async id => id === projectId ? copy(project) : null };
  const requirementsManager = { getBindings: async () => ({ bindings: [copy(binding)] }), getSource: async () => copy(protocol) };
  const runStore = { listRuns: async () => copy([...runs.values()]), createRun: async run => { runs.set(run.run_id, copy(run)); return copy(run); },
    getRun: async id => copy(runs.get(id)), updateRun: async (id, update) => { const next = await update(copy(runs.get(id))); runs.set(id, copy(next)); return copy(next); } };
  const manager = new BackendManager({ root: path.join(root, 'plans'), caseStore, requirementsManager, runStore, harnessManager, execute });
  await manager.init();
  const environment = await manager.registerEnvironment(projectId, { name: 'temporary-synthetic-sut', base_url: environmentBaseUrl, non_production: true, authorized: true, reviewer: 'local-test-operator' });
  structuredExecution = { ...copy(exampleExecution), environment_id: environment.environment_id, steps: [copy(exampleExecution.steps[0])] };
  mutateExecution(structuredExecution);
  return { root, manager, harnessManager, caseStore, requirementsManager, runStore, execute, projectId, caseId, project, binding, protocol, runs, environment, structuredExecution };
}

function completedHarnessRun(extraEvents = []) {
  return { events: [...extraEvents, { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } }, { type: 'final' }], toolCalls: 0,
    processResult: { exitCode: 0, termination: null, outputComplete: true, closeObserved: true, observerError: null } };
}

test('draft CAS and frozen hash reject a self-test for bytes replaced after execution', async () => {
  const f = fixture(); await f.session.initialize();
  const first = await f.session.invoke('write_draft', { execution: f.execution, previous_sha256: null });
  const firstTest = await f.session.invoke('self_test', {});
  assert.equal(firstTest.status, 'PASSED'); assert.equal(firstTest.execution_sha256, first.draft_sha256);

  const changed = copy(f.execution); changed.timeout_ms += 1000;
  const second = await f.session.invoke('write_draft', { execution: changed, previous_sha256: first.draft_sha256 });
  assert.notEqual(second.draft_sha256, first.draft_sha256);
  await assert.rejects(() => f.session.invoke('submit_candidate', {
    execution_sha256: first.draft_sha256, outcome: 'READY', coverage: coverage(),
  }), /BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST/);
  await assert.rejects(() => f.session.invoke('submit_candidate', {
    execution_sha256: second.draft_sha256, outcome: 'READY', coverage: coverage(),
  }), /BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST/);

  const secondTest = await f.session.invoke('self_test', {});
  assert.equal(secondTest.status, 'PASSED'); assert.equal(secondTest.execution_sha256, second.draft_sha256);
  await f.session.invoke('review_candidate', {});
  const submitted = await f.session.invoke('submit_candidate', {
    execution_sha256: second.draft_sha256, outcome: 'READY', coverage: coverage(),
  });
  assert.equal(submitted.candidate.execution_sha256, second.draft_sha256);
  assert.equal(f.plan.execution_sha256, second.draft_sha256);
});

test('case, protocol, or environment identity drift blocks submit after a successful self-test', async t => {
  for (const staleField of ['case', 'protocol', 'environment']) await t.test(staleField, async () => {
    const expected = { case: 'case-v1-content', protocol: 'protocol-v1-hash', environment: 'environment-v1-hash' };
    const live = { ...expected };
    const f = fixture({ assertCurrent: async () => {
      if (Object.keys(expected).some(key => live[key] !== expected[key])) throw Error('BACKEND_PLAN_IDENTITY_CHANGED');
    } });
    await f.session.initialize();
    const draft = await f.session.invoke('write_draft', { execution: f.execution, previous_sha256: null });
    await f.session.invoke('self_test', {});
    live[staleField] = `${expected[staleField]}-changed`;
    await assert.rejects(() => f.session.invoke('submit_candidate', {
      execution_sha256: draft.draft_sha256, outcome: 'READY', coverage: coverage(),
    }), /BACKEND_PLAN_IDENTITY_CHANGED/);
    assert.equal(f.plan.generation_session.candidate, null);
  });
});

test('a plan preinitialized by BackendManager receives complete session limits and deadline', async () => {
  const f = fixture();
  f.plan.generation_session = { status: 'RUNNING', started_at: new Date().toISOString(), finished_at: null,
    limits: null, tool_calls_used: 0, harness_starts: 0, provider_requests: null, provider_usage: null, self_tests: [], candidate: null, error: null };
  await f.session.initialize();
  const state = f.session.getState();
  assert.deepEqual(state.limits, BACKEND_HARNESS_LIMITS);
  assert.ok(Number.isFinite(state.deadline_ms));
});

test('a real business assertion failure cannot be submitted as READY or reported as business success', async t => {
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url.startsWith('/api/books?')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ items: [{ title: 'Alpha' }] })); return;
    }
    response.writeHead(404, { 'content-type': 'application/json' }); response.end('{}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });

  const f = fixture({ execute: args => executeBackendCase(args) });
  f.environment.base_url = `http://127.0.0.1:${server.address().port}`;
  f.execution.steps[0].requests[0].assertions[0].value = [{ title: 'Beta' }];
  await f.session.initialize();
  const draft = await f.session.invoke('write_draft', { execution: f.execution, previous_sha256: null });
  const selfTest = await f.session.invoke('self_test', {});
  assert.equal(selfTest.status, 'FAILED');
  assert.equal(selfTest.result.status, 'FAILED');
  assert.equal(selfTest.result.steps[0].requests[0].assertions[0].status, 'FAILED');
  await assert.rejects(() => f.session.invoke('submit_candidate', {
    execution_sha256: draft.draft_sha256, outcome: 'READY', coverage: coverage(),
  }), /BACKEND_SELF_TEST_NOT_READY/);
  await f.session.invoke('review_candidate', {});
  const submitted = await f.session.invoke('submit_candidate', {
    execution_sha256: draft.draft_sha256, outcome: 'BUSINESS_DIFFERENCE', coverage: coverage(),
  });
  assert.equal(submitted.candidate.status, 'BUSINESS_DIFFERENCE');
  assert.equal(submitted.semantic_approval, false);
});

test('real HTTP setup failure, business assertion failure, and cleanup failure have different review outcomes', async t => {
  for (const scenario of ['setupFail', 'businessFail', 'cleanupFail']) await t.test(scenario, async st => {
    const site = await syntheticTarget(st, { [scenario]: true });
    const f = syntheticFixture({ execute: args => executeBackendCase(args) });
    f.environment.base_url = site.base;
    if (scenario === 'businessFail') f.execution.steps[0].requests[0].assertions.find(item => item.pointer === '/items/0/code').value = 'DEV-999';
    await f.session.initialize();
    const draft = await f.session.invoke('write_draft', { execution: f.execution, previous_sha256: null });
    const selfTest = await f.session.invoke('self_test', {});
    if (scenario === 'businessFail') {
      assert.equal(selfTest.status, 'FAILED');
      assert.equal(selfTest.result.steps[0].requests[0].assertions.find(item => item.pointer === '/items/0/code').status, 'FAILED');
      await assert.rejects(() => f.session.invoke('submit_candidate', {
        execution_sha256: draft.draft_sha256, outcome: 'BUSINESS_DIFFERENCE', coverage: syntheticCoverage('missing later evidence'),
      }), /BACKEND_CANDIDATE_COVERAGE_INVALID/);
      await f.session.invoke('review_candidate', {});
      const submitted = await f.session.invoke('submit_candidate', {
        execution_sha256: draft.draft_sha256, outcome: 'BUSINESS_DIFFERENCE', coverage: syntheticCoverage(),
      });
      assert.equal(submitted.candidate.status, 'BUSINESS_DIFFERENCE');
    } else if (scenario === 'setupFail') {
      assert.equal(selfTest.status, 'ERROR');
      assert.equal(selfTest.result.setup[0].status, 'FAILED');
      assert.ok(selfTest.result.steps.every(step => step.status === 'NOT_RUN'));
      await assert.rejects(() => f.session.invoke('submit_candidate', {
        execution_sha256: draft.draft_sha256, outcome: 'BUSINESS_DIFFERENCE', coverage: syntheticCoverage(),
      }), /BACKEND_SELF_TEST_NOT_SUBMITTABLE/);
    } else {
      assert.equal(selfTest.status, 'ERROR');
      assert.equal(selfTest.result.steps[0].status, 'PASSED');
      assert.ok(selfTest.result.cleanup_error);
      await assert.rejects(() => f.session.invoke('submit_candidate', {
        execution_sha256: draft.draft_sha256, outcome: 'BUSINESS_DIFFERENCE', coverage: syntheticCoverage(),
      }), /BACKEND_SELF_TEST_NOT_SUBMITTABLE/);
    }
    assert.ok(site.requests.some(request => request.path === '/__control/namespaces'));
  });
});

test('cancelled self-test is recorded and cannot be replayed by the cancelled session', async () => {
  const controller = new AbortController(); let executions = 0; let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const f = fixture({ signal: controller.signal, execute: async ({ signal }) => {
    executions += 1; markStarted();
    return new Promise(resolve => signal.addEventListener('abort', () => resolve({ ...passed(), status: 'CANCELLED', execution_status: 'CANCELLED', complete_pass: false }), { once: true }));
  } });
  await f.session.initialize();
  await f.session.invoke('write_draft', { execution: f.execution, previous_sha256: null });
  const pending = f.session.invoke('self_test', {}); await started; controller.abort();
  const row = await pending;
  assert.equal(row.status, 'CANCELLED'); assert.equal(executions, 1);
  await assert.rejects(() => f.session.invoke('self_test', {}), /BACKEND_HARNESS_CANCELLED/);
  assert.equal(executions, 1);
});

test('DSH process-spawn count is distinct from provider requests within the session', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-harness-manager-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const spawn of [false, true]) await t.test(spawn ? 'one process spawn with multiple provider events' : 'no process spawn', async () => {
    const f = fixture();
    const manager = new BackendHarnessManager({ root, dshHome: path.join(root, 'dsh-home'),
      configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
      credentialProvider: async () => ({ apiKey: 'synthetic-test-key', baseUrl: 'https://api.example.invalid' }),
      qualityReviewer: noFindings,
      ensureRuntime: async () => {}, execute: async () => passed(),
      runHarness: async options => {
        if (spawn) await options.onLifecycle({ type: 'process_spawn' });
        await options.onLifecycle({ event_type: 'provider_request', call_id: 'synthetic-call-1' });
        await options.onLifecycle({ event_type: 'provider_request', call_id: 'synthetic-call-2' });
        return { events: [{ type: 'provider_request' }, { type: 'provider_request' }], toolCalls: 0,
          processResult: { exitCode: 0, termination: null, outputComplete: true, closeObserved: true, observerError: null } };
      } });
    const result = await manager.start({ plan: f.plan, context: f.context, environment: f.environment,
      signal: new AbortController().signal, persist: async () => {}, assertCurrent: async () => {} });
    assert.equal(result.state.harness_starts, spawn ? 1 : 0);
    assert.equal(result.state.provider_requests, null, 'unknown provider calls must not be inferred from process starts or tool events');
    assert.equal(result.state.provider_usage, null);
  });
});

test('BackendManager cannot confirm a submitted candidate until its Harness session exits', async t => {
  let releaseHarness; const hold = new Promise(resolve => { releaseHarness = resolve; });
  t.after(() => releaseHarness());
  let candidateReady; const ready = new Promise(resolve => { candidateReady = resolve; });
  const f = await backendManagerFixture(t, { runHarness: async (options, getSession, getExecution) => {
    await options.onLifecycle({ type: 'process_spawn' });
    const session = getSession();
    const draft = await session.invoke('write_draft', { execution: getExecution(), previous_sha256: null });
    await session.invoke('self_test', {});
    await session.invoke('review_candidate', {});
    await session.invoke('submit_candidate', { execution_sha256: draft.draft_sha256, outcome: 'READY', coverage: [
      { order: 1, requirement: '唯一记录为DEV-001', request_ids: ['before'], uncovered: '' },
    ] });
    candidateReady();
    await hold;
    return completedHarnessRun();
  } });
  const plan = await f.manager.create(f.projectId, { case_id: f.caseId, case_version: 1, binding_version: 1,
    environment_id: f.environment.environment_id, request_mode: 'generate', generate: true, allow_model: true });
  await ready;
  const during = await f.manager.get(f.projectId, plan.plan_id);
  assert.equal(during.state, 'GENERATING');
  await assert.rejects(() => f.manager.confirm(f.projectId, plan.plan_id, { revision: during.revision, reviewer: 'local-test-reviewer' }), /BACKEND_PLAN_REVISION_CONFLICT/);
  releaseHarness(); await f.manager.completion;
  const finished = await f.manager.get(f.projectId, plan.plan_id);
  assert.equal(finished.state, 'DRAFT');
  assert.equal(finished.generation_session.status, 'COMPLETED');
  const withoutQuality = copy(finished); delete withoutQuality.generation_session.quality_policy;
  await f.manager.save(withoutQuality);
  await assert.rejects(() => f.manager.confirm(f.projectId, plan.plan_id, { revision: finished.revision, reviewer: 'local-test-reviewer' }), /BACKEND_QUALITY_REVIEW_REQUIRED/);
  await f.manager.save(finished);
  assert.equal((await f.manager.confirm(f.projectId, plan.plan_id, { revision: finished.revision, reviewer: 'local-test-reviewer' })).state, 'CONFIRMED');
});

test('service recovery interrupts a persisted GENERATING Harness plan without replaying it', async t => {
  const f = await backendManagerFixture(t);
  const draft = await f.manager.create(f.projectId, { case_id: f.caseId, case_version: 1, binding_version: 1,
    environment_id: f.environment.environment_id, request_mode: 'generate', generate: false, execution: f.structuredExecution });
  const interrupted = { ...draft, state: 'GENERATING', revision: draft.revision + 1,
    generation_session: { status: 'RUNNING', started_at: new Date().toISOString(), finished_at: null, limits: null,
      tool_calls_used: 0, harness_starts: 1, provider_requests: null, provider_usage: null, self_tests: [], candidate: null, error: null } };
  await f.manager.save(interrupted);

  let replayStarts = 0;
  const restarted = new BackendManager({ root: path.join(f.root, 'plans'), caseStore: f.caseStore,
    requirementsManager: f.requirementsManager, runStore: f.runStore,
    harnessManager: { start: async () => { replayStarts += 1; throw new Error('unexpected replay'); } }, execute: f.execute });
  await restarted.init();

  const recovered = await restarted.get(f.projectId, draft.plan_id);
  assert.equal(recovered.state, 'INTERRUPTED');
  assert.equal(recovered.error, 'SERVICE_INTERRUPTED_NO_REPLAY');
  assert.equal(recovered.generation_session.status, 'INTERRUPTED');
  assert.equal(recovered.generation_session.error, 'SERVICE_INTERRUPTED_NO_REPLAY');
  assert.deepEqual(recovered.execution, f.structuredExecution, 'recovery preserves stored candidate bytes for review without executing them');
  assert.equal(replayStarts, 0, 'init recovers durable state and never launches DSH again');
});

test('a complete BUSINESS_DIFFERENCE candidate can be human confirmed and its exact replay remains FAILED', async t => {
  const site = await syntheticTarget(t);
  const f = await backendManagerFixture(t, { environmentBaseUrl: site.base, candidateOutcome: 'BUSINESS_DIFFERENCE',
    execute: args => executeBackendCase(args),
    mutateExecution: execution => { execution.steps[0].requests[0].assertions.find(item => item.pointer === '/items/0/code').value = 'DEV-999'; } });
  const plan = await f.manager.create(f.projectId, { case_id: f.caseId, case_version: 1, binding_version: 1,
    environment_id: f.environment.environment_id, request_mode: 'generate', generate: true, allow_model: true });
  await f.manager.completion;
  const submitted = await f.manager.get(f.projectId, plan.plan_id);
  assert.equal(submitted.generation_session.candidate.status, 'BUSINESS_DIFFERENCE');
  assert.equal(submitted.generation_session.candidate.execution_sha256, backendDigest(submitted.execution));
  assert.equal(submitted.generation_session.self_tests.at(-1).status, 'FAILED');
  const confirmed = await f.manager.confirm(f.projectId, plan.plan_id, { revision: submitted.revision, reviewer: 'local-test-reviewer' });
  assert.equal(confirmed.state, 'CONFIRMED');
  const selection = f.manager.automationIdentity(confirmed);
  const run = await f.manager.start(selection); await f.manager.completions.get(run.run_id);
  const saved = f.runs.get(run.run_id);
  assert.equal(saved.status, 'FAILED');
  assert.equal(saved.test_status, 'FAILED');
  assert.equal(saved.model_calls, 0);
  assert.equal(saved.bundle_sha256, submitted.generation_session.candidate.execution_sha256);
  assert.equal(saved.content_sha256, confirmed.content_sha256);
});

test('revision context carries only the explicit source/feedback, while fresh and regenerate contexts have no old draft', async t => {
  const contexts = new Map();
  const f = await backendManagerFixture(t, { runHarness: async (options, getSession) => {
    await options.onLifecycle({ type: 'process_spawn' });
    const session = getSession();
    const context = await session.invoke('read_context', {});
    contexts.set(session.plan.request_mode, context);
    return completedHarnessRun();
  } });
  const input = { case_id: f.caseId, case_version: 1, binding_version: 1, environment_id: f.environment.environment_id };
  const originalExecution = copy(f.structuredExecution);
  const sourceDraft = await f.manager.create(f.projectId, { ...input, request_mode: 'generate', generate: false, execution: originalExecution });
  const source = await f.manager.confirm(f.projectId, sourceDraft.plan_id, { revision: sourceDraft.revision, reviewer: 'local-test-reviewer' });
  const sourceBytes = JSON.stringify(source.execution);
  const maliciousSeed = copy(originalExecution); maliciousSeed.timeout_ms += 500;
  await assert.rejects(() => f.manager.create(f.projectId, { ...input, request_mode: 'generate', generate: true, allow_model: true, execution: maliciousSeed }), /BACKEND_GENERATED_EXECUTION_INPUT_FORBIDDEN/);
  assert.equal(JSON.stringify((await f.manager.get(f.projectId, source.plan_id)).execution), sourceBytes);

  const revised = await f.manager.create(f.projectId, { ...input, request_mode: 'revise', source_plan_id: source.plan_id,
    feedback: '请重核列表字段映射', generate: true, allow_model: true });
  await f.manager.completion;
  const revisionInput = contexts.get('revise')?.revision_input;
  assert.equal(revisionInput.source_plan_id, source.plan_id);
  assert.equal(revisionInput.source_execution_sha256, backendDigest(source.execution));
  assert.equal(revisionInput.feedback, '请重核列表字段映射');
  assert.deepEqual(revisionInput.source_execution, source.execution);
  assert.equal(revised.execution, null);
  assert.equal(Object.hasOwn(contexts.get('revise'), 'feedback'), false);

  const fresh = await f.manager.create(f.projectId, { ...input, request_mode: 'generate', generate: true, allow_model: true });
  await f.manager.completion;
  assert.equal(fresh.execution, null);
  assert.equal(Object.hasOwn(contexts.get('generate'), 'revision_input'), false);
  assert.equal(contexts.get('generate').execution, null);

  const regenerated = await f.manager.create(f.projectId, { ...input, request_mode: 'regenerate', source_plan_id: source.plan_id, generate: true, allow_model: true });
  await f.manager.completion;
  assert.equal(regenerated.execution, null);
  assert.equal(Object.hasOwn(contexts.get('regenerate'), 'revision_input'), false);
  assert.equal(contexts.get('regenerate').execution, null);
  assert.equal(JSON.stringify((await f.manager.get(f.projectId, source.plan_id)).execution), sourceBytes);
});

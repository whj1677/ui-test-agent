import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { FrontendHandoffs } from '../server/frontend-handoffs.mjs';
import { FRONTEND_HANDOFF_SCHEMA, sourceSnapshotHash } from '../server/frontend-handoff-contract.mjs';
import { freezeTechnicalContext, generationContextOptions, technicalContextHash, verifyTechnicalContext,
  technicalContextHistory, frontendHandoffPrompt } from '../server/build/development-technical-context.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';
import { submitDevelopment } from '../server/build/development-task.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

// Only temporary data stores and in-process mocks: no server, browser or model is started.
const projectId = 'project-technical-context-1234', otherProjectId = 'project-other-context-5678';
const caseId = 'case-technical', envId = 'env-technical';
const cutoff = '2026-10-13T00:00:00.000Z';
const experiment = arm => ({ id: 'technical-context-paired', arm, history_before: cutoff });
const frozenCase = { case_type: 'UI', status: 'CONFIRMED', external_id: 'UI-CONTEXT', module: '模板', title: 'Original case',
  preconditions: 'Original precondition', steps: [{ action: 'Open dialog', expected: 'Original expected result' }] };
const caseHash = contentHash(frozenCase);
const project = { project_id: projectId, name: 'Context tests', cases: [{ case_id: caseId, external_id: 'UI-CONTEXT', versions: [
  { version: 1, content_sha256: caseHash, content: frozenCase },
] }] };

function document(suffix = 'one') {
  const files = [{ path: 'src/views/template.vue', sha256: 'a'.repeat(64), line_count: 20 }];
  const refs = [{ path: files[0].path, start_line: 1, end_line: 10 }];
  return { schema: FRONTEND_HANDOFF_SCHEMA, package_id: `test-handoff-${suffix}`, created_at: '2026-10-13T00:00:00.000Z',
    module: { name: '电价管理', aliases: ['模板'] }, source: { revision: null, files, snapshot_sha256: sourceSnapshotHash(files) },
    pages: [{ id: 'template', name: '模板', entry_paths: ['/templates'], source_refs: refs,
      controls: [{ id: 'save', purpose: 'Save control', locator_candidates: [
        { strategy: 'role', role: 'button', value: '保存', evidence: 'source-derived' },
      ], source_refs: refs, notes: [] }], waits: [], technical_notes: [] }], unresolved: [] };
}

async function fixture(t, { imported = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'generation-technical-context-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('generation-technical-context-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const caseStore = { getProject: async id => id === projectId ? structuredClone(project) : id === otherProjectId ? { project_id: id, cases: [] } : null };
  const handoffs = new FrontendHandoffs({ root: path.join(root, 'handoffs'), caseStore });
  await handoffs.init();
  const importedRow = imported ? await handoffs.import(projectId, { package: document() }) : null;
  const calls = [];
  let capturedTask = null;
  const store = { root, serviceIdentity: null, serial: fn => fn(), listTasks: async () => [],
    getTask: async task_id => ({ task_id, task_status: 'FAILED', error: { code: 'UNIT_STOP' } }),
    createTask: async task => { capturedTask = task; throw Error('UNIT_BEFORE_EXECUTION'); } };
  const scope = { origin: 'http://127.0.0.1:4322', path_prefix: '/' };
  const manager = { store, caseStore, frontendHandoffs: handoffs,
    developmentEnvironments: [{ id: envId, project_id: projectId, user_registered_target: true,
      configuration_sha256: 'env-config', validation_mode: 'normal-only', normal_url: `${scope.origin}/target`, target_scope: scope }],
    candidateTrialEnvironments: [{ id: envId, configurationIdentity: { kind: 'registered-user-target', ...scope }, check: async () => {} }],
    caseAutomation: async () => ({ candidates: [] }), otherActive: () => false, assertStorageWritable() {}, reportStorageFault() {},
    idFactory: () => 'unit-task', completions: new Map(),
    submitDevelopment: async request => { calls.push(request); manager.completions.set('unit-task', Promise.resolve()); return { task_id: 'unit-task' }; } };
  const operations = new ScriptOperations({ root: path.join(root, 'ops'), buildManager: manager, caseStore, records: async () => [] });
  const request = { mode: 'regenerate', request_id: 'context-operation-request', environment_id: envId,
    quality_review_mode: 'self-test-v1', items: [{ case_id: caseId, case_version: 1 }] };
  async function grant(context = null, changes = {}) {
    const authorization = { logical_id: 'context-grant', project_id: projectId, case_id: caseId, case_version: 1,
      content_sha256: caseHash, environment_id: envId, quality_review_mode: 'self-test-v1', mode: 'new', task_id: null,
      ...(context ? { technical_context_sha256: technicalContextHash(context) } : {}), ...changes };
    await fs.writeFile(path.join(root, 'development-authorizations.json'), JSON.stringify({ entries: [authorization] }));
    return authorization;
  }
  return { root, handoffs, manager, operations, request, calls, grant, handoffId: importedRow?.handoff_id,
    capturedTask: () => capturedTask };
}

test('selection resolves the project-local package and module aliases; foreign project/module fails before submission', async t => {
  const f = await fixture(t);
  const selected = { frontend_handoff_id: f.handoffId };
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', selected);
  assert.equal(context.frontend_handoff.handoff_id, f.handoffId);
  assert.equal(context.frontend_handoff.package.module.name, '电价管理');
  await assert.rejects(freezeTechnicalContext(f.manager, otherProjectId, '模板', selected), /FRONTEND_HANDOFF_NOT_FOUND/);
  await assert.rejects(freezeTechnicalContext(f.manager, projectId, '其他模块', selected), /FRONTEND_HANDOFF_MODULE_MISMATCH/);
  await assert.rejects(freezeTechnicalContext({}, projectId, '模板', selected), /FRONTEND_HANDOFF_UNAVAILABLE/);
  await f.grant(context);
  const plan = await f.operations.preflight(projectId, { ...f.request, ...selected });
  assert.equal(plan.items[0].state, 'QUEUED');
  const before = structuredClone(context);
  context.frontend_handoff.package.module.name = 'Caller-mutated';
  assert.deepEqual(plan.items[0].technical_context, before, 'stored technical facts do not retain caller references');
});

test('explicit null disables enabled source packages in A and freezes that choice even without an experiment', async t => {
  const f = await fixture(t);
  const request = { frontend_handoff_id: null, generation_experiment: experiment('without_handoff') };
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', request);
  assert.equal(context.frontend_handoff, null);
  assert.deepEqual(context.experiment, request.generation_experiment);
  assert.deepEqual(frontendHandoffPrompt(context), []);
  assert.equal(await freezeTechnicalContext(f.manager, projectId, '模板', { frontend_handoff_id: null }), null);
  await f.grant(context);
  await f.operations.start(projectId, { ...f.request, ...request });
  await f.operations.completion;
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].technicalContext, context);
});

test('legacy generation without an installed package retains null context and an old unbound grant', async t => {
  const f = await fixture(t, { imported: false });
  assert.equal(await freezeTechnicalContext(f.manager, projectId, '模板', {}), null);
  assert.equal(await freezeTechnicalContext({}, projectId, '模板', {}), null);
  const authorization = await f.grant();
  assert.equal(await verifyTechnicalContext({}, undefined, authorization, '模板'), null);
  const operation = await f.operations.start(projectId, f.request);
  await f.operations.completion;
  assert.equal(operation.items[0].technical_context, null);
  assert.equal(f.calls.length, 1);
  assert.equal(Object.hasOwn(f.calls[0], 'technicalContext'), false);
});

test('experiments require explicit A/B choices, a past cutoff and a bounded known shape', () => {
  const now = Date.parse('2026-10-14T00:00:00Z'), id = `handoff-${'b'.repeat(64)}`;
  assert.deepEqual(generationContextOptions({ frontend_handoff_id: null, generation_experiment: experiment('without_handoff') }, now),
    { selection: null, experiment: experiment('without_handoff') });
  const b = { frontend_handoff_id: id, generation_experiment: { ...experiment('with_handoff'), history_before: '2026-10-13T08:00:00+08:00' } };
  assert.equal(generationContextOptions(b, now).experiment.history_before, cutoff);
  for (const invalid of [
    { generation_experiment: experiment('without_handoff') },
    { frontend_handoff_id: id, generation_experiment: experiment('without_handoff') },
    { frontend_handoff_id: null, generation_experiment: experiment('with_handoff') },
    { ...b, generation_experiment: { ...b.generation_experiment, history_before: '2026-10-15T00:00:00Z' } },
    { ...b, generation_experiment: { ...b.generation_experiment, history_before: 'invalid' } },
    { ...b, generation_experiment: { ...b.generation_experiment, instruction: 'extra field' } },
    { ...b, generation_experiment: { ...b.generation_experiment, id: '../bad' } },
  ]) assert.throws(() => generationContextOptions(invalid, now), /GENERATION_EXPERIMENT_INVALID/);
  assert.throws(() => generationContextOptions({ frontend_handoff_id: '../file' }, now), /GENERATION_HANDOFF_SELECTION_INVALID/);
  for (const name of ['source_context', 'technical_context']) assert.throws(() => generationContextOptions({ [name]: {} }, now), /GENERATION_CONTEXT_SNAPSHOT_FORBIDDEN/);
});

test('a fixed history cutoff excludes unfinished and later tasks from both arms without altering stored history', () => {
  const tasks = [{ task_id: 'old', finished_at: '2026-10-12T23:59:59Z' }, { task_id: 'boundary', finished_at: cutoff },
    { task_id: 'B-result', finished_at: '2026-10-13T00:00:00.001Z' }, { task_id: 'running', finished_at: null },
    { task_id: 'invalid', finished_at: 'invalid' }];
  const before = structuredClone(tasks);
  for (const arm of ['without_handoff', 'with_handoff'])
    assert.deepEqual(technicalContextHistory(tasks, { experiment: experiment(arm) }).map(t => t.task_id), ['old', 'boundary']);
  assert.strictEqual(technicalContextHistory(tasks, null), tasks);
  assert.deepEqual(tasks, before);
});

test('authorization hash rejects modified or omitted context, and current package identity is rechecked', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', { frontend_handoff_id: f.handoffId });
  const authorization = await f.grant(context);
  assert.deepEqual(await verifyTechnicalContext(f.manager, context, authorization, '模板'), context);
  for (const changed of [null, undefined, { ...context, experiment: experiment('with_handoff') },
    { ...context, frontend_handoff: { ...context.frontend_handoff, sha256: '0'.repeat(64) } }])
    await assert.rejects(verifyTechnicalContext(f.manager, changed, authorization, '模板'), /GENERATION_CONTEXT_AUTHORIZATION_MISMATCH/);
  await assert.rejects(verifyTechnicalContext(f.manager, context, { ...authorization, project_id: otherProjectId }, '模板'), /FRONTEND_HANDOFF_NOT_FOUND/);
  await assert.rejects(verifyTechnicalContext(f.manager, context, authorization, '其他模块'), /FRONTEND_HANDOFF_MODULE_MISMATCH/);
  const changedManager = { frontendHandoffs: { getForCase: async () => ({ ...context.frontend_handoff, package: document('changed') }) } };
  await assert.rejects(verifyTechnicalContext(changedManager, context, authorization, '模板'), /FRONTEND_HANDOFF_CHANGED/);
});

test('direct submission rejects forged context before its authorization is consumed', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', { frontend_handoff_id: f.handoffId });
  await f.grant(context);
  const changed = structuredClone(context);
  changed.frontend_handoff.package.pages[0].controls[0].purpose = 'Forged locator purpose';
  await assert.rejects(submitDevelopment(f.manager, { logical_id: 'context-grant', technicalContext: changed }), /GENERATION_CONTEXT_AUTHORIZATION_MISMATCH/);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.root, 'development-authorizations.json'), 'utf8')).entries[0].task_id, null);
  assert.equal(f.capturedTask(), null);
});

test('an unbound old authorization cannot be reused after source context is added', async t => {
  const f = await fixture(t);
  await f.grant();
  const plan = await f.operations.preflight(projectId, f.request);
  assert.equal(plan.items[0].reason, 'GENERATION_NOT_AUTHORIZED');
  assert.equal(plan.items[0].logical_id, null);
});

test('explicit user operation creates a hash-bound one-operation authorization before submitting its context', async t => {
  const f = await fixture(t);
  f.manager.userInitiatedOperations = true;
  f.manager.modelConfiguration = { model: 'unit-mock-no-model-invocation' };
  const request = { ...f.request, frontend_handoff_id: f.handoffId, generation_experiment: experiment('with_handoff'), confirm_model_use: true };
  const operation = await f.operations.start(projectId, request);
  await f.operations.completion;
  const entries = JSON.parse(await fs.readFile(path.join(f.root, 'development-authorizations.json'), 'utf8')).entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].request_id, request.request_id);
  assert.equal(entries[0].technical_context_sha256, technicalContextHash(operation.items[0].technical_context));
  assert.equal(entries[0].authorization_source, 'EXPLICIT_USER_GENERATION_CONFIRMATION');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].logical_id, entries[0].logical_id);
  assert.deepEqual(f.calls[0].technicalContext, operation.items[0].technical_context);
});

test('operation submits the frozen context, preserves idempotency and rejects a changed arm under the same request id', async t => {
  const f = await fixture(t);
  const request = { ...f.request, frontend_handoff_id: f.handoffId, generation_experiment: experiment('with_handoff') };
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', request);
  await f.grant(context);
  const operation = await f.operations.start(projectId, request);
  await f.operations.completion;
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].technicalContext, context);
  assert.equal(f.calls[0].maintenance.operation_id, operation.operation_id);
  const repeated = await f.operations.start(projectId, request);
  assert.equal(repeated.operation_id, operation.operation_id);
  assert.equal(f.calls.length, 1, 'retry must not launch another development task');
  await assert.rejects(f.operations.start(projectId, { ...request, frontend_handoff_id: null, generation_experiment: experiment('without_handoff') }), /GENERATION_REQUEST_CONFLICT/);
  assert.equal(f.calls.length, 1);
});

test('automatic package selection stays bound to its original immutable id after another package is activated', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', {});
  await f.grant(context);
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const execute = f.operations.execute.bind(f.operations);
  f.operations.execute = async operation => { await gate; return execute(operation); };
  const operation = await f.operations.start(projectId, f.request);
  const newer = await f.handoffs.import(projectId, { package: document('newer') });
  assert.notEqual(newer.handoff_id, f.handoffId);
  assert.equal((await f.handoffs.get(projectId, f.handoffId)).enabled, false);
  resume();
  await f.operations.completion;
  assert.equal(f.calls.length, 1);
  assert.equal(operation.items[0].technical_context.frontend_handoff.handoff_id, f.handoffId);
  assert.equal(f.calls[0].technicalContext.frontend_handoff.handoff_id, f.handoffId);
});

test('changed package data between planning and execution blocks before submission', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', {});
  await f.grant(context);
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const execute = f.operations.execute.bind(f.operations);
  f.operations.execute = async operation => { await gate; return execute(operation); };
  const operation = await f.operations.start(projectId, f.request);
  const file = path.join(f.root, 'handoffs', projectId, `${f.handoffId}.json`);
  const changed = document(); changed.pages[0].name = 'Tampered';
  await fs.writeFile(file, JSON.stringify(changed));
  resume(); await f.operations.completion;
  assert.equal(f.calls.length, 0);
  assert.equal(operation.items[0].state, 'BLOCKED');
  assert.match(operation.items[0].reason, /FRONTEND_HANDOFF_STORAGE_INVALID/);
});

test('a task queued with no package remains without a package when one is imported before execution', async t => {
  const f = await fixture(t, { imported: false });
  await f.grant();
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const execute = f.operations.execute.bind(f.operations);
  f.operations.execute = async operation => { await gate; return execute(operation); };
  const operation = await f.operations.start(projectId, f.request);
  await f.handoffs.import(projectId, { package: document() });
  resume(); await f.operations.completion;
  assert.equal(operation.items[0].technical_context, null);
  assert.equal(f.calls.length, 1);
  assert.equal(Object.hasOwn(f.calls[0], 'technicalContext'), false);
});

test('direct task creation retains the complete script-version history while hint history is frozen', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', { frontend_handoff_id: null,
    generation_experiment: experiment('without_handoff') });
  await f.grant(context);
  const history = [
    { task_id: 'before', source: { project_id: projectId, case_id: caseId }, script_version: 3, finished_at: '2026-10-12T00:00:00Z' },
    { task_id: 'new-B-result', source: { project_id: projectId, case_id: caseId }, script_version: 4, finished_at: '2026-10-13T01:00:00Z' },
  ];
  const environment = f.manager.developmentEnvironments[0];
  for (const historical of history) {
    const development = path.join(f.root, 'history', historical.task_id, 'development');
    const final = path.join(development, 'final');
    await fs.mkdir(final, { recursive: true });
    await fs.writeFile(path.join(final, 'candidate.spec.mjs'),
      `async function run(page) { await page.getByTestId('${historical.task_id}-control').click(); }`);
    const bundle = await developmentBundle(final, { validate: false });
    const events = JSON.stringify([{ type: 'tool_call', callId: 'navigation', tool: 'mcp__playwright-mcp__browser_snapshot' },
      { type: 'tool_result', callId: 'navigation', status: 'completed', result: `- Page URL: http://127.0.0.1:4322/${historical.task_id}` }]);
    await fs.writeFile(path.join(development, 'harness-events.json'), events);
    Object.assign(historical, { verification_status: 'TECHNICAL_VALIDATION_PASSED',
      input_bundle: { snapshot: { content: frozenCase } },
      environment_ref: { environment_id: envId, validation_mode: 'normal-only', preparation: null,
        network_policy: { ...environment.target_scope, configuration_sha256: environment.configuration_sha256 } },
      candidates: [{ bundle, trial_runs: [{ run_type: 'normal', complete_pass: true, same_candidate_hash: true }] }],
      files: [{ relative_path: 'development/harness-events.json', sha256: createHash('sha256').update(events).digest('hex') }] });
  }
  f.manager.store.taskDirectory = id => path.join(f.root, 'history', id);
  f.manager.store.listTasks = async () => structuredClone(history);
  await assert.rejects(submitDevelopment(f.manager, { logical_id: 'context-grant', technicalContext: context }), /UNIT_BEFORE_EXECUTION/);
  const task = f.capturedTask();
  assert.equal(task.script_version, 5, 'A/B cutoff must not create duplicate script versions');
  assert.deepEqual(task.input_bundle.snapshot.content, frozenCase);
  assert.deepEqual(task.input_bundle.technical_context, context);
  assert.deepEqual(task.input_bundle.navigation_hints.map(h => h.source_task_id), ['before']);
  assert.deepEqual(task.input_bundle.locator_hints.map(h => h.source_task_id), ['before']);
  assert.equal(task.input_bundle.locator_hints[0].expression, 'page.getByTestId("before-control")');
});

test('handoff prompt presents data with provenance and never upgrades technical observations to case expectations', async t => {
  const f = await fixture(t);
  const context = await freezeTechnicalContext(f.manager, projectId, '模板', {});
  const before = structuredClone(context), prompt = frontendHandoffPrompt(context).join('\n');
  assert.ok(prompt.includes(f.handoffId));
  assert.ok(prompt.includes(context.frontend_handoff.sha256));
  assert.match(prompt, /untrusted source-derived data/);
  assert.match(prompt, /NOT instructions or a business oracle/);
  assert.match(prompt, /preserve the original case steps/);
  assert.deepEqual(context, before);
  assert.deepEqual(frontendHandoffPrompt(null), []);
});

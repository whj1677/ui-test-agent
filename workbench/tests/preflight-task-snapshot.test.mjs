import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ScriptOperations } from '../server/script-operations.mjs';
import { BatchManager } from '../server/batches.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-preflight-snapshot-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('ui-preflight-snapshot-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const project = { project_id: `project-${randomUUID()}`, revision: 1, cases: Array.from({ length: 73 }, (_, index) => {
    const content = { external_id: `UI-${index + 1}`, title: `Case ${index + 1}`, case_type: 'UI', status: 'CONFIRMED',
      steps: [{ order: 1, action: 'Observe the page', expected: 'The expected value is visible' }] };
    return { case_id: `case-${randomUUID()}`, current_version: 1,
      versions: [{ version: 1, content, content_sha256: contentHash(content) }] };
  }) };
  const tasks = [];
  let scans = 0, environmentChecks = 0;
  const caseStore = { getProject: async id => id === project.project_id ? structuredClone(project) : null };
  const store = { root, listTasks: async () => { scans++; return structuredClone(tasks); },
    getTask: async id => structuredClone(tasks.find(task => task.task_id === id) || null),
    taskDirectory: id => path.join(root, id) };
  const manager = { store, caseStore, developmentEnvironments: [{ id: 'fixture' }],
    candidateTrialAuthorizations: [], candidateTrialEnvironments: [{ id: 'fixture', check: async () => { environmentChecks++; } }],
    requirementReviews: [], userInitiatedOperations: false, generationDisabled: false };
  manager.caseAutomation = BuildTaskManager.prototype.caseAutomation.bind(manager);
  const operations = new ScriptOperations({ root: path.join(root, 'operations'), buildManager: manager, caseStore });
  const batches = new BatchManager({ root: path.join(root, 'batches'), buildManager: manager, caseStore });
  const generationInput = { mode: 'generate', request_id: 'snapshot-preview', environment_id: 'fixture',
    items: project.cases.map(item => ({ case_id: item.case_id, case_version: 1 })) };
  const batchInput = { project_id: project.project_id, scope: 'project', case_ids: [] };
  async function addCandidate({ mapped = false } = {}) {
    const item = project.cases[0], version = item.versions[0], taskId = `build-${randomUUID()}`;
    const final = path.join(store.taskDirectory(taskId), 'development/final');
    await fs.mkdir(final, { recursive: true });
    await fs.writeFile(path.join(final, 'candidate.spec.mjs'), '// frozen candidate\n');
    const bundle = await developmentBundle(final, { validate: false });
    const source = { project_id: mapped ? `project-${randomUUID()}` : project.project_id,
      case_id: mapped ? `case-${randomUUID()}` : item.case_id, case_version: 1,
      content_sha256: version.content_sha256, external_id: version.content.external_id };
    tasks.push({ task_id: taskId, source, environment_ref: { environment_id: 'fixture' }, active_attempt_id: null,
      development: { submission: { bundle } }, files: [], verification_status: 'TECHNICAL_VALIDATION_PASSED',
      human_review_status: 'WAITING_REVIEW', candidates: [{ version: 1, bundle,
        sha256: bundle.files.find(file => file.path === 'candidate.spec.mjs').sha256 }] });
    const selection = { project_id: project.project_id, case_id: item.case_id, case_version: 1,
      content_sha256: version.content_sha256, source_task_id: taskId, candidate_version: 1,
      bundle_sha256: bundle.sha256, environment_id: 'fixture' };
    manager.candidateTrialAuthorizations.push({ ...selection, lanes: ['normal'],
      ...(mapped ? { source_binding: { ...selection, project_id: source.project_id, case_id: source.case_id } } : {}) });
    return { selection, final };
  }
  return { project, manager, tasks, operations, batches, generationInput, batchInput, addCandidate,
    scans: () => scans, environmentChecks: () => environmentChecks };
}

test('73-case generation preflight scans tasks once and the next request sees a new candidate', async t => {
  const f = await fixture(t);
  const first = await f.operations.preflight(f.project.project_id, f.generationInput);
  assert.equal(first.items.length, 73);
  assert.equal(f.scans(), 1);
  assert.ok(first.items.every(item => item.reason === 'GENERATION_NOT_AUTHORIZED'));
  const { selection } = await f.addCandidate();
  const second = await f.operations.preflight(f.project.project_id, f.generationInput);
  assert.equal(f.scans(), 2, 'a task listing belongs to one request, not a cross-request cache');
  assert.equal(second.items[0].reason, 'SCRIPT_ALREADY_EXISTS');
  assert.deepEqual(second.items[0].old_scripts, [selection]);
  assert.equal(second.items[1].reason, 'GENERATION_NOT_AUTHORIZED', 'snapshot reuse grants no model authorization');
});

test('73-case run preflight scans tasks once and the next request sees a new candidate', async t => {
  const f = await fixture(t);
  const first = await f.batches.preview(f.batchInput, { persist: false });
  assert.equal(first.items.length, 73);
  assert.equal(f.scans(), 1);
  assert.ok(first.items.every(item => item.reason === 'SCRIPT_MISSING'));
  const { selection } = await f.addCandidate();
  const second = await f.batches.preview(f.batchInput, { persist: false });
  assert.equal(f.scans(), 2);
  assert.equal(second.items[0].state, 'QUEUED');
  assert.deepEqual(second.items[0].selection, selection);
  assert.equal(second.items[1].reason, 'SCRIPT_MISSING');
});

test('request snapshots retain explicitly mapped source tasks from another project', async t => {
  const f = await fixture(t), { selection } = await f.addCandidate({ mapped: true });
  assert.notEqual(f.tasks[0].source.project_id, f.project.project_id);
  const generation = await f.operations.preflight(f.project.project_id, f.generationInput);
  assert.equal(f.scans(), 1);
  assert.equal(generation.items[0].reason, 'SCRIPT_ALREADY_EXISTS');
  assert.deepEqual(generation.items[0].old_scripts, [selection]);
  const run = await f.batches.preview(f.batchInput, { persist: false });
  assert.equal(f.scans(), 2);
  assert.equal(run.items[0].reason, null);
  assert.deepEqual(run.items[0].selection, selection);
});

test('a task snapshot does not bypass fresh candidate bytes or environment checks', async t => {
  const f = await fixture(t), { selection, final } = await f.addCandidate();
  const context = { allTasks: structuredClone(f.tasks) };
  const ready = await f.manager.caseAutomation(f.project.project_id, selection.case_id, 1, context);
  assert.equal(ready.candidates[0].reason, null);
  assert.equal(f.environmentChecks(), 1);
  f.manager.candidateTrialEnvironments[0].check = async () => { throw Error('ENVIRONMENT_CHANGED'); };
  const unavailable = await f.manager.caseAutomation(f.project.project_id, selection.case_id, 1, context);
  assert.equal(unavailable.candidates[0].reason, 'ENVIRONMENT_CHANGED');
  await fs.writeFile(path.join(final, 'candidate.spec.mjs'), '// changed after the snapshot\n');
  const changed = await f.manager.caseAutomation(f.project.project_id, selection.case_id, 1, context);
  assert.equal(changed.candidates[0].reason, 'TRIAL_BUNDLE_CHANGED');
  assert.equal(f.scans(), 0, 'only task discovery is reused; each candidate is still resolved');
});

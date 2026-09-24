import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, E2E01_PROJECT_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { createPaths } from '../server/paths.mjs';

for (const mode of ['normal', 'cancel', 'exception']) test(`production lifecycle final indexing: ${mode}, delayed append and close`, async () => {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-lifecycle-'));
  let manager;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('engineering route fixture', { status: 200 });
  try {
    const paths = createPaths({ localRoot });
    const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
    const library = new CaseLibraryManager(caseStore);
    const project = await library.createProject({ name: 'engineering lifecycle fixture' });
    const uploaded = await library.upload({ fileName: 'cases.json', contentType: 'application/json', body: await fs.readFile(new URL('../examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json', import.meta.url)) });
    const preview = await library.preview(project.project_id, { upload_id: uploaded.upload_id });
    const imported = await library.confirm(project.project_id, preview.preview_id, {});
    const source = imported.project.cases.find((c) => c.external_id === 'TC-001');
    const store = new BuildTaskStore(paths.buildTasksRoot, {
      authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID,
      appendFile: async (...args) => { await new Promise((r) => setTimeout(r, 5)); await fs.appendFile(...args); },
    });
    await store.init();
    let started;
    const ready = new Promise((r) => { started = r; });
    const adapter = {
      ensureHarnessRuntime: async () => ({}),
      runHarnessTask: async ({ candidatePath, onLifecycle, signal }) => {
        await onLifecycle({ type: 'process_spawn', pid: 0 }); started();
        if (mode === 'cancel') await new Promise((r) => signal.aborted ? r() : signal.addEventListener('abort', r, { once: true }));
        // Stream callback is deliberately pending when the last callback begins.
        const pending = onLifecycle({ type: 'output_complete', output_complete: true });
        await onLifecycle({ type: 'process_close', exit_code: 0 }); await pending;
        if (mode === 'exception') throw new Error('engineering exception after stream drain');
        if (mode === 'cancel') throw new Error('engineering cancellation');
        await fs.writeFile(candidatePath, "import {test,expect} from '@playwright/test'; test('fixture',async()=>{});\n");
        return { assessment: { success: true, completed: true, candidateExists: true, exitCode: 0 }, events: [], candidate: { path: candidatePath }, process: { exitCode: 0, closeObserved: true, outputComplete: true } };
      },
      verifyCandidate: async ({ runDirectory }) => {
        await fs.mkdir(runDirectory, { recursive: true });
        const reportPath = path.join(runDirectory, 'playwright-report.json');
        await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status: 'passed', steps: [1, 2, 3].map((n) => ({ title: `CASE_STEP_${n}`, category: 'test.step' })) }] }] }] }] }));
        return { reportPath, process: { exitCode: 0 } };
      },
    };
    manager = new BuildTaskManager({ store, caseStore, paths, adapter, authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID, browserExecutable: 'engineering', useStoredDshCredentials: true });
    const task = await manager.submitProjectCase({ request_id: `case-build-request-lifecycle${mode}`, project_id: project.project_id, case_id: source.case_id, case_version: 1, content_sha256: source.versions[0].content_sha256, environment_id: 'test-site-01-query-v1' });
    await manager.start(task.task_id); await ready;
    if (mode === 'cancel') await manager.stop(task.task_id);
    const result = await manager.wait(task.task_id);
    assert.equal(result.task_status, mode === 'normal' ? 'WAITING_E2E_TRIALS' : mode === 'cancel' ? 'CANCELLED' : 'FAILED');
    const file = result.files.find((f) => f.kind === 'lifecycle_log'); assert.ok(file);
    const bytes = await fs.readFile(path.join(store.taskDirectory(task.task_id), file.relative_path));
    const events = bytes.toString().trim().split('\n').map(JSON.parse);
    const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    console.log(JSON.stringify({ mode, integrity_state: file.integrity_state, registered_bytes: file.bytes, actual_bytes: bytes.length, registered_sha256: file.sha256, actual_sha256: actualHash, last_event: events.at(-1).type, events: events.map((e) => e.type) }));
    assert.equal(file.integrity_state, 'FINALIZED');
    assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, actualHash);
    assert.equal(result.attempts[0].observation.summary.last_event.type, events.at(-1).type);
    assert.equal(result.attempts[0].observation.summary.event_count, events.length);
    await assert.rejects(() => manager.stop(task.task_id), /NOT_ACTIVE/);
    assert.deepEqual(await fs.readFile(path.join(store.taskDirectory(task.task_id), file.relative_path)), bytes);
  } finally { await manager?.settle(); globalThis.fetch = originalFetch; await fs.rm(localRoot, { recursive: true, force: true }); }
});

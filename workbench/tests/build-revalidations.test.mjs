import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildRevalidationStore } from '../server/build/revalidations.mjs';
import { sha256File } from '../server/integrity.mjs';

const temporaryRoots = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-revalidation-'));
  temporaryRoots.push(root);
  const revalidationRoot = path.join(root, 'candidate-revalidations');
  const validationId = 'validation-test-12345678';
  const validationRoot = path.join(revalidationRoot, validationId);
  const taskId = 'build-test-12345678';
  const candidateSha = 'A'.repeat(64);
  const task = {
    task_id: taskId,
    attempts: [{ attempt_id: 'attempt-01-initial' }],
    candidates: [{ version: 1, attempt_id: 'attempt-01-initial', sha256: candidateSha }],
  };
  const buildStore = { async getTask(id) { return id === taskId ? structuredClone(task) : null; } };
  const descriptors = {};
  for (const lane of ['normal', 'negative']) {
    const fileName = lane === 'normal' ? 'test-finished-1.png' : 'test-failed-1.png';
    const screenshot = path.join(validationRoot, lane, 'artifacts', fileName);
    const video = path.join(validationRoot, lane, 'artifacts', 'video.webm');
    const trace = path.join(validationRoot, lane, 'artifacts', 'trace.zip');
    await fs.mkdir(path.dirname(screenshot), { recursive: true });
    await fs.writeFile(screenshot, `${lane}-image`);
    await fs.writeFile(video, `${lane}-video-bytes`);
    await fs.writeFile(trace, `${lane}-trace`);
    descriptors[lane] = [];
    for (const absolute of [screenshot, video, trace]) {
      const stat = await fs.stat(absolute);
      descriptors[lane].push({
        relative_path: path.relative(path.join(validationRoot, lane), absolute).replaceAll('\\', '/'),
        bytes: stat.size,
        sha256: await sha256File(absolute),
      });
    }
  }
  const record = {
    schema: 'workbench/existing-candidate-revalidation-v1', validation_id: validationId,
    source_task_id: taskId, source_attempt_id: 'attempt-01-initial', source_candidate_version: 1,
    candidate_sha256: candidateSha, started_at: '2026-09-21T00:00:00.000Z', finished_at: '2026-09-21T00:01:00.000Z',
    status: 'TECHNICAL_REVALIDATION_PASSED', runtime: { config_path: '<repo>/workbench/config.mjs', consistent: true },
    normal: { report_status: 'COMPLETE', test_status: 'PASSED', test_count: 1, complete_pass: true, process: { exit_code: 0 }, files: descriptors.normal },
    negative: { report_status: 'COMPLETE', test_status: 'FAILED', test_count: 1, complete_pass: false, process: { exit_code: 1 }, specified_mismatch: true,
      error: { type: 'ASSERTION_MISMATCH', expected: 'EXPECTED', actual: 'ACTUAL', message: 'mismatch', attribution: 'PENDING_ANALYSIS' }, files: descriptors.negative },
  };
  await fs.writeFile(path.join(validationRoot, 'revalidation.json'), `${JSON.stringify(record, null, 2)}\n`);
  const store = new BuildRevalidationStore(revalidationRoot, buildStore);
  await store.init();
  return { root, revalidationRoot, validationRoot, validationId, taskId, candidateSha, record, store };
}

test('associates exact task candidate and registers the same record idempotently', async () => {
  const value = await fixture();
  const first = await value.store.register(value.validationId);
  const second = await value.store.register(value.validationId);
  assert.deepEqual(second, first);
  assert.equal((await value.store.listForTask(value.taskId)).length, 1);
  assert.equal(first.source_attempt_id, 'attempt-01-initial');
  assert.equal(first.candidate_sha256, value.candidateSha);
  assert.deepEqual(first.media.map((item) => `${item.lane}:${item.kind}`).sort(), [
    'negative:screenshot', 'negative:trace', 'negative:video', 'normal:screenshot', 'normal:trace', 'normal:video',
  ]);
});

test('rejects candidate hash mismatch and does not associate media across tasks', async () => {
  const value = await fixture();
  value.record.candidate_sha256 = 'B'.repeat(64);
  await fs.writeFile(path.join(value.validationRoot, 'revalidation.json'), `${JSON.stringify(value.record, null, 2)}\n`);
  await assert.rejects(() => value.store.register(value.validationId), /REVALIDATION_SOURCE_CANDIDATE_MISMATCH/);
  value.record.candidate_sha256 = value.candidateSha;
  await fs.writeFile(path.join(value.validationRoot, 'revalidation.json'), `${JSON.stringify(value.record, null, 2)}\n`);
  await value.store.register(value.validationId);
  assert.equal(await value.store.resolveMedia('build-other-12345678', value.validationId, 'normal-video'), null);
});

test('serves only registered unchanged media with byte ranges', async () => {
  const value = await fixture();
  await value.store.register(value.validationId);
  const task = { task_id: value.taskId, candidates: [{ version: 1 }], template: { title: 'fixture' }, created_at: 'now', files: [] };
  const buildStore = { async listTasks() { return [structuredClone(task)]; }, async getTask(id) { return id === value.taskId ? structuredClone(task) : null; } };
  const server = createWorkbenchServer({
    store: { async listAssets() { return []; }, async listRuns() { return []; } },
    buildStore, buildRevalidationStore: value.store,
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const pathRoot = `${base}/api/build/tasks/${value.taskId}/revalidations/${value.validationId}/media`;
    const ranged = await fetch(`${pathRoot}/normal-video`, { headers: { range: 'bytes=0-5' } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get('accept-ranges'), 'bytes');
    assert.equal((await ranged.arrayBuffer()).byteLength, 6);
    assert.equal((await fetch(`${pathRoot}/not-registered`)).status, 404);
    assert.notEqual((await fetch(`${pathRoot}/${encodeURIComponent('../normal-video')}`)).status, 200);
    assert.equal((await fetch(`${base}/api/build/tasks/build-other-12345678/revalidations/${value.validationId}/media/normal-video`)).status, 404);

    const video = path.join(value.validationRoot, 'normal', value.record.normal.files.find((item) => item.relative_path.endsWith('.webm')).relative_path);
    const original = await fs.readFile(video);
    await fs.rm(video);
    assert.equal((await fetch(`${pathRoot}/normal-video`)).status, 404);
    await fs.writeFile(video, Buffer.from(original).fill(0x78));
    assert.equal((await fetch(`${pathRoot}/normal-video`)).status, 409);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

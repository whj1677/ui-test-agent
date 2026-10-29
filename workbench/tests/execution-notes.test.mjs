import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExecutionNotes } from '../server/execution-notes.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'execution-notes-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const record = { project_id: 'project-one', run_id: 'run-one', executed_case_id: 'case-one', executed_case_version: 3,
    source_build_task_id: 'build-one', candidate_version: 2, bundle_sha256: 'a'.repeat(64), environment_id: 'environment-one',
    status: 'FAILED', result: { test_status: 'FAILED', error: { message: 'original error' } } };
  const original = JSON.stringify(record), root = path.join(directory, 'notes');
  const getRecords = async projectId => {
    if (projectId === 'project-missing') throw Error('CASE_PROJECT_NOT_FOUND');
    return projectId === 'project-one' ? [record] : [];
  };
  return { directory, root, record, original, getRecords, notes: new ExecutionNotes({ root, getRecords }) };
}

test('observation stores plain text and frozen references without changing original run evidence', async t => {
  const f = await fixture(t), text = '<img src=x onerror=alert(1)> 观察到超时，原因待查';
  assert.deepEqual(await f.notes.list('project-one', 'run-one'), { notes: [] });
  const note = await f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text });
  assert.equal(note.text, text); assert.equal(note.status, 'NEEDS_ANALYSIS');
  assert.deepEqual(note.binding, { project_id: 'project-one', run_id: 'run-one', case_id: 'case-one', case_version: 3,
    source_task_id: 'build-one', candidate_version: 2, bundle_sha256: 'a'.repeat(64), environment_id: 'environment-one', original_status: 'FAILED' });
  assert.ok(Number.isFinite(Date.parse(note.created_at)));
  assert.equal(JSON.stringify(f.record), f.original);
  assert.deepEqual((await f.notes.list('project-one', 'run-one')).notes, [note]);
  assert.deepEqual((await new ExecutionNotes({ root: f.root, getRecords: f.getRecords }).list('project-one', 'run-one')).notes, [note]);
});

test('project/run ownership and safe paths are checked before any write', async t => {
  const f = await fixture(t), input = { request_id: randomUUID(), text: '观察' };
  await assert.rejects(f.notes.append('project-other', 'run-one', input), /RUN_NOT_FOUND/);
  await assert.rejects(f.notes.list('project-missing', 'run-one'), /CASE_PROJECT_NOT_FOUND/);
  await assert.rejects(f.notes.append('project-one', 'run-missing', input), /RUN_NOT_FOUND/);
  for (const scope of [['../project-one', 'run-one'], ['project-one', '../run-one'], ['project-one', 'run/one']]) {
    await assert.rejects(f.notes.append(...scope, input), /SCOPE_INVALID/);
  }
  const misleading = new ExecutionNotes({ root: f.root, getRecords: async () => [{ ...f.record, project_id: 'project-other' }] });
  await assert.rejects(misleading.append('project-one', 'run-one', input), /RUN_NOT_FOUND/);
  await assert.rejects(fs.stat(f.root), { code: 'ENOENT' });
});

test('UUID payload retries replay original note and conflicting text cannot overwrite it', async t => {
  const f = await fixture(t), input = { request_id: randomUUID(), text: '第一次观察' };
  const first = await f.notes.append('project-one', 'run-one', input);
  assert.deepEqual(await f.notes.append('project-one', 'run-one', input), first);
  await assert.rejects(f.notes.append('project-one', 'run-one', { ...input, text: '不同观察' }), /REQUEST_CONFLICT/);
  assert.deepEqual((await f.notes.list('project-one', 'run-one')).notes, [first]);
  assert.equal(JSON.stringify(f.record), f.original);
});

test('independent concurrent writers preserve distinct notes and replay same UUID atomically', async t => {
  const f = await fixture(t), second = new ExecutionNotes({ root: f.root, getRecords: f.getRecords });
  const identical = { request_id: randomUUID(), text: '同一次请求' };
  const results = await Promise.all([f.notes.append('project-one', 'run-one', identical), second.append('project-one', 'run-one', identical),
    f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text: '另一观察' })]);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await f.notes.list('project-one', 'run-one')).notes.length, 2);
  const conflictId = randomUUID();
  const raced = await Promise.allSettled([f.notes.append('project-one', 'run-one', { request_id: conflictId, text: 'A' }), second.append('project-one', 'run-one', { request_id: conflictId, text: 'B' })]);
  assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(raced.find(result => result.status === 'rejected').reason.message, /REQUEST_CONFLICT/);
  assert.equal((await f.notes.list('project-one', 'run-one')).notes.length, 3);
  assert.equal(JSON.stringify(f.record), f.original);
});

test('invalid input, unreadable storage and corrupt notes are rejected without false success', async t => {
  const f = await fixture(t);
  for (const input of [{ request_id: 'not-uuid', text: '观察' }, { request_id: randomUUID(), text: ' ' }, { request_id: randomUUID(), text: 'x'.repeat(4001) }, { request_id: randomUUID(), text: '观察', status: 'PASSED' }]) {
    await assert.rejects(f.notes.append('project-one', 'run-one', input), /INPUT_INVALID/);
  }
  await fs.writeFile(f.root, 'not a directory');
  await assert.rejects(f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text: '观察' }), /STORAGE_ERROR/);
  await assert.rejects(f.notes.list('project-one', 'run-one'), /STORAGE_ERROR/);
  await fs.unlink(f.root);
  const note = await f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text: '观察' });
  await fs.writeFile(path.join(f.root, 'project-one', 'run-one', `${note.request_id}.json`), '{broken');
  await assert.rejects(f.notes.list('project-one', 'run-one'), /STORAGE_ERROR/);
  await assert.rejects(f.notes.append('project-one', 'run-one', { request_id: note.request_id, text: '观察' }), /STORAGE_ERROR/);
});

test('an existing successful run may receive an observation without changing its result', async t => {
  const f = await fixture(t); f.record.status = 'PASSED'; f.record.result.test_status = 'PASSED';
  const before = JSON.stringify(f.record);
  const note = await f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text: '补充观察，不作为失败归因' });
  assert.equal(note.status, 'NEEDS_ANALYSIS'); assert.equal(note.binding.original_status, 'PASSED');
  assert.equal(JSON.stringify(f.record), before);
});

test('a junction cannot redirect note writes outside the dedicated storage root', async t => {
  const f = await fixture(t), outside = path.join(f.directory, 'outside');
  await fs.mkdir(f.root); await fs.mkdir(outside);
  await fs.symlink(outside, path.join(f.root, 'project-one'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.notes.append('project-one', 'run-one', { request_id: randomUUID(), text: '观察' }), /STORAGE_ERROR/);
  assert.deepEqual(await fs.readdir(outside), []);
});

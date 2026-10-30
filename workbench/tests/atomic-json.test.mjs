import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeAtomicJson, writeAtomicJsonLine } from '../server/atomic-json.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { RequirementsStore } from '../server/requirements/store.mjs';
import { CaseAssistantStore } from '../server/case-assistant/store.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-atomic-json-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('shared writers preserve existing JSON byte formats and exclusive temporary creation', async t => {
  const root = await fixture(t), value = { name: '中文记录', revision: 2 };
  const writes = [];
  const io = { ...fs, writeFile: async (file, content, options) => {
    writes.push({ file, options }); return fs.writeFile(file, content, options);
  } };
  await writeAtomicJson(path.join(root, 'plain.json'), value, io);
  await writeAtomicJsonLine(path.join(root, 'line.json'), value, io);
  assert.equal(await fs.readFile(path.join(root, 'plain.json'), 'utf8'), JSON.stringify(value, null, 2));
  assert.equal(await fs.readFile(path.join(root, 'line.json'), 'utf8'), `${JSON.stringify(value, null, 2)}\n`);
  assert.deepEqual(writes.map(write => write.options), [{ flag: 'wx' }, { flag: 'wx' }]);
  assert.notEqual(writes[0].file, writes[1].file);
  assert.deepEqual((await fs.readdir(root)).sort(), ['line.json', 'plain.json']);
});

for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
  test(`${code}: transient lock retries and then replaces the complete record`, async t => {
    const root = await fixture(t), file = path.join(root, 'record.json'), waits = [];
    await fs.writeFile(file, 'old-record');
    let attempts = 0;
    const io = { ...fs, rename: async (...args) => {
      if (++attempts <= 2) throw Object.assign(Error('locked'), { code });
      return fs.rename(...args);
    } };
    await writeAtomicJsonLine(file, { revision: 2 }, io, async ms => { waits.push(ms); });
    assert.equal(await fs.readFile(file, 'utf8'), '{\n  "revision": 2\n}\n');
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [20, 40]);
    assert.deepEqual(await fs.readdir(root), ['record.json']);
  });
}

for (const [code, expectedAttempts] of [['EACCES', 8], ['ENOSPC', 1]]) {
  test(`${code}: failed replacement preserves the old record and removes its temporary file`, async t => {
    const root = await fixture(t), file = path.join(root, 'record.json'), waits = [];
    await fs.writeFile(file, 'old-record');
    const failure = Object.assign(Error('replacement-failed'), { code });
    let attempts = 0;
    const io = { ...fs, rename: async () => { attempts++; throw failure; } };
    await assert.rejects(writeAtomicJsonLine(file, { revision: 2 }, io, async ms => { waits.push(ms); }), error => error === failure);
    assert.equal(attempts, expectedAttempts);
    assert.equal(waits.length, expectedAttempts - 1);
    assert.equal(await fs.readFile(file, 'utf8'), 'old-record');
    assert.deepEqual(await fs.readdir(root), ['record.json']);
  });
}

test('case, build, requirements and assistant stores retain newline-terminated records', async t => {
  const root = await fixture(t);
  const caseStore = new CaseLibraryStore(path.join(root, 'cases')); await caseStore.init();
  const project = await caseStore.createProject({ name: '持久化兼容检查' });
  const buildStore = new BuildTaskStore(path.join(root, 'build')); await buildStore.init();
  const requirementsStore = new RequirementsStore(path.join(root, 'requirements')); await requirementsStore.init();
  const design = { design_id: 'design-11111111-1111-1111-1111-111111111111', project_id: project.project_id, revision: 1 };
  await requirementsStore.createDesign(project.project_id, design);
  const assistantStore = new CaseAssistantStore(path.join(root, 'assistant')); await assistantStore.init();
  const conversation = { id: 'conversation-22222222-2222-2222-2222-222222222222', project_id: project.project_id, turns: [], messages: [] };
  await assistantStore.write(conversation);
  for (const [file, value] of [
    [path.join(caseStore.projectDirectory(project.project_id), 'project.json'), project],
    [buildStore.budgetFile, await buildStore.getBudget()],
    [path.join(requirementsStore.designRoot(project.project_id, design.design_id), 'current.json'), design],
    [assistantStore.file(project.project_id, conversation.id), conversation],
  ]) assert.equal(await fs.readFile(file, 'utf8'), `${JSON.stringify(value, null, 2)}\n`);
});

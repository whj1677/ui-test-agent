import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { runLab } from '../scripts/autonomous-lab.mjs';
import { readFrozenHeldout, startVerifiedHeldoutFixture } from '../scripts/heldout-fixture.mjs';
import { importCases, mechanicalIssues } from '../src/importer.mjs';
import { Store } from '../src/store.mjs';

test('isolated heldout harness authenticates without credentials and never passes offline oracle', async () => {
  const inputs = [];
  const provider = {
    baseURL: 'https://api.deepseek.com',
    model: 'engineering-injected',
    configured: () => true,
    json: async (prompt, input) => {
      inputs.push({ prompt, input });
      throw Object.assign(new Error('ENGINEERING_EXPECTED_STOP'), {
        code: 'ENGINEERING_EXPECTED_STOP',
      });
    },
    close: async () => {},
  };
  const result = await runLab({
    realModel: true,
    suite: 'heldout',
    caseIds: ['HOLD-F1'],
    maxCalls: 1,
    maxMinutes: 1,
    modelProvider: provider,
  });
  assert.equal(result.model_mode, 'ENGINEERING_INJECTED');
  assert.equal(result.budget.calls, 1);
  assert.equal(result.fixture.url, 'http://localhost:4198');
  assert.equal(result.oracle_input_to_model, false);
  assert.equal(result.tasks.length, 1);
  assert.equal(inputs.length, 1);
  const serialized = JSON.stringify(inputs);
  for (const secret of [
    'failing_step_id',
    'expected_result',
    '320 kW',
    'pointer interceptor',
    'HOLD-F2',
  ])
    assert.equal(serialized.includes(secret), false, secret);
  const store = new Store(result.directory + '/product-data'),
    id = result.tasks[0].id;
  const task = await store.read(id),
    baseline = await store.baseline(id);
  assert.equal(task.target, 'http://localhost:4198/');
  assert.equal(task.authorization.writes, false);
  assert.deepEqual(
    baseline.cases[0],
    (await readFrozenHeldout()).cases.find((c) => c.case_id === 'HOLD-F1'),
  );
  assert.equal(task.cases[0].attempts.length, 0);
  assert.notEqual(task.cases[0].status, 'PASS_ASSERTIONS');
});

test('independent frozen cases import unchanged and stay separate from original32', async () => {
  const f = await readFrozenHeldout();
  assert.equal(f.cases.length, 8);
  const bytes = await fs.readFile(new URL('../heldout-lab/cases.json', import.meta.url));
  const imported = await importCases('heldout.json', bytes);
  assert.deepEqual(imported.cases, f.cases);
  assert.deepEqual(imported.cases.flatMap(mechanicalIssues), []);
  assert.deepEqual(await runLab({ suite: 'heldout' }), {
    state: 'PREFLIGHT_ONLY',
    cases: 8,
    frozen_files: 17,
    model_calls: 0,
  });
  assert.equal((await runLab({ suite: 'all' })).cases, 32);
  const selected = await runLab({ suite: 'heldout', caseIds: ['HOLD-M2', 'HOLD-F1'] });
  assert.deepEqual(selected.selected_case_ids, ['HOLD-F1', 'HOLD-M2']);
  await assert.rejects(
    runLab({ suite: 'heldout', caseIds: ['LAB-V01'] }),
    /INVALID_CASE_SELECTION/,
  );
  await assert.rejects(runLab({ suite: 'all', caseIds: ['HOLD-Q1'] }), /INVALID_CASE_SELECTION/);
});
test('served fixture permits HTML only, blocks oracle/source/writes, and verifies reuse', async (t) => {
  const f = await startVerifiedHeldoutFixture(0);
  t.after(() => f.close());
  await f.verify();
  const port = Number(new URL(f.url).port),
    reuse = await startVerifiedHeldoutFixture(port);
  assert.equal(reuse.reused, true);
  await reuse.close();
  await f.verify();
  for (const route of [
    '/oracle.json',
    '/cases.json',
    '/manifest.json',
    '/serve.mjs',
    '/reference.test.mjs',
    '/index.html',
    '/probe/q3',
    '/probe/q1?x=1',
  ])
    assert.equal((await fetch(f.url + route)).status, 404, route);
  assert.equal((await fetch(f.url + '/', { method: 'POST' })).status, 405);
  const html = await fetch(f.url + '/');
  assert.match(html.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(html.headers.get('content-security-policy'), /script-src 'sha256-/);
  assert.equal((await fetch(f.url + '/', { method: 'HEAD' })).status, 200);
  assert.equal(
    await new Promise((resolve, reject) => {
      http
        .get({ hostname: '127.0.0.1', port, path: '/', headers: { Host: 'example.test' } }, (r) => {
          r.resume();
          resolve(r.statusCode);
        })
        .on('error', reject);
    }),
    421,
  );
});
test('unrelated service on selected port cannot be accepted as synthetic fixture', async (t) => {
  const s = http.createServer((q, r) => {
    r.writeHead(200, { 'content-type': 'application/json' });
    r.end(JSON.stringify({ site: 'heldout-lab', version: 1 }));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => s.close(r)));
  await assert.rejects(startVerifiedHeldoutFixture(s.address().port), /HELDOUT_FIXTURE_MISMATCH/);
});

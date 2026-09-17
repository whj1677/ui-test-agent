import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { startFixture, sites } from '../acceptance/serve.mjs';
import { importCases } from '../src/importer.mjs';
import { verifyManifest } from '../acceptance/check.mjs';

const asset = (name) => new URL(`../acceptance/${name}`, import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('controlled artifact manifest detects any byte drift', async () => {
  const result = await verifyManifest();
  assert.equal(result.cases, 24);
  assert.ok(result.files >= 15);
});
test('frozen baseline imports 24 unique cases without changing source semantics', async () => {
  const ids = [];
  for (const site of sites) {
    const bytes = await readFile(asset(`cases/${site}.json`));
    const original = JSON.parse(bytes);
    const imported = await importCases(`${site}.json`, bytes);
    assert.deepEqual(imported, original);
    assert.equal(imported.cases.length, 8);
    assert.equal(imported.case_count, 8);
    for (const c of imported.cases) {
      ids.push(c.case_id);
      assert.ok(c.steps.every((s) => s.action && s.expected));
      assert.ok(c.preconditions.length);
    }
  }
  assert.equal(new Set(ids).size, 24);
});
test('classification freezes 19 normal, 3 defects and 2 boundaries; only two write cases', async () => {
  const oracle = JSON.parse(await readFile(asset('oracle.json')));
  const counts = {};
  const ids = [];
  for (const site of sites)
    ids.push(
      ...JSON.parse(await readFile(asset(`cases/${site}.json`))).cases.map((c) => c.case_id),
    );
  assert.deepEqual(oracle.cases.map((c) => c.case_id).sort(), ids.sort());
  for (const c of oracle.cases) counts[c.expected_outcome] = (counts[c.expected_outcome] || 0) + 1;
  assert.deepEqual(counts, { SUCCESS: 19, PRODUCT_DEFECT: 3, AUTHORIZATION_BLOCK: 2 });
  assert.deepEqual(
    oracle.cases.filter((c) => c.writes).map((c) => c.case_id),
    ['REQS-005', 'REQS-006'],
  );
});
test('original eight cases and target HTML remain byte-identical to frozen historical inputs', async () => {
  assert.equal(
    digest(await readFile(asset('cases/devices.json'))),
    '3770932d3cf997faaf56f9d6a565b4012f53eeea80b033e4e46183aa22f4efbb',
  );
  assert.equal(
    digest(await readFile(asset('fixtures/devices/index.html'))),
    '0f59e366d120a49e9718c59c582a712e9e117d8def4cc95acc89c1bdc1841775',
  );
});
test('HTTP whitelist never serves cases, oracle, source harness, traversal, or unknown SPA fallback', async (t) => {
  for (const site of sites) {
    const f = await startFixture({ site });
    t.after(() => f.close());
    assert.equal((await fetch(f.origin)).status, 200);
    for (const pathname of [
      '/oracle.json',
      '/cases.json',
      '/cases/devices.json',
      '/serve.mjs',
      '/tests/acceptance-fixtures.integration.mjs',
      '/%2e%2e/oracle.json',
      '/not-found',
      '/%2e%2e%2f%2e%2e%2fsrc/server.mjs',
    ]) {
      assert.equal((await fetch(f.origin + pathname)).status, 404, `${site}:${pathname}`);
    }
    const page = await fetch(f.origin);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(page.headers.get('access-control-allow-origin'), null);
    assert.equal(
      (await fetch(f.origin, { headers: { origin: 'https://external.invalid' } })).status,
      403,
    );
    // Fetch normalizes Host; use the native transport to actually send the negative header.
    const status = await new Promise((resolve, reject) => {
      const request = http.get(f.origin, { headers: { host: 'external.invalid' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      request.on('error', reject);
    });
    assert.equal(status, 403);
  }
});
test('synthetic CRUD validates auth, field bounds, media type, size and exact duplicate ownership', async (t) => {
  const f = await startFixture();
  t.after(() => f.close());
  const endpoint = f.origin + '/api/requests';
  const headers = {
    cookie: 'requests_demo=1',
    'content-type': 'application/json',
    origin: f.origin,
  };
  const body = {
    name: '回归专用申请甲',
    project: '青岚站',
    applicant: '合成测试员',
    category: '检修工具',
    quantity: 2,
  };
  const post = (payload) =>
    fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { method: 'POST', body: JSON.stringify(body) })).status, 401);
  assert.equal(
    (await fetch(endpoint, { method: 'POST', headers: { cookie: 'requests_demo=1' }, body: '{}' }))
      .status,
    415,
  );
  assert.equal((await fetch(endpoint, { method: 'POST', headers, body: '[' })).status, 400);
  assert.equal(
    (await fetch(endpoint, { method: 'POST', headers, body: 'x'.repeat(9000) })).status,
    413,
  );
  for (const quantity of [0, 21, 1.2, '2', null])
    assert.equal((await post({ ...body, quantity })).status, 400);
  assert.equal((await post({ ...body, project: '远川站' })).status, 400);
  assert.equal((await post({ ...body, name: '' })).status, 400);
  assert.equal(f.inspect().mutations.length, 0);
  const response = await post(body);
  assert.equal(response.status, 201);
  const { record } = await response.json();
  assert.equal(record.total, 120);
  assert.equal((await post(body)).status, 409);
  assert.equal(
    (await fetch(`${endpoint}/${record.id}`, { method: 'PATCH', headers, body: '{"quantity":3}' }))
      .status,
    200,
  );
  assert.equal(f.inspect().records.find((r) => r.id === record.id).total, 180);
  assert.equal(
    (await fetch(`${endpoint}/${record.id}`, { method: 'DELETE', headers })).status,
    200,
  );
  assert.deepEqual(
    f.inspect().records.map((r) => r.name),
    ['例行工具申请', '回归专用申请甲（勿删）'],
  );
  assert.deepEqual(
    f.inspect().mutations.map((m) => m.method),
    ['POST', 'PATCH', 'DELETE'],
  );
});
test('seed records reject mutation and independent server instances reset all CRUD state', async (t) => {
  const f = await startFixture(),
    other = await startFixture();
  t.after(async () => {
    await f.close();
    await other.close();
  });
  const initial = f.inspect().records;
  const headers = { cookie: 'requests_demo=1', 'content-type': 'application/json' };
  for (const record of initial)
    for (const method of ['PATCH', 'DELETE'])
      assert.equal(
        (
          await fetch(`${f.origin}/api/requests/${record.id}`, {
            method,
            headers,
            ...(method === 'PATCH' ? { body: '{"quantity":4}' } : {}),
          })
        ).status,
        403,
      );
  await fetch(`${f.origin}/api/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: '实例隔离样本',
      project: '青岚站',
      applicant: '隔离员',
      category: '检修工具',
      quantity: 1,
    }),
  });
  assert.equal(f.inspect().records.length, 3);
  assert.deepEqual(other.inspect(), { records: initial, mutations: [] });
  assert.deepEqual(
    f.inspect().records.filter((r) => r.protected),
    initial,
  );
  const snapshot = f.inspect();
  snapshot.records[0].name = '外部引用不能改状态';
  assert.deepEqual(
    f.inspect().records.filter((r) => r.protected),
    initial,
  );
});

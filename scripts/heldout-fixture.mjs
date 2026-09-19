// Maintenance-only independent frozen synthetic set. No oracle enters model input.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startHeldoutLab, heldoutRoutes } from '../heldout-lab/serve.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = [
  'index.html',
  'cases.json',
  'oracle.json',
  'serve.mjs',
  'reference.test.mjs',
  'README.md',
];
export async function readFrozenHeldout() {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../heldout-lab/manifest.json', import.meta.url), 'utf8'),
  );
  if (
    manifest.origin !== 'http://localhost:4198' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== files.length ||
    new Set(manifest.files.map((f) => f.path)).size !== files.length
  )
    throw Error('INVALID_HELDOUT_MANIFEST');
  for (const item of manifest.files) {
    if (!files.includes(item.path)) throw Error('INVALID_HELDOUT_MANIFEST');
    if (
      hash(await fs.readFile(new URL('../heldout-lab/' + item.path, import.meta.url))) !==
      item.sha256
    )
      throw Error('HELDOUT_FREEZE_MISMATCH');
  }
  const baseline = JSON.parse(
    await fs.readFile(new URL('../heldout-lab/cases.json', import.meta.url), 'utf8'),
  );
  const expectedIds = [
    'HOLD-Q1',
    'HOLD-Q2',
    'HOLD-F1',
    'HOLD-F2',
    'HOLD-M1',
    'HOLD-M2',
    'HOLD-S1',
    'HOLD-S2',
  ];
  if (JSON.stringify(baseline.cases.map((c) => c.case_id)) !== JSON.stringify(expectedIds))
    throw Error('HELDOUT_CASES_MISMATCH');
  if (
    baseline.cases.some(
      (c) =>
        c.page_entry_url !== manifest.origin + '/probe/' + c.case_id.slice(5).toLowerCase() ||
        c.read_only_scope !== true ||
        c.synthetic_login !== 'none_required',
    )
  )
    throw Error('HELDOUT_CASES_MISMATCH');
  return { manifest, cases: baseline.cases };
}
export async function startVerifiedHeldoutFixture(port = 4198) {
  const { manifest } = await readFrozenHeldout();
  const expected = manifest.files.find((f) => f.path === 'index.html').sha256;
  const verify = async (url) => {
    const get = async (route) => {
      const response = await fetch(url + route, {
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw Error('HELDOUT_FIXTURE_MISMATCH');
      return response;
    };
    const health = await (await get('/healthz')).json();
    if (health.site !== 'heldout-lab' || health.version !== 1)
      throw Error('HELDOUT_FIXTURE_MISMATCH');
    for (const route of heldoutRoutes)
      if (hash(Buffer.from(await (await get(route)).arrayBuffer())) !== expected)
        throw Error('HELDOUT_FIXTURE_MISMATCH');
  };
  let fixture;
  try {
    fixture = await startHeldoutLab(port);
  } catch (error) {
    if (!port || error.code !== 'EADDRINUSE') throw error;
    const url = `http://localhost:${port}`;
    await verify(url);
    fixture = { url, close: async () => {}, reused: true };
  }
  return { ...fixture, reused: fixture.reused === true, verify: () => verify(fixture.url) };
}

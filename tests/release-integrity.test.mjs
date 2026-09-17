import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCandidate, verifyCandidate } from '../src/distribution.mjs';
import { readBuildInfo } from '../src/build-info.mjs';
import { inspectEnvironment } from '../src/installation.mjs';

const failure = { code: 'CANDIDATE_INTEGRITY_FAILED' };
async function fixture(t, actual = false) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-integrity-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source');
  const root = path.join(directory, 'candidate');
  await fs.mkdir(path.join(source, 'src', 'nested'), { recursive: true });
  for (const [name, content] of Object.entries({
    'package.json': JSON.stringify({ version: '0.4.0-beta.1' }),
    'package-lock.json': '{}',
    'src/nested/runtime.mjs': 'export const marker = 1;',
    '试用说明.md': '# 合成安装说明\n',
  }))
    await fs.writeFile(path.join(source, name), content);
  const manifest = actual ? await createCandidate(root) : await createCandidate(root, source);
  return { directory, root, manifest, build: await readBuildInfo(root) };
}

const integrity = (report) => report.checks.find((check) => check.name === '候选包摘要');
const doctor = (root) => inspectEnvironment({ root, probeBrowser: false });

test('complete real candidate verifies every delivered file, including the handbook', async (t) => {
  const { root, manifest } = await fixture(t, true);
  assert.ok(manifest.files.length > 20);
  assert.ok(manifest.files.some((entry) => entry.file === '试用说明.md'));
  assert.deepEqual(await verifyCandidate(root, manifest), { file_count: manifest.files.length });
  assert.equal(integrity(await doctor(root)).ready, true);
});

test('handbook changes do not change runtime identity but must fail candidate inspection', async (t) => {
  const { root, manifest, build } = await fixture(t);
  await fs.appendFile(path.join(root, '试用说明.md'), '\nSYNTHETIC DAMAGE');
  assert.equal((await readBuildInfo(root)).build_id, build.build_id);
  await assert.rejects(verifyCandidate(root, manifest), failure);
  assert.equal(integrity(await doctor(root)).ready, false);
});

test('a missing listed handbook is not silently treated as a source checkout', async (t) => {
  const { root, manifest, build } = await fixture(t);
  await fs.unlink(path.join(root, '试用说明.md'));
  assert.equal((await readBuildInfo(root)).build_id, build.build_id);
  await assert.rejects(verifyCandidate(root, manifest), failure);
  const report = await doctor(root);
  assert.equal(integrity(report).ready, false);
  assert.equal(report.ready, false);
});

test('source checkout without a release manifest retains the non-candidate path', async (t) => {
  const { root } = await fixture(t);
  await fs.unlink(path.join(root, 'release-manifest.json'));
  assert.equal(integrity(await doctor(root)), undefined);
});

test('runtime mutation or added runtime file cannot keep the old candidate identity', async (t) => {
  for (const name of ['src/nested/runtime.mjs', 'src/extra.mjs'])
    await t.test(name, async (t) => {
      const { root, manifest, build } = await fixture(t);
      await fs.writeFile(path.join(root, name), 'SYNTHETIC MODIFICATION');
      assert.notEqual((await readBuildInfo(root)).build_id, build.build_id);
      await assert.rejects(verifyCandidate(root, manifest), failure);
    });
});

test('manifest metadata and exact inventory are checked before reading listed paths', async (t) => {
  const changes = [
    ['null manifest', () => null],
    ['array manifest', () => []],
    ['wrong schema', (m) => ({ ...m, schema_version: 'future/v2' })],
    ['wrong application', (m) => ({ ...m, application: 'other' })],
    ['wrong version', (m) => ({ ...m, version: '999' })],
    ['wrong build', (m) => ({ ...m, build_id: '0'.repeat(64) })],
    ['wrong release status', (m) => ({ ...m, release_status: 'RELEASED' })],
    ['missing files', (m) => ({ ...m, files: undefined })],
    ['files object', (m) => ({ ...m, files: {} })],
    ['missing entry', (m) => ({ ...m, files: m.files.slice(1) })],
    ['extra entry', (m) => ({ ...m, files: [...m.files, m.files[0]] })],
    [
      'duplicate replaces required entry',
      (m) => {
        m.files[1] = m.files[0];
        return m;
      },
    ],
    [
      'null entry',
      (m) => {
        m.files[0] = null;
        return m;
      },
    ],
    [
      'non-string path',
      (m) => {
        m.files[0].file = 123;
        return m;
      },
    ],
    [
      'missing hash',
      (m) => {
        delete m.files[0].sha256;
        return m;
      },
    ],
    [
      'non-string hash',
      (m) => {
        m.files[0].sha256 = 123;
        return m;
      },
    ],
    [
      'invalid hash',
      (m) => {
        m.files[0].sha256 = 'not-a-digest';
        return m;
      },
    ],
    ...[
      '../outside.txt',
      '/outside.txt',
      'C:/outside.txt',
      'C:outside.txt',
      '\\\\server\\outside.txt',
      'src\\nested\\runtime.mjs',
      './package.json',
      'src/../package.json',
      'src//nested/runtime.mjs',
      'package.json/',
      'package.json:stream',
      'data/private.json',
      'package.json\0',
    ].map((name) => [
      'unsafe or unlisted path ' + JSON.stringify(name),
      (m) => {
        m.files[0].file = name;
        return m;
      },
    ]),
  ];
  const { root, manifest, build } = await fixture(t);
  for (const [name, mutate] of changes)
    await t.test(name, async (t) => {
      const reads = t.mock.method(fs, 'readFile', async () => {
        throw new Error('UNEXPECTED_READ');
      });
      const stats = t.mock.method(fs, 'lstat', async () => {
        throw new Error('UNEXPECTED_STAT');
      });
      await assert.rejects(
        verifyCandidate(root, mutate(structuredClone(manifest)), build),
        failure,
      );
      assert.equal(reads.mock.callCount(), 0);
      assert.equal(stats.mock.callCount(), 0);
    });
});

test('well-formed but incorrect manifest digest is compared to actual bytes', async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.files.find((entry) => entry.file === '试用说明.md').sha256 = '0'.repeat(64);
  await assert.rejects(verifyCandidate(root, manifest), failure);
});

test('inventory order is irrelevant and unshipped private files are not inspected', async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.files.reverse();
  await fs.mkdir(path.join(root, 'data'));
  await fs.writeFile(path.join(root, 'data', 'private.json'), 'SYNTHETIC PRIVATE CANARY');
  await fs.writeFile(path.join(root, '.env'), 'SYNTHETIC PRIVATE CANARY');
  assert.deepEqual(await verifyCandidate(root, manifest), { file_count: manifest.files.length });
});

test('non-file and linked delivered paths are rejected even when content would match', async (t) => {
  for (const kind of ['directory handbook', 'linked handbook', 'linked runtime directory']) {
    await t.test(kind, async (t) => {
      const { directory, root, manifest, build } = await fixture(t);
      const outside = path.join(directory, 'isolated-outside');
      if (kind === 'linked runtime directory') {
        await fs.rename(path.join(root, 'src'), outside);
        await fs.symlink(outside, path.join(root, 'src'), 'junction');
      } else {
        await fs.unlink(path.join(root, '试用说明.md'));
        if (kind === 'directory handbook') await fs.mkdir(path.join(root, '试用说明.md'));
        else {
          await fs.mkdir(outside);
          await fs.symlink(outside, path.join(root, '试用说明.md'), 'junction');
        }
      }
      await assert.rejects(verifyCandidate(root, manifest, build), failure);
    });
  }
});

test('malformed, directory or linked manifest is not a source checkout', async (t) => {
  for (const kind of ['malformed', 'directory', 'linked'])
    await t.test(kind, async (t) => {
      const { directory, root } = await fixture(t);
      const file = path.join(root, 'release-manifest.json');
      await fs.unlink(file);
      if (kind === 'malformed') await fs.writeFile(file, '{broken');
      else if (kind === 'directory') await fs.mkdir(file);
      else {
        const outside = path.join(directory, 'isolated-outside');
        await fs.mkdir(outside);
        await fs.symlink(outside, file, 'junction');
      }
      assert.equal(integrity(await doctor(root)).ready, false);
    });
});

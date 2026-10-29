import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { prepareNativeWorkspaceRuntime, NATIVE_PLAYWRIGHT_VERSION } from '../server/native-dsh/workspace-runtime.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-workspace-runtime-'));
  const sourceModules = path.join(root, 'source/node_modules'), dataRoot = path.join(root, 'old-data'), baseRoot = path.join(root, 'local-app-data');
  await fs.mkdir(dataRoot); await fs.writeFile(path.join(dataRoot, 'historical-evidence.json'), '{"preserve":true}');
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    const directory = path.join(sourceModules, name);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version: NATIVE_PLAYWRIGHT_VERSION,
      dependencies: name === '@playwright/test' ? { playwright: NATIVE_PLAYWRIGHT_VERSION } : name === 'playwright' ? { 'playwright-core': NATIVE_PLAYWRIGHT_VERSION } : {} }));
    await fs.writeFile(path.join(directory, 'index.js'), `module.exports=${JSON.stringify(name)};\n`);
  }
  return { root, sourceModules, options: { dataRoot, baseRoot }, close: () => fs.rm(root, { recursive: true, force: true }) };
}

test('owner access is prepared only for a fresh empty managed root and failure leaves it retryable', async () => {
  const f = await fixture();
  try {
    let calls = 0;
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules, ensureOwnerAccess: async root => {
      calls++; assert.deepEqual(await fs.readdir(root), []); throw Error('ACL_DENIED');
    } }), /ACL_DENIED/);
    const runtime = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules, ensureOwnerAccess: async root => {
      calls++; assert.deepEqual(await fs.readdir(root), []);
    } });
    await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules, ensureOwnerAccess: () => assert.fail('must not change existing root ACL') });
    assert.equal(calls, 2);
    assert.equal(await fs.readFile(path.join(f.options.dataRoot, 'historical-evidence.json'), 'utf8'), '{"preserve":true}');
    assert.ok(runtime.reused === false);
  } finally { await f.close(); }
});

test('copies only fixed packages as real directories and repeated preparation verifies and reuses bytes', async () => {
  const f = await fixture();
  try {
    const first = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules });
    assert.equal(first.reused, false); assert.equal(first.version, NATIVE_PLAYWRIGHT_VERSION); assert.equal(first.file_count, 6);
    assert.match(first.id, /^[a-f0-9]{16}$/);
    assert.equal((await fs.lstat(first.modulesRoot)).isSymbolicLink(), false);
    const project = path.join(first.projectsRoot, 'project-a/workspace'); await fs.mkdir(project, { recursive: true });
    const projectRequire = createRequire(path.join(project, 'run.js'));
    assert.equal(projectRequire('@playwright/test'), '@playwright/test');
    const second = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules, copyFile: () => assert.fail('unchanged dependencies must be reused') });
    assert.equal(second.reused, true); assert.equal(second.bundle_sha256, first.bundle_sha256);
    assert.equal(await fs.readFile(path.join(f.options.dataRoot, 'historical-evidence.json'), 'utf8'), '{"preserve":true}');
  } finally { await f.close(); }
});

test('version drift, changed installed bytes and changed source bytes fail closed', async () => {
  const f = await fixture();
  try {
    const runtime = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules });
    await fs.writeFile(path.join(runtime.modulesRoot, 'playwright/index.js'), 'tampered');
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules }), /COPY_CHANGED/);
    await fs.copyFile(path.join(f.sourceModules, 'playwright/index.js'), path.join(runtime.modulesRoot, 'playwright/index.js'));
    await fs.writeFile(path.join(f.sourceModules, 'playwright/index.js'), 'source changed without version bump');
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules }), /SOURCE_CHANGED/);
    await fs.writeFile(path.join(f.sourceModules, 'playwright/package.json'), JSON.stringify({ name: 'playwright', version: '1.60.0' }));
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules }), /VERSION_MISMATCH/);
  } finally { await f.close(); }
});

test('partial copy never becomes active and a later clean preparation can recover', async () => {
  const f = await fixture();
  try {
    let copied = 0;
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules, copyFile: async (source, target) => {
      if (++copied === 3) throw Error('deliberate copy interruption');
      await fs.copyFile(source, target);
    } }), /deliberate copy interruption/);
    const generated = path.join(f.options.baseRoot, (await fs.readdir(f.options.baseRoot))[0]);
    assert.equal(await fs.stat(path.join(generated, 'node_modules')).catch(() => null), null);
    assert.equal((await fs.readdir(generated)).some(file => file.startsWith('.dependency-staging-')), false);
    const recovered = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules });
    assert.equal(recovered.reused, false);
  } finally { await f.close(); }
});

test('dependency symlinks are rejected without reading or changing their target', async () => {
  const f = await fixture();
  try {
    const outside = path.join(f.root, 'outside'); await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'keep.txt'), 'keep');
    await fs.symlink(outside, path.join(f.sourceModules, 'playwright/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules }), /DEPENDENCY_LINK_REJECTED/);
    assert.equal(await fs.readFile(path.join(outside, 'keep.txt'), 'utf8'), 'keep');
  } finally { await f.close(); }
});

test('different data directories have isolated runtime roots and manifests cannot be silently repaired', async () => {
  const f = await fixture();
  try {
    const first = await prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules });
    const secondData = path.join(f.root, 'second-data'); await fs.mkdir(secondData);
    const second = await prepareNativeWorkspaceRuntime({ ...f.options, dataRoot: secondData }, { sourceModules: f.sourceModules });
    assert.notEqual(first.root, second.root);
    await fs.unlink(first.manifestPath);
    await assert.rejects(prepareNativeWorkspaceRuntime(f.options, { sourceModules: f.sourceModules }), /COPY_INCOMPLETE/);
    assert.equal(await fs.readFile(path.join(first.modulesRoot, 'playwright/index.js'), 'utf8'), 'module.exports="playwright";\n');
  } finally { await f.close(); }
});

test('installed locked Playwright packages load through ancestor resolution without a junction', { timeout: 30_000 }, async () => {
  const f = await fixture();
  try {
    const runtime = await prepareNativeWorkspaceRuntime(f.options);
    const workspace = path.join(runtime.projectsRoot, 'project-real/workspace'); await fs.mkdir(workspace, { recursive: true });
    const nativeRequire = createRequire(path.join(workspace, 'entry.js'));
    for (const name of ['@playwright/test', 'playwright', 'playwright-core']) assert.equal(nativeRequire(name + '/package.json').version, NATIVE_PLAYWRIGHT_VERSION);
    assert.equal(typeof nativeRequire('@playwright/test').test, 'function');
    assert.equal(typeof nativeRequire('playwright').chromium.launch, 'function');
    assert.equal(await fs.stat(path.join(workspace, 'node_modules')).catch(() => null), null);
    const again = await prepareNativeWorkspaceRuntime(f.options);
    assert.equal(again.reused, true); assert.equal(again.bundle_sha256, runtime.bundle_sha256);
  } finally { await f.close(); }
});

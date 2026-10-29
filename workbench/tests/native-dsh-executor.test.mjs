import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { executeNativeScript } from '../server/native-dsh/executor.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-dsh-executor-'));
  const workspace = path.join(root, 'project');
  await fs.mkdir(workspace);
  await fs.writeFile(path.join(workspace, 'case.spec.mjs'), "import {test,expect} from '@playwright/test'; import {value} from './lib.mjs'; test('CASE-1 ordinary',async()=>expect(value).toBe(1));\n");
  await fs.writeFile(path.join(workspace, 'lib.mjs'), 'export const value=1;\n');
  let count = 0;
  return { root, workspace, options: extra => ({ workspace, runDirectory: path.join(root, `run-${++count}`), entry: 'case.spec.mjs', caseId: 'CASE-1', ...extra }), close: () => fs.rm(root, { recursive: true, force: true }) };
}

const testResult = (status = 'passed') => ({ id: 'test-1', title: 'CASE-1 ordinary', status, expected_status: 'passed', duration_ms: 2, errors: status === 'failed' ? ['Expected value differs'] : [] });

test('unbound formal evidence is diagnosed before business execution; diagnostics remain unscored', async () => {
  const f = await fixture();
  try {
    const identity = {run_id:'run-contract',project_id:'project-contract',source_task_id:'task-contract',executed_case_id:'case-contract',executed_case_version:1,executed_content_sha256:'a'.repeat(64),executed_external_id:'CASE-1'};
    const frozenCaseContent={steps:[{order:1,action:'first',expected:'one'},{order:2,action:'second',expected:'two'}]};
    const result = await executeNativeScript(f.options({identity,frozenCaseContent}),{execute:()=>assert.fail('Unbound business must not execute'),prepareRecorder:()=>assert.fail('No browser recorder before mapping')});
    assert.equal(result.status,'ERROR');assert.equal(result.error,'NATIVE_EVIDENCE_CONTRACT_UNBOUND');
    assert.equal(result.evidence_preflight.business_execution_started,false);
    assert.equal(result.evidence_mapping.status,'UNAVAILABLE');assert.notEqual(result.evidence_status,'COMPLETE');
    const diagnostic=await executeNativeScript(f.options({identity,frozenCaseContent,purpose:'diagnostic'}),{execute:fakeProcess()});
    assert.equal(diagnostic.status,'PASSED');assert.equal(diagnostic.purpose,'diagnostic');assert.equal(diagnostic.evidence_preflight,undefined);
  } finally {await f.close();}
});
function fakeProcess({ status = 'passed', tests = [testResult(status)], termination = null, outputComplete = true, mutate = null } = {}) {
  return async (command, args, options) => {
    assert.equal(command, process.execPath);
    assert.match(args[0], /[\\/]workbench[\\/]node_modules[\\/]@playwright[\\/]test[\\/]cli\.js$/);
    assert.equal(options.env.DEEPSEEK_API_KEY, undefined);
    assert.equal(options.env.NODE_OPTIONS, undefined);
    const config = (await import(pathToFileURL(args.at(-1)).href)).default;
    assert.equal(config.use.headless, false);
    assert.equal(config.use.video, 'on'); assert.equal(config.use.trace, 'on'); assert.equal(config.use.screenshot, 'on');
    const reportPath = config.reporter[0][1].outputFile;
    await fs.writeFile(reportPath, JSON.stringify({ status, finished_at: new Date().toISOString(), tests, errors: [] }));
    await mutate?.({ options, config });
    return { exitCode: status === 'passed' ? 0 : 1, stdout: 'ordinary test output', stderr: '', termination, outputComplete };
  };
}

test('source and dependencies are frozen, private state excluded and fixed runtime owns evidence', async () => {
  const f = await fixture();
  try {
    await fs.writeFile(path.join(f.workspace, '.env'), 'SECRET=x');
    await fs.mkdir(path.join(f.workspace, 'private'));
    await fs.writeFile(path.join(f.workspace, 'private', 'secret.json'), '{"password":"x"}');
    await fs.writeFile(path.join(f.workspace, 'storage-state.json'), '{"secret":"x"}');
    await fs.writeFile(path.join(f.workspace, 'execute.mjs'), 'const bearer="must-not-export";');
    await fs.writeFile(path.join(f.workspace, 'current-task.json'), '{"bearer":"must-not-export"}');
    await fs.mkdir(path.join(f.workspace, 'references'));
    await fs.writeFile(path.join(f.workspace, 'references', 'old.mjs'), 'reference only');
    const input = f.options({ storageState: { cookies: [], origins: [] } });
    const result = await executeNativeScript(input, { execute: fakeProcess() });
    assert.equal(result.status, 'PASSED', result.error);
    assert.ok(result.script_sha256); assert.ok(result.bundle_sha256);
    assert.ok(result.artifacts.some(item => item.relative_path === 'snapshot/lib.mjs'));
    assert.ok(result.artifacts.some(item => item.relative_path === 'stdout.log'));
    assert.ok(result.artifacts.every(item => item.sha256.length === 64));
    assert.ok(!result.artifacts.some(item => /storage-state|private|\.env|node_modules|current-task|execute\.mjs|references/.test(item.relative_path)));
    await assert.rejects(fs.stat(path.join(input.runDirectory, '.private')), { code: 'ENOENT' });
    await fs.writeFile(path.join(f.workspace, 'lib.mjs'), 'export const value=2;\n');
    const second = await executeNativeScript(f.options(), { execute: fakeProcess() });
    assert.equal(second.script_sha256, result.script_sha256);
    assert.notEqual(second.bundle_sha256, result.bundle_sha256);
    assert.equal(await fs.readFile(path.join(input.runDirectory, 'snapshot/lib.mjs'), 'utf8'), 'export const value=1;\n');
    await fs.writeFile(path.join(f.workspace, 'lib.mjs'), "import './execute.mjs';export const value=2;");
    assert.match((await executeNativeScript(f.options(), { execute: fakeProcess() })).error, /DEPENDENCY_NOT_SNAPSHOTTED/);
  } finally { await f.close(); }
});

test('path escape, symlink, external dependency and oversized source fail before execution', async () => {
  const f = await fixture(); let executions = 0;
  const deps = { execute: async () => { executions++; throw Error('must not execute'); } };
  try {
    const escaped = await executeNativeScript(f.options({ entry: '../outside.mjs' }), deps);
    assert.match(escaped.error, /ENTRY_OUTSIDE/);
    const nested = await executeNativeScript(f.options({ runDirectory: path.join(f.workspace, 'run') }), deps);
    assert.match(nested.error, /MUST_BE_SEPARATE/);
    await fs.mkdir(path.join(f.root, 'outside'));
    await fs.symlink(path.join(f.root, 'outside'), path.join(f.workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.match((await executeNativeScript(f.options(), deps)).error, /SYMLINK/);
    await fs.unlink(path.join(f.workspace, 'linked'));
    await fs.writeFile(path.join(f.workspace, 'lib.mjs'), "import lodash from 'lodash'; export const value=1;\n");
    assert.match((await executeNativeScript(f.options(), deps)).error, /EXTERNAL_DEPENDENCY/);
    await fs.writeFile(path.join(f.workspace, 'lib.mjs'), "import x from '../../outside.mjs'; export const value=1;\n");
    assert.match((await executeNativeScript(f.options(), deps)).error, /DEPENDENCY_OUTSIDE/);
    await fs.writeFile(path.join(f.workspace, 'lib.mjs'), ' '.repeat(2 * 1024 * 1024 + 1));
    assert.match((await executeNativeScript(f.options(), deps)).error, /BUNDLE_TOO_LARGE/);
    assert.equal(executions, 0);
  } finally { await f.close(); }
});

test('TypeScript and literal relative imports work; unresolved and computed imports are rejected', async () => {
  const f = await fixture();
  try {
    await fs.writeFile(path.join(f.workspace, 'case.spec.mjs'), "import {test,expect} from '@playwright/test';import {value} from './lib';test('CASE-1',()=>expect(value).toBe(1));");
    await fs.unlink(path.join(f.workspace, 'lib.mjs'));
    await fs.writeFile(path.join(f.workspace, 'lib.ts'), 'export const value: number = 1;');
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess() })).status, 'PASSED');
    await fs.writeFile(path.join(f.workspace, 'lib.ts'), "const name='fs';export const value=await import(name);");
    assert.match((await executeNativeScript(f.options(), { execute: fakeProcess() })).error, /DYNAMIC_DEPENDENCY/);
  } finally { await f.close(); }
});

test('skips, zero tests, mismatched cases and incomplete reports cannot produce PASS', async () => {
  const f = await fixture();
  try {
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess({ tests: [testResult('skipped')] }) })).status, 'FAILED');
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess({ tests: [] }) })).status, 'ERROR');
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess({ tests: [{ ...testResult(), title: 'OTHER' }] }) })).status, 'FAILED');
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess({ outputComplete: false }) })).status, 'ERROR');
    assert.equal((await executeNativeScript(f.options(), { execute: fakeProcess({ tests: [{ ...testResult(), expected_status: 'failed' }] }) })).status, 'FAILED');
  } finally { await f.close(); }
});

test('cancel and timeout are terminal; private authentication input is deleted on both paths', async () => {
  const f = await fixture();
  try {
    for (const termination of ['cancelled', 'timeout']) {
      const input = f.options({ storageState: { cookies: [], origins: [] } });
      const result = await executeNativeScript(input, { execute: fakeProcess({ termination }) });
      assert.equal(result.status, termination === 'timeout' ? 'TIMED_OUT' : 'CANCELLED');
      assert.ok(result.finished_at); assert.ok(result.artifacts.length);
      await assert.rejects(fs.stat(path.join(input.runDirectory, '.private')), { code: 'ENOENT' });
    }
    const controller = new AbortController(); controller.abort();
    const cancelled = await executeNativeScript(f.options({ signal: controller.signal }), { execute: () => assert.fail('pre-cancelled task must not launch') });
    assert.equal(cancelled.status, 'CANCELLED');
  } finally { await f.close(); }
});

test('modified executed source invalidates a nominal passing result', async () => {
  const f = await fixture();
  try {
    const result = await executeNativeScript(f.options(), { execute: fakeProcess({ mutate: ({ options }) => fs.writeFile(path.join(options.cwd, 'lib.mjs'), 'export const value=99;') }) });
    assert.equal(result.status, 'ERROR'); assert.match(result.error, /EXECUTED_SOURCE_CHANGED/);
  } finally { await f.close(); }
});

test('an artifact symlink cannot export external files or leave a persisted PASS', async () => {
  const f = await fixture();
  try {
    const input = f.options();
    const result = await executeNativeScript(input, { execute: fakeProcess({ mutate: async ({ config }) => {
      await fs.mkdir(config.outputDir);
      await fs.symlink(f.workspace, path.join(config.outputDir, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    } }) });
    assert.equal(result.status, 'ERROR'); assert.match(result.error, /ARTIFACT_SYMLINK/);
    assert.equal(JSON.parse(await fs.readFile(path.join(input.runDirectory, 'execution-result.json'), 'utf8')).status, 'ERROR');
    assert.equal(result.artifacts.length, 0);
  } finally { await f.close(); }
});

test('real standard Playwright produces readable screenshots, video and trace for pass and failure on a local file', { timeout: 90_000 }, async t => {
  const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  if (!await fs.stat(browserExecutable).catch(() => null)) return t.skip('No local test browser configured');
  const f = await fixture();
  try {
    const pageFile = path.join(f.root, 'fixture.html');
    await fs.writeFile(pageFile, '<!doctype html><title>Local engineering test</title><h1>Ready</h1><button>Continue</button>');
    const url = pathToFileURL(pageFile).href;
    for (const expected of ['Ready', 'Deliberate failure']) {
      await fs.writeFile(path.join(f.workspace, 'case.spec.mjs'), `import {test,expect} from '@playwright/test';test('CASE-1 local engineering',async({page})=>{await page.goto(${JSON.stringify(url)});await expect(page.getByRole('heading')).toHaveText(${JSON.stringify(expected)},{timeout:100});});`);
      const result = await executeNativeScript(f.options({ browserExecutable, timeoutMs: 30_000 }));
      assert.equal(result.status, expected === 'Ready' ? 'PASSED' : 'FAILED', result.error);
      for (const kind of ['screenshot', 'video', 'trace']) {
        const artifact = result.artifacts.find(item => item.kind === kind);
        assert.ok(artifact, `${kind} missing: ${JSON.stringify(result)}`); assert.ok(artifact.bytes > 20);
      }
      assert.equal(result.tests.length, 1);
      if (expected !== 'Ready') assert.match(result.error, /Deliberate failure/);
    }
  } finally { await f.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

process.env.WORKBENCH_PACKAGE ||= fileURLToPath(new URL('../../../workbench/package.json', import.meta.url));
process.env.PILOT_CDP = 'http://127.0.0.1:1';
process.env.TARGET_URL = 'http://example.test/module';
const require = createRequire(process.env.WORKBENCH_PACKAGE);
const { chromium } = require('playwright');
const { runCase, expect } = await import('../scripts/runtime.mjs');

class FakeSession extends EventEmitter {
  constructor() { super(); this.detached = false; this.disconnected = false; }
  async send() { if (this.disconnected) throw Error('transport closed'); }
  async detach() { this.detached = true; }
  request(url, method = 'GET') { this.emit('Network.requestWillBeSent', { request: { url, method } }); }
}
async function fixture(t, stepCount = 1) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-runtime-'));
  const caseFile = path.join(root, 'case.json'), scriptFile = path.join(root, 'case.mjs');
  const frozenCase = {
    external_id: 'CASE-1', case_version: 3, content_sha256: 'declared-original-content-hash',
    content: { title: 'Original case', steps: Array.from({ length: stepCount }, (_, n) => ({ order: n + 1, action: `Action ${n + 1}`, expected: `Expected ${n + 1}` })) },
  };
  await fs.writeFile(caseFile, JSON.stringify(frozenCase));
  await fs.writeFile(scriptFile, "import './shared.mjs';\n");
  await fs.writeFile(path.join(root, 'shared.mjs'), 'export const value = 1;\n');
  const session = new FakeSession();
  let pageCloseCalls = 0, browserCloseCalls = 0;
  const page = {
    url: () => process.env.TARGET_URL,
    screenshot: async ({ path: output }) => fs.writeFile(output, 'offline-fake-screenshot'),
    context: () => ({ newCDPSession: async () => session }),
    close: () => pageCloseCalls++,
  };
  const originalConnect = chromium.connectOverCDP;
  chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [page] }], close: () => browserCloseCalls++ });
  t.after(async () => {
    chromium.connectOverCDP = originalConnect;
    assert.equal(pageCloseCalls, 0); assert.equal(browserCloseCalls, 0);
    await fs.rm(root, { recursive: true, force: true });
  });
  const options = { caseFile, scriptFile, outputDir: path.join(root, 'out'), attempt: 1 };
  return { root, options, page, session, frozenCase };
}
const completeStep = ctx => ctx.step(1, () => ctx.check('value', () => expect(1).toBe(1)));

test('freezes original input, completes steps, snapshots local dependencies and does not close user browser', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    assert.ok(Object.isFrozen(ctx.frozenCase.content.steps[0]));
    ctx.cleanup(async () => expect(true).toBe(true));
    await completeStep(ctx);
  } });
  assert.equal(report.status, 'PASSED');
  assert.equal(report.case.case_version, 3);
  assert.equal(report.case.declared_content_sha256, 'declared-original-content-hash');
  assert.ok(report.source_snapshot.some(file => file.source.endsWith('shared.mjs')));
  assert.ok(report.source_snapshot.some(file => file.source.endsWith('runtime.mjs')));
  const saved = JSON.parse(await fs.readFile(path.join(f.options.outputDir, 'attempt-001/result.json')));
  assert.equal(saved.status, 'PASSED');
  assert.equal(report.cleanup.succeeded, 1);
  await assert.rejects(runCase({ ...f.options, execute: async () => assert.fail('must not run') }), { code: 'EEXIST' });
});

test('caught failed assertions cannot become green', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    await ctx.step(1, async () => {
      await ctx.check('broken', () => expect('actual').toBe('expected')).catch(() => {});
    }).catch(() => {});
  } });
  assert.equal(report.status, 'FAILED');
  assert.equal(report.failure_kind, 'ASSERTION');
  assert.equal(report.steps[0].status, 'FAILED');
  assert.ok(report.screenshots.some(file => file.file.includes('failure')));
});

test('omitted original steps and steps without checks are runner errors', async t => {
  const f = await fixture(t, 2);
  let report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {}); await completeStep(ctx);
  } });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'ORIGINAL_STEPS_INCOMPLETE'));
  report = await runCase({ ...f.options, attempt: 2, execute: async ctx => {
    ctx.cleanup(async () => {}); await ctx.step(1, async () => {});
  } });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'STEP_HAS_NO_CHECK'));
});

test('cleanup is compulsory for a completed case and failed cleanup cannot pass', async t => {
  const f = await fixture(t);
  let report = await runCase({ ...f.options, execute: completeStep });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'CLEANUP_NOT_REGISTERED'));
  report = await runCase({ ...f.options, attempt: 2, execute: async ctx => {
    ctx.cleanup(async () => { throw Error('modal remains'); }); await completeStep(ctx);
  } });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'CLEANUP_FAILED'));
});

test('failed action runs cleanup and retains script failure instead of reporting success', async t => {
  const f = await fixture(t); let cleaned = false;
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => { cleaned = true; });
    await ctx.step(1, async () => { throw new ReferenceError('missing import'); });
  } });
  assert.equal(report.status, 'FAILED'); assert.equal(report.failure_kind, 'SCRIPT_ERROR'); assert.equal(cleaned, true);
});

test('missing preconditions are BLOCKED, including if caller catches the exception', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    try { ctx.blocked('No authorized test fixture'); } catch {}
  } });
  assert.equal(report.status, 'BLOCKED'); assert.equal(report.failure_kind, 'PRECONDITION');
});

test('zero-request evidence requires an actually observed probe and removes listeners', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    await ctx.watchRequests({ urlPattern: /\/save$/, probePattern: '/query', probe: async () => {}, probeTimeoutMs: 10 });
  } });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'REQUEST_CHANNEL_UNVERIFIED'));
  assert.equal(report.request_watches[0].channel_verified, false);
  assert.equal(f.session.detached, true); assert.equal(f.session.listenerCount('Network.requestWillBeSent'), 0);
});

test('observed probe permits zero-write assertion; reports redact query values', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    const watcher = await ctx.watchRequests({ urlPattern: /\/save$/, methods: ['POST'], probePattern: '/query',
      probe: async () => f.session.request('http://example.test/query?token=SECRET') });
    const marker = watcher.mark();
    await ctx.step(1, () => ctx.check('no-write', () => watcher.assertNoneSince(marker, { observationMs: 0 })));
  } });
  assert.equal(report.status, 'PASSED');
  assert.equal(report.request_watches[0].channel_verified, true);
  assert.equal(report.request_watches[0].assertions[0].count, 0);
  assert.ok(!JSON.stringify(report).includes('SECRET'));
  assert.equal(f.session.detached, true);
});

test('request starts catch in-flight writes and repeated identical URLs', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    const watcher = await ctx.watchRequests({ urlPattern: '/save', methods: ['POST'], probePattern: '/query',
      probe: async () => f.session.request('http://example.test/query') });
    const marker = watcher.mark();
    f.session.request('http://example.test/save', 'POST'); f.session.request('http://example.test/save', 'POST');
    await ctx.step(1, () => ctx.check('no-write', () => watcher.assertNoneSince(marker, { observationMs: 0 })));
  } });
  assert.equal(report.status, 'FAILED'); assert.equal(report.request_watches[0].assertions[0].count, 2);
});

test('late request after initial zero-write assertion remains a failure', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    const watcher = await ctx.watchRequests({ urlPattern: '/save', probePattern: '/query',
      probe: async () => f.session.request('http://example.test/query') });
    const marker = watcher.mark();
    await ctx.step(1, () => ctx.check('no-write', () => watcher.assertNoneSince(marker, { observationMs: 0 })));
    f.session.request('http://example.test/save', 'POST');
  } });
  assert.equal(report.status, 'FAILED'); assert.equal(report.request_watches[0].assertions[0].count, 1);
});

test('disconnected observation channel cannot claim zero requests', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {});
    const watcher = await ctx.watchRequests({ urlPattern: '/save', probePattern: '/query',
      probe: async () => f.session.request('http://example.test/query') });
    const marker = watcher.mark(); f.session.disconnected = true;
    await ctx.step(1, () => ctx.check('no-write', () => watcher.assertNoneSince(marker, { observationMs: 0 })));
  } });
  assert.equal(report.status, 'ERROR'); assert.ok(report.faults.some(error => error.code === 'REQUEST_CHANNEL_DISCONNECTED'));
});

test('mutated case or dependency makes immutable original snapshot available and fails integrity', async t => {
  const f = await fixture(t);
  const report = await runCase({ ...f.options, execute: async ctx => {
    ctx.cleanup(async () => {}); await completeStep(ctx);
    await fs.writeFile(path.join(f.root, 'shared.mjs'), 'export const value = 2;\n');
    await fs.writeFile(f.options.caseFile, '{}');
  } });
  assert.equal(report.status, 'ERROR');
  assert.ok(report.faults.some(error => error.code === 'ORIGINAL_CASE_CHANGED'));
  assert.ok(report.faults.some(error => error.code === 'SOURCE_CHANGED_DURING_RUN'));
  const source = report.source_snapshot.find(file => file.source.endsWith('shared.mjs'));
  assert.equal(await fs.readFile(path.join(f.options.outputDir, 'attempt-001', source.file), 'utf8'), 'export const value = 1;\n');
  assert.equal(JSON.parse(await fs.readFile(path.join(f.options.outputDir, 'attempt-001/original-case.json'))).case_version, 3);
});

test('exact page selection refuses prefix-only and ambiguous targets', async t => {
  const f = await fixture(t);
  f.page.url = () => `${process.env.TARGET_URL}/other`;
  let report = await runCase({ ...f.options, execute: async () => assert.fail('not called') });
  assert.equal(report.status, 'BLOCKED');
  chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [{ ...f.page, url: () => process.env.TARGET_URL }, { ...f.page, url: () => process.env.TARGET_URL }] }] });
  report = await runCase({ ...f.options, attempt: 2, execute: async () => assert.fail('not called') });
  assert.equal(report.status, 'BLOCKED');
});

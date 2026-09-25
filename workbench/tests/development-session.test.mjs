import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client, StreamableHTTPClientTransport } from '../../harness-probe/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { DevelopmentSession, digest, DEVELOPMENT_LIMITS } from '../server/build/development-session.mjs';
import { startDevelopmentMcp } from '../server/build/development-mcp.mjs';
import { developmentToolAllowed } from '../server/build/development-tool-guard.mjs';
import { checkDevelopmentCandidate } from '../server/build/development-policy.mjs';

const frozenCase = { steps: [{ order: 1, action: 'Open', expected: 'The label is good' }] };
const draft = value => `import {test,expect} from '@playwright/test';\ntest('engineering',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('${value}');});});\n`;
async function fixture(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'development-engineering-'));
  const controller = new AbortController(); const saved = [];
  const verify = async ({ candidatePath, runDirectory }) => {
    await fs.mkdir(runDirectory, { recursive: true });
    const pass = (await fs.readFile(candidatePath, 'utf8')).includes("toHaveText('good')");
    const error = pass ? undefined : { message: 'Expected string: "bad"\nReceived string: "good"' };
    const report = { stats: { expected: pass ? 1 : 0, unexpected: pass ? 0 : 1, skipped: 0 }, suites: [{ specs: [{ tests: [{ results: [{ status: pass ? 'passed' : 'failed', error, steps: [{ title: 'CASE_STEP_1', category: 'test.step', error }] }] }] }] }] };
    const reportPath = path.join(runDirectory, 'playwright-report.json'); await fs.writeFile(reportPath, JSON.stringify(report));
    return { reportPath, process: { exitCode: pass ? 0 : 1, termination: null } };
  };
  const session = new DevelopmentSession({ directory, frozenCase, normalUrl: 'http://127.0.0.1:1234/normal', verify, persist: async state => saved.push(state), signal: controller.signal, ...options });
  await session.init(options.seed ?? null);
  return { session, saved, controller, close: () => fs.rm(directory, { recursive: true, force: true }) };
}
function coverage(execution) { return [{ order: 1, requirement: frozenCase.steps[0].expected, check_lines: [2], execution, uncovered: '' }]; }

test('pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes', async () => {
  const f = await fixture({ seed: draft('bad') }); const bridge = await startDevelopmentMcp((name, args) => f.session.invoke(name, args));
  const client = new Client({ name: 'zero-model-agent-context', version: '1' }, { versionNegotiation: { mode: 'auto' } });
  const context = [];
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(bridge.url)));
    assert.equal((await client.listTools()).tools.length, 7);
    async function call(name, args = {}) { const result = await client.callTool({ name, arguments: args }); context.push(result); return result; }
    const denied = await call('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) });
    assert.equal(denied.isError, true);
    const first = await call('self_test'); assert.notEqual(first.isError, true);
    assert.equal(JSON.parse(first.content[0].text).result.error.actual, 'good');
    await call('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) });
    assert.equal((await call('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(1) })).isError, true);
    const second = await call('self_test'); assert.equal(JSON.parse(second.content[0].text).result.complete_pass, true);
    const final = await call('submit_candidate', { sha256: digest(draft('good')), outcome: 'ready', coverage: coverage(2) });
    assert.equal(JSON.parse(final.content[0].text).status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
    assert.equal(context.length, 6);
    assert.notEqual(f.session.state.self_tests[0].sha256, f.session.state.self_tests[1].sha256);
    await assert.rejects(f.session.invoke('write_draft', { code: draft('bad'), previous_sha256: digest(draft('good')) }), /FROZEN/);
  } finally { await client.close(); await bridge.close(); await f.close(); }
});

test('self-test limit is cumulative and further edits cannot create an unverified final version', async () => {
  const f = await fixture({ seed: draft('bad') });
  try {
    for (let i = 0; i < 3; i++) await f.session.invoke('self_test');
    await assert.rejects(f.session.invoke('self_test'), /BUDGET/);
    await assert.rejects(f.session.invoke('write_draft', { code: draft('good'), previous_sha256: digest(draft('bad')) }), /BUDGET/);
    assert.equal(f.saved.at(-1).self_tests.length, 3);
  } finally { await f.close(); }
});

test('cancellation reaches an active execution and later tools stop', async () => {
  let began; const started = new Promise(resolve => { began = resolve; });
  const f = await fixture({ seed: draft('bad'), verify: async ({ signal }) => { began(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw new Error('owned execution cancelled'); } });
  try {
    const running = f.session.invoke('self_test'); await started; f.controller.abort('cancelled'); await running;
    assert.equal(f.session.state.self_tests[0].status, 'CANCELLED');
    await assert.rejects(f.session.invoke('read_draft'), /CANCELLED/);
  } finally { await f.close(); }
});

test('wall budget terminates before another tool or executor admission', async () => {
  let now = 0; const f = await fixture({ now: () => now, limits: { ...DEVELOPMENT_LIMITS, wall_ms: 10 } });
  try { now = 10; await assert.rejects(f.session.invoke('read_draft'), /TIME_EXHAUSTED/); assert.equal(f.session.state.self_tests.length, 0); }
  finally { await f.close(); }
});

test('from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate', async () => {
  const f = await fixture(); const bridge = await startDevelopmentMcp((name, args) => f.session.invoke(name, args));
  const client = new Client({ name: 'empty-draft-engineering', version: '1' }, { versionNegotiation: { mode: 'auto' } });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(bridge.url)));
    const call = code => client.callTool({ name: 'write_draft', arguments: { code, previous_sha256: null } });
    const rejected = await call(draft('good').replace("import {test,expect} from '@playwright/test';", "const {test,expect}=require('@playwright/test');"));
    assert.equal(rejected.isError, true); assert.equal(f.session.state.self_tests.length, 0);
    assert.equal(f.session.state.draft_sha256, null);
    const accepted = await call(draft('good'));
    assert.notEqual(accepted.isError, true); assert.equal(f.session.state.draft_sha256, digest(draft('good')));
  } finally { await client.close(); await bridge.close(); await f.close(); }
});

test('task guard denies arbitrary commands, filesystem, code and alternate navigation', () => {
  const normal = 'http://127.0.0.1:1234/normal';
  assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_navigate', { url: normal }, normal), true);
  for (const [name, args] of [['bash', {}], ['read_file', {}], ['run_code', {}], ['mcp__playwright-mcp__browser_run_code', {}], ['mcp__playwright-mcp__browser_navigate', { url: normal + '?fault=1' }], ['mcp__playwright-mcp__browser_take_screenshot', { filename: '../outside.png' }]]) assert.equal(developmentToolAllowed(name, args, normal), false);
  for (const forbidden of ["test.fail();", "test.skip();", "await fetch('http://other');", "process.env.DEEPSEEK_API_KEY;", "await import('node:fs');"]) assert.throws(() => checkDevelopmentCandidate(draft('good') + forbidden));
});

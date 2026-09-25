import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { Client, StreamableHTTPClientTransport } from '../../harness-probe/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { checkFidelity } from '../server/build/development-fidelity.mjs';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { startDevelopmentMcp } from '../server/build/development-mcp.mjs';
import { hiddenEnabledCounterexample } from './fixtures/hidden-enabled-counterexample.mjs';

const engineering = expected => ({ steps: [{ order: 1, action: 'Inspect', expected }] });
const script = body => `import {test,expect} from '@playwright/test'; test('engineering',async({page})=>{const control=page.getByRole('button',{name:'重新执行'});await page.goto(process.env.PROBE_URL);${body}});`;
const step = body => `await test.step('CASE_STEP_1',async()=>{${body}});`;
test('finite path proof expands neutral helper calls, branches and early returns', () => {
  const code = script(`const helper=async()=>{if(await control.isVisible()){await expect(control).toBeDisabled();}else{await expect(control).toBeHidden();}};${step('await helper();')}`);
  assert.equal(checkFidelity(code, engineering('重新执行按钮禁用或不可见')).obligations[0].status, 'SUPPORTED');
  assert.equal(checkFidelity(code, engineering('重新执行按钮禁用')).obligations[0].status, 'INSUFFICIENT');
  const early = script(step('if(await control.isVisible()){return;}await expect(control).toBeDisabled();'));
  assert.notEqual(checkFidelity(early, engineering('重新执行按钮禁用')).obligations[0].status, 'SUPPORTED');
  const direct = script(step('await expect(control).toBeDisabled();'));
  assert.equal(checkFidelity(direct, engineering('重新执行按钮禁用')).obligations[0].status, 'SUPPORTED');
  const notAwaited = script(step('expect(control).toBeDisabled();'));
  assert.equal(checkFidelity(notAwaited, engineering('重新执行按钮禁用')).status, 'NEEDS_REVIEW');
});

test('field identity is label-bound and independent of expected answer; unknown code never semantic_pass', () => {
  const requirement = engineering('温度23 C；测量时间2026-09-25 10:00:00');
  const code = script(step("await expect(page.getByText('温度',{exact:true}).locator('..').locator('.value')).toHaveText('23 C');await expect(page.getByText('测量时间',{exact:true}).locator('..').locator('.value')).toHaveText('2026-09-25 10:00:00');"));
  assert.equal(checkFidelity(code, requirement).status, 'LIMITED_CHECKS_SATISFIED');
  assert.equal(checkFidelity(code, requirement).semantic_pass, false);
  assert.equal(checkFidelity(script(step("await expect(page.getByText('23 C')).toBeVisible();")), requirement).status, 'NEEDS_REVIEW');
});

test('real browser predicate boundaries: hidden/enabled, hidden/disabled and missing are distinct', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="target" style="display:none">重新执行</button>');
    const target = page.locator('#target');
    await expect(target).toBeHidden(); // Explicit OR permits hidden.
    await assert.rejects(expect(target).toBeDisabled({ timeout: 150 })); // Hidden/enabled cannot prove disabled.
    await page.setContent('<button id="target" style="display:none" disabled>重新执行</button>');
    await expect(target).toBeDisabled(); // Hidden/disabled is valid.
    await page.setContent('<div>no control</div>');
    await assert.rejects(expect(target).toBeDisabled({ timeout: 150 })); // Missing cannot prove disabled.
  } finally { await browser.close(); }
});

test('production MCP exposes actionable admission/absence/parameter feedback and retains original B advisory gaps without claiming semantic approval', async () => {
  const original = JSON.parse(await fs.readFile(new URL('../qa/20260925-autonomous/b/task.json', import.meta.url)));
  const code = await fs.readFile(new URL('../qa/20260925-autonomous/b/final/candidate.spec.mjs', import.meta.url), 'utf8');
  const report = await fs.readFile(new URL('../qa/20260925-autonomous/b/dev-1/report.json', import.meta.url));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fidelity-protocol-'));
  const session = new DevelopmentSession({ directory, frozenCase: original.input_bundle.snapshot.content, normalUrl: 'http://127.0.0.1:1/normal', signal: new AbortController().signal, persist: async () => {},
    // OFFLINE regression of the actual historical passing report, not a new product execution.
    verify: async ({ runDirectory }) => { await fs.mkdir(runDirectory, { recursive: true }); const reportPath = path.join(runDirectory, 'report.json'); await fs.writeFile(reportPath, report); return { reportPath, process: { exitCode: 0, termination: null } }; } });
  await session.init(); const bridge = await startDevelopmentMcp((name,args) => session.invoke(name,args), { getState: () => session.state });
  const client = new Client({ name: 'fidelity-engineering', version: '1' }, { versionNegotiation: { mode: 'auto' } });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(bridge.url)));
    const call = async (name,args={}) => { const result = await client.callTool({ name, arguments: args }); return { error: result.isError, value: JSON.parse(result.content[0].text) }; };
    assert.match((await call('read_draft')).value.runtime_contract.module_format, /ES module/);
    const absent = await call('self_test'); assert.equal(absent.value.code, 'DRAFT_NOT_CREATED'); assert.equal(absent.value.current_sha256, null); assert.doesNotMatch(JSON.stringify(absent), /C:\\|D:\\/);
    const invalid = await call('write_draft', { code: 1, previous_sha256: null }); assert.equal(invalid.value.code, 'TOOL_ARGUMENTS_INVALID');
    const rejected = await call('write_draft', { code: "const {test}=require('@playwright/test');", previous_sha256: null });
    assert.equal(rejected.value.identifier, 'require'); assert.equal(rejected.value.rule, 'ES_MODULE_IMPORT_REQUIRED'); assert.equal(rejected.value.location.line, 1); assert.equal(rejected.value.draft_saved, false);
    await call('write_draft', { code, previous_sha256: null });
    const executed = await call('self_test'); assert.equal(executed.value.result.complete_pass, true);
    const blocked = await call('submit_candidate', { ...original.development.submission, unknown_parameter: true });
    // Supply only the actual public schema; extra metadata above must be rejected.
    assert.equal(blocked.value.code, 'TOOL_ARGUMENTS_INVALID');
    const { outcome, coverage } = original.development.submission;
    const advisory = await call('check_fidelity');
    assert.equal(advisory.value.obligations.find(o => o.step === 4).status, 'INSUFFICIENT');
    const check = await call('submit_candidate', { sha256: digest(code), outcome, coverage });
    assert.equal(check.value.status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
    assert.equal(session.state.submission.semantic_approval, false);
    assert.equal(session.state.submission.requirements_review, 'PENDING_INDEPENDENT_REVIEW');
  } finally { await client.close(); await bridge.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('isolated semantic fixture changes only retry disabled/visibility, keeping status and readings', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const original = await fs.readFile(new URL('../qa/20260924/site/index.html', import.meta.url), 'utf8');
    await page.route('http://fixture.local/**', route => route.fulfill({ contentType: 'text/html', body: hiddenEnabledCounterexample(original) }));
    await page.goto('http://fixture.local/?scene=retry&variant=normal');
    await page.getByRole('button', { name: '查看遥测' }).click();
    await expect(page.locator('#tRetry')).toBeEnabled();
    await page.locator('#tRetry').click();
    await expect(page.locator('#tStatus')).toHaveText('读取中…');
    await expect(page.locator('#tRetry')).toBeHidden(); await expect(page.locator('#tRetry')).toBeEnabled();
    await expect(page.locator('#tStatus')).toHaveText('读取成功');
    await expect(page.locator('#tVolt')).toHaveText('750 V');
    await expect(page.locator('#tTime')).toHaveText('2026-09-24 10:00:00');
    await expect(page.locator('#tRetry')).toBeEnabled();
  } finally { await browser.close(); }
});

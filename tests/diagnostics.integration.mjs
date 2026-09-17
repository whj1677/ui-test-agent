import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DeepSeek } from '../src/deepseek.mjs';
import { demoCases, startDemo } from '../src/demo.mjs';
import { start } from '../src/server.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { PLAN_PROMPT, REVIEW_PROMPT, planHash } from '../src/plans.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(ROOT, 'validation', 'diagnostics-' + Date.now());
await fs.mkdir(directory, { recursive: true });
const fixture = demoCases(),
  secret = 'fixture-diagnostics-secret-local-only',
  password = 'fixture-password-do-not-export';
const markup = '<img src=x onerror="window.diagnosticsInjection=true">';
let modelCalls = 0,
  planCalls = 0,
  app,
  demo,
  browser;
const provider = new DeepSeek({
  key: secret,
  fetchImpl: async (url, options) => {
    // All model transport is injected: this test must not make an external request.
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer ' + secret);
    modelCalls++;
    const request = JSON.parse(options.body),
      input = JSON.parse(request.messages[1].content);
    let value;
    if (input.purpose === 'case_ui_discovery')
      value = { done: true, reason: '已采集商品查询控件与结果观察区域。' };
    else if (request.messages[0].content.startsWith(INPUT_REVIEW_PROMPT + '\n')) {
      assert.equal(input.effective.case_id, 'CATALOG-001');
      assert.ok(!Object.hasOwn(input, 'pages'));
      value = { issues: [] };
    } else if (request.messages[0].content.startsWith(PLAN_AUDIT_PROMPT + '\n')) {
      const candidate = input.candidate_plan;
      assert.equal(input.plan_hash, planHash(candidate));
      assert.deepEqual(candidate.steps[0].assertions, fixture.plans[0].steps[0].assertions);
      value = {
        checks: input.original.steps.flatMap((step) =>
          step.obligations.map((obligation) => {
            const assertions = candidate.steps.find((s) => s.step_id === step.step_id).assertions,
              indices = assertions.flatMap((a, i) =>
                a.obligation_ids.includes(obligation.id) ? [i] : [],
              );
            assert.ok(indices.length);
            return {
              step_id: step.step_id,
              obligation_id: obligation.id,
              status: 'COVERED',
              assertion_indices: indices,
              reason: '合成审查：商品名和结果数量分别覆盖该条原预期。',
            };
          }),
        ),
        issues: [],
      };
    } else if (input.case) {
      assert.ok(request.messages[0].content.startsWith(REVIEW_PROMPT + '\n'));
      value = { issues: [] };
    } else {
      assert.ok(request.messages[0].content.startsWith(PLAN_PROMPT + '\n'));
      assert.ok(input.pages[0].controls.length > 0);
      const plan = structuredClone(fixture.plans[0]);
      plan.case_id = input.original.case_id;
      plan.case_hash = input.case_hash;
      plan.notes = markup;
      if (++planCalls === 1) {
        plan.steps[0].assertions.pop();
        plan.notes += ` ${secret} password="${password}"`;
      }
      value = { plan };
    }
    return new Response(
      JSON.stringify({
        model: 'fixture-diagnostics-model',
        usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 },
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
      }),
      { status: 200 },
    );
  },
});

async function until(predicate, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + label);
}

try {
  app = await start({ port: 0, dataDir: path.join(directory, 'data'), headless: true, provider });
  demo = await startDemo();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
      viewport: { width: 1536, height: 1100 },
      acceptDownloads: true,
    }),
    pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(app.url);
  await page.getByRole('button', { name: '导入测试用例', exact: true }).click();
  await page.locator('#task-name').fill('诊断日志集成验证（模拟模型回复）');
  await page.locator('#target').fill(demo.url + '/catalog');
  await page.locator('#case-file').setInputFiles({
    name: 'diagnostics-cases.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...fixture.baseline, case_count: 1, cases: [fixture.baseline.cases[0]] }),
    ),
  });
  await page.locator('#nonproduction').check();
  await page.getByRole('button', { name: '导入并检查' }).click();
  await page
    .getByRole('heading', { name: '诊断日志集成验证（模拟模型回复）', exact: true })
    .waitFor();
  const id = (await app.store.list())[0].id;
  await page.getByRole('checkbox', { name: '选择全部用例' }).check();
  await page.locator('#preparation-tools > summary').click();
  await page.getByRole('button', { name: '审查所选用例', exact: true }).click();
  await until(
    async () =>
      !app.controller.active &&
      (await app.store.read(id)).events.some((e) => e.type === 'CASE_REVIEWED'),
    'review saved',
  );
  await page.getByRole('button', { name: '确认所选原文' }).click();
  await page.getByRole('button', { name: '以上用例原文已核对' }).click();
  await page.getByText('待生成计划', { exact: true }).waitFor();
  await page.getByRole('button', { name: '打开浏览器', exact: true }).click();
  await page.getByText('浏览器已打开', { exact: true }).waitFor();
  await app.browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await page.getByRole('button', { name: '确认登录状态', exact: true }).click();
  await page.locator('#marker').selectOption({ label: '演示用户 · strong' });
  await page.locator('#save-marker').click();
  await page.getByText('登录可复用', { exact: true }).waitFor();
  await until(
    async () =>
      !app.controller.active && (await app.store.read(id)).cases[0].status === 'PLAN_REVIEW',
    'incomplete plan repaired and audited',
  );
  const prepared = (await app.store.read(id)).cases[0];
  assert.equal(prepared.self_repair.repair_count, 1);
  assert.equal(prepared.self_repair.rounds.length, 2);
  assert.equal(prepared.self_repair.rounds[0].code, 'ORACLE_COVERAGE_INCOMPLETE');
  assert.equal(prepared.plan_approved, false);
  assert.equal(prepared.attempts.length, 0);
  assert.equal(prepared.plan_audit.plan_hash, planHash(prepared.plan));
  await page.getByText('待确认计划', { exact: true }).waitFor();
  assert.equal(modelCalls, 6);

  await page.getByRole('button', { name: '按名称查询商品', exact: true }).click();
  await page.getByText('输入审查与计划自修复 · 已修复 1 / 2 次', { exact: true }).click();
  assert.ok(
    (await page.locator('.preparation-history').textContent()).includes(
      'ORACLE_COVERAGE_INCOMPLETE',
    ),
  );
  assert.ok(
    (await page.locator('.preparation-history').textContent()).includes('自检采纳不代表已经执行'),
  );
  assert.equal(await page.locator('#modal video').count(), 0);
  await page.screenshot({ path: path.join(directory, '00-repair-history.png'), fullPage: true });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const preparationReport = await (await fetch(`${app.url}/api/tasks/${id}/report`)).text();
  const reportManifest = JSON.parse(
    preparationReport
      .match(/<pre id="report-manifest">([\s\S]*?)<\/pre>/)[1]
      .replaceAll('&quot;', '"'),
  );
  assert.equal(reportManifest.counts.attempted, 0);
  assert.equal(reportManifest.counts.pass, 0);
  assert.ok(preparationReport.includes('已修复 1 / 2 次'));

  const response = await fetch(`${app.url}/api/tasks/${id}/diagnostics`);
  assert.equal(response.status, 200);
  const diagnostics = await response.json();
  assert.equal(diagnostics.schema_version, 'ui-agent-diagnostics/v1');
  assert.equal(diagnostics.logging_available, true);
  const requests = diagnostics.records.filter((r) => r.type === 'MODEL_REQUEST'),
    decisions = diagnostics.records.filter((r) => r.type === 'MODEL_DECISION');
  assert.equal(requests.length, 6);
  assert.equal(decisions.length, 6);
  assert.equal(decisions.filter((r) => r.outcome === 'REJECTED').length, 1);
  assert.equal(decisions.filter((r) => r.outcome === 'ACCEPTED').length, 5);
  for (const request of requests) {
    assert.equal(request.case_id, 'CATALOG-001');
    assert.ok(request.request_id && request.job_id);
    assert.ok(
      diagnostics.records.some(
        (r) => r.request_id === request.request_id && r.type === 'MODEL_TRANSPORT_STARTED',
      ),
    );
    assert.ok(
      diagnostics.records.some(
        (r) => r.request_id === request.request_id && r.type === 'MODEL_TRANSPORT_FINISHED',
      ),
    );
    assert.ok(
      diagnostics.records.some(
        (r) => r.request_id === request.request_id && r.type === 'MODEL_RESPONSE_PARSED',
      ),
    );
    assert.equal(decisions.filter((r) => r.request_id === request.request_id).length, 1);
  }
  const diagnosticText = JSON.stringify(diagnostics);
  assert.ok(!diagnosticText.includes(secret));
  assert.ok(!diagnosticText.includes(password));

  await page.getByRole('button', { name: '诊断日志', exact: true }).click();
  await page.locator('#diagnostics-case').selectOption('CATALOG-001');
  await page.locator('#diagnostics-type').selectOption('MODEL_DECISION');
  await page.locator('#diagnostics-outcome').selectOption('REJECTED');
  assert.equal(await page.locator('.diagnostic-record').count(), 1);
  await page.locator('.diagnostic-record summary').click();
  assert.ok(
    (await page.locator('#diagnostics-records').textContent()).includes(
      'ORACLE_COVERAGE_INCOMPLETE',
    ),
  );
  await page.screenshot({
    path: path.join(directory, '01-rejected-plan-diagnostics.png'),
    fullPage: true,
  });
  await page.locator('#diagnostics-outcome').selectOption('ACCEPTED');
  assert.equal(await page.locator('.diagnostic-record').count(), 5);
  await page.locator('#diagnostics-outcome').selectOption('');
  await page.locator('#diagnostics-type').selectOption('MODEL_RESPONSE_PARSED');
  assert.equal(await page.locator('.diagnostic-record').count(), 6);
  const displayedResponses = await page.locator('#diagnostics-records pre').allTextContents();
  assert.ok(
    displayedResponses
      .map((text) => JSON.parse(text))
      .some((record) => record.parsed_value?.plan?.notes === markup),
  );
  await page.locator('.diagnostic-record summary').first().click();
  assert.equal(await page.locator('#diagnostics-records img').count(), 0);
  assert.equal(await page.evaluate(() => window.diagnosticsInjection), undefined);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#diagnostics-download').click();
  const fullPath = path.join(directory, 'diagnostics-full.json');
  await (await downloadPromise).saveAs(fullPath);
  const exported = JSON.parse(await fs.readFile(fullPath, 'utf8'));
  assert.deepEqual(exported.records, diagnostics.records);
  assert.equal(exported.timeline.length, diagnostics.timeline.length);
  assert.ok(!JSON.stringify(exported).includes(secret));
  assert.ok(!JSON.stringify(exported).includes(password));
  await page.screenshot({ path: path.join(directory, '02-response-details.png'), fullPage: true });

  // Simulate an older service only for this test page. No live service is touched.
  await page.route(`**/api/tasks/${id}/diagnostics`, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'NOT_FOUND' }),
    }),
  );
  await page.locator('#diagnostics-refresh').click();
  await page
    .locator('#modal-body .notice')
    .filter({ hasText: '本轮基础日志；模型原始回复未留档' })
    .waitFor();
  const fallbackPromise = page.waitForEvent('download');
  await page.locator('#diagnostics-download').click();
  const fallbackPath = path.join(directory, 'diagnostics-basic.json');
  await (await fallbackPromise).saveAs(fallbackPath);
  const fallback = JSON.parse(await fs.readFile(fallbackPath, 'utf8'));
  assert.equal(fallback.logging_available, false);
  assert.deepEqual(fallback.records, []);
  assert.ok(fallback.timeline.length > 0);
  const allowed = [
    'type',
    'at',
    'case_id',
    'step_id',
    'job_id',
    'request_id',
    'operation',
    'status',
    'code',
    'passed',
    'attempt',
    'repair_count',
    'duration_ms',
    'requested_model',
    'response_model',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
  ];
  for (const event of fallback.timeline)
    assert.ok(Object.keys(event).every((key) => allowed.includes(key)));
  for (const forbidden of [
    'snapshots',
    'original',
    'effective',
    'authorization',
    'auth',
    'plan',
    'cases',
  ])
    assert.ok(!Object.hasOwn(fallback, forbidden));
  assert.ok(!JSON.stringify(fallback).includes(secret));
  assert.ok(!JSON.stringify(fallback).includes(password));
  await page.screenshot({
    path: path.join(directory, '03-basic-log-fallback.png'),
    fullPage: true,
  });
  assert.deepEqual(pageErrors, []);
  const summary = {
    scope:
      'Local server/controller and Chromium diagnostics integration; DeepSeek transport injected with synthetic replies; zero real API calls; no product execution.',
    task_id: id,
    model_calls: modelCalls,
    requests_logged: requests.length,
    decisions: decisions.map((r) => ({
      request_id: r.request_id,
      outcome: r.outcome,
      code: r.code ?? r.error_code ?? null,
    })),
    request_response_decision_correlated: true,
    rejected_plan_trace_visible: true,
    case_type_outcome_filters: true,
    full_local_export: true,
    credential_absent_from_diagnostics: true,
    html_escaped: true,
    legacy_404_fallback: true,
    basic_export_metadata_only: true,
    page_errors: pageErrors,
  };
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify({ validated: true, directory, model_calls: modelCalls }) + '\n',
  );
} finally {
  await browser?.close();
  await app?.close();
  await demo?.close();
}

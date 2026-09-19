import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { stepOutcome, renderEvidenceSteps } from '../public/evidence-view.js';

const steps = [1, 2, 3, 4].map((id) => ({
  step_id: String(id),
  action: `原操作${id}`,
  expected: `原预期${id}`,
}));
const fact = () => ({
  executed_case: { steps },
  status: 'TECHNICAL_FAILED',
  error: 'ADAPTIVE_NO_PROGRESS',
  adaptive_steps: [{ step_id: '1', status: 'COMPLETE' }],
  adaptive_segments: [
    { step_id: '1', status: 'EXECUTED' },
    { step_id: '2', error: 'ADAPTIVE_NO_PROGRESS' },
  ],
  assertions: [
    { step_id: '1', passed: true, actual: '正常' },
    { step_id: '2', passed: true, actual: '局部匹配' },
  ],
});

test('partial success is incomplete, later untouched steps are not failed, facts remain unchanged', () => {
  const f = fact(),
    before = structuredClone(f);
  assert.deepEqual(
    steps.map((s) => stepOutcome(f, s.step_id).status),
    ['PASS', 'INCOMPLETE', 'NOT_EXECUTED', 'NOT_EXECUTED'],
  );
  assert.equal(stepOutcome(f, '3').error, null);
  const html = renderEvidenceSteps(f);
  assert.match(html, /通过 1 · 失败 0 · 未完成 1 · 未执行 2/);
  assert.match(html, /不随播放进度变化/);
  assert.deepEqual(f, before);
});

test('explicit mismatch wins over completion; group mismatch does not count as passing', () => {
  const f = fact();
  f.assertions[0].group_passed = false;
  assert.equal(stepOutcome(f, '1').status, 'FAIL');
  assert.equal(stepOutcome(f, '1').passedChecks, 0);
  f.assertions[0].group_passed = true;
  f.assertions[0].passed = false;
  assert.equal(stepOutcome(f, '1').status, 'FAIL');
});

test('complete without observations, unfinished checkpoint and unknown measurements cannot pass', () => {
  const f = fact();
  f.assertions = [];
  assert.equal(stepOutcome(f, '1').status, 'INCOMPLETE');
  f.assertions = [{ step_id: '1' }];
  assert.equal(stepOutcome(f, '1').status, 'INCOMPLETE');
  f.assertions[0].passed = true;
  f.checkpoints = [{ step_id: '1', status: 'RUNNING' }];
  assert.equal(stepOutcome(f, '1').status, 'INCOMPLETE');
  f.checkpoints = [{ step_id: '4', status: 'NOT_EXECUTED' }];
  assert.equal(stepOutcome(f, '4').status, 'NOT_EXECUTED');
});

test('frozen executed case wins over later edits and unsafe strings are escaped', () => {
  const f = fact();
  f.executed_case = {
    steps: [{ ...steps[0], action: '<img onerror=bad()>', expected: '<script>bad()</script>' }],
  };
  const html = renderEvidenceSteps(f, { steps: [{ step_id: 'new', action: 'later edit' }] });
  assert.ok(!html.includes('later edit') && !html.includes('<img') && !html.includes('<script>'));
  assert.match(html, /&lt;img/);
  assert.match(renderEvidenceSteps({}), /没有原步骤快照/);
});

test('legacy evidence remains compatible and missing media does not hide step outcomes', () => {
  const f = { assertions: [{ step_id: '1', passed: true }], media: [] };
  assert.equal(stepOutcome(f, '1').status, 'PASS');
  assert.match(renderEvidenceSteps(f, { steps }), /通过 1/);
  assert.equal(stepOutcome(null, '1').status, 'NOT_EXECUTED');
});

test('console HTTP serves shared presentation assets with JavaScript/CSS MIME without broadening file access', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-assets-'));
  const app = await start({
    port: 0,
    dataDir: dir,
    headless: true,
    provider: { configured: () => false },
  });
  t.after(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  for (const [file, mime] of [
    ['evidence-view.js', 'text/javascript'],
    ['evidence.css', 'text/css'],
  ]) {
    const res = await fetch(app.url + '/' + file);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').startsWith(mime));
    assert.equal(
      await res.text(),
      await fs.readFile(new URL('../public/' + file, import.meta.url), 'utf8'),
    );
  }
  assert.equal((await fetch(app.url + '/src/report-view.mjs')).status, 404);
});

test('desktop and narrow recording panels render all result labels and work with keyboard', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const css = await fs.readFile(new URL('../public/evidence.css', import.meta.url), 'utf8');
  for (const width of [1440, 768, 375]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const f = fact();
    f.assertions.push({ step_id: '3', passed: false, expected: '正常', actual: '故障' });
    await page.setContent(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:16px;font:16px/1.6 sans-serif}${css}</style><div class="execution-review"><div class="execution-media"><video controls aria-label="合成录像"></video><p>无媒体合成布局测试</p></div>${renderEvidenceSteps(f)}</div>`,
    );
    assert.equal(
      await page.getByText('通过 1 · 失败 1 · 未完成 1 · 未执行 1', { exact: true }).count(),
      1,
    );
    assert.equal(await page.locator('[data-step-result]').count(), 4);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `overflow at ${width}`,
    );
    const summary = page.locator('.result-steps summary').first();
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.ok((await page.locator('.result-steps details').first().getAttribute('open')) !== null);
    assert.equal(await page.getByText('原预期1', { exact: false }).isVisible(), true);
    assert.equal(await page.locator('video').getAttribute('autoplay'), null);
    await page.close();
  }
});

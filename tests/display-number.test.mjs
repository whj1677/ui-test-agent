import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { validateAssertion, suggestObligations } from '../src/plans.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import {
  displayNumber,
  displayUnit,
  sourceSupportsNumber,
  sourceDisplayUnits,
} from '../src/table-assertion.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';

const target = {
  kind: 'within',
  scope: { role: 'dialog', name: '设备详情', exact: true },
  target: { kind: 'definition', name: '额定功率', exact: true },
};
const source = (expected = '额定功率200。') =>
  suggestObligations([{ step_id: '1', action: '核对额定功率。', expected }])[0];
const assertion = (s = source(), check = 'display_number', expected = 200) => ({
  target,
  check,
  expected,
  oracle_quote: s.expected,
  obligation_ids: ['1-O1'],
});

test('display number uses the existing strict closed numeric display grammar', () => {
  for (const s of ['200', '200.0', '200 kW', '2e2 kW', '200 MW'])
    assert.equal(displayNumber(s), 200);
  for (const s of [
    '',
    '200 or 120',
    'power 200',
    '200 kW / 120 kW',
    '200 unknown',
    '200<script>',
    'Infinity',
  ])
    assert.equal(displayNumber(s), null, s);
  assert.equal(displayNumber('1200 kW'), 1200);
  assert.equal(displayUnit('200.0 kW'), 'kW');
  assert.equal(sourceSupportsNumber(200, { expected: '编号D200' }), false);
  assert.equal(sourceSupportsNumber(200, { expected: '功率200。' }), true);
  assert.deepEqual(sourceDisplayUnits(200, { expected: '功率200kW。' }), ['kW']);
  assert.deepEqual(sourceDisplayUnits(200, { expected: '编号D200kW' }), []);
});

test('projection requires a sourced finite number, scoped definition and no explicit unit', () => {
  assert.doesNotThrow(() => validateAssertion(assertion(), source()));
  for (const expected of ['200', NaN, Infinity])
    assert.throws(
      () => validateAssertion(assertion(source(), 'display_number', expected), source()),
      { code: 'ASSERTION_NUMBER_INVALID' },
    );
  assert.throws(
    () =>
      validateAssertion(
        { ...assertion(), target: { kind: 'text', value: '200 kW', exact: true } },
        source(),
      ),
    { code: 'ASSERTION_DISPLAY_NUMBER_SCOPE' },
  );
  assert.throws(() => validateAssertion(assertion(source(), 'display_number', 120), source()), {
    code: 'ASSERTION_DISPLAY_NUMBER_SOURCE',
  });
  const explicit = source('额定功率200kW。');
  assert.throws(() => validateAssertion(assertion(explicit), explicit), {
    code: 'ASSERTION_DISPLAY_UNIT_REQUIRED',
  });
  assert.throws(() => validateAssertion(assertion(), source(), { data: { power: '200 kW' } }), {
    code: 'ASSERTION_DISPLAY_UNIT_REQUIRED',
  });
});

test('new adaptive unit text cannot be copied from observation; fixed text behavior stays unchanged', () => {
  const check = (s, adaptive = true) =>
    requirePlanSemantics(
      { steps: [{ assertions: [assertion(s, 'text', '200 kW')] }] },
      { steps: [s] },
      { adaptive_readonly: adaptive, pages: [{ controls: [{ locator: target }] }] },
      { complete: false },
    );
  assert.throws(() => check(source()), { code: 'PLAN_DISPLAY_UNIT_UNSUPPORTED' });
  assert.doesNotThrow(() => check(source(), false));
  assert.doesNotThrow(() => check(source('额定功率200kW。')));
  assert.throws(() => check(source('额定功率200MW。')), { code: 'PLAN_DISPLAY_UNIT_UNSUPPORTED' });
});

test('actual browser projection preserves DOM evidence and does not convert or match a substring', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const [actual, passed] of [
    ['200', true],
    ['200 kW', true],
    ['200.00', true],
    ['1200 kW', false],
    ['120 kW', false],
  ]) {
    await page.setContent(
      `<dialog open aria-label="设备详情"><dl><dt>额定功率</dt><dd>${actual}</dd></dl></dialog>`,
    );
    const [result] = await checkAssertionGroup(page, [assertion()], { timeout: 500 });
    assert.equal(result.passed, passed, actual);
    assert.equal(result.actual, actual);
    assert.deepEqual(result.numeric_projection, {
      value: displayNumber(actual),
      unit_verified: false,
      conversion: false,
    });
  }
  await page.setContent(
    '<dialog open aria-label="设备详情"><dl><dt>额定功率</dt><dd>200 or 120</dd></dl></dialog>',
  );
  await assert.rejects(checkAssertionGroup(page, [assertion()], { timeout: 500 }), {
    code: 'ASSERTION_DISPLAY_NUMBER_UNPARSEABLE',
  });
  await page.setContent(
    '<dialog open aria-label="设备详情"><dl><dt>额定功率</dt><dd>200 kW</dd><dt>额定功率</dt><dd>200 kW</dd></dl></dialog>',
  );
  await assert.rejects(checkAssertionGroup(page, [assertion()], { timeout: 500 }));
});

// Actual browser/controller, injected model only: not real-model acceptance.
for (const scenario of ['repair', 'difference', 'repeat', 'scalar'])
  test(`display-number candidate repair with no business replay: ${scenario}`, async (t) => {
    const actual = scenario === 'difference' ? '120 kW' : '200 kW';
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>字段验证</h1><dialog open aria-label="设备详情"><dl><dt>额定功率</dt><dd>${actual}</dd></dl></dialog>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'display-number-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = { case_id: 'DISPLAY', title: '详情数值', steps: [source()] };
    const marker = { kind: 'role', role: 'heading', name: '字段验证', exact: true };
    const id = await store.create({
      name: 'display numeric engineering',
      target: `http://127.0.0.1:${server.address().port}/`,
      baseline: { cases: [c] },
    });
    await store.update(id, (s) => {
      s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
      s.auth_marker = marker;
    });
    const browser = new BrowserSession({ headless: true });
    t.after(() => browser.close());
    const task = await store.read(id);
    await browser.open(task);
    await browser.authenticate(task, marker);
    let plans = 0,
      audits = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          audits++;
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: 'COVERED',
                assertion_refs: ['A1'],
                reason: '同一已绑定字段的原数值，不增加单位',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(
              input.correction.code,
              scenario === 'scalar'
                ? 'ASSERTION_NUMERIC_FIELD_REQUIRED'
                : 'PLAN_DISPLAY_UNIT_UNSUPPORTED',
            );
            assert.equal(input.progress.completed_segments, 0);
            assert.equal(input.remaining.replans, 3 - plans);
          }
          const bad = plans === 1 || scenario === 'repeat';
          value = {
            actions: [],
            assertions: [
              {
                target,
                check: bad ? (scenario === 'scalar' ? 'number' : 'text') : 'display_number',
                expected: bad && scenario !== 'scalar' ? '200 kW' : 200,
                source_refs: ['1-O1'],
              },
            ],
            complete: true,
            within_ms: 500,
            reason: '原数值字段',
          };
        }
        return {
          value,
          usage: { response_model: 'injected', prompt_tokens: 1, completion_tokens: 1 },
        };
      },
    };
    const controller = new Controller({ store, browser, provider, planningMode: 'adaptive' });
    await controller.confirmCase(id, c.case_id, { steps: c.steps });
    await controller.launch(id, 'test', [c.case_id]);
    await controller.active?.finished;
    const row = (await store.read(id)).cases[0];
    const fact = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      fact.adaptive_segments[0].error,
      scenario === 'scalar' ? 'ASSERTION_NUMERIC_FIELD_REQUIRED' : 'PLAN_DISPLAY_UNIT_UNSUPPORTED',
    );
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    assert.equal(fact.actions.length, 0);
    assert.equal(plans, 2);
    assert.equal(audits, scenario === 'repeat' ? 0 : 1);
    assert.equal(
      fact.status,
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(fact.assertions.length, scenario === 'repeat' ? 0 : 1);
    if (scenario === 'repeat') assert.equal(fact.error, 'ADAPTIVE_NO_PROGRESS');
    else
      assert.equal(
        fact.assertions[0].numeric_projection.value,
        scenario === 'difference' ? 120 : 200,
      );
  });

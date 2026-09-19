import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { ADAPTIVE_NUMERIC_GUIDANCE } from '../src/table-assertion.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';

test('planner and reviewer share explicit numeric capability boundaries', () => {
  for (const prompt of [ADAPTIVE_NEXT_PROMPT, ADAPTIVE_REVIEW_REFERENCES])
    assert.ok(prompt.includes(ADAPTIVE_NUMERIC_GUIDANCE));
});

test('fixed scalar numeric semantics stay strict, not silently extended to display units', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const [actual, passed] of [
    ['200', true],
    ['200 kW', false],
    ['120', false],
    ['200 or 120', false],
  ]) {
    await page.setContent(`<p id="power">${actual}</p>`);
    const [result] = await checkAssertionGroup(
      page,
      [{ target: { kind: 'css', value: '#power' }, check: 'number', expected: 200 }],
      { timeout: 100 },
    );
    assert.equal(result.passed, passed, actual);
    assert.equal(result.actual, actual);
  }
});

// Actual Chromium + actual controller, injected model only: NOT real-model acceptance.
for (const scenario of ['suffix', 'pure-number', 'difference', 'repeat']) {
  test(`numeric capability repair before dispatch: ${scenario}`, async (t) => {
    const actual =
      scenario === 'difference' ? '120 kW' : scenario === 'pure-number' ? '200' : '200 kW';
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>设备</h1><table><thead><tr><th>编号</th><th>额定功率</th></tr></thead><tbody><tr><td>D009</td><td>${actual}</td></tr></tbody></table>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'numeric-capability-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'NUM',
      title: '数字能力',
      steps: suggestObligations([
        { step_id: '1', action: '核对设备D009的额定功率。', expected: '编号D009的额定功率200。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '设备', exact: true };
    const table = { kind: 'role', role: 'table', name: '', exact: true };
    const cell = {
      kind: 'cell',
      table,
      key: { column: '编号', value: 'D009' },
      column: '额定功率',
    };
    const id = await store.create({
      name: 'numeric engineering',
      target,
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
                reason: '同一编号的额定功率数值',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(input.correction.code, 'ASSERTION_NUMERIC_TABLE_REQUIRED');
            assert.equal(input.progress.completed_segments, 0);
            assert.equal(input.remaining.replans, 3 - plans);
            assert.match(input.correction.instruction, /SAME table/);
          }
          const repaired = plans > 1 && scenario !== 'repeat';
          value = {
            actions: [],
            assertions: [
              {
                ...(repaired
                  ? {
                      target: table,
                      check: 'table_cells',
                      expected: {
                        key_column: '编号',
                        rows: [
                          {
                            key: 'D009',
                            cells: [{ column: '额定功率', check: 'number', expected: 200 }],
                          },
                        ],
                        ordered: false,
                        exact_rows: false,
                      },
                    }
                  : { target: cell, check: 'number', expected: 200 }),
                source_refs: ['1-O1'],
              },
            ],
            complete: true,
            within_ms: 100,
            reason: '保持原数值与对象',
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
    assert.equal(fact.actions.length, 0);
    assert.equal(fact.adaptive_segments[0].error, 'ASSERTION_NUMERIC_TABLE_REQUIRED');
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    if (scenario === 'repeat') {
      assert.equal(plans, 3);
      assert.equal(audits, 0);
      assert.equal(fact.assertions.length, 0);
      assert.equal(fact.error, 'ASSERTION_NUMERIC_TABLE_REQUIRED');
      assert.equal(fact.status, 'TECHNICAL_FAILED');
    } else {
      assert.equal(plans, 2);
      assert.equal(audits, 1);
      assert.equal(fact.assertions.length, 1);
      assert.equal(fact.assertions[0].check, 'table_cells');
      assert.equal(fact.assertions[0].expected.rows[0].cells[0].expected, 200);
      assert.equal(fact.status, scenario === 'difference' ? 'FAIL_ASSERTION' : 'PASS_ASSERTIONS');
    }
  });
}

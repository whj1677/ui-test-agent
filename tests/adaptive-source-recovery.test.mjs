import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';

// Isolated real Chromium and controller, injected decisions only. No provider API.
for (const scenario of ['repair', 'still-ungrounded', 'actual-mismatch']) {
  test(`real V02 source-unit failure through execution loop: ${scenario}`, async (t) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>资产设备</h1><table><thead><tr><th>编号</th><th>额定功率</th></tr></thead><tbody><tr><td>D009</td><td>${scenario === 'actual-mismatch' ? 201 : 200} kW</td></tr></tbody></table>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-source-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'SOURCE-1',
      title: '原数值与显示单位',
      steps: suggestObligations([
        { step_id: '4', action: '核对设备D009的额定功率。', expected: '编号D009的额定功率200。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '资产设备', exact: true };
    const id = await store.create({ name: '来源纠错隔离回放', target, baseline: { cases: [c] } });
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
                step_id: '4',
                obligation_id: '4-O1',
                status: 'COVERED',
                assertion_indices: [0],
                reason: '同表编号D009及功率数值200覆盖原预期',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(input.correction.code, 'TABLE_SOURCE_UNGROUNDED');
            assert.equal(input.correction.field_path, 'expected.rows[0].cells[0].expected');
            assert.equal(input.remaining.replans, 3 - plans);
            assert.equal(input.progress.completed_segments, 0);
          }
          const bad = plans === 1 || scenario === 'still-ungrounded';
          value = {
            actions: [],
            assertions: [
              {
                target: { kind: 'role', role: 'table', name: '', exact: true },
                check: 'table_cells',
                expected: {
                  key_column: '编号',
                  rows: [
                    {
                      key: 'D009',
                      cells: [
                        {
                          column: '额定功率',
                          check: bad ? 'text' : 'number',
                          expected: bad ? '200 kW' : 200,
                        },
                      ],
                    },
                  ],
                  ordered: true,
                  exact_rows: true,
                },
                oracle_quote: c.steps[0].expected,
                obligation_ids: ['4-O1'],
              },
            ],
            complete: true,
            within_ms: 200,
            reason: '核对原数值，不以现场显示反推预期',
          };
        }
        return {
          value,
          usage: { response_model: 'injected', prompt_tokens: 1, completion_tokens: 1 },
        };
      },
    };
    const controller = new Controller({ store, provider, browser, planningMode: 'adaptive' });
    await controller.confirmCase(id, c.case_id, { steps: c.steps });
    await controller.launch(id, 'test', [c.case_id]);
    await controller.active?.finished;
    const state = await store.read(id);
    const row = state.cases[0];
    assert.ok(row.attempts.length, JSON.stringify(state.events.slice(-5)));
    const fact = await store.facts(id, row.attempts.at(-1));
    assert.equal(fact.actions.length, 0);
    assert.equal(fact.adaptive_segments[0].error, 'TABLE_SOURCE_UNGROUNDED');
    if (scenario === 'still-ungrounded') {
      assert.equal(fact.status, 'TECHNICAL_FAILED');
      assert.equal(fact.error, 'TABLE_SOURCE_UNGROUNDED');
      assert.equal(plans, 3);
      assert.equal(audits, 0);
      assert.equal(fact.assertions.length, 0);
    } else {
      assert.equal(plans, 2);
      assert.equal(audits, 1);
      assert.equal(
        fact.status,
        scenario === 'repair' ? 'PASS_ASSERTIONS' : 'FAIL_ASSERTION',
        JSON.stringify(fact),
      );
      assert.equal(fact.assertions[0].expected.rows[0].cells[0].expected, 200);
      assert.equal(fact.adaptive_steps.length, scenario === 'repair' ? 1 : 0);
    }
  });
}

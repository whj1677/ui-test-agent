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

for (const difference of [false, true])
  test('same-step original order source, actual difference=' + difference, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>排序演练</h1><button id="query">查询</button><table aria-label="结果"><thead><tr><th>编号</th><th>额定功率</th></tr></thead><tbody><tr><td>X001</td><td>10 kW</td></tr><tr><td>X002</td><td>20 kW</td></tr></tbody></table><script>document.querySelector("#query").onclick=()=>{const c=document.querySelectorAll("tbody tr td:last-child");c[0].textContent="' +
          (difference ? '10' : '20') +
          ' kW";c[1].textContent="' +
          (difference ? '20' : '10') +
          ' kW"}</script>',
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'table-order-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'ORDER',
      title: '按原指定字段排序',
      steps: suggestObligations([
        { step_id: '1', action: '点击查询，按功率降序排列。', expected: '应用排序。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '排序演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'order engineering',
      target: 'http://127.0.0.1:' + server.address().port + '/',
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
                reason: '按当前原动作指定的功率降序验证当前页，不推断值或总量',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans === 2) assert.equal(input.correction.code, 'TABLE_ORDER_SOURCE_REQUIRED');
          value = {
            actions: [
              { op: 'click', target: { kind: 'role', role: 'button', name: '查询', exact: true } },
            ],
            assertions: [
              {
                target: table,
                check: 'table_order',
                expected: {
                  field: '功率',
                  column: '额定功率',
                  direction: plans === 1 ? 'ascending' : 'descending',
                  comparison: 'number',
                },
                source_refs: ['1-O1'],
              },
            ],
            complete: true,
            within_ms: 5000,
            reason: '当前原步骤排序关系；首次错误方向必须先拒绝再改候选',
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
    assert.equal(fact.status, difference ? 'FAIL_ASSERTION' : 'PASS_ASSERTIONS');
    assert.equal(plans, 2);
    assert.equal(audits, 1);
    assert.equal(fact.actions.filter((a) => a.dispatched).length, 1);
    assert.equal(fact.assertions[0].check, 'table_order');
    assert.equal(fact.assertions[0].expected.direction, 'descending');
    assert.deepEqual(fact.assertions[0].table_comparison.values, difference ? [10, 20] : [20, 10]);
    assert.ok(
      fact.adaptive_segments.some(
        (s) => s.error === 'TABLE_ORDER_SOURCE_REQUIRED' && !s.dispatched,
      ),
    );
  });

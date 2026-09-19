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

for (const scenario of ['correct', 'wrong-table-order', 'persistent-control-only'])
  test('actual order, not control state: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      const ids = scenario === 'wrong-table-order' ? ['X002', 'X001'] : ['X001', 'X002'];
      r.end(
        '<h1>顺序证据演练</h1><label>排序<select><option selected>编号升序</option></select></label><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody>' +
          ids.map((id) => '<tr><td>' + id + '</td></tr>').join('') +
          '</tbody></table>',
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'order-evidence-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'ORDER',
      title: '初始顺序实测',
      steps: suggestObligations([
        { step_id: '1', action: '观察初始列表，不改变排序。', expected: '排序为编号升序。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '顺序证据演练', exact: true },
      table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'order evidence engineering',
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
                reason: '实际同表体顺序测量，不以选项代替',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans === 2) assert.equal(input.correction.code, 'PLAN_TABLE_ORDER_UNPROVEN');
          const bad = plans === 1 || scenario === 'persistent-control-only';
          value = {
            actions: [],
            assertions: [
              bad
                ? {
                    target: { kind: 'label', value: '排序', exact: true },
                    check: 'selected_label',
                    expected: '编号升序',
                    source_refs: ['1-O1'],
                  }
                : {
                    target: table,
                    check: 'table_order',
                    expected: {
                      field: '编号',
                      column: '编号',
                      direction: 'ascending',
                      comparison: 'identifier',
                    },
                    source_refs: ['1-O1'],
                  },
            ],
            complete: true,
            within_ms: 1500,
            reason: bad ? '错误地只检查了选项' : '补同一当前表的真实顺序，无额外业务动作',
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
    const row = (await store.read(id)).cases[0],
      f = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'correct'
        ? 'PASS_ASSERTIONS'
        : scenario === 'wrong-table-order'
          ? 'FAIL_ASSERTION'
          : 'TECHNICAL_FAILED',
    );
    assert.equal(f.actions.filter((a) => a.dispatched).length, 0);
    assert.ok(
      f.adaptive_segments.some((s) => s.error === 'PLAN_TABLE_ORDER_UNPROVEN' && !s.dispatched),
    );
    assert.equal(audits, scenario === 'persistent-control-only' ? 0 : 1);
    assert.equal(f.assertions.length, scenario === 'persistent-control-only' ? 0 : 1);
    if (f.assertions.length) {
      assert.equal(f.assertions[0].check, 'table_order');
      assert.equal(f.assertions[0].passed, scenario === 'correct');
    }
  });

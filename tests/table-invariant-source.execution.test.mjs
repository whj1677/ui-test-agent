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
  test(`pre-action baseline for same-step equality prose, difference=${difference}`, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>查询演练</h1><label>关键词<input id='kw' type='search'></label><table aria-label='结果'><thead><tr><th>编号</th><th>值</th></tr></thead><tbody><tr><td>X1</td><td id='v'>10</td></tr></tbody></table>${difference ? "<script>document.querySelector('#kw').addEventListener('input',()=>document.querySelector('#v').textContent='99')</script>" : ''}`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'invariant-source-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'INVARIANT-SOURCE',
      title: '输入前后表格一致',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '在关键词输入A，不点击查询。',
          expected: '表格内容与操作前完全一致。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '查询演练', exact: true },
      table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'invariant source engineering',
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
    let plans = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT))
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: 'COVERED',
                assertion_refs: ['A1'],
                reason: '同一步操作前运行器基线与操作后完整表格比较',
              },
            ],
            issues: [],
          };
        else {
          plans++;
          assert.equal(input.table_baseline?.captured, true);
          value = {
            actions: [
              { op: 'fill', target: { kind: 'label', value: '关键词', exact: true }, value: 'A' },
            ],
            assertions: [{ target: table, check: 'table_unchanged', source_refs: ['1-O1'] }],
            complete: true,
            within_ms: 5000,
            reason: '只填条件，完整比较操作前基线',
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
      fact = await store.facts(id, row.attempts.at(-1));
    assert.equal(fact.status, difference ? 'FAIL_ASSERTION' : 'PASS_ASSERTIONS');
    assert.equal(plans, 1);
    assert.equal(fact.actions.filter((a) => a.dispatched).length, 1);
    const measured = [...fact.assertions, ...(fact.relational_observations ?? [])].filter(
      (a) => a.check === 'table_unchanged',
    );
    assert.ok(measured.length > 0);
    assert.ok(measured.every((a) => a.table_comparison.before.rows[0][1] === '10'));
    if (difference)
      assert.ok(measured.some((a) => !a.passed && a.table_comparison.after.rows[0][1] === '99'));
  });

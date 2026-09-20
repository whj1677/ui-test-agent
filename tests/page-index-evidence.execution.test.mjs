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

for (const scenario of ['correct', 'wrong-page', 'persistent-missing', 'after-navigation'])
  test('current page is not inferred from IDs: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>分页演练</h1><span id="pager">第${scenario === 'wrong-page' ? 11 : 1}/12页</span><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>X001</td></tr><tr><td>X002</td></tr></tbody></table>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'page-index-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'PAGE',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '打开 /list 并观察默认列表。',
          expected: '默认第1页显示X001至X002。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '分页演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'current page engineering',
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
                assertion_refs: input.assertion_catalog.map((a) => a.ref),
                reason: '注入审查误以编号代替页码，必要证据仍必须检查',
              },
            ],
            issues: [],
          };
        else {
          plans++;
          const bad = plans === 1 || scenario === 'persistent-missing';
          const nav = { action_id: 'nav-' + plans, op: 'navigate', value: '/list' };
          const matrix = {
            target: table,
            check: 'table_cells',
            expected: {
              key_column: '编号',
              rows: ['X001', 'X002'].map((key) => ({
                key,
                cells: [{ column: '编号', check: 'text', expected: key }],
              })),
              ordered: false,
              exact_rows: false,
            },
            source_refs: ['1-O1'],
          };
          const pager = {
            target: { kind: 'css', value: '#pager' },
            check: 'contains',
            expected: '第1/',
            source_refs: ['1-O1'],
          };
          const already = scenario === 'after-navigation' && plans > 1;
          value = {
            actions: already ? [] : [nav],
            assertions: already ? [pager] : bad ? [matrix] : [matrix, pager],
            complete: !(scenario === 'after-navigation' && plans === 1),
            within_ms: 1500,
            reason: bad ? '先查编号，缺页码' : '原当前页独立测量，不复制总页数',
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
      scenario === 'wrong-page'
        ? 'FAIL_ASSERTION'
        : scenario === 'persistent-missing'
          ? 'TECHNICAL_FAILED'
          : 'PASS_ASSERTIONS',
      JSON.stringify(f.error),
    );
    assert.equal(
      f.actions.filter((a) => a.operation === 'navigate' && a.dispatched).length,
      scenario === 'persistent-missing' ? 0 : 1,
    );
    assert.ok(
      f.adaptive_segments.some((s) => s.error === 'PLAN_CURRENT_PAGE_UNPROVEN' && !s.dispatched),
    );
    const pages = f.assertions.filter((a) => a.target?.value === '#pager');
    assert.equal(pages.length, scenario === 'persistent-missing' ? 0 : 1);
    if (pages.length) {
      assert.equal(pages[0].expected, '第1/');
      assert.equal(pages[0].passed, scenario !== 'wrong-page');
    }
  });

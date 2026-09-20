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

for (const scenario of ['joint', 'extra', 'closed', 'closed-extra', 'persistent'])
  test('sole-record proof through actual Controller: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>唯一记录演练</h1><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>R009</td></tr>' +
          (scenario.includes('extra') ? '<tr><td>R010</td></tr>' : '') +
          '</tbody></table>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'unique-row-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'UNIQUE',
      steps: suggestObligations([
        { step_id: '1', action: '打开 /result 并核对结果。', expected: '唯一行是R009。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '唯一记录演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'sole-record engineering',
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
                status: input.complete ? 'COVERED' : 'MISSING',
                assertion_refs: input.complete ? input.assertion_catalog.map((a) => a.ref) : [],
                reason: '原唯一身份与数量需要同次实际证明',
              },
            ],
            issues: input.complete
              ? []
              : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '导航不是测量' }],
          };
        else {
          plans++;
          assert.deepEqual(input.step_capabilities.unique_rows, [
            { source_ref: '1-O1', key: 'R009', row_count: 1 },
          ]);
          if (plans === 1)
            value = {
              actions: [{ op: 'navigate', value: '/result' }],
              assertions: [],
              complete: false,
              within_ms: 800,
              reason: '原导航一次',
            };
          else {
            if (plans > 2) assert.equal(input.correction.code, 'PLAN_UNIQUE_ROW_UNPROVEN');
            const repaired = plans > 2 && scenario !== 'persistent';
            const matrix = {
              target: table,
              check: 'table_cells',
              expected: {
                key_column: '编号',
                rows: [
                  { key: 'R009', cells: [{ column: '编号', check: 'text', expected: 'R009' }] },
                ],
                ordered: false,
                exact_rows: repaired && scenario.startsWith('closed'),
              },
              source_refs: ['1-O1'],
            };
            value = {
              actions: [],
              assertions: [
                matrix,
                ...(repaired && !scenario.startsWith('closed')
                  ? [{ target: table, check: 'row_count', expected: 1, source_refs: ['1-O1'] }]
                  : []),
              ],
              complete: true,
              within_ms: 800,
              reason: '只补原唯一性测量，不重放导航',
            };
          }
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
    const f = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'persistent'
        ? 'TECHNICAL_FAILED'
        : scenario.includes('extra')
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
      JSON.stringify(f.error),
    );
    assert.equal(plans, 3);
    assert.equal(f.actions.length, 1, 'no navigation replay');
    assert.ok(
      f.adaptive_segments.some((s) => s.error === 'PLAN_UNIQUE_ROW_UNPROVEN' && !s.dispatched),
    );
    assert.equal(
      f.assertions.length,
      scenario === 'persistent' ? 0 : scenario.startsWith('closed') ? 1 : 2,
    );
    if (f.assertions.length === 2) {
      assert.equal(f.assertions[0].sample_id, f.assertions[1].sample_id);
      assert.equal(f.assertions[1].actual, scenario === 'extra' ? 2 : 1);
    }
    if (scenario.includes('extra')) assert.equal(f.assertions.at(-1).passed, false);
  });

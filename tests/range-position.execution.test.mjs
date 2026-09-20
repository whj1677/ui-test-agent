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

for (const scenario of ['correct', 'shifted', 'repeat', 'closed-extra', 'wrong-position'])
  test('source position interval through actual Controller: ' + scenario, async (t) => {
    const ids = ['R301', 'R499', 'R102'];
    const actual = ['R900', ...ids, 'R901'];
    if (scenario === 'shifted') actual.unshift('R902');
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>行区间演练</h1><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody>' +
          actual.map((id) => '<tr><td>' + id + '</td></tr>').join('') +
          '</tbody></table>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'range-position-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'RANGE',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '打开 /positions 并核对结果。',
          expected: '第2至4行依次为R301、R499、R102。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '行区间演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'range source engineering',
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
    const wantedError =
      scenario === 'closed-extra'
        ? 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED'
        : scenario === 'wrong-position'
          ? 'TABLE_POSITION_UNGROUNDED'
          : 'PLAN_ROW_POSITION_UNPROVEN';
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
                assertion_refs: input.complete ? ['A1'] : [],
                reason: '原位置须实际测量，导航不代替断言',
              },
            ],
            issues: input.complete
              ? []
              : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '导航后尚待原行位置测量' }],
          };
        else {
          plans++;
          assert.deepEqual(
            input.step_capabilities.row_positions,
            ids.map((key, i) => ({
              source_ref: '1-O1',
              key,
              position: i + 2,
              required_check: 'table_cells',
            })),
          );
          if (plans === 1)
            value = {
              actions: [{ op: 'navigate', value: '/positions' }],
              assertions: [],
              complete: false,
              within_ms: 1000,
              reason: '先执行原导航',
            };
          else {
            if (plans > 2) assert.equal(input.correction.code, wantedError);
            const bad = plans === 2 || scenario === 'repeat';
            const includePosition = !bad || ['closed-extra', 'wrong-position'].includes(scenario);
            value = {
              actions: [],
              assertions: [
                {
                  target: table,
                  check: 'table_cells',
                  expected: {
                    key_column: '编号',
                    rows: ids.map((key, i) => ({
                      key,
                      ...(includePosition
                        ? { position: i + 2 + (bad && scenario === 'wrong-position' ? 1 : 0) }
                        : {}),
                      cells: [{ column: '编号', check: 'text', expected: key }],
                    })),
                    ordered: true,
                    exact_rows: bad && scenario === 'closed-extra',
                  },
                  source_refs: ['1-O1'],
                },
              ],
              complete: true,
              within_ms: 800,
              reason: '原位置区间测量',
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
    const row = (await store.read(id)).cases[0],
      f = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'shifted'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
      JSON.stringify(f.error),
    );
    assert.equal(f.actions.length, 1, 'original navigate is not repeated');
    assert.equal(plans, 3);
    assert.equal(f.assertions.length, scenario === 'repeat' ? 0 : 1);
    assert.ok(f.adaptive_segments.some((s) => s.error === wantedError && !s.dispatched));
    if (scenario === 'shifted')
      assert.ok(
        f.assertions[0].table_comparison.differences.some((d) => d.reason === 'row_position'),
      );
    if (f.assertions.length)
      assert.equal(
        f.assertions[0].expected.exact_rows,
        false,
        'trailing records not silently forbidden',
      );
  });

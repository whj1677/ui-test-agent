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

for (const scenario of [
  'inverted',
  'real-defect',
  'valid-part',
  'unresolved',
  'malformed',
  'persistent',
])
  test('partial semantic review with actual Controller and browser: ' + scenario, async (t) => {
    const compound = scenario === 'valid-part';
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>部分断言演练</h1><span id="a">A</span><span id="b">B</span><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>X009</td></tr>' +
          (scenario === 'real-defect' ? '<tr><td>X001</td></tr>' : '') +
          '</tbody></table>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'partial-review-')));
    await store.init();
    t.after(() => store.releaseLock());
    const expected = compound ? 'A及B均可见。' : '记录X009可见；不出现X001。';
    const c = {
      case_id: 'PARTIAL',
      steps: suggestObligations([{ step_id: '1', action: '打开 /result 并核对结果。', expected }]),
    };
    const marker = { kind: 'role', role: 'heading', name: '部分断言演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const row = (value) => ({ kind: 'row', table, key: { column: '编号', value } });
    const id = await store.create({
      name: 'partial assertion engineering',
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
      extra = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (input.partial_assertion_review) {
          extra++;
          assert.deepEqual(input.partial_assertion_review.required_refs, ['A1']);
          value =
            scenario === 'malformed'
              ? { assertion_checks: [] }
              : {
                  assertion_checks: [
                    {
                      assertion_ref: 'A1',
                      status: compound
                        ? 'SUPPORTED'
                        : ['unresolved', 'persistent'].includes(scenario)
                          ? 'UNRESOLVED'
                          : 'CONTRADICTS',
                      reason: compound
                        ? 'A可见是合法部分证据，B仍待测'
                        : '正向要求X001存在不能证明原不出现X001',
                    },
                  ],
                };
        } else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const incomplete = !input.complete;
          value = {
            checks: c.steps[0].obligations.map((o, i) => ({
              obligation_id: o.id,
              status: incomplete ? 'MISSING' : 'COVERED',
              assertion_refs: incomplete
                ? input.assertion_catalog
                    .filter((a) => a.obligation_ids.includes(o.id))
                    .map((a) => a.ref)
                : compound
                  ? ['A1', 'A2']
                  : ['A' + (i + 1)],
              reason: incomplete
                ? '缺口尚未齐全，当前断言合法性需分别判定'
                : '原范围与全部测量语义一致',
            })),
            issues: incomplete
              ? [
                  {
                    code: 'ASSERTION_GAP',
                    step_id: '1',
                    reason: compound
                      ? 'B未测，不否定A测量的正确性'
                      : '尚未正确检查原全部要求，正向X001不能代表不出现',
                  },
                ]
              : [],
          };
        } else {
          plans++;
          const fragment = {
            actions: [],
            assertions: [],
            complete: false,
            within_ms: 800,
            reason: '遵循原操作和预期',
          };
          if (plans === 1)
            fragment.actions = [{ action_id: 'open', op: 'navigate', value: '/result' }];
          else if (compound) {
            fragment.assertions = [
              {
                target: { kind: 'css', value: plans === 2 ? '#a' : '#b' },
                check: 'visible',
                source_refs: ['1-O1'],
              },
            ];
            fragment.complete = plans > 2;
          } else if (plans === 2 || scenario === 'persistent') {
            fragment.assertions = [
              {
                target: table,
                check: 'table_cells',
                expected: {
                  key_column: '编号',
                  rows: [
                    { key: 'X001', cells: [{ column: '编号', check: 'text', expected: 'X001' }] },
                  ],
                  ordered: false,
                  exact_rows: false,
                },
                source_refs: ['1-O2'],
              },
            ];
          } else {
            assert.equal(input.correction.code, 'ADAPTIVE_SEGMENT_REJECTED');
            assert.ok(input.correction.audit.partial_assertion_review);
            fragment.assertions = [
              { target: row('X009'), check: 'visible', source_refs: ['1-O1'] },
              { target: row('X001'), check: 'count', expected: 0, source_refs: ['1-O2'] },
            ];
            fragment.complete = true;
          }
          value = fragment;
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
    const result = (await store.read(id)).cases[0],
      f = await store.facts(id, result.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'real-defect'
        ? 'FAIL_ASSERTION'
        : scenario === 'persistent'
          ? 'TECHNICAL_FAILED'
          : 'PASS_ASSERTIONS',
      JSON.stringify(f.error),
    );
    assert.equal(extra, 1);
    assert.equal(plans, 3);
    assert.equal(f.actions.length, 1, 'prior navigate is never replayed');
    assert.equal(
      f.assertions.length,
      scenario === 'persistent' ? 0 : 2,
      'invalid positive X001 assertion is never dispatched',
    );
    const audit = f.adaptive_segments.find((s) => s.audit?.partial_assertion_review)?.audit;
    assert.ok(audit);
    assert.equal(audit.outcome, 'REPAIR');
    assert.equal(
      audit.checks.some((c) => c.status === 'MISSING'),
      true,
    );
    assert.equal(
      audit.issues.some((i) => i.code === 'ACTION_MISMATCH'),
      !compound,
    );
    if (scenario === 'real-defect') {
      assert.equal(f.assertions.at(-1).expected, 0);
      assert.equal(f.assertions.at(-1).actual, 1);
      assert.equal(f.assertions.at(-1).passed, false);
    }
  });

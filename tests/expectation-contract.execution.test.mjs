import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { Controller } from '../src/controller.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import {
  EXPECTATION_INTERPRET_PROMPT,
  EXPECTATION_REVIEW_PROMPT,
} from '../src/expectation-contract.mjs';

for (const scenario of [
  'correct',
  'correct-order',
  'swapped',
  'weak-repeat',
  'unknown',
  'review-unknown',
])
  test('source contract through actual Controller with future table: ' + scenario, async (t) => {
    const order = scenario === 'swapped' ? ['R702', 'R701'] : ['R701', 'R702'];
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>解释演练</h1><button onclick="document.querySelector(\'table\').hidden=false">查看</button>' +
          '<table hidden aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody>' +
          order.map((x) => `<tr><td>${x}</td></tr>`).join('') +
          '</tbody></table>',
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'source-contract-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'SOURCE',
      steps: suggestObligations([
        {
          step_id: 'S',
          action: '点击查看并核对结果',
          expected:
            scenario === 'correct-order' ? '编号升序排列' : 'R701必须占据表体的第一个数据位置',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '解释演练', exact: true };
    const id = await store.create({
      name: 'source contract engineering',
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
      interpretations = 0,
      reviews = 0;
    const expected = {
      key_column: '编号',
      rows: [
        { key: 'R701', position: 1, cells: [{ column: '编号', check: 'text', expected: 'R701' }] },
      ],
      ordered: false,
      exact_rows: false,
    };
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt === EXPECTATION_INTERPRET_PROMPT) {
          interpretations++;
          assert.equal(input.current, undefined);
          assert.equal(input.candidate_plan, undefined);
          assert.deepEqual(input.original, c.steps[0]);
          value = {
            obligations: [
              {
                id: 'S-O1',
                status: scenario === 'unknown' ? 'UNINTERPRETED' : 'INTERPRETED',
                timing: scenario === 'unknown' ? null : 'AFTER_ACTIONS',
                reason: '原记录绝对位置',
                predicates:
                  scenario === 'unknown'
                    ? []
                    : scenario === 'correct-order'
                      ? [
                          {
                            subject: '编号排序',
                            check: 'table_order',
                            expected: { field: '编号', direction: 'ascending' },
                          },
                        ]
                      : [{ subject: 'R701的表体位置', check: 'table_cells', expected }],
              },
            ],
          };
        } else if (prompt === EXPECTATION_REVIEW_PROMPT) {
          reviews++;
          value = {
            checks: [
              {
                id: 'S-O1',
                status: scenario === 'review-unknown' ? 'UNINTERPRETED' : 'SUPPORTED',
                reason: '独立核对原文而非候选',
              },
            ],
          };
        } else if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT))
          value = {
            checks: [
              {
                obligation_id: 'S-O1',
                status: input.complete ? 'COVERED' : 'MISSING',
                assertion_refs: input.complete ? ['A1'] : [],
                reason: '故意乐观审核，程序仍须阻止弱证据',
              },
            ],
            issues: input.complete
              ? []
              : [{ code: 'ASSERTION_GAP', step_id: 'S', reason: '原表尚待实际测量' }],
          };
        else {
          plans++;
          assert.equal(input.expectation_contract.evidence_of_pass, false);
          if (plans === 1)
            value = {
              actions: [
                {
                  op: 'click',
                  target: { kind: 'role', role: 'button', name: '查看', exact: true },
                },
              ],
              assertions: [],
              complete: false,
              within_ms: 1000,
              reason: '授权前置动作，未来表无需先出现',
            };
          else {
            const e = structuredClone(expected);
            if (plans === 2 || scenario === 'weak-repeat') delete e.rows[0].position;
            const orderAssertion = scenario === 'correct-order';
            value = {
              actions: [],
              assertions: [
                {
                  target: { kind: 'role', role: 'table', name: '结果', exact: true },
                  check: orderAssertion ? 'table_order' : 'table_cells',
                  expected: orderAssertion
                    ? {
                        field: '编号',
                        column: '编号',
                        direction: 'ascending',
                        comparison: 'identifier',
                      }
                    : e,
                  source_refs: ['S-O1'],
                },
              ],
              complete: true,
              within_ms: 1000,
              reason: '核对原位置，不改变来源',
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
    assert.equal(interpretations, 1);
    assert.equal(reviews, 1);
    assert.equal(f.actions.length, 1, 'authorized click once, no replay or pre-observation gate');
    assert.equal(
      f.status,
      scenario.startsWith('correct')
        ? 'PASS_ASSERTIONS'
        : scenario === 'swapped'
          ? 'FAIL_ASSERTION'
          : 'TECHNICAL_FAILED',
      JSON.stringify(f.error),
    );
    if (scenario !== 'correct-order')
      assert.ok(
        f.adaptive_segments.some(
          (s) =>
            s.error ===
            (scenario.includes('unknown')
              ? 'PLAN_OBLIGATION_UNINTERPRETED'
              : 'PLAN_CONTRACT_EVIDENCE_INSUFFICIENT'),
        ),
      );
    if (['correct', 'correct-order', 'swapped'].includes(scenario)) {
      assert.equal(f.assertions.length, 1);
      if (scenario === 'correct-order')
        assert.equal(f.assertions[0].expected.direction, 'ascending');
      else assert.equal(f.assertions[0].expected.rows[0].position, 1);
      if (scenario === 'swapped')
        assert.ok(
          f.assertions[0].table_comparison.differences.some((d) => d.reason === 'row_position'),
        );
    } else assert.equal(f.assertions.length, 0, 'unknown/weak claims are not evidence');
    assert.deepEqual(f.executed_case.steps, c.steps);
    assert.equal(
      f.expectation_states.at(-1).state,
      scenario.startsWith('correct')
        ? 'MEASURED_COMPLETE'
        : scenario === 'swapped'
          ? 'ACTUAL_DIFFERENCE'
          : scenario.includes('unknown')
            ? 'UNINTERPRETED'
            : 'EVIDENCE_INSUFFICIENT',
    );
  });

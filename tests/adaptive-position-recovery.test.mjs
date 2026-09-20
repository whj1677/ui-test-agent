import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { suggestObligations } from '../src/plans.mjs';
import {
  EXPECTATION_INTERPRET_PROMPT,
  EXPECTATION_REVIEW_PROMPT,
} from '../src/expectation-contract.mjs';

// Real kernel/browser, injected model. These validate bounded recovery, not LLM quality.
for (const scenario of [
  'membership',
  'ungrounded',
  'difference',
  'repeat',
  'prefix-extra',
  'prefix-difference',
  'prefix-repeat',
])
  test(`position proof repair without navigation or replay: ${scenario}`, async (t) => {
    const prefixCase = scenario.startsWith('prefix-');
    const difference = scenario === 'difference' || scenario === 'prefix-difference';
    const repeat = scenario === 'repeat' || scenario === 'prefix-repeat';
    const expectedError = prefixCase
      ? 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED'
      : scenario === 'ungrounded'
        ? 'TABLE_POSITION_UNGROUNDED'
        : 'PLAN_CONTRACT_EVIDENCE_INSUFFICIENT';
    const rows = difference
      ? [
          ['R003', 100],
          ['R012', 600],
        ]
      : [
          ['R012', 600],
          ['R003', 100],
        ];
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<h1>位置验证</h1><table aria-label="设备"><thead><tr><th>编号</th><th>功率</th></tr></thead><tbody>' +
          rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]} kW</td></tr>`).join('') +
          '</tbody></table>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'position-proof-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'POSITION',
      title: '首行位置',
      steps: suggestObligations([
        { step_id: '1', action: '核对首行设备。', expected: '首行R012功率600' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '位置验证', exact: true };
    const id = await store.create({
      name: 'position engineering',
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
        if (prompt === EXPECTATION_INTERPRET_PROMPT)
          value = {
            obligations: [
              {
                id: '1-O1',
                status: 'INTERPRETED',
                timing: 'AFTER_ACTIONS',
                reason: '原首行身份与功率',
                predicates: [
                  {
                    subject: 'R012首行功率',
                    check: 'table_cells',
                    expected: {
                      key_column: '编号',
                      rows: [
                        {
                          key: 'R012',
                          position: 1,
                          cells: [{ column: '功率', check: 'number', expected: 600 }],
                        },
                      ],
                      ordered: false,
                      exact_rows: false,
                    },
                  },
                ],
              },
            ],
          };
        else if (prompt === EXPECTATION_REVIEW_PROMPT)
          value = { checks: [{ id: '1-O1', status: 'SUPPORTED', reason: '原文独立复核' }] };
        else if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT))
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: 'COVERED',
                assertion_refs: ['A1'],
                reason: '原首行身份位置及功率',
              },
            ],
            issues: [],
          };
        else {
          plans++;
          if (plans > 1) {
            assert.equal(input.correction.code, expectedError);
            assert.equal(input.progress.completed_segments, 0);
          }
          const bad = plans === 1 || repeat;
          value = {
            actions: [],
            assertions: [
              {
                target: { kind: 'role', role: 'table', name: '设备', exact: true },
                check: 'table_cells',
                expected: {
                  key_column: '编号',
                  ordered: false,
                  exact_rows: prefixCase && bad,
                  rows: [
                    {
                      key: 'R012',
                      ...(prefixCase || !bad
                        ? { position: 1 }
                        : scenario === 'ungrounded'
                          ? { position: 2 }
                          : {}),
                      cells: [{ column: '功率', check: 'number', expected: 600 }],
                    },
                  ],
                },
                source_refs: ['1-O1'],
              },
            ],
            complete: true,
            within_ms: 500,
            reason: '原首行测量',
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
    assert.equal(fact.adaptive_segments[0].error, expectedError);
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    assert.equal(fact.actions.length, 0);
    assert.ok(plans >= 2 && plans <= 3);
    assert.equal(
      fact.status,
      repeat ? 'TECHNICAL_FAILED' : difference ? 'FAIL_ASSERTION' : 'PASS_ASSERTIONS',
    );
    assert.equal(fact.assertions.length, repeat ? 0 : 1);
    if (difference) assert.match(JSON.stringify(fact.assertions), /row_position/);
  });

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

// Injected-model engineering only. These are not official model acceptance runs.
for (const scenario of ['repair', 'difference', 'repeat'])
  test(`all candidate issues arrive in one bounded correction: ${scenario}`, async (t) => {
    const rows =
      scenario === 'difference'
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
        '<h1>能力验证</h1><table aria-label="设备"><thead><tr><th>编号</th><th>功率</th></tr></thead><tbody>' +
          rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]} kW</td></tr>`).join('') +
          '</tbody></table><span>共12条 · 第1/3页</span>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'capability-feedback-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'CAPABILITY',
      title: '位置与分页',
      steps: suggestObligations([
        { step_id: '1', action: '核对首行与分页。', expected: '首行R012功率600；分页第1/3页' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '能力验证', exact: true };
    const id = await store.create({
      name: 'capability engineering',
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
                reason: '原首行身份位置及数值',
              },
              {
                obligation_id: '1-O2',
                status: 'COVERED',
                assertion_refs: ['A2'],
                reason: '原页码，不增加总数',
              },
            ],
            issues: [],
          };
        else {
          plans++;
          assert.deepEqual(input.step_capabilities.row_positions, [
            { source_ref: '1-O1', key: 'R012', position: 1, required_check: 'table_cells' },
          ]);
          assert.equal(input.step_capabilities.evidence_of_pass, false);
          if (plans > 1) {
            assert.equal(input.correction.code, 'TABLE_SOURCE_UNGROUNDED');
            assert.deepEqual(
              input.correction.candidate_issues.map((i) => i.code),
              [
                'TABLE_SOURCE_UNGROUNDED',
                'PLAN_TABLE_CONSTRAINT_UNSUPPORTED',
                'PLAN_ROW_POSITION_UNPROVEN',
              ],
            );
            assert.equal(input.progress.completed_segments, 0);
            assert.equal(input.remaining.replans, 3 - plans);
          }
          const bad = plans === 1 || scenario === 'repeat';
          value = {
            actions: [],
            assertions: [
              {
                target: { kind: 'role', role: 'table', name: '设备', exact: true },
                check: 'table_cells',
                expected: {
                  key_column: '编号',
                  ordered: false,
                  exact_rows: false,
                  rows: [
                    {
                      key: 'R012',
                      ...(!bad ? { position: 1 } : {}),
                      cells: [
                        {
                          column: '功率',
                          check: bad ? 'text' : 'number',
                          expected: bad ? '600 kW' : 600,
                        },
                      ],
                    },
                  ],
                },
                source_refs: ['1-O1'],
              },
              {
                target: { kind: 'text', value: '共12条 · 第1/3页', exact: true },
                check: bad ? 'text' : 'contains',
                expected: bad ? '共12条 · 第1/3页' : '第1/3页',
                source_refs: ['1-O2'],
              },
            ],
            complete: true,
            within_ms: 500,
            reason: '原位置、功率与页码',
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
    assert.equal(fact.adaptive_segments[0].error, 'TABLE_SOURCE_UNGROUNDED');
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    assert.equal(fact.actions.length, 0);
    assert.equal(plans, scenario === 'repeat' ? 3 : 2);
    assert.equal(
      fact.status,
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(fact.assertions.length, scenario === 'repeat' ? 0 : 2);
    if (scenario === 'difference') assert.match(JSON.stringify(fact.assertions), /row_position/);
  });

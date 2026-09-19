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

// Actual browser/kernel; injected model exercises feedback routing, not LLM quality.
for (const scenario of ['repair', 'difference', 'repeat', 'partial-repair', 'partial-repeat'])
  test(`negative audit routes to bounded candidate repair: ${scenario}`, async (t) => {
    const repeat = scenario.endsWith('repeat');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>否定检查</h1><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>${scenario === 'difference' ? 'R001' : 'R009'}</td></tr></tbody></table>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'negative-review-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'NEG',
      title: '排除原指定记录',
      steps: suggestObligations([
        { step_id: '1', action: '核对当前结果。', expected: '结果不出现R001。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '否定检查', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'negative review engineering',
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
      audits = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          audits++;
          assert.equal(
            input.review_correction,
            undefined,
            'negative finding must return to candidate, not repeated audit-format calls',
          );
          const bad = input.assertion_catalog[0].check === 'table_cells';
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: bad ? 'MISSING' : 'COVERED',
                assertion_refs: ['A1'],
                reason: bad ? '正向存在断言不能证明原要求不存在' : '原编号行不可见的实际断言',
              },
            ],
            issues: bad
              ? [
                  {
                    step_id: '1',
                    code: 'ORACLE_UNCLEAR',
                    reason: '候选极性相反，原不存在期望未覆盖',
                  },
                ]
              : [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(input.correction.code, 'ADAPTIVE_SEGMENT_REJECTED');
            assert.equal(input.progress.completed_segments, 0);
          }
          const bad = plans === 1 || repeat;
          value = {
            actions: [],
            assertions: [
              {
                ...(bad
                  ? {
                      target: table,
                      check: 'table_cells',
                      expected: {
                        key_column: '编号',
                        ordered: false,
                        exact_rows: false,
                        rows: [
                          {
                            key: 'R001',
                            cells: [{ column: '编号', check: 'text', expected: 'R001' }],
                          },
                        ],
                      },
                    }
                  : {
                      target: { kind: 'row', table, key: { column: '编号', value: 'R001' } },
                      check: 'hidden',
                    }),
                source_refs: ['1-O1'],
              },
            ],
            complete: !(scenario.startsWith('partial-') && bad),
            within_ms: 500,
            reason: '保留原排除要求，仅修当前候选',
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
    assert.equal(fact.actions.length, 0);
    assert.equal(fact.adaptive_segments[0].error, 'ADAPTIVE_SEGMENT_REJECTED');
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    assert.ok(fact.adaptive_segments[0].audit.issues.some((i) => i.code === 'ORACLE_UNCLEAR'));
    assert.ok(fact.adaptive_segments[0].audit.issues.some((i) => i.code === 'ACTION_MISMATCH'));
    assert.equal(plans, 2);
    assert.equal(audits, repeat ? 1 : 2);
    if (repeat) assert.equal(fact.error, 'ADAPTIVE_NO_PROGRESS');
    assert.equal(
      fact.status,
      repeat
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(fact.assertions.length, repeat ? 0 : 1);
    if (fact.assertions.length) assert.equal(fact.assertions[0].check, 'hidden');
  });

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

// Real Chromium/controller, deliberately injected model. Not product acceptance.
for (const scenario of ['repair', 'repeat', 'business-difference']) {
  test(`source binding feedback remains advisory through execution: ${scenario}`, async (t) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>资产</h1><table><thead><tr><th>编号</th></tr></thead><tbody><tr><td>D009</td></tr>${scenario === 'business-difference' ? '<tr><td>D001</td></tr>' : ''}</tbody></table>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'binding-feedback-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'BIND',
      title: '联合来源',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '核对表格编号。',
          expected: '表格仅有1行；编号为D009；结果不含D001。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '资产', exact: true };
    const table = { kind: 'role', role: 'table', name: '', exact: true };
    const id = await store.create({
      name: 'binding feedback engineering',
      target,
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
                reason: '行数测量',
              },
              {
                obligation_id: '1-O2',
                status: 'COVERED',
                assertion_refs: ['A2'],
                reason: '编号测量',
              },
              {
                obligation_id: '1-O3',
                status: 'COVERED',
                assertion_refs: ['A1', 'A2'],
                reason: '唯一行编号D009与D001排他',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(input.progress.completed_segments, 0);
            const gaps = input.correction.source_binding_gaps;
            assert.equal(gaps.length, 1);
            assert.equal(gaps[0].assertion_ref, 'A2');
            assert.equal(gaps[0].missing_source_ref, '1-O3');
            assert.deepEqual(gaps[0].assertion.obligation_ids, ['1-O2']);
            assert.equal(input.remaining.replans, 1);
          }
          const corrected = plans > 1 && scenario !== 'repeat';
          value = {
            actions: [],
            assertions: [
              { target: table, check: 'row_count', expected: 1, source_refs: ['1-O1', '1-O3'] },
              {
                target: {
                  kind: 'cell',
                  table,
                  key: { column: '编号', value: 'D009' },
                  column: '编号',
                },
                check: 'text',
                expected: 'D009',
                source_refs: corrected ? ['1-O2', '1-O3'] : ['1-O2'],
              },
            ],
            complete: true,
            within_ms: 200,
            reason: '核验原预期',
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
    assert.equal(plans, 2);
    assert.equal(fact.actions.length, 0);
    assert.equal(fact.adaptive_segments[0].error, 'ADAPTIVE_SEGMENT_REJECTED');
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    if (scenario === 'repeat') {
      assert.equal(audits, 1);
      assert.equal(fact.error, 'ADAPTIVE_NO_PROGRESS');
      assert.equal(fact.assertions.length, 0);
    } else {
      assert.equal(audits, 2);
      assert.equal(fact.assertions.length, 2);
      assert.equal(fact.status, scenario === 'repair' ? 'PASS_ASSERTIONS' : 'FAIL_ASSERTION');
      assert.deepEqual(fact.assertions[1].obligation_ids, ['1-O2', '1-O3']);
    }
  });
}

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

for (const scenario of ['early-feedback', 'actual-page11', 'persistent-omission'])
  test('parallel completion feedback through actual Controller: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>结果页</h1><span id="pager">第${scenario === 'actual-page11' ? 11 : 1}/12页</span><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>R001</td></tr><tr><td>R002</td></tr></tbody></table>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-feedback-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'EARLY',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '打开 /result 并核对。',
          expected: '进入结果页；默认第1页显示R001至R002。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '结果页', exact: true };
    const table = { kind: 'role', role: 'table', name: '结果', exact: true };
    const id = await store.create({
      name: 'parallel feedback engineering',
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
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const refs = input.assertion_catalog.map((a) => a.ref);
          value = {
            checks: c.steps[0].obligations.map((o, i) => ({
              obligation_id: o.id,
              status: refs.length ? 'COVERED' : 'MISSING',
              assertion_refs: refs.length ? (i === 0 ? ['A1'] : refs.slice(1)) : [],
              reason: '核对原页面与默认页码和记录，引用仍须由程序检查',
            })),
            issues: refs.length
              ? []
              : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '导航后才测量原状态' }],
          };
        } else {
          plans++;
          if (plans === 1)
            value = {
              actions: [{ op: 'navigate', value: '/result' }],
              assertions: [],
              complete: false,
              within_ms: 800,
              reason: '只执行原导航',
            };
          else {
            if (plans === 3) {
              assert.equal(input.correction.code, 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED');
              const gap = input.correction.candidate_issues.find(
                (x) => x.code === 'PLAN_CURRENT_PAGE_UNPROVEN',
              );
              assert.ok(gap, 'missing page must be reported alongside first unrelated rejection');
              assert.equal(gap.evidence_of_pass, false);
            }
            if (plans === 4) assert.equal(input.correction.code, 'ADAPTIVE_SEGMENT_REJECTED');
            assert.ok(plans <= 4, 'no new planning budget');
            value = {
              actions: [],
              complete: false,
              within_ms: 800,
              reason: '只修原断言，不重放导航',
              assertions: [
                {
                  target: marker,
                  check: 'text',
                  expected: '结果页',
                  source_refs: [plans === 3 ? '1-O2' : '1-O1'],
                },
                {
                  target: table,
                  check: 'table_cells',
                  expected: {
                    key_column: '编号',
                    rows: ['R001', 'R002'].map((key) => ({
                      key,
                      cells: [{ column: '编号', check: 'text', expected: key }],
                    })),
                    ordered: false,
                    exact_rows: plans === 2,
                  },
                  source_refs: ['1-O2'],
                },
                ...(plans >= 3 && (plans === 3 || scenario !== 'persistent-omission')
                  ? [
                      {
                        target: { kind: 'css', value: '#pager' },
                        check: 'contains',
                        expected: '第1/',
                        source_refs: ['1-O2'],
                      },
                    ]
                  : []),
              ],
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
      scenario === 'early-feedback'
        ? 'PASS_ASSERTIONS'
        : scenario === 'actual-page11'
          ? 'FAIL_ASSERTION'
          : 'TECHNICAL_FAILED',
      JSON.stringify(f.error),
    );
    assert.equal(plans, 4);
    assert.equal(f.actions.length, 1, 'original navigate once');
    assert.equal(
      f.assertions.length,
      scenario === 'persistent-omission' ? 2 : 3,
      'unexecuted candidate page assertion never becomes a measured fact',
    );
    assert.ok(
      f.adaptive_segments.some(
        (s) => s.error === 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' && !s.dispatched,
      ),
    );
    assert.ok(
      f.adaptive_segments.some((s) => s.error === 'ADAPTIVE_SEGMENT_REJECTED' && !s.dispatched),
    );
    if (scenario === 'persistent-omission') assert.equal(f.error, 'PLAN_CURRENT_PAGE_UNPROVEN');
    if (scenario === 'actual-page11') {
      assert.equal(f.assertions.at(-1).passed, false);
      assert.equal(f.assertions.at(-1).actual, '第11/12页');
    }
  });

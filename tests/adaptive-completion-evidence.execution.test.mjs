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

for (const scenario of ['new-evidence', 'final-reject', 'duplicate-only', 'actual-difference'])
  test(
    'a new successful measurement can request completion, not approve it: ' + scenario,
    async (t) => {
      const server = http.createServer((q, r) => {
        r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        r.end(
          `<h1>收尾证据演练</h1><span id="pager">第${scenario === 'actual-difference' ? 11 : 1}/12页</span><table aria-label="结果"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>X001</td></tr><tr><td>X002</td></tr></tbody></table>`,
        );
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      t.after(() => new Promise((r) => server.close(r)));
      const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-evidence-')));
      await store.init();
      t.after(() => store.releaseLock());
      const c = {
        case_id: 'FINISH',
        steps: suggestObligations([
          { step_id: '1', action: '观察当前列表。', expected: '默认第1页显示X001至X002。' },
        ]),
      };
      const marker = { kind: 'role', role: 'heading', name: '收尾证据演练', exact: true },
        table = { kind: 'role', role: 'table', name: '结果', exact: true };
      const id = await store.create({
        name: 'completion evidence engineering',
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
        finalAudits = 0;
      const provider = {
        configured: () => true,
        json: async (prompt, input) => {
          let value;
          if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
          else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
            const issues = [];
            if (input.complete) {
              finalAudits++;
              assert.deepEqual(input.current_fragment.actions, []);
              assert.deepEqual(input.current_fragment.assertions, []);
              if (scenario === 'final-reject')
                issues.push({
                  code: 'ACTION_MISMATCH',
                  step_id: '1',
                  reason: '最终独立核对发现原操作不完整，不得自动接受',
                });
            }
            value = {
              checks: [
                {
                  obligation_id: '1-O1',
                  status: 'COVERED',
                  assertion_refs: input.assertion_catalog.map((a) => a.ref),
                  reason: '注入累计审查；必要证据仍须程序核验',
                },
              ],
              issues,
            };
          } else {
            plans++;
            if (plans > 2 && scenario === 'final-reject')
              value = { blocked: true, reason: '最终独立审查拒绝，不能安全补做' };
            else {
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
              value = {
                actions: [],
                assertions: [plans === 2 && scenario !== 'duplicate-only' ? pager : matrix],
                complete: false,
                within_ms: 1500,
                reason: '只提供新测量，不自报完成',
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
      const probes = f.adaptive_segments.filter(
        (s) => s.proposal_origin === 'controller_completion_probe',
      );
      assert.equal(
        f.status,
        scenario === 'new-evidence'
          ? 'PASS_ASSERTIONS'
          : scenario === 'actual-difference'
            ? 'FAIL_ASSERTION'
            : 'TECHNICAL_FAILED',
        JSON.stringify(f.error),
      );
      assert.equal(f.actions.length, 0);
      assert.equal(probes[0].error, 'PLAN_CURRENT_PAGE_UNPROVEN');
      if (['new-evidence', 'final-reject'].includes(scenario)) {
        assert.equal(probes.length, 2);
        assert.equal(finalAudits, 1);
        assert.notEqual(probes[0].completion_evidence_hash, probes[1].completion_evidence_hash);
        assert.equal(
          probes[0].proposal_hash,
          probes[1].proposal_hash,
          'identical empty proposals must still be distinguished by successful evidence',
        );
        assert.equal(
          f.assertions.length,
          2,
          'no repeated field measurement to force another completion',
        );
        if (scenario === 'new-evidence') {
          assert.equal(plans, 2);
          assert.equal(probes[1].status, 'EXECUTED');
        } else {
          assert.equal(probes[1].status, 'REJECTED');
          assert.equal(f.adaptive_steps.length, 0);
        }
      } else {
        assert.equal(probes.length, 1);
        assert.equal(finalAudits, 0);
        assert.equal(f.adaptive_steps.length, 0);
      }
      if (scenario === 'actual-difference') assert.equal(f.assertions.at(-1).passed, false);
    },
  );

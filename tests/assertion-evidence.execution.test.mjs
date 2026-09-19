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

for (const scenario of ['normal', 'field-difference', 'negative-review'])
  test(
    'evidence-source advisory does not grant execution or substitute note values: ' + scenario,
    async (t) => {
      const server = http.createServer((q, r) => {
        r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        r.end(
          `<h1>字段取证演练</h1><dialog open aria-label="设备X"><dl><dt>温度</dt><dd>${scenario === 'field-difference' ? '75' : '55'} ℃</dd></dl><h2>历史说明</h2><p>旧记录温度为55 ℃。</p></dialog>`,
        );
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      t.after(() => new Promise((r) => server.close(r)));
      const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-source-')));
      await store.init();
      t.after(() => store.releaseLock());
      const c = {
        case_id: 'FIELD',
        title: '只读字段与说明',
        steps: suggestObligations([
          {
            step_id: '1',
            action: '核对设备X弹窗的温度字段与历史说明，不操作页面。',
            expected: '设备X的温度字段为55 ℃；历史说明可见，即使说明也含55 ℃也不作为温度字段。',
          },
        ]),
      };
      assert.equal(c.steps[0].obligations.length, 3);
      const marker = { kind: 'role', role: 'heading', name: '字段取证演练', exact: true };
      const scope = { role: 'dialog', name: '设备X', exact: true };
      const id = await store.create({
        name: 'evidence-source engineering',
        target: 'http://127.0.0.1:' + server.address().port + '/',
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
      let audits = 0;
      const provider = {
        configured: () => true,
        json: async (prompt, input) => {
          let value;
          if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
          else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
            audits++;
            assert.equal(
              input.assertion_catalog[0].evidence_binding.kind,
              'native_definition_field',
            );
            assert.equal(input.assertion_catalog[0].evidence_binding.runtime_verified, false);
            assert.equal(input.assertion_catalog[1].evidence_binding.kind, 'heading_only');
            const negative = scenario === 'negative-review';
            value = {
              checks: c.steps[0].obligations.map((o, i) => ({
                obligation_id: o.id,
                status: negative ? 'MISSING' : 'COVERED',
                assertion_refs: negative ? [] : i === 1 ? ['A2'] : ['A1'],
                reason: negative
                  ? '独立审查仍认为取证不足，提示标签不能撤销缺口'
                  : '原字段有独立值测量，说明可见另测，条件中的相同数值不是新增值要求',
              })),
              issues: negative
                ? [
                    {
                      code: 'ASSERTION_GAP',
                      step_id: '1',
                      reason: '保留独立负面审查，不自动赋予覆盖',
                    },
                  ]
                : [],
            };
          } else
            value = {
              actions: [],
              assertions: [
                {
                  target: {
                    kind: 'within',
                    scope,
                    target: { kind: 'definition', name: '温度', exact: true },
                  },
                  check: 'text',
                  expected: '55 ℃',
                  source_refs: ['1-O1', '1-O3'],
                },
                {
                  target: {
                    kind: 'within',
                    scope,
                    target: { kind: 'role', role: 'heading', name: '历史说明', exact: true },
                  },
                  check: 'visible',
                  expected: true,
                  source_refs: ['1-O2'],
                },
              ],
              complete: true,
              within_ms: 5000,
              reason: '原字段值和备注可见分别取证，不要求条件句中的备注数字出现',
            };
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
        scenario === 'negative-review'
          ? 'TECHNICAL_FAILED'
          : scenario === 'field-difference'
            ? 'FAIL_ASSERTION'
            : 'PASS_ASSERTIONS',
      );
      assert.equal(f.actions.filter((a) => a.dispatched).length, 0);
      assert.ok(audits > 0);
      if (scenario === 'negative-review') {
        assert.equal(f.assertions.length, 0);
        assert.ok(f.adaptive_segments.every((s) => !s.dispatched));
      } else {
        assert.equal(f.assertions[0].target.target.kind, 'definition');
        assert.equal(f.assertions[0].expected, '55 ℃');
        assert.equal(f.assertions[0].actual, scenario === 'field-difference' ? '75 ℃' : '55 ℃');
        assert.deepEqual(f.assertions[0].obligation_ids, ['1-O1', '1-O3']);
      }
    },
  );

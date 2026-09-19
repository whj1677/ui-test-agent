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
import { stepAssertions } from '../src/plan-steps.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { stepOutcome } from '../public/evidence-view.js';

// Injected decisions with the actual browser/execution kernel; not real-model acceptance.
for (const scenario of ['finish', 'missing-obligation', 'final-reject', 'actual-difference']) {
  test(`measured coverage proposes completion but never approves itself: ${scenario}`, async (t) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>演练首页</h1><output role="status" aria-label="状态">${scenario === 'actual-difference' ? '异常' : '正常'}</output><p>旁注</p>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-probe-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'DONE',
      title: '收尾审查',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '核对当前状态和原预期。',
          expected: scenario === 'missing-obligation' ? '状态为正常；旁注可见。' : '状态为正常。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '演练首页', exact: true };
    const id = await store.create({
      name: 'completion probe engineering',
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
      finalAudits = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const assertions = stepAssertions(input.candidate_plan.steps[0]);
          const checks = input.original.steps[0].obligations.map((o) => {
            const indices = assertions.flatMap((a, i) =>
              a.obligation_ids.includes(o.id) ? [i] : [],
            );
            return {
              step_id: '1',
              obligation_id: o.id,
              status: indices.length ? 'COVERED' : 'MISSING',
              assertion_indices: indices,
              reason: '工程注入审查',
            };
          });
          const issues = checks
            .filter((c) => c.status === 'MISSING')
            .map(() => ({ code: 'ASSERTION_GAP', step_id: '1', reason: '旁注尚未测量' }));
          if (input.complete) {
            finalAudits++;
            if (scenario !== 'missing-obligation') {
              assert.deepEqual(input.current_fragment.actions, []);
              assert.deepEqual(input.current_fragment.assertions, []);
            }
            if (scenario === 'final-reject')
              issues.push({
                code: 'ACTION_MISMATCH',
                step_id: '1',
                reason: '最终核对判定原操作尚未完成，不得仅凭已有测量通过',
              });
          }
          value = { checks, issues };
        } else {
          plans++;
          if (plans > 1 && scenario === 'final-reject') {
            assert.equal(input.correction.code, 'ADAPTIVE_SEGMENT_REJECTED');
            value = { blocked: true, reason: '最终审查指出原操作未完成，无法安全补做' };
          } else {
            if (plans > 1)
              assert.equal(
                scenario,
                'missing-obligation',
                'covered step must not request another open-ended plan',
              );
            value = {
              actions: [],
              assertions:
                plans === 1
                  ? [
                      {
                        target: { kind: 'role', role: 'status', name: '状态', exact: true },
                        check: 'text',
                        expected: '正常',
                        source_refs: ['1-O1'],
                      },
                    ]
                  : [
                      {
                        target: { kind: 'text', value: '旁注', exact: true },
                        check: 'visible',
                        source_refs: ['1-O2'],
                      },
                    ],
              complete: plans > 1,
              within_ms: 200,
              reason: '仅测量原义务',
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
    const state = await store.read(id),
      row = state.cases[0];
    const fact = await store.facts(id, row.attempts.at(-1));
    assert.equal(fact.actions.length, 0);
    const probes = fact.adaptive_segments.filter(
      (s) => s.proposal_origin === 'controller_completion_probe',
    );
    if (scenario === 'finish') {
      assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
      assert.equal(plans, 1);
      assert.equal(finalAudits, 1);
      assert.equal(probes.length, 1);
      assert.equal(fact.assertions.length, 1);
      assert.equal(fact.adaptive_steps.length, 1);
      assert.equal(stepOutcome(fact, '1').status, 'PASS');
    } else if (scenario === 'missing-obligation') {
      assert.equal(fact.status, 'PASS_ASSERTIONS');
      assert.equal(plans, 2);
      assert.equal(probes.length, 0);
      assert.equal(fact.assertions.length, 2);
      assert.equal(stepOutcome(fact, '1').status, 'PASS');
    } else if (scenario === 'final-reject') {
      assert.equal(finalAudits, 1);
      assert.equal(probes.length, 1);
      assert.equal(probes[0].status, 'REJECTED');
      assert.notEqual(fact.status, 'PASS_ASSERTIONS');
      assert.equal(fact.adaptive_steps.length, 0);
      assert.equal(stepOutcome(fact, '1').status, 'INCOMPLETE');
    } else {
      assert.equal(fact.status, 'FAIL_ASSERTION');
      assert.equal(finalAudits, 0);
      assert.equal(probes.length, 0);
      assert.equal(fact.assertions[0].expected, '正常');
      assert.equal(stepOutcome(fact, '1').status, 'FAIL');
    }
  });
}

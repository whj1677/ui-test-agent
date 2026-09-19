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
import { stepAssertions } from '../src/plan-steps.mjs';

for (const scenario of ['repair', 'difference', 'repeat']) {
  test(`actual controller page-counter binding, injected model: ${scenario}`, async (t) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>设备</h1><button onclick="document.querySelector('span').textContent='第${scenario === 'difference' ? 1 : 2}/3页'">下一页</button><span ${scenario === 'difference' ? 'id="pager"' : ''}>第1/3页</span><table id="assets"><thead><tr><th>编号</th></tr></thead><tbody><tr><td>D009</td></tr></tbody></table>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'page-target-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'PAGER',
      title: '分页绑定',
      steps: suggestObligations([
        { step_id: '1', action: '点击下一页。', expected: '分页显示第2/3页。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '设备', exact: true };
    const id = await store.create({
      name: 'page binding engineering',
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
    let plans = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const measured = stepAssertions(input.candidate_plan.steps[0]).length > 0;
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: measured ? 'COVERED' : 'MISSING',
                assertion_refs: measured ? ['A1'] : [],
                reason: '原分页测量',
              },
            ],
            issues: measured ? [] : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '下一段测量' }],
          };
        } else {
          plans++;
          const bad = plans === 2 || scenario === 'repeat';
          let locator = { kind: 'css', value: '#assets' };
          if (plans > 2) {
            assert.equal(input.correction.code, 'ADAPTIVE_TARGET_PAGE_MISMATCH');
            assert.equal(input.progress.completed_segments, 1);
            if (!bad) {
              const text = input.current.controls.find(
                (c) => c.text_context?.value === `第${scenario === 'difference' ? 1 : 2}/3页`,
              );
              assert.ok(text);
              locator = text.locator;
            }
          }
          value = {
            actions:
              plans === 1
                ? [
                    {
                      op: 'click',
                      target: { kind: 'role', role: 'button', name: '下一页', exact: true },
                    },
                  ]
                : [],
            assertions:
              plans === 1
                ? []
                : [{ target: locator, check: 'text', expected: '第2/3页', source_refs: ['1-O1'] }],
            complete: plans !== 1,
            within_ms: 100,
            reason: '原动作后核对分页',
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
    assert.equal(
      fact.actions.filter((a) => a.dispatched).length,
      1,
      'never replay the next-page action',
    );
    assert.equal(fact.adaptive_segments[1].error, 'ADAPTIVE_TARGET_PAGE_MISMATCH');
    assert.equal(fact.adaptive_segments[1].dispatched, false);
    assert.equal(
      fact.status,
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(fact.assertions.length, scenario === 'repeat' ? 0 : 1);
    assert.equal(plans, scenario === 'repeat' ? 4 : 3);
  });
}

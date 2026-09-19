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

for (const scenario of ['repair', 'difference-after-click', 'persistent-premature'])
  test('tab postcondition timing without business retry: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>切换演练</h1><dialog open aria-label="对象详情"><button role="tab" aria-selected="false" onclick="${scenario === 'difference-after-click' ? 'void 0' : "this.setAttribute('aria-selected','true')"}">基本信息</button><dl><dt>周期</dt><dd>7天</dd></dl></dialog>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'selection-timing-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'SWITCH',
      title: '切换后再检查',
      steps: suggestObligations([
        { step_id: '1', action: '切回基本信息页签', expected: '基本信息页签选中；周期为7天。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '切换演练', exact: true },
      scope = { role: 'dialog', name: '对象详情', exact: true },
      tab = {
        kind: 'within',
        scope,
        target: { kind: 'role', role: 'tab', name: '基本信息', exact: true },
      };
    const id = await store.create({
      name: 'selection timing engineering',
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
    let plans = 0,
      audits = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          audits++;
          const field = input.assertion_catalog.find((a) => a.check === 'text');
          value = {
            checks: c.steps[0].obligations.map((o, i) => ({
              obligation_id: o.id,
              status: i === 0 || field ? 'COVERED' : 'MISSING',
              assertion_refs: i === 0 ? ['A1'] : field ? [field.ref] : [],
              reason: '选中状态必须在当前步骤合法切换之后，周期另测',
            })),
            issues: field ? [] : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '周期尚待补测' }],
          };
        } else {
          plans++;
          if (plans === 2) assert.equal(input.correction.code, 'ASSERTION_SELECTION_BEFORE_ACTION');
          const premature = plans === 1 || scenario === 'persistent-premature';
          value = {
            actions: premature ? [] : [{ op: 'click', target: tab }],
            assertions: [
              { target: tab, check: 'aria_selected', expected: true, source_refs: ['1-O1'] },
              ...(premature
                ? []
                : [
                    {
                      target: {
                        kind: 'within',
                        scope,
                        target: { kind: 'definition', name: '周期', exact: true },
                      },
                      check: 'text',
                      expected: '7天',
                      source_refs: ['1-O2'],
                    },
                  ]),
            ],
            complete: !premature,
            within_ms: 1500,
            reason: premature
              ? '错误候选先测选中，必须在派发前拒绝'
              : '按原动作切换一次，再测选中和原周期',
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
      f = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'persistent-premature'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference-after-click'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(
      f.actions.filter((a) => a.dispatched).length,
      scenario === 'persistent-premature' ? 0 : 1,
    );
    assert.equal(audits, scenario === 'persistent-premature' ? 0 : 1);
    assert.ok(
      f.adaptive_segments.some(
        (s) => s.error === 'ASSERTION_SELECTION_BEFORE_ACTION' && !s.dispatched,
      ),
    );
    if (scenario === 'persistent-premature') assert.equal(f.assertions.length, 0);
    else {
      assert.equal(f.assertions[0].expected, true);
      assert.equal(f.assertions[0].actual, scenario === 'repair');
    }
  });

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

for (const scenario of ['repair', 'still-open', 'persistent-missing'])
  test('closing requires same-dialog result without replay: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>字段演练</h1><dialog open aria-label="对象详情"><h2>对象X</h2><button onclick="${scenario === 'still-open' ? 'void 0' : "document.querySelector('dialog').close()"}">关闭详情</button></dialog>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'closure-witness-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'CLOSE',
      title: '关闭结果不由点击代替',
      steps: suggestObligations([
        { step_id: '1', action: '点击关闭详情', expected: '详情关闭后，列表标题为字段演练。' },
      ]),
    };
    assert.equal(c.steps[0].obligations.length, 2);
    const marker = { kind: 'role', role: 'heading', name: '字段演练', exact: true };
    const scope = { role: 'dialog', name: '对象详情', exact: true };
    const id = await store.create({
      name: 'closure engineering',
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
    let plans = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const closed = input.assertion_catalog.find((a) => a.check === 'hidden'),
            title = input.assertion_catalog.find((a) => a.check === 'visible');
          value = {
            checks: c.steps[0].obligations.map((o, i) => ({
              obligation_id: o.id,
              status: (i === 0 ? closed : title) ? 'COVERED' : 'MISSING',
              assertion_refs: (i === 0 ? closed : title) ? [(i === 0 ? closed : title).ref] : [],
              reason: '关闭结果与标题分别实测，不把动作作为结果',
            })),
            issues:
              closed && title
                ? []
                : [
                    {
                      code: 'ASSERTION_GAP',
                      step_id: '1',
                      reason: '关闭动作之后仍须测同弹窗消失与列表标题',
                    },
                  ],
          };
        } else {
          plans++;
          if (plans === 1)
            value = {
              actions: [
                {
                  op: 'click',
                  target: {
                    kind: 'within',
                    scope,
                    target: { kind: 'role', role: 'button', name: '关闭详情', exact: true },
                  },
                },
              ],
              assertions: [],
              complete: false,
              within_ms: 5000,
              reason: '只执行一次原关闭动作，后续测结果',
            };
          else {
            if (plans === 3) assert.equal(input.correction.code, 'PLAN_VISIBILITY_UNPROVEN');
            const proofs = [];
            if (plans >= 3 && scenario !== 'persistent-missing')
              proofs.push({
                target: { kind: 'within', scope },
                check: 'hidden',
                source_refs: ['1-O1'],
              });
            proofs.push({
              target: marker,
              check: 'visible',
              source_refs:
                plans >= 3 && scenario !== 'persistent-missing' ? ['1-O2'] : ['1-O1', '1-O2'],
            });
            value = {
              actions: [],
              assertions: proofs,
              complete: true,
              within_ms: 2000,
              reason: '只补原缺口，不重放已派发关闭',
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
    assert.equal(
      f.status,
      scenario === 'persistent-missing'
        ? 'TECHNICAL_FAILED'
        : scenario === 'still-open'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(f.actions.filter((a) => a.dispatched).length, 1);
    assert.ok(
      f.adaptive_segments.some((s) => s.error === 'PLAN_VISIBILITY_UNPROVEN' && !s.dispatched),
    );
    if (scenario === 'persistent-missing') assert.equal(f.assertions.length, 0);
    else {
      assert.equal(f.assertions[0].check, 'hidden');
      assert.equal(f.assertions[0].actual, scenario === 'repair');
      assert.equal(plans, 3);
    }
  });

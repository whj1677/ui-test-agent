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

for (const scenario of ['repair', 'difference', 'repeat'])
  test('default tab typed recovery without replay: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        `<h1>只读详情演练</h1><button id='open'>打开详情</button><dialog aria-label='详情'><h2>对象X</h2><button role='tab' aria-selected='${scenario === 'difference' ? 'false' : 'true'}'>基本信息</button></dialog><script>document.querySelector('#open').onclick=()=>document.querySelector('dialog').showModal()</script>`,
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'aria-selected-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'TAB',
      title: '只读默认页签',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '点击打开详情，核对默认页签，不切换页签。',
          expected: '详情中默认页签为基本信息。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '只读详情演练', exact: true };
    const tab = {
      kind: 'within',
      scope: { role: 'dialog', name: '详情', exact: true },
      target: { kind: 'role', role: 'tab', name: '基本信息', exact: true },
    };
    const id = await store.create({
      name: 'tab engineering',
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
          const has = input.assertion_catalog.length > 0;
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: has ? 'COVERED' : 'MISSING',
                assertion_refs: has ? ['A1'] : [],
                reason: has ? '原默认页签的实际ARIA选中状态' : '操作已许可，后续仍须测量选中状态',
              },
            ],
            issues: has
              ? []
              : [{ code: 'ASSERTION_GAP', step_id: '1', reason: '打开后核对原默认页签' }],
          };
        } else {
          plans++;
          if (plans === 1)
            value = {
              actions: [
                {
                  op: 'click',
                  target: { kind: 'role', role: 'button', name: '打开详情', exact: true },
                },
              ],
              assertions: [],
              complete: false,
              within_ms: 5000,
              reason: '仅打开一次原对象详情',
            };
          else {
            if (plans > 2) {
              assert.equal(input.correction.code, 'ASSERTION_SELECTION_TARGET_REQUIRED');
              assert.equal(input.progress.completed_segments, 1);
            }
            const bad = plans === 2 || scenario === 'repeat';
            value = {
              actions: [],
              assertions: [
                {
                  target: tab,
                  check: bad ? 'selected_label' : 'aria_selected',
                  expected: bad ? '基本信息' : true,
                  source_refs: ['1-O1'],
                },
              ],
              complete: true,
              within_ms: 5000,
              reason: '保留默认选中要求，只修测量类型，不点击页签',
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
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(f.actions.filter((a) => a.dispatched).length, 1);
    assert.equal(f.actions[0].target.name, '打开详情');
    assert.equal(plans, scenario === 'repeat' ? 4 : 3);
    assert.equal(audits, scenario === 'repeat' ? 1 : 2);
    assert.equal(f.assertions.length, scenario === 'repeat' ? 0 : 1);
    if (f.assertions.length) {
      assert.equal(f.assertions[0].check, 'aria_selected');
      assert.equal(f.assertions[0].expected, true);
      assert.equal(f.assertions[0].actual, scenario !== 'difference');
    }
    assert.ok(
      f.adaptive_segments.some(
        (s) => s.error === 'ASSERTION_SELECTION_TARGET_REQUIRED' && !s.dispatched,
      ),
    );
  });

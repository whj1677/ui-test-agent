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
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';

const role = (role, name = '') => ({ kind: 'role', role, name, exact: true });
const table = role('table');

for (const obligation of ['当前页面URL包含 /devices', '表格保持不变', '页面无遮挡']) {
  test(`partial may defer coverage but never supplied invalid assertions: ${obligation}`, () => {
    const c = {
      steps: [
        { action: '查看设备', expected: obligation, obligations: [{ id: 'O', text: obligation }] },
      ],
    };
    const plan = { steps: [{ actions: [], assertions: [] }] };
    const context = { adaptive_readonly: true };
    assert.doesNotThrow(() => requirePlanSemantics(plan, c, context, { complete: false }));
    assert.throws(() => requirePlanSemantics(plan, c, context));
    plan.steps[0].assertions.push({ target: table, check: 'row_count', expected: 5 });
    assert.throws(() => requirePlanSemantics(plan, c, context, { complete: false }), {
      code: 'PLAN_ASSERTION_UNSUPPORTED',
    });
  });
}

test('partial semantic policy keeps identity, numeric values and explicit counts', () => {
  const c = { steps: [{ action: '查看D009', expected: 'D009额定功率200，显示1条记录' }] };
  const a = {
    target: { kind: 'cell', table, key: { column: '编号', value: 'D009' }, column: '额定功率' },
    check: 'number',
    expected: 200,
  };
  const plan = { steps: [{ assertions: [a, { target: table, check: 'row_count', expected: 1 }] }] };
  const validate = () => requirePlanSemantics(plan, c, {}, { complete: false });
  assert.doesNotThrow(validate);
  a.expected = 201;
  assert.throws(validate, { code: 'PLAN_ASSERTION_VALUE_UNSUPPORTED' });
  a.expected = 200;
  a.target.key.value = 'D008';
  assert.throws(validate, { code: 'PLAN_ROW_IDENTITY_UNSUPPORTED' });
});

// Real isolated Chromium/controller; provider replies are injected, never a live API.
// Keep original V03 step 2/3 wording; the server only supplies technical fixture state.
for (const scenario of ['recover', 'persistent-invalid', 'page-mismatch', 'invalid-with-action']) {
  test(`V03 partial-to-complete controller boundary: ${scenario}`, async (t) => {
    const rows = (start) =>
      Array.from({ length: 5 }, (_, i) => {
        const id = 'D' + String(start + i).padStart(3, '0');
        return `<tr><td>${id}</td><td>${id === 'D009' ? '<button onclick="document.querySelector(\'dialog\').showModal()">详情</button>' : ''}</td></tr>`;
      }).join('');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>资产设备</h1><button id="next">下一页</button><p id="pager" data-testid="pager">第1/3页</p><table><thead><tr><th>编号</th><th>操作</th></tr></thead><tbody>${rows(1)}</tbody></table><dialog aria-label="设备详情"><h2>D009</h2></dialog><script>document.querySelector('#next').onclick=()=>{window.turns=(window.turns||0)+1;document.querySelector('tbody').innerHTML=${JSON.stringify(rows(6))};document.querySelector('#pager').textContent=${JSON.stringify(scenario === 'page-mismatch' ? '第1/3页' : '第2/3页')};};</script>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-semantic-')));
    await store.init();
    t.after(() => store.releaseLock());
    const originals = JSON.parse(
      await fs.readFile(new URL('../manual-lab/cases/01-valid.json', import.meta.url), 'utf8'),
    );
    const source = originals.cases.find((c) => c.case_id === 'LAB-V03');
    const c = {
      case_id: 'SEMANTIC-V03',
      title: source.title,
      data: source.data,
      steps: suggestObligations(source.steps.slice(1, 3)),
    };
    const frozen = structuredClone(c);
    const marker = role('heading', '资产设备');
    const id = await store.create({ name: '片段校验隔离回放', target, baseline: { cases: [c] } });
    await store.update(id, (s) => {
      s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
      s.auth_marker = marker;
    });
    const browser = new BrowserSession({ headless: true });
    t.after(() => browser.close());
    const task = await store.read(id);
    await browser.open(task);
    await browser.authenticate(task, marker);
    let pagePlans = 0,
      detailPlans = 0,
      auditsWithBadCount = 0;
    const proof = (check, expected, ids, target = table) => ({
      target,
      check,
      ...(expected === undefined ? {} : { expected }),
      oracle_quote: c.steps[0].expected,
      obligation_ids: ids,
    });
    const fragment = (actions, assertions, complete = false) => ({
      actions,
      assertions,
      complete,
      within_ms: 300,
      reason: '保留原预期，按当前原步骤补测',
    });
    const clickNext = { op: 'click', target: role('button', '下一页') };
    const count = proof('row_count', 5, ['2-O3']);
    const identities = proof(
      'table_cells',
      {
        key_column: '编号',
        rows: Array.from({ length: 5 }, (_, i) => {
          const id = 'D' + String(i + 6).padStart(3, '0');
          return { key: id, cells: [{ column: '编号', check: 'text', expected: id }] };
        }),
        ordered: false,
        exact_rows: false,
      },
      ['2-O3', '2-O4'],
    );
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          const assertions = stepAssertions(input.candidate_plan.steps[0]);
          if (assertions.some((a) => a.check === 'row_count')) auditsWithBadCount++;
          const step = input.original.steps[0];
          const checks = step.obligations.map((o) => {
            const indices = assertions.flatMap((a, i) =>
              a.obligation_ids.includes(o.id) ? [i] : [],
            );
            return {
              step_id: step.step_id,
              obligation_id: o.id,
              status: indices.length ? 'COVERED' : 'MISSING',
              assertion_indices: indices,
              reason: indices.length ? '只引用当前义务实际测量' : '后续片段仍须补证',
            };
          });
          value = {
            checks,
            issues: checks.some((x) => x.status === 'MISSING')
              ? [{ code: 'ASSERTION_GAP', step_id: step.step_id, reason: '后续必须补齐原检查' }]
              : [],
          };
        } else if (input.step.step_id === '3') {
          detailPlans++;
          const base = {
            kind: 'row',
            table,
            key: { column: '编号', value: 'D009' },
            target: role('button', '详情'),
          };
          value = fragment(
            [{ op: 'click', target: base }],
            c.steps[1].obligations.map((o) => ({
              target: /h2/.test(o.text) ? role('heading', 'D009') : role('dialog', '设备详情'),
              check: 'visible',
              oracle_quote: c.steps[1].expected,
              obligation_ids: [o.id],
            })),
            true,
          );
        } else {
          pagePlans++;
          if (scenario === 'invalid-with-action') value = fragment([clickNext], [count]);
          else if (pagePlans === 1) value = fragment([clickNext], []);
          else if (pagePlans === 2 || scenario === 'persistent-invalid')
            value = fragment([], [identities, count]);
          else if (pagePlans === 3) {
            assert.equal(input.correction.code, 'PLAN_ASSERTION_UNSUPPORTED');
            assert.equal(input.correction.detail.field_path, 'plan.steps[0].assertions_flat[1]');
            assert.equal(input.progress.completed_segments, 1);
            assert.equal(input.remaining.replans, 1);
            assert.match(input.correction.instruction, /not.*executed|not.*measured/i);
            value = fragment([], [identities]);
          } else if (pagePlans === 4)
            value = fragment(
              [],
              [proof('text', '第2/3页', ['2-O1', '2-O2'], { kind: 'testid', value: 'pager' })],
            );
          else value = fragment([], [], true);
        }
        return {
          value,
          usage: { response_model: 'injected', prompt_tokens: 1, completion_tokens: 1 },
        };
      },
    };
    const controller = new Controller({ store, provider, browser, planningMode: 'adaptive' });
    await controller.confirmCase(id, c.case_id, { steps: c.steps });
    await controller.launch(id, 'test', [c.case_id]);
    await controller.active?.finished;
    const state = await store.read(id);
    const attempts = state.cases[0].attempts;
    assert.ok(attempts.length, JSON.stringify(state.events.slice(-5)));
    const fact = await store.facts(id, attempts.at(-1));
    assert.equal(
      auditsWithBadCount,
      0,
      'invalid assertion must be rejected before audit/measurement',
    );
    assert.equal(
      fact.assertions.some((a) => a.check === 'row_count'),
      false,
    );
    assert.deepEqual(c, frozen);
    assert.deepEqual(fact.executed_case.steps, frozen.steps);
    const rejected = fact.adaptive_segments.find((s) => s.error === 'PLAN_ASSERTION_UNSUPPORTED');
    assert.ok(rejected, JSON.stringify(fact.adaptive_segments));
    assert.equal(rejected.dispatched, false);
    const clicks = fact.actions.filter((a) => a.dispatched);
    if (scenario === 'recover') {
      assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact));
      assert.equal(pagePlans, 5);
      assert.equal(detailPlans, 1);
      assert.equal(clicks.length, 2, 'one next-page click and one detail click; no replay');
      assert.equal(fact.adaptive_steps.length, 2);
    } else if (scenario === 'page-mismatch') {
      assert.equal(fact.status, 'FAIL_ASSERTION', JSON.stringify(fact));
      assert.equal(pagePlans, 4);
      assert.equal(detailPlans, 0);
      assert.equal(clicks.length, 1);
      assert.equal(fact.adaptive_steps.length, 0);
    } else {
      assert.equal(fact.status, 'TECHNICAL_FAILED');
      assert.ok(['ADAPTIVE_NO_PROGRESS', 'PLAN_ASSERTION_UNSUPPORTED'].includes(fact.error));
      assert.ok(pagePlans <= (scenario === 'persistent-invalid' ? 4 : 3));
      assert.equal(detailPlans, 0);
      assert.equal(fact.assertions.length, 0);
      assert.equal(clicks.length, scenario === 'persistent-invalid' ? 1 : 0);
    }
  });
}

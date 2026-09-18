import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { suggestObligations, planHash } from '../src/plans.mjs';
import { stepAssertions } from '../src/plan-steps.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { report } from '../src/report.mjs';

// Injected model decisions exercise the real runtime/browser, NOT model intelligence.
const role = (role, name) => ({ kind: 'role', role, name, exact: true });
async function setup(t, options = {}) {
  const html = `<!doctype html><meta charset="utf-8"><h1>设备管理</h1>
  <button type="button" onclick="openMenu(this)">运营中心</button><main id="view"></main>
  <script>function openMenu(b){b.disabled=true;view.innerHTML='<${options.link ? 'a href="#assets"' : 'button type="button"'} onclick="assets()">资产设备</${options.link ? 'a' : 'button'}>'}
  function assets(){view.innerHTML='<article aria-label="设备D009"><h2>D009</h2><button type="button" onclick="detail()">详情</button></article>'}
  function detail(){setTimeout(()=>{const d=document.createElement('dialog');d.setAttribute('aria-label','设备详情');d.innerHTML='<h2>D009</h2><button type="button" role="tab" onclick="params(this)">运行参数</button>';document.body.append(d);d.showModal()},80)}
  function params(b){b.disabled=true;b.insertAdjacentHTML('afterend','<label>频率<input readonly value="${options.wrong ? '60' : '50'}"></label>')}
  </script>`;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const target = `http://127.0.0.1:${server.address().port}/`;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-ui-'));
  const store = new Store(root);
  await store.init();
  t.after(() => store.releaseLock());
  const c = {
    case_id: 'AD-1',
    title: '动态菜单、卡片与详情',
    data: { identity: 'D009', container: '设备D009' },
    steps: suggestObligations([
      {
        step_id: 'S1',
        action: '展开运营中心并点击资产设备，打开设备D009的详情。',
        expected: options.compound
          ? '设备详情中D009标题可见；运行参数标签可见。'
          : '设备详情中D009标题可见。',
      },
      { step_id: 'S2', action: '点击运行参数并查看频率。', expected: '频率为50。' },
    ]),
  };
  const id = await store.create({ name: '独立合成动态执行', target, baseline: { cases: [c] } });
  await store.update(id, (s) => {
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    s.auth_marker = role('heading', '设备管理');
  });
  const session = new BrowserSession({ headless: true });
  t.after(() => session.close());
  const task = await store.read(id);
  await session.open(task);
  await session.authenticate(task, task.auth_marker);
  const calls = [];
  const provider = {
    configured: () => true,
    json: async (prompt, input) => {
      let value;
      if (prompt.startsWith(INPUT_REVIEW_PROMPT)) {
        calls.push('input');
        value = { issues: [] };
      } else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
        calls.push('audit');
        const checks = input.original.steps.flatMap((s) =>
          s.obligations.map((o) => {
            const assertions = stepAssertions(
              input.candidate_plan.steps.find((x) => x.step_id === s.step_id),
            );
            const indices = assertions.flatMap((a, i) =>
              a.obligation_ids.includes(o.id) ? [i] : [],
            );
            return {
              step_id: s.step_id,
              obligation_id: o.id,
              status: indices.length ? 'COVERED' : 'MISSING',
              assertion_indices: indices,
              reason: '合成协议审查，不是真实模型',
            };
          }),
        );
        value = {
          checks,
          issues: checks
            .filter((x) => x.status === 'MISSING')
            .map((x) => ({
              code: 'ASSERTION_GAP',
              step_id: x.step_id,
              reason: '后续现场仍需补齐检查',
            })),
        };
      } else {
        calls.push('plan');
        const previous = input.previous.length,
          s = c.steps.find((x) => x.step_id === input.step.step_id);
        const next =
          input.step.step_id === 'S1'
            ? ['运营中心', '资产设备', '详情'][previous]
            : ['运行参数'][previous];
        if (next) {
          const found = input.current.controls.find(
            (x) => x.name === next && x.locator && ['button', 'link', 'tab'].includes(x.role),
          );
          assert.ok(found, `当前观察应包含${next}`);
          if (previous === 0 && s.step_id === 'S1')
            assert.equal(
              input.current.controls.some((x) => x.name === '详情'),
              false,
              '无需先观察未来DOM',
            );
          value = {
            actions: [
              { action_id: `${s.step_id}-${previous}`, op: 'click', target: found.locator },
            ],
            assertions: [],
            complete: false,
            within_ms: 1000,
            reason: '只执行当前观察中的一步',
          };
          if (options.badFirst && calls.filter((x) => x === 'plan').length === 1)
            value.actions[0].target = role('button', '不存在的菜单');
        } else {
          const target =
            s.step_id === 'S1'
              ? {
                  kind: 'within',
                  scope: { role: 'dialog', name: '设备详情', exact: true },
                  target: role('heading', 'D009'),
                }
              : { kind: 'label', value: '频率', exact: true };
          value = {
            actions: [],
            assertions: [
              {
                target,
                check: s.step_id === 'S1' ? 'visible' : 'value',
                ...(s.step_id === 'S2' ? { expected: '50' } : {}),
                oracle_quote: s.obligations[0].text,
                obligation_ids: [s.obligations[0].id],
              },
            ],
            complete: true,
            within_ms: 200,
            reason: '核验固定原预期',
          };
          if (options.skip) value.assertions = [];
          if (options.ambiguous && s.step_id === 'S1' && !input.repair_assertions)
            value.assertions[0].target = role('heading', 'D009');
          if (options.tamper && input.repair_assertions) {
            value.assertions[0].check = 'text';
            value.assertions[0].expected = 'D009';
          }
        }
      }
      if (options.transform) value = options.transform(value, { prompt, input, calls });
      return {
        value,
        usage: { response_model: 'injected', prompt_tokens: 1, completion_tokens: 1 },
      };
    },
  };
  const controller = new Controller({
    store,
    provider,
    browser: session,
    planningMode: 'adaptive',
  });
  await controller.confirmCase(id, c.case_id, { steps: c.steps });
  return { controller, store, id, c, calls, session };
}
async function run(e) {
  await e.controller.launch(e.id, 'test', [e.c.case_id]);
  await e.controller.active?.finished;
  const state = await e.store.read(e.id);
  const row = state.cases[0];
  assert.ok(row.attempts.length, JSON.stringify(state.events.slice(-8)));
  return { state, row, fact: await e.store.facts(e.id, row.attempts.at(-1)) };
}

for (const finish of [true, false]) {
  test(`measured assertion repeated with complete=${finish} ${finish ? 'may finalize' : 'still stops as no progress'}`, async (t) => {
    let measured = 0;
    let saved;
    const e = await setup(t, {
      transform(value, { prompt, input }) {
        if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
          return value;
        if (input.step.step_id === 'S1' && !value.actions.length) {
          saved ??= structuredClone(value);
          return {
            ...structuredClone(saved),
            complete: measured++ > 0 && finish,
            reason: `重复检查${measured}`,
          };
        }
        return value;
      },
    });
    const { row, fact } = await run(e);
    if (finish) {
      assert.equal(
        row.status,
        'PASS_ASSERTIONS',
        JSON.stringify({ status: row.status, error: fact.error }),
      );
      assert.equal(fact.actions.length, 4, 'completion never repeats menu/detail/tab actions');
      assert.equal(fact.adaptive_steps.length, 2);
    } else {
      assert.equal(row.status, 'TECHNICAL_FAILED');
      assert.equal(fact.error, 'ADAPTIVE_NO_PROGRESS');
      assert.equal(fact.actions.length, 3);
      assert.equal(measured, 3, 'one bounded reconsideration, then permanent repeat stops');
    }
  });
}

test('partial audit gaps survive success and a repeated measurement recovers without replaying actions', async (t) => {
  let duplicate;
  let observedGap = false,
    corrected = false;
  const e = await setup(t, {
    compound: true,
    transform(value, { prompt, input }) {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
        return value;
      if (input.step.step_id !== 'S1' || value.actions.length) return value;
      duplicate ??= { ...structuredClone(value), complete: false };
      if (input.previous.length === 3) return structuredClone(duplicate);
      assert.equal(input.progress.completed_segments, 4);
      assert.deepEqual(
        input.progress.remaining_obligations.map((o) => o.id),
        ['S1-O2'],
      );
      assert.equal(input.progress.obligations[0].status, 'MEASURED_COVERED');
      assert.ok(input.progress.issues.some((issue) => issue.code === 'ASSERTION_GAP'));
      observedGap = true;
      if (!input.correction) return structuredClone(duplicate);
      assert.equal(input.correction.code, 'ADAPTIVE_NO_PROGRESS');
      assert.equal(input.remaining.replans, 1);
      corrected = true;
      const obligation = input.original.steps[0].obligations[1];
      return {
        ...value,
        assertions: [
          {
            target: role('tab', '运行参数'),
            check: 'visible',
            oracle_quote: obligation.text,
            obligation_ids: [obligation.id],
          },
        ],
        complete: true,
      };
    },
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.ok(observedGap && corrected);
  assert.equal(fact.actions.length, 4);
  assert.equal(fact.assertions.length, 3, 'rejected duplicate was never measured twice');
  assert.equal(fact.adaptive_steps.length, 2);
  assert.ok(
    fact.adaptive_segments.some(
      (item) => item.error === 'ADAPTIVE_NO_PROGRESS' && !item.dispatched,
    ),
  );
});

test('contradictory audit returns candidate feedback without executing or erasing its negative finding', async (t) => {
  let contradicted = false,
    corrected = false;
  const e = await setup(t, {
    transform(value, { prompt, input }) {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT)) return value;
      if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
        if (!contradicted && value.checks.every((check) => check.status === 'COVERED')) {
          contradicted = true;
          value.issues.push({
            step_id: 'S1',
            code: 'ASSERTION_GAP',
            reason: '合成矛盾审查：声称覆盖但又报告缺口',
          });
        }
        return value;
      }
      if (input.correction?.code === 'ADAPTIVE_SEGMENT_REJECTED') {
        assert.equal(input.correction.audit.outcome, 'REPAIR');
        assert.ok(input.correction.audit.issues.some((issue) => issue.code === 'ASSERTION_GAP'));
        assert.equal(
          input.progress.obligations[0].status,
          'PENDING',
          'rejected proposed assertion is not measured',
        );
        corrected = true;
        value.reason = '已对照原预期重新核对当前标题测量，提交独立审查';
      }
      return value;
    },
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.ok(contradicted && corrected);
  assert.equal(fact.actions.length, 4);
  assert.equal(fact.assertions.length, 2);
  assert.ok(
    fact.adaptive_segments.some(
      (item) =>
        item.status === 'REJECTED' &&
        item.audit?.issues.some((issue) => issue.code === 'ASSERTION_GAP'),
    ),
  );
});

test('no remaining obligations feedback permits a no-action completion but never replays navigation', async (t) => {
  const e = await setup(t, {
    transform(value, { prompt, input }) {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
        return value;
      if (input.step.step_id === 'S1' && !value.actions.length) {
        if (input.correction?.code === 'ADAPTIVE_NO_PROGRESS') {
          assert.deepEqual(input.progress.remaining_obligations, []);
          return { ...value, assertions: [], complete: true };
        }
        return { ...value, complete: false };
      }
      return value;
    },
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.equal(fact.assertions.length, 2);
});

test('real-response format error then mistaken blocked recovers without replaying menu clicks', async (t) => {
  let next = 0;
  const e = await setup(t, {
    transform: (value, { prompt, input }) => {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
        return value;
      next++;
      if (next === 1) {
        value.actions[0].target = { kind: 'button', name: '运营中心', exact: true };
        return value;
      }
      if (next === 2) {
        assert.equal(input.correction.code, 'INVALID_LOCATOR');
        return { blocked: true, reason: '没有看见子菜单资产设备，无法继续。' };
      }
      if (next === 3) assert.equal(input.correction.code, 'ADAPTIVE_MODEL_BLOCKED');
      return value;
    },
  });
  const { fact, state } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.ok(state.events.some((x) => x.type === 'ADAPTIVE_PROTOCOL_REPAIR'));
  assert.ok(state.events.some((x) => x.type === 'ADAPTIVE_BLOCK_REVIEW'));
});

test('malformed audit response repairs only the audit while preserving executed actions', async (t) => {
  let broken = false;
  const e = await setup(t, {
    transform: (value, { prompt, input }) => {
      if (
        prompt.startsWith(PLAN_AUDIT_PROMPT) &&
        value.checks.some((x) => x.status === 'COVERED') &&
        !broken
      ) {
        broken = true;
        value.checks.find((x) => x.status === 'COVERED').assertion_indices = [];
      }
      return value;
    },
  });
  const { fact, state } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.ok(state.events.some((x) => x.type === 'ADAPTIVE_AUDIT_REPAIR'));
});

test('repeated blocked is terminal after one evidence-based reconsideration', async (t) => {
  let plans = 0;
  const e = await setup(t, {
    transform: (value, { prompt }) => {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
        return value;
      plans++;
      return { blocked: true, reason: '仍无法提出有依据的下一步。' };
    },
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'TECHNICAL_FAILED');
  assert.equal(fact.error, 'ADAPTIVE_MODEL_BLOCKED');
  assert.equal(fact.actions.length, 0);
  assert.equal(plans, 2);
});

test('current target/source refs execute through the real controller and browser kernel', async (t) => {
  const e = await setup(t, {
    transform: (value, { prompt, input }) => {
      if (prompt.startsWith(INPUT_REVIEW_PROMPT) || prompt.startsWith(PLAN_AUDIT_PROMPT))
        return value;
      value.actions = value.actions.map((a) => ({
        op: a.op,
        target_ref: input.targets.find(
          (x) => JSON.stringify(x.locator) === JSON.stringify(a.target),
        ).ref,
      }));
      value.assertions = value.assertions.map(({ oracle_quote, obligation_ids, ...a }) => ({
        ...a,
        source_refs: obligation_ids,
      }));
      return value;
    },
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.ok(fact.actions.every((a) => a.action_id.startsWith('ad-')));
  assert.ok(
    fact.assertions.every((a) => typeof a.oracle_quote === 'string' && a.obligation_ids.length),
  );
});

test('exhausted audit format repair is terminal without spending a fresh planning round', async (t) => {
  const e = await setup(t, {
    transform: (value, { prompt }) =>
      prompt.startsWith(PLAN_AUDIT_PROMPT) ? { checks: [], issues: [] } : value,
  });
  const { fact } = await run(e);
  assert.equal(fact.status, 'TECHNICAL_FAILED');
  assert.equal(fact.error, 'PLAN_AUDIT_COUNT_INVALID');
  assert.equal(e.calls.filter((x) => x === 'plan').length, 1);
  assert.equal(e.calls.filter((x) => x === 'audit').length, 3);
  assert.equal(fact.actions.length, 0);
});

for (const link of [false, true])
  test(`direct test dynamically handles ${link ? 'link' : 'button'} navigation without upfront technical plan`, async (t) => {
    const e = await setup(t, { link });
    const { state, row, fact } = await run(e);
    assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
    assert.equal(row.approval_kind, 'case_and_scope');
    assert.equal(row.approved_hash, planHash(row.plan));
    assert.equal(fact.adaptive_steps.length, 2);
    assert.equal(fact.actions.length, 4);
    assert.equal(fact.assertions.length, 2);
    assert.equal(e.calls.filter((x) => x === 'input').length, 1);
    assert.ok(!state.events.some((x) => x.type === 'PLAN_APPROVED'));
    const projection = await e.store.executionProjection(e.id);
    assert.equal(projection.issues.length, 0);
    const output = await report(e.store, e.id);
    assert.ok(output);
  });
test('actual business mismatch stops without changing oracle or replaying actions', async (t) => {
  const e = await setup(t, { wrong: true });
  const { fact } = await run(e);
  assert.equal(fact.status, 'FAIL_ASSERTION', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.equal(fact.assertions.at(-1).expected, '50');
  assert.equal(fact.adaptive_steps.length, 1);
});
test('a pre-dispatch locator failure is locally replanned and the rejected attempt is retained', async (t) => {
  const e = await setup(t, { badFirst: true });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.ok(
    fact.adaptive_segments.some(
      (x) => x.status === 'REJECTED' && x.dispatched === false && x.error === 'LOCATOR_NOT_VISIBLE',
    ),
  );
});
test('model completion cannot skip original expected obligations', async (t) => {
  const e = await setup(t, { skip: true });
  const { fact } = await run(e);
  assert.notEqual(fact.status, 'PASS_ASSERTIONS');
  assert.equal(fact.adaptive_steps.length, 0);
});
test('direct entry refuses write authorization and unreviewed input', async (t) => {
  const e = await setup(t);
  await e.store.update(e.id, (s) => {
    s.authorization.writes = true;
  });
  await assert.rejects(e.controller.launch(e.id, 'test', [e.c.case_id]), {
    code: 'ADAPTIVE_READ_ONLY_REQUIRED',
  });
  await e.store.update(e.id, (s) => {
    s.authorization.writes = false;
    s.cases[0].reviewed = false;
  });
  await assert.rejects(e.controller.launch(e.id, 'test', [e.c.case_id]), {
    code: 'ADAPTIVE_REVIEW_REQUIRED',
  });
  assert.equal(e.calls.length, 0);
});

test('ambiguous assertion can repair its scope without replaying completed actions', async (t) => {
  const e = await setup(t, { ambiguous: true });
  const { fact } = await run(e);
  assert.equal(fact.status, 'PASS_ASSERTIONS', JSON.stringify(fact.adaptive_segments));
  assert.equal(fact.actions.length, 4);
  assert.ok(fact.adaptive_segments.some((x) => x.error === 'LOCATOR_NOT_UNIQUE' && !x.dispatched));
});

test('assertion scope repair cannot change the predicate or expected result', async (t) => {
  const e = await setup(t, { ambiguous: true, tamper: true });
  const { fact } = await run(e);
  assert.notEqual(fact.status, 'PASS_ASSERTIONS');
  assert.equal(fact.error, 'ADAPTIVE_ASSERTION_CONTRACT_CHANGED');
  assert.equal(fact.actions.length, 3);
  assert.equal(fact.adaptive_steps.length, 0);
});

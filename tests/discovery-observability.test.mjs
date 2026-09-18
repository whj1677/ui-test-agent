import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { DISCOVERY_PROMPT } from '../src/discovery.mjs';
import { CASE_NAMED_GUIDANCE } from '../src/case-named.mjs';
import { caseHash, suggestObligations } from '../src/plans.mjs';
import { fixtureModelPhase, fixtureModelReply } from './fixture-model.mjs';
import { rejectionLog, recordRejection } from '../src/observation-diagnostics.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
async function site(t, body) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/`;
}
const wizard = (
  marked,
) => `<h1>申请向导</h1><ol><li ${marked ? 'aria-current="step"' : ''}>基本信息</li><li>明细</li></ol>
<section><h2>基本信息</h2><form><label>名称<input></label><button>下一步</button></form></section>
<script>window.effects=0; document.querySelector('form').oninput=()=>effects++; document.querySelector('form').onsubmit=e=>{e.preventDefault(); effects++};</script>`;

test('discovery knows the same bounded future-binding protocol as planning', () => {
  assert.ok(DISCOVERY_PROMPT.includes(CASE_NAMED_GUIDANCE));
  assert.match(DISCOVERY_PROMPT, /never a discovery action permission/i);
});

for (const marked of [true, false]) {
  test(`real discovery feeds future binding to planning; wizard context=${marked}`, async (t) => {
    const target = await site(t, wizard(marked));
    const session = new BrowserSession({ headless: true });
    t.after(() => session.close());
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'discovery-handoff-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'FUTURE',
      steps: suggestObligations([
        { step_id: '1', action: '点击「下一步」，数量输入2', expected: '数量为2' },
      ]),
    };
    const original = JSON.stringify(c);
    const future = {
      kind: 'case_named',
      source_step_id: '1',
      target: { kind: 'label', value: '数量', exact: true },
      control_type: 'number',
      guard: { path: '/', page_heading: '申请向导', step: '明细' },
    };
    const plan = {
      schema_version: 'ui-agent-plan/v2',
      case_id: c.case_id,
      case_hash: caseHash(c),
      entry_path: '/',
      data_effect: 'read_only',
      preconditions: [],
      cleanup: null,
      steps: [
        {
          step_id: '1',
          source_action: c.steps[0].action,
          source_expected: c.steps[0].expected,
          actions: [
            { action_id: 'next', op: 'click', target: role('button', '下一步') },
            { action_id: 'fill', op: 'fill', target: future, value: '2' },
          ],
          assertions: [
            {
              target: future,
              check: 'value',
              expected: '2',
              oracle_quote: '数量为2',
              obligation_ids: ['1-O1'],
            },
          ],
          assertion_mode: 'simultaneous',
          within_ms: 1000,
        },
      ],
    };
    const id = await store.create({ name: '探索规划限定衔接', target, baseline: { cases: [c] } });
    await store.update(id, (s) => {
      s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    });
    const task = await store.read(id);
    await session.open(task);
    await session.authenticate(task, role('heading', '申请向导'));
    const calls = [];
    const provider = {
      configured: () => true,
      json: async (prompt, input, options) => {
        const phase = fixtureModelPhase(prompt, input);
        calls.push(phase);
        let value = { issues: [] };
        if (input.purpose === 'case_ui_discovery') {
          assert.ok(prompt.includes(CASE_NAMED_GUIDANCE));
          assert.equal(
            input.current.controls.some((x) => x.name === '数量'),
            false,
          );
          assert.equal(
            input.candidates.some((x) => x.name === '下一步'),
            false,
          );
          value = marked
            ? {
                done: true,
                reason: '向导结构已观察，原文字段交固定规划阶段校验；不代表字段已出现。',
              }
            : { blocked: true, reason: '缺少当前步骤标识，不能假设延迟绑定可用。' };
        } else {
          if (phase === 'plan') assert.ok(input.pages.some((p) => p.wizard_context));
          value = fixtureModelReply(prompt, input, [structuredClone(plan)]);
        }
        return {
          value,
          usage: { response_model: 'local-injected', prompt_tokens: 1, completion_tokens: 1 },
        };
      },
    };
    const controller = new Controller({ store, provider, browser: session });
    await controller.confirmCase(id, c.case_id, { steps: c.steps, note: '固定合成原文' });
    await controller.launch(id, 'discover', [c.case_id]);
    await controller.active.finished;
    const result = await store.read(id),
      row = result.cases[0];
    assert.equal(
      row.discovery.status,
      marked ? 'CAPTURED' : 'BLOCKED',
      JSON.stringify(row.discovery),
    );
    assert.equal(row.plan_approved, false);
    assert.equal(row.attempts.length, 0);
    if (marked) {
      assert.equal(row.status, 'PLAN_REVIEW', row.mapping_reason);
      assert.equal(row.plan.steps[0].actions[1].target.kind, 'case_named');
    } else assert.equal(row.plan == null, true);
    assert.equal(await session.loginPage.evaluate(() => effects), 0);
    assert.equal(
      result.events.some((e) => e.type === 'DISCOVERY_ACTION_BEFORE'),
      false,
    );
    const offered = result.events.find((e) => e.type === 'DISCOVERY_CANDIDATES_PROVIDED');
    assert.ok(offered?.page_id);
    assert.ok(offered?.request_id);
    const observation = result.events.find((e) => e.type === 'DISCOVERY_OBSERVED');
    const mapping = observation.observation_diagnostics;
    const selection = observation.candidate_diagnostics;
    assert.equal(mapping.raw_count, mapping.mapped_count + mapping.rejected.total);
    assert.equal(
      selection.considered_controls,
      selection.eligible_controls + selection.excluded.total,
    );
    assert.equal(selection.excluded.counts.FORM_SUBMIT_UNAUTHORIZED, 1);
    assert.equal(JSON.stringify(c), original);
    assert.ok(calls.includes('discovery'));
    assert.equal(calls.includes('plan'), marked);
    assert.equal(calls.includes('plan_audit'), marked);
  });
}

test('rejection accounting is bounded and never exposes sensitive control names', () => {
  const log = rejectionLog();
  for (let i = 0; i < 100; i++) recordRejection(log, 'TARGET_DISABLED', '普通控件', i);
  for (let i = 0; i < 30; i++) recordRejection(log, 'CODE_' + i, 'API key local-sensitive', i);
  assert.equal(log.total, 130);
  assert.equal(log.counts.TARGET_DISABLED, 100);
  assert.equal(log.samples.length, 24);
  assert.equal(log.omitted_samples, 106);
  assert.ok(!JSON.stringify(log).includes('local-sensitive'));
  assert.ok(log.samples.every((s) => Object.keys(s).sort().join() === 'code,control_index,name'));
});

test('real candidate exclusions explain mapping, ambiguity, disabled, safety and unsupported controls', async (t) => {
  const target = await site(
    t,
    `<h1>诊断页面</h1><button>重复详情</button><button>重复详情</button>
    <input><div role="status">状态无匹配</div><button disabled>查看禁用项</button>
    <button>删除项目</button><button>神秘操作</button><button>查看详情</button>
    <label>业务字段<input value="unlogged-local-value"></label>`,
  );
  const task = {
    id: 'diagnostics',
    target,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  const session = new BrowserSession({ headless: true });
  t.after(() => session.close());
  await session.open(task);
  await session.authenticate(task, role('heading', '诊断页面'));
  const explorer = new DiscoveryBrowser(session, task);
  t.after(() => explorer.close());
  const observed = await explorer.open();
  const mapping = observed.snapshot.observation_diagnostics;
  assert.equal(mapping.raw_count, mapping.mapped_count + mapping.rejected.total);
  assert.equal(mapping.rejected.counts.ADAPTER_TARGET_NOT_UNIQUE, 2);
  assert.equal(mapping.rejected.counts.ADAPTER_TARGET_MISSING, 1);
  assert.ok(mapping.rejected.counts.ADAPTER_MAPPING_MISSING >= 1);
  const candidates = observed.snapshot.candidate_diagnostics;
  for (const code of [
    'TARGET_DISABLED',
    'ACTION_SAFETY_FILTERED',
    'INTERACTION_UNSUPPORTED',
    'INPUT_CAPABILITY_UNAVAILABLE',
  ])
    assert.equal(candidates.excluded.counts[code], 1, JSON.stringify(candidates));
  assert.equal(
    candidates.considered_controls,
    candidates.eligible_controls + candidates.excluded.total,
  );
  assert.deepEqual(
    observed.candidates.map((c) => c.name),
    ['查看详情'],
  );
  assert.ok(!JSON.stringify({ mapping, candidates }).includes('unlogged-local-value'));
});

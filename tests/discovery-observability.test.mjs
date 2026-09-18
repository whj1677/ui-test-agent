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
    assert.equal(JSON.stringify(c), original);
    assert.ok(calls.includes('discovery'));
    assert.equal(calls.includes('plan'), marked);
    assert.equal(calls.includes('plan_audit'), marked);
  });
}

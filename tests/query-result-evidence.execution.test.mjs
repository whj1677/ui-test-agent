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

for (const scenario of ['correct', 'wrong-result-name', 'persistent-input-only'])
  test('AND result evidence without replay: ' + scenario, async (t) => {
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(`<h1>结果证据演练</h1><form onsubmit="event.preventDefault();document.querySelector('#queries').textContent=String(Number(document.querySelector('#queries').textContent)+1)">
        <label>关键词<input type="text" name="keyword"></label>
        <label>园区<select name="park"><option>全部</option><option>西区</option></select></label>
        <label>状态<select name="state"><option>全部</option><option>在线</option></select></label>
        <button>查询</button></form><span id="queries">0</span>
        <table aria-label="记录"><thead><tr><th>编号</th><th>名称</th><th>园区</th><th>状态</th></tr></thead>
        <tbody><tr><td>X017</td><td>${scenario === 'wrong-result-name' ? '电机' : '阀门'}</td><td>西区</td><td>在线</td></tr></tbody></table>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'query-result-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'QUERY',
      data: { keyword: '阀门', park: '西区', state: '在线', id: 'X017' },
      steps: suggestObligations([
        {
          step_id: '1',
          action: '在「关键词」输入 阀门，「园区」选择 西区，「状态」选择 在线。',
          expected: '三个条件均已设置。',
        },
        { step_id: '2', action: '点击「查询」。', expected: '条件按AND生效。' },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '结果证据演练', exact: true };
    const table = { kind: 'role', role: 'table', name: '记录', exact: true };
    const id = await store.create({
      name: 'AND engineering',
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
    let inputPlans = 0,
      queryPlans = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          value = {
            checks: [
              {
                obligation_id: input.original.steps[0].obligations[0].id,
                status: 'COVERED',
                assertion_refs: input.assertion_catalog.map((a) => a.ref),
                reason: '注入审查故意不发现缺字段，由程序必要证据兜底',
              },
            ],
            issues: [],
          };
        } else if (input.step.step_id === '1') {
          const [label, literal, op] = [
            ['关键词', '阀门', 'fill'],
            ['园区', '西区', 'select'],
            ['状态', '在线', 'select'],
          ][inputPlans++];
          const target = { kind: 'label', value: label, exact: true };
          value = {
            actions: [{ action_id: 'input-' + inputPlans, op, target, value: literal }],
            assertions: [
              {
                target,
                check: op === 'fill' ? 'value' : 'selected_label',
                expected: literal,
                source_refs: ['1-O1'],
              },
            ],
            complete: inputPlans === 3,
            within_ms: 1500,
            reason: '原输入',
          };
        } else {
          queryPlans++;
          if (queryPlans === 1)
            value = {
              actions: [
                {
                  action_id: 'query',
                  op: 'click',
                  target: { kind: 'role', role: 'button', name: '查询', exact: true },
                },
              ],
              assertions: [
                {
                  target: { kind: 'label', value: '关键词', exact: true },
                  check: 'value',
                  expected: '阀门',
                  source_refs: ['2-O1'],
                },
              ],
              complete: false,
              within_ms: 1500,
              reason: '先执行查询，尚未完成结果检查',
            };
          else {
            if (queryPlans === 3) assert.equal(input.correction.code, 'PLAN_QUERY_RESULT_UNPROVEN');
            const field = (column, expected) => ({
              target: { kind: 'cell', table, key: { column: '编号', value: 'X017' }, column },
              check: 'text',
              expected,
              source_refs: ['2-O1'],
            });
            const bad = queryPlans === 2 || scenario === 'persistent-input-only';
            value = {
              actions: [],
              assertions: [
                bad
                  ? {
                      target: { kind: 'label', value: '关键词', exact: true },
                      check: 'value',
                      expected: '阀门',
                      source_refs: ['2-O1'],
                    }
                  : field('名称', '阀门'),
                field('园区', '西区'),
                field('状态', '在线'),
              ],
              complete: true,
              within_ms: 1500,
              reason: '补当前查询结果，不再次点击查询',
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
      facts = await store.facts(id, row.attempts.at(-1));
    assert.equal(
      facts.status,
      scenario === 'correct'
        ? 'PASS_ASSERTIONS'
        : scenario === 'wrong-result-name'
          ? 'FAIL_ASSERTION'
          : 'TECHNICAL_FAILED',
      JSON.stringify(facts.error),
    );
    assert.equal(facts.actions.filter((a) => a.action_id === 'query' && a.dispatched).length, 1);
    assert.ok(
      facts.adaptive_segments.some(
        (s) => s.error === 'PLAN_QUERY_RESULT_UNPROVEN' && !s.dispatched,
      ),
    );
    const names = facts.assertions.filter(
      (a) => a.target?.kind === 'cell' && a.target.column === '名称',
    );
    assert.equal(names.length, scenario === 'persistent-input-only' ? 0 : 1);
    if (names.length) assert.equal(names[0].passed, scenario === 'correct');
  });

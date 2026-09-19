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

for (const scenario of [
  'repair',
  'actual-field-difference',
  'persistent-aggregate',
  'explicit-literal-difference',
])
  test('row source boundary without normalizing fabricated oracle: ' + scenario, async (t) => {
    const literal = 'Z019 箱体 西园 运行 200 kW 详情';
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end(
        '<h1>行证据演练</h1><table aria-label="结果"><thead><tr><th>编号</th><th>名称</th><th>园区</th><th>状态</th><th>功率</th><th>操作</th></tr></thead><tbody><tr><td>Z019</td><td>箱体</td><td>西园</td><td>运行</td><td>' +
          (scenario === 'actual-field-difference' ? '2000' : '200') +
          ' kW</td><td>详情</td></tr></tbody></table>',
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'row-evidence-')));
    await store.init();
    t.after(() => store.releaseLock());
    const explicit = scenario === 'explicit-literal-difference';
    const c = {
      case_id: 'ROW',
      title: '原字段核验',
      data: { id: 'Z019' },
      steps: suggestObligations([
        {
          step_id: '1',
          action: '只读核对Z019记录',
          expected: explicit
            ? '整行文本为“' + literal + '”'
            : '编号Z019，名称箱体，园区西园，状态运行，功率200',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '行证据演练', exact: true },
      table = { kind: 'role', role: 'table', name: '结果', exact: true },
      row = { kind: 'row', table, key: { column: '编号', value: 'Z019' } };
    const id = await store.create({
      name: 'row source engineering',
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
    const refs = c.steps[0].obligations.map((o) => o.id);
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          audits++;
          value = {
            checks: refs.map((id) => ({
              obligation_id: id,
              status: 'COVERED',
              assertion_refs: ['A1'],
              reason: explicit
                ? '原文确实要求完整行字面文本'
                : '同一原记录全部原字段与原数值，未擅加单位',
            })),
            issues: [],
          };
        } else {
          plans++;
          if (plans === 2) assert.equal(input.correction.code, 'ASSERTION_ROW_FIELD_REQUIRED');
          const aggregate = plans === 1 || scenario === 'persistent-aggregate' || explicit;
          value = {
            actions: [],
            assertions: [
              aggregate
                ? { target: row, check: 'text', expected: literal, source_refs: refs }
                : {
                    target: table,
                    check: 'table_cells',
                    expected: {
                      key_column: '编号',
                      rows: [
                        {
                          key: 'Z019',
                          cells: [
                            { column: '名称', check: 'text', expected: '箱体' },
                            { column: '园区', check: 'text', expected: '西园' },
                            { column: '状态', check: 'text', expected: '运行' },
                            { column: '功率', check: 'number', expected: 200 },
                          ],
                        },
                      ],
                      ordered: false,
                      exact_rows: false,
                    },
                    source_refs: refs,
                  },
            ],
            complete: true,
            within_ms: 1000,
            reason: aggregate ? '整行候选须有原明确字面依据' : '改为原对象字段和原值，不重放动作',
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
    const result = (await store.read(id)).cases[0],
      f = await store.facts(id, result.attempts.at(-1));
    assert.equal(
      f.status,
      scenario === 'repair'
        ? 'PASS_ASSERTIONS'
        : scenario === 'persistent-aggregate'
          ? 'TECHNICAL_FAILED'
          : 'FAIL_ASSERTION',
    );
    assert.equal(f.actions.filter((a) => a.dispatched).length, 0);
    assert.equal(audits, scenario === 'persistent-aggregate' ? 0 : 1);
    if (!explicit)
      assert.ok(
        f.adaptive_segments.some(
          (s) => s.error === 'ASSERTION_ROW_FIELD_REQUIRED' && !s.dispatched,
        ),
      );
    assert.equal(f.assertions.length, scenario === 'persistent-aggregate' ? 0 : 1);
    if (explicit) {
      assert.equal(f.assertions[0].expected, literal);
      assert.ok(f.assertions[0].actual.includes('\t'));
      assert.equal(plans, 1);
    } else if (f.assertions.length) {
      assert.equal(f.assertions[0].check, 'table_cells');
      assert.equal(f.assertions[0].passed, scenario === 'repair');
    }
  });

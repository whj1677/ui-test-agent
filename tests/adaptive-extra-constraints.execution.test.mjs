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

// Actual Chromium/controller; injected planning and review, NOT product acceptance.
for (const scenario of ['repair', 'difference', 'repeat']) {
  test(`original membership, not an invented closed sorted population: ${scenario}`, async (t) => {
    const ids = ['D011', 'D010', 'D009', 'D008', 'D007', 'D006'].filter(
      (x) => scenario !== 'difference' || x !== 'D009',
    );
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<h1>范围检查</h1><span>共' +
          ids.length +
          '条 · 第2/3页</span><table><thead><tr><th>编号</th></tr></thead><tbody>' +
          ids.map((x) => '<tr><td>' + x + '</td></tr>').join('') +
          '</tbody></table>',
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    const target = `http://127.0.0.1:${server.address().port}/`;
    const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'extra-constraints-')));
    await store.init();
    t.after(() => store.releaseLock());
    const c = {
      case_id: 'RANGE',
      title: '范围不是总体',
      steps: suggestObligations([
        {
          step_id: '1',
          action: '核对当前页编号与分页。',
          expected: '分页显示第2/3页；可见D006至D010。',
        },
      ]),
    };
    const marker = { kind: 'role', role: 'heading', name: '范围检查', exact: true };
    const table = { kind: 'role', role: 'table', name: '', exact: true };
    const id = await store.create({
      name: 'extra constraints engineering',
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
    let plans = 0,
      audits = 0;
    const provider = {
      configured: () => true,
      json: async (prompt, input) => {
        let value;
        if (prompt.startsWith(INPUT_REVIEW_PROMPT)) value = { issues: [] };
        else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
          audits++;
          value = {
            checks: [
              {
                obligation_id: '1-O1',
                status: 'COVERED',
                assertion_refs: ['A2'],
                reason: '仅原页码测量',
              },
              {
                obligation_id: '1-O2',
                status: 'COVERED',
                assertion_refs: ['A1'],
                reason: '每个原编号存在，额外记录及顺序不作要求',
              },
            ],
            issues: [],
          };
        } else {
          plans++;
          if (plans > 1) {
            assert.equal(input.correction.code, 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED');
            assert.equal(input.progress.completed_segments, 0);
            assert.equal(input.remaining.replans, 3 - plans);
          }
          const bad = plans === 1 || scenario === 'repeat';
          const counter = input.current.controls.find((x) =>
            x.text_context?.value.includes('第2/3页'),
          );
          assert.ok(counter);
          value = {
            actions: [],
            assertions: [
              {
                target: table,
                check: 'table_cells',
                expected: {
                  key_column: '编号',
                  rows: ['D006', 'D007', 'D008', 'D009', 'D010'].map((key) => ({
                    key,
                    cells: [{ column: '编号', check: 'text', expected: key }],
                  })),
                  ordered: bad,
                  exact_rows: bad,
                },
                source_refs: ['1-O2'],
              },
              {
                target: counter.locator,
                check: bad ? 'text' : 'contains',
                expected: bad ? counter.text_context.value : '第2/3页',
                source_refs: ['1-O1'],
              },
            ],
            complete: true,
            within_ms: 100,
            reason: '保留原可见性和分页义务',
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
    assert.equal(fact.adaptive_segments[0].error, 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED');
    assert.equal(fact.adaptive_segments[0].dispatched, false);
    assert.equal(fact.actions.length, 0);
    assert.equal(
      fact.status,
      scenario === 'repeat'
        ? 'TECHNICAL_FAILED'
        : scenario === 'difference'
          ? 'FAIL_ASSERTION'
          : 'PASS_ASSERTIONS',
    );
    assert.equal(plans, 2);
    if (scenario === 'repeat') assert.equal(fact.error, 'ADAPTIVE_NO_PROGRESS');
    assert.equal(audits, scenario === 'repeat' ? 0 : 1);
    assert.equal(fact.assertions.length, scenario === 'repeat' ? 0 : 2);
    if (scenario === 'difference')
      assert.ok(
        fact.assertions[0].table_comparison.differences.some(
          (d) => d.key === 'D009' && d.reason === 'missing_row',
        ),
      );
  });
}

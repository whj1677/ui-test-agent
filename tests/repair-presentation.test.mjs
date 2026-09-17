import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Store } from '../src/store.mjs';
import { report } from '../src/report.mjs';

const original = {
  case_id: 'A',
  title: '修复呈现回归',
  data: { name: '原值', nested: { size: 1, keep: true } },
  steps: [{ step_id: 'S1', action: '读取名称', expected: '名称为苹果' }],
};
const repair = {
  input_hash: 'input-v1',
  max_repairs: 2,
  repair_count: 1,
  outcome: 'ACCEPTED',
  rounds: [
    {
      round: 0,
      plan_hash: 'plan-before',
      status: 'AUDIT_REJECTED',
      code: 'ORACLE_COVERAGE_INCOMPLETE',
      reason: '缺少标题 <script>bad</script>',
      at: '2026-09-16T01:00:00.000Z',
    },
    {
      round: 1,
      plan_hash: 'plan-after',
      status: 'ACCEPTED',
      reason: '补全原预期，待核对',
      at: '2026-09-16T01:00:01.000Z',
    },
  ],
};
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-repair-view-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.init();
  const id = await store.create({
    name: '修复历史',
    target: 'http://127.0.0.1:1',
    baseline: { cases: [original] },
  });
  return { store, id };
}
function manifest(html) {
  return JSON.parse(
    html.match(/<pre id="report-manifest">([\s\S]*?)<\/pre>/)[1].replaceAll('&quot;', '"'),
  );
}

test('unified report shows self repair without manufacturing execution or passing results', async (t) => {
  const { store, id } = await fixture(t);
  await store.update(id, (s) =>
    Object.assign(s.cases[0], {
      status: 'PLAN_REVIEW',
      self_repair: repair,
      input_review: { issues: [], input_hash: 'input-v1' },
      plan_audit: {
        outcome: 'ACCEPTED',
        plan_hash: 'plan-after',
        input_hash: 'input-v1',
        checks: ['原预期覆盖已检查'],
        issues: [],
      },
    }),
  );
  const html = await report(store, id),
    m = manifest(html);
  assert.equal(m.counts.attempted, 0);
  assert.equal(m.counts.pass, 0);
  assert.equal(m.cases[0].status, 'PLAN_REVIEW');
  for (const text of [
    '已修复 1 / 2 次',
    '首次计划',
    '第 1 次修复',
    '前一计划：plan-before',
    '本次计划：plan-after',
    '候选计划已通过自检，仍需核对',
    '尚未执行，无实际结果',
    '不计入已执行数量或断言满足数量',
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!html.includes('<script>bad</script>'));
});
test('clarification issues and originals are visible while legacy records remain compatible', async (t) => {
  const { store, id } = await fixture(t);
  const old = await report(store, id);
  assert.ok(!old.includes('输入审查与计划自修复'));
  assert.ok(old.includes('原始测试数据'));
  assert.ok(old.includes('原值'));
  await store.update(id, (s) =>
    Object.assign(s.cases[0], {
      input_review: { issues: [{ step_id: 'S1', message: '步骤和数据不一致' }] },
      self_repair: { max_repairs: 2, repair_count: 0, outcome: 'NEEDS_CLARIFICATION', rounds: [] },
    }),
  );
  const html = await report(store, id);
  assert.ok(html.includes('步骤和数据不一致'));
  assert.ok(html.includes('需要澄清用例'));
  assert.equal(manifest(html).counts.attempted, 0);
});

async function client() {
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
    nodes = new Map(),
    fallback = { content: 'csrf' };
  const context = vm.createContext({
    document: {
      querySelector: (s) =>
        nodes.has(s) ? nodes.get(s) : s.startsWith('[data-correction=') ? null : fallback,
    },
    console,
  });
  vm.runInContext(
    source.slice(0, source.lastIndexOf('await action(() => refresh(true));')) +
      '\nconfig.auto_discovery=true;globalThis.helpers={preparationHistoryHTML,dataCorrectionHTML,readDataCorrections,eventText,discoveryHTML};',
    context,
  );
  return { helpers: context.helpers, nodes };
}

test('discovery failure shows only this job blocked request with escaped actionable guidance', async () => {
  const { helpers } = await client();
  const state = {
    discovery: { job_id: 'current', status: 'FAILED', reason: 'WRITE_NOT_AUTHORIZED' },
    events: [
      { type: 'DISCOVERY_FAILED', job_id: 'old', blocked: { method: 'POST', path: '/old/save' } },
      {
        type: 'DISCOVERY_FAILED',
        job_id: 'current',
        blocked: { method: 'POST', path: '/query/<script>' },
      },
    ],
  };
  const html = helpers.discoveryHTML(state);
  assert.ok(html.includes('POST /query/&lt;script&gt;'));
  assert.ok(html.includes('环境设置'));
  assert.ok(html.includes('若已核实为只读查询'));
  assert.ok(!html.includes('/old/save'));
  state.discovery.job_id = 'later';
  assert.ok(!helpers.discoveryHTML(state).includes('/query/'));
});
test('console presents bounded repair progress and marks accepted candidate as still awaiting review', async () => {
  const { helpers } = await client();
  const html = helpers.preparationHistoryHTML({ self_repair: repair });
  assert.ok(html.includes('已修复 1 / 2 次'));
  assert.ok(html.includes('自检采纳不代表已经执行'));
  assert.ok(html.includes('前一计划：plan-before'));
  assert.ok(html.includes('&lt;script&gt;'));
  const text = helpers.eventText({
    type: 'PLAN_REPAIR_ATTEMPT',
    case_id: 'A',
    round: 1,
    status: 'AUDIT_REJECTED',
    reason: '缺少标题',
  });
  assert.ok(text.includes('计划修复尝试已留档 · A · 第 1 次修复'));
  assert.ok(text.includes('计划语义核验未满足'));
  assert.ok(text.includes('缺少标题'));
  assert.equal(helpers.preparationHistoryHTML({}), '');
});
test('data corrections omit untouched or blank values and submit only changed existing keys', async () => {
  const { helpers, nodes } = await client(),
    c = { original, effective: structuredClone(original), attempts: [] };
  assert.ok(helpers.dataCorrectionHTML(c).includes('原始测试数据'));
  assert.equal(helpers.dataCorrectionHTML({ original: {}, effective: {}, attempts: [] }), '');
  nodes.set('[data-correction="data"]', { value: JSON.stringify(original.data) });
  assert.equal(JSON.stringify(helpers.readDataCorrections(c)), '{}');
  nodes.set('[data-correction="data"]', { value: ' ' });
  assert.equal(JSON.stringify(helpers.readDataCorrections(c)), '{}');
  nodes.set('[data-correction="data"]', {
    value: '{"name":"确认值","nested":{"size":2,"keep":true}}',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.readDataCorrections(c))), {
    data_overrides: { data: { name: '确认值', nested: { size: 2, keep: true } } },
  });
  assert.equal(original.data.name, '原值');
  assert.equal(original.data.nested.size, 1);
});
test('data corrections reject malformed JSON, unknown keys and nested keys', async () => {
  const { helpers, nodes } = await client(),
    c = { original, effective: original };
  for (const [value, pattern] of [
    ['{', /JSON 格式不正确/],
    ['[]', /必须是 JSON 对象/],
    ['{"other":1}', /只能更正已有字段/],
    ['{"nested":{"new":1}}', /只能更正已有字段/],
    ['{"__proto__":{}}', /只能更正已有字段/],
  ]) {
    nodes.set('[data-correction="data"]', { value });
    assert.throws(() => helpers.readDataCorrections(c), pattern);
  }
});

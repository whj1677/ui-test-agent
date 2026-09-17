import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { RecordingEvidence, RECORDING_HOLD_MS } from '../src/recording-evidence.mjs';
import { Store } from '../src/store.mjs';
import { report } from '../src/report.mjs';
import { caseHash, planHash, suggestObligations, validatePlan } from '../src/plans.mjs';
import { uid } from '../src/common.mjs';
import { startRecordingFixture } from './fixture-recording.mjs';

const directory = path.resolve(
  process.env.RECORDING_VALIDATION_DIR || `validation/recording-${Date.now()}`,
);
const store = new Store(path.join(directory, 'data'));
await store.init();
const site = await startRecordingFixture();
const session = new BrowserSession({ headless: true });
const target = (value) => ({ kind: 'css', value: `#${value}` });
const click = (id, value) => ({ action_id: id, op: 'click', target: target(value) });
const check = (value, expected, quote) => ({
  target: target(value),
  check: 'text',
  expected,
  oracle_quote: quote,
});
const expectations = '状态为已完成；名称为初值；点击次数为1；对象为Video-Owned-001。';
const cases = [];
const plans = [];
function addCase(id, title, entry, steps, overrides = {}) {
  const testCase = {
    case_id: id,
    title,
    steps: suggestObligations(
      steps.map(({ action, expected }, i) => ({ step_id: `S${i + 1}`, action, expected })),
    ),
  };
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: id,
    case_hash: caseHash(testCase),
    entry_path: entry,
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: steps.map((step, i) => ({
      step_id: `S${i + 1}`,
      source_action: step.action,
      source_expected: step.expected,
      actions: step.actions,
      assertion_mode: 'simultaneous',
      within_ms: step.within_ms ?? 1000,
      assertions: step.assertions.map((item) => ({
        ...item,
        obligation_ids: testCase.steps[i].obligations
          .filter(
            (obligation) =>
              item.oracle_quote.includes(obligation.text) ||
              obligation.text.includes(item.oracle_quote),
          )
          .map((obligation) => obligation.id),
      })),
    })),
    ...overrides,
  };
  validatePlan(plan, testCase, site.url);
  cases.push(testCase);
  plans.push(plan);
}
const baseStep = {
  action: '点击执行一次，读取状态、名称、点击次数和对象。',
  expected: expectations,
  actions: [click('A1', 'action')],
  assertions: [
    check('status', '已完成', '状态为已完成'),
    { target: target('name'), check: 'value', expected: '初值', oracle_quote: '名称为初值' },
    check('count', '1', '点击次数为1'),
    check('identity', '对象：Video-Owned-001', '对象为Video-Owned-001'),
  ],
};
addCase('RV-001', '正常步骤、预期和实际值', '/', [baseStep]);
addCase('RV-002', '预置错误：四项中仅状态不符', '/?defect=1', [{ ...baseStep, within_ms: 150 }]);
addCase('RV-003', '超过观察时限的成功不得算通过', '/?late=1', [{ ...baseStep, within_ms: 100 }]);
addCase('RV-004', '完整导航后仍显示正确步骤', '/', [
  {
    action: '点击查看详情。',
    expected: '位置为详情页。',
    actions: [click('A1', 'details')],
    assertions: [check('location', '详情页', '位置为详情页')],
  },
  {
    action: '点击返回列表。',
    expected: '位置为列表页。',
    actions: [click('A2', 'home')],
    assertions: [check('location', '列表页', '位置为列表页')],
  },
]);
const longExpected = '页面状态为已完成，且这是需要完整显示而不能省略的中文业务预期说明'.repeat(9);
addCase('RV-005', '长预期完整分页', '/', [
  {
    action: '点击执行一次。',
    expected: longExpected,
    actions: [click('A1', 'action')],
    assertions: [check('status', '已完成', longExpected)],
  },
]);
addCase('RV-006', '字幕失败仅影响证据完整性', '/', [baseStep]);
addCase('RV-007', '前置条件不满足时不录制业务', '/', [baseStep], {
  preconditions: [{ target: target('status'), check: 'text', expected: '不存在的前置状态' }],
});
addCase(
  'RV-008',
  '创建后精确清理，录像区分清理阶段',
  '/',
  [
    {
      action: '创建本轮Video-Owned-001记录。',
      expected: '列表包含Video-Owned-001。',
      actions: [click('A1', 'create')],
      assertions: [check('owned-item', 'Video-Owned-001', '列表包含Video-Owned-001')],
    },
  ],
  {
    data_effect: 'mutation',
    cleanup: {
      identity: 'Video-Owned-001',
      ownership: [{ target: target('owned-item'), check: 'text', expected: 'Video-Owned-001' }],
      actions: [click('CLEAN-A1', 'delete')],
      assertions: [{ target: target('owned-item'), check: 'count', expected: 0 }],
    },
  },
);
const id = await store.create({
  name: '录像步骤与预期 · 固定计划工程验证',
  target: site.url,
  baseline: { cases },
});
await store.update(id, (state) => {
  state.fixture = true;
  state.authorization = { nonproduction: true, writes: true, readOnlyEndpoints: [] };
  state.report_execution_label =
    '本机合成站点 · 固定计划工程验证 · 未调用 DeepSeek · 不代表产品验收';
  state.report_context =
    '预先定义反例：RV-002状态错误、RV-003超过断言时限、RV-006字幕故障、RV-007前置不满足。字幕在独立WebM画面内；截图保留干净业务画面。录制层的host可被DOM结构脚本枚举，本轮不证明任意框架无副作用。';
  state.cases.forEach((record, i) => {
    record.plan = plans[i];
    record.status = 'READY';
  });
});
const task = await store.read(id);
const scope = await store.beginRun(id, {
  id: uid(),
  case_ids: cases.map((c) => c.case_id),
  case_hashes: Object.fromEntries(cases.map((c) => [c.case_id, caseHash(c)])),
  plan_hashes: Object.fromEntries(plans.map((p) => [p.case_id, planHash(p)])),
});
const results = [];
try {
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '登录合成站点' }).click();
  await session.authenticate(task, target('signed'));
  for (let index = 0; index < cases.length; index++) {
    const runId = uid();
    const originalRender = RecordingEvidence.prototype.render;
    if (cases[index].case_id === 'RV-006')
      RecordingEvidence.prototype.render = async () => {
        throw new Error('injected media failure');
      };
    let fact;
    try {
      fact = await session.execute(
        task,
        cases[index],
        plans[index],
        path.join(store.dir(id), 'runs', runId),
        {
          run_scope_id: scope.id,
          onEvent: (event) => store.recordExecutionEvent(id, runId, event),
        },
      );
    } finally {
      RecordingEvidence.prototype.render = originalRender;
    }
    const receipt = await store.fact(id, fact);
    await store.update(id, (state) => {
      const record = state.cases[index];
      record.attempts.push(receipt);
      record.status = fact.status;
    });
    results.push(fact);
    console.log(
      JSON.stringify({
        case: fact.case_id,
        status: fact.status,
        evidence: fact.evidence_status,
        issues: fact.recording?.issues,
      }),
    );
  }
  assert.deepEqual(
    results.map((r) => r.status),
    [
      'PASS_ASSERTIONS',
      'FAIL_ASSERTION',
      'FAIL_ASSERTION',
      'PASS_ASSERTIONS',
      'PASS_ASSERTIONS',
      'PASS_ASSERTIONS',
      'BLOCKED_DATA',
      'PASS_ASSERTIONS',
    ],
  );
  assert.equal(results[1].assertions.filter((o) => o.passed).length, 3);
  assert.equal(results[2].assertions[0].actual, '等待操作');
  assert.equal(results[2].assertions[0].within_ms, 100);
  assert.equal(results[5].evidence_status, 'PARTIAL');
  assert.equal(results[6].media.length, 0);
  assert.equal(results[7].cleanup_status, 'CLEAN');
  assert.equal(site.item, null);
  assert.equal(site.logins, 1);
  for (const result of results.filter((r) => r.recording && r.case_id !== 'RV-006')) {
    assert.deepEqual(result.recording.issues, []);
    const captions = result.recording.timeline.filter((t) => t.kind === 'caption');
    assert.ok(
      captions.every((c) => c.visible && c.fits && c.to_ms - c.from_ms >= RECORDING_HOLD_MS),
    );
    assert.ok(
      result.recording.timeline.some(
        (t) => t.kind === 'pointer' && t.trusted_event && t.inside_target,
      ),
    );
  }
  const longCaptions = results[4].recording.timeline.filter(
    (t) => t.kind === 'caption' && t.phase === '准备操作',
  );
  assert.equal(longCaptions.map((c) => c.expected).join(''), longExpected);
  const html = await report(store, id);
  assert.ok(html.includes('3/4 项值匹配 · 整组未满足'));
  await fs.writeFile(path.join(directory, '统一验证报告.html'), html);
  await fs.writeFile(
    path.join(directory, 'summary.json'),
    JSON.stringify(
      {
        task_id: id,
        scope_id: scope.id,
        login_count: site.logins,
        model_calls: 0,
        results: results.map((r) => ({
          case_id: r.case_id,
          attempt_id: r.id,
          status: r.status,
          evidence_status: r.evidence_status,
          cleanup_status: r.cleanup_status,
          media: r.media,
          recording: r.recording,
        })),
        checks:
          'Fixed-plan runner integration and media timeline; decoded-frame visual review is separate.',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ validated: true, directory, task_id: id }));
} finally {
  await session.close();
  await site.close();
}

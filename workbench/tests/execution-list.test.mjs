import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionListModel, filterExecutionRows, groupExecutionSymptoms, executionRowSummaryHtml, executionRowActivityHtml, executionRevisionAvailability, executionArtifactLabel, executionIndexMeta } from '../web-v2/execution-list.js';
import { backendRunHtml, stageBackendRevisionContext, backendRevisionContextFor } from '../web-v2/backend.js';

const project = { project_id: 'p1', cases: [
  { case_id: 'c1', external_id: 'TC-1', versions: [{ version: 1, content: { title: '旧要求' } }, { version: 2, content: { title: '新要求' } }] },
  { case_id: 'c2', external_id: 'TC-2', versions: [{ version: 1, content: { title: '另一用例' } }] },
] };
const selection = (caseId, version) => ({ project_id: 'p1', case_id: caseId, case_version: version, source_task_id: 'task-1', candidate_version: 3, bundle_sha256: 'bundle-3' });
const batch = { batch_id: 'batch-1', project_id: 'p1', created_at: '2026-09-26T01:00:00Z', state: 'FINISHED', software_version: 'app-1', items: [
  { case_id: 'c1', case_version: 1, external_id: 'TC-1', title: '旧要求', state: 'FINISHED', result: 'FAILED', run_id: 'run-1', selection: selection('c1', 1) },
  { case_id: 'c2', case_version: 1, external_id: 'TC-2', title: '另一用例', state: 'FINISHED', result: 'FAILED', run_id: 'run-2', selection: selection('c2', 1) },
  { case_id: 'c1', case_version: 2, external_id: 'TC-1', title: '新要求', state: 'BLOCKED', reason: 'CASE_VERSION_NOT_APPLICABLE', selection: null },
] };
const run = (id, caseId, version, actual, projectId = 'p1') => ({ project_id: projectId, batch_id: 'batch-1', run_id: id,
  executed_case_id: caseId, executed_case_version: version, executed_external_id: caseId === 'c1' ? 'TC-1' : 'TC-2',
  status: 'FAILED', execution_status: 'FINISHED', source_build_task_id: 'task-1', candidate_version: 3, bundle_sha256: 'bundle-3',
  error: { type: 'ASSERTION', message: '观察值不符', expected: '原要求', actual, value_source: 'PLAYWRIGHT_MATCHER_RESULT', actual_present: true },
  frozen_case_content: { steps: [{ order: 1, action: '核对', expected: '原要求' }] },
  step_coverage: { items: [{ order: 1, marker: 'CASE_STEP_1', execution_status: 'FAILED', attributed_errors: [{ error: { expected: '原要求', actual, value_source: 'PLAYWRIGHT_MATCHER_RESULT', actual_present: true } }] }] },
});

test('batch scope counts frozen items and refuses cross-project or version-mismatched runs', () => {
  const records = [run('run-1', 'c1', 1, '观察值A'), run('run-2', 'c2', 1, '观察值A'), run('run-3', 'c1', 2, '错误版本'), run('run-1', 'c1', 1, '外部项目', 'p2')];
  const model = buildExecutionListModel({ project, records, batches: [batch, { ...batch, batch_id: 'foreign', project_id: 'p2' }] });
  assert.deepEqual(model.totals, { requested: 3, passed: 0, failed: 2, blocked: 1, evidence: 0, notRun: 0, cancelled: 0, other: 0 });
  assert.equal(model.batches.length, 1);
  assert.equal(model.rows[0].actual, '观察值A');
  assert.equal(model.rows[0].case_version, 1);
  assert.equal(model.rows[0].candidate_version, 3);
  assert.equal(model.rows[2].run_id, null);
  assert.equal(model.rows[2].reason, 'CASE_VERSION_NOT_APPLICABLE');
  assert.equal(model.rows[2].title, '新要求');
});

test('same recorded error groups as a symptom, while blocking stays separate', () => {
  const model = buildExecutionListModel({ project, records: [run('run-1', 'c1', 1, '观察值A'), run('run-2', 'c2', 1, '观察值A')], batches: [batch] });
  const groups = groupExecutionSymptoms(model.rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2);
  assert.match(groups[0].label, /同一步骤 \/ 报错/);
  assert.equal(filterExecutionRows(model.rows, { search: '新要求', status: 'all', issue: 'all' }).length, 1);
  assert.equal(filterExecutionRows(model.rows, { status: 'failed', issue: 'all' }).length, 2);
});

test('a batch item never borrows a run with the wrong version or batch', () => {
  const wrong = run('run-1', 'c1', 2, '别的版本');
  const model = buildExecutionListModel({ project, records: [wrong, run('run-2', 'c2', 1, '观察值A')], batches: [batch] });
  assert.equal(model.rows[0].record_available, false);
  assert.equal(model.rows[0].kind, 'evidence');
  assert.equal(model.rows[0].reason, 'RUN_RECORD_NOT_AVAILABLE');
  assert.equal(model.rows[0].eligible_to_rerun, false);
  assert.equal(model.rows[0].case_version, 1);
});

test('invalid batch does not silently switch to latest or blend historical runs', () => {
  const missing = buildExecutionListModel({ project, records: [run('run-1', 'c1', 1, '观察值A')], batches: [batch], query: new URLSearchParams('batch_id=foreign') });
  assert.equal(missing.invalidBatch, true);
  assert.equal(missing.rows.length, 0);
  const history = buildExecutionListModel({ project, records: [run('run-1', 'c1', 1, '观察值A'), run('run-2', 'c2', 1, '观察值B', 'p2')], batches: [batch], query: new URLSearchParams('view=history') });
  assert.equal(history.history, true);
  assert.equal(history.rows.length, 1);
  assert.equal(history.rows[0].batch_id, 'batch-1');
});

test('candidate or bundle mismatch makes batch evidence unavailable',()=>{
  for(const changed of [{source_build_task_id:'other'},{candidate_version:4},{bundle_sha256:'other'}]){
    const model=buildExecutionListModel({project,batches:[batch],records:[{...run('run-1','c1',1,'wrong evidence'),...changed}]});
    assert.equal(model.rows[0].kind,'evidence');assert.equal(model.rows[0].eligible_to_revise,false);
  }
});

test('old UI message-derived actual remains unknown in the failure summary', () => {
  const legacy = run('run-1', 'c1', 1, 'copied from error text');
  legacy.error.value_source = 'LEGACY_PLAYWRIGHT_MESSAGE';
  legacy.step_coverage.items[0].attributed_errors[0].error.value_source = 'LEGACY_PLAYWRIGHT_MESSAGE';
  const row = buildExecutionListModel({ project, records: [legacy], batches: [batch] }).rows[0];
  assert.equal(row.actual_recorded, false);
  assert.equal(row.actual, null);
  assert.match(executionRowSummaryHtml(row), /可信实际：未记录/);
  assert.match(executionRowSummaryHtml(row), /<details><summary>技术报错/);
});

const httpRun = (id, status, requests, extra = {}) => ({
  project_id: 'p1', run_id: id, namespace_id: `backend-run-${id}`, executed_case_id: 'c1', executed_case_version: 1,
  executed_external_id: 'TC-1', runner_kind: 'HTTP_JSON', schema: 'workbench/backend-run-v1',
  status, execution_status: status === 'CANCELLED' ? 'CANCELLED' : 'FINISHED', model_calls: 0, requests_sent: 3,
  http_evidence: { setup: [{ request_id: 'setup', status: 'PASSED', assertions: [] }], steps: [{ order: 2, action: '创建后独立读取', expected: 'DEV-007 恰好一条，原记录不变', status, requests }], cleanup: [{ request_id: 'cleanup', status: 'PASSED', assertions: [] }] },
  ...extra,
});
const httpRequest = (id, status, assertions = [], extra = {}) => ({
  request_id: 'create-device', status,
  request: { method: 'POST', url: `http://127.0.0.1:4401/api/v1/namespaces/backend-run-${id}/devices` },
  response: { status: 500 }, assertions, ...extra,
});
const historyModel = records => buildExecutionListModel({ project, records, query: new URLSearchParams('view=history') });

test('HTTP failed assertions show the first real request and preserve its expected and actual values', () => {
  const records = ['h1', 'h2'].map(id => httpRun(id, 'FAILED', [
    httpRequest(id, 'PASSED', [{ status: 'PASSED', target: 'status', expected: 200, actual: 200 }], { request_id: 'read-before' }),
    httpRequest(id, 'FAILED', [{ status: 'FAILED', target: 'status', expected: 201, actual: 500 }, { status: 'FAILED', target: 'json', pointer: '/created', expected: true, actual: false }]),
  ]));
  const model = historyModel(records), row = model.rows[0];
  assert.equal(row.kind, 'failed'); assert.equal(row.failure_step, 'CASE_STEP_2');
  assert.equal(row.failure_request_id, 'create-device'); assert.equal(row.expected, 201); assert.equal(row.actual, 500);
  assert.match(row.failure_request_path, /backend-run-h1\/devices$/);
  assert.equal(row.failure_group_path, '/api/v1/namespaces/{{runId}}/devices');
  assert.equal(groupExecutionSymptoms(model.rows).length, 1, 'different owned namespaces should group the same recorded failure');
  assert.equal(groupExecutionSymptoms(model.rows)[0].rows.length, 2);
  assert.equal(filterExecutionRows(model.rows, { search: 'create-device', issue: 'abnormal' }).length, 2);
  assert.match(executionRowSummaryHtml(row), /预期：201/); assert.match(executionRowSummaryHtml(row), /实际：500/);
});

test('a missing JSON pointer stays distinct from recorded null, false, zero, empty string, and an unrecorded actual', () => {
  const actualRunId = 'backend-195d0fae-f6d6-49d7-ba41-fbfbe6c4aebc';
  const missingPointer = httpRun(actualRunId, 'FAILED', [httpRequest(actualRunId, 'FAILED', [
    { target:'json', pointer:'/items/0/code', op:'equals', expected:'BK-001', actual:null, actual_exists:false, status:'FAILED' },
  ], { response:{status:200, json:{items:[], total:0}} })]);
  const valueCases = [
    ['null', {actual:null, actual_exists:true}, 'null'],
    ['false', {actual:false, actual_exists:true}, 'false'],
    ['zero', {actual:0, actual_exists:true}, '0'],
    ['empty', {actual:'', actual_exists:true}, '&quot;&quot;（空字符串）'],
    ['exists-unrecorded', {actual_exists:true}, '字段存在，实际值未记录', {status:200}],
    ['unrecorded', {}, '未记录', {status:200}],
  ];
  const values = valueCases.map(([id, fields, , response = null]) => httpRun(id, 'FAILED', [httpRequest(id, 'FAILED', [
    { target:'json', pointer:'/items/0/code', op:'equals', expected:'BK-001', ...fields, status:'FAILED' },
  ], { response })]));
  const rows = historyModel([missingPointer, ...values]).rows;
  const rowById = new Map(rows.map(row => [row.run_id, row]));
  const missing = rowById.get(actualRunId);
  assert.equal(missing.actual, null);
  assert.equal(missing.actual_exists, false);
  assert.equal(missing.actual_recorded, true);
  assert.match(executionRowSummaryHtml(missing), /实际：字段不存在/);
  assert.equal(filterExecutionRows([missing], { issue:'with-actual' }).length, 1);
  for (const [id, , label] of valueCases) {
    const row = rowById.get(id);
    assert.ok(executionRowSummaryHtml(row).includes(`实际：${label}`), `${id} should display its recorded actual correctly`);
    assert.equal(row.actual_recorded, !['exists-unrecorded', 'unrecorded'].includes(id));
    if (['exists-unrecorded', 'unrecorded'].includes(id)) assert.equal(row.actual, null, 'HTTP status must not replace a missing assertion actual');
  }
  assert.equal(filterExecutionRows([rowById.get('unrecorded')], { issue:'with-actual' }).length, 0);
  assert.equal(filterExecutionRows([rowById.get('exists-unrecorded')], { issue:'with-actual' }).length, 0);
  assert.equal(filterExecutionRows([missing], { search:'字段不存在' }).length, 1);
});

test('backend timeout and transport error are failures visible in actionable and failed filters', () => {
  const records = [
    httpRun('timeout', 'TIMED_OUT', [httpRequest('timeout', 'TIMED_OUT', [], { response: null, error: { code: 'BACKEND_TIMEOUT' } })]),
    httpRun('network', 'ERROR', [httpRequest('network', 'ERROR', [], { response: null, error: { code: 'BACKEND_NETWORK_ERROR' } })]),
    httpRun('okay', 'PASSED', [httpRequest('okay', 'PASSED')]),
  ];
  const model = historyModel(records);
  assert.equal(model.totals.failed, 2); assert.equal(model.totals.passed, 1); assert.equal(model.totals.other, 0);
  assert.equal(filterExecutionRows(model.rows, { issue: 'abnormal' }).length, 2);
  assert.equal(filterExecutionRows(model.rows, { status: 'failed' }).length, 2);
  assert.equal(model.rows[0].actual, 'BACKEND_TIMEOUT');
  assert.equal(model.rows[0].expected, 'DEV-007 恰好一条，原记录不变');
  assert.equal(groupExecutionSymptoms(model.rows).length, 2, 'network and timeout causes are not collapsed');
});

test('backend cancellation remains cancellation and exposes request attempts and recorded zero model calls', () => {
  const cancelled = httpRun('cancel', 'CANCELLED', [httpRequest('cancel', 'CANCELLED', [], { response: null, error: { code: 'BACKEND_CANCELLED' } })]);
  const model = historyModel([cancelled]), row = model.rows[0];
  assert.equal(row.kind, 'cancelled'); assert.equal(model.totals.cancelled, 1); assert.equal(model.totals.notRun, 0);
  assert.equal(row.actual, 'BACKEND_CANCELLED'); assert.equal(row.request_attempts, 3); assert.equal(row.model_calls, 0);
  assert.equal(filterExecutionRows(model.rows, { status: 'cancelled', issue: 'abnormal' }).length, 1);
  assert.match(groupExecutionSymptoms(model.rows)[0].label, /^已取消/);
  const html = executionRowActivityHtml(row);
  assert.match(html, /模型调用 0/); assert.match(html, /HTTP 请求尝试 3/); assert.match(html, /取消不代表请求从未发生/);
  assert.doesNotMatch(html, /未发送/);
});

test('unrecorded model calls and request counts stay unknown instead of being changed to zero', () => {
  const row = historyModel([httpRun('old', 'CANCELLED', [], { model_calls: undefined, requests_sent: undefined })]).rows[0];
  assert.equal(row.model_calls, null); assert.equal(row.request_attempts, null);
  assert.match(executionRowActivityHtml(row), /模型调用 未记录/);
  assert.doesNotMatch(executionRowActivityHtml(row), /模型调用 0/);
});

test('HTTP cleanup failure is shown without inventing a business step or losing false and zero', () => {
  const item = httpRun('cleanup', 'FAILED', []);
  item.http_evidence.steps = [{ order: 1, status: 'PASSED', requests: [] }];
  item.http_evidence.cleanup = [httpRequest('cleanup', 'FAILED', [{ target: 'json', pointer: '/deleted', status: 'FAILED', expected: true, actual: false }], { request_id: 'cleanup', request: { method: 'DELETE', path: '/ns/<untrusted>' } })];
  const row = historyModel([item]).rows[0];
  assert.equal(row.failure_step, 'HTTP_CLEANUP'); assert.equal(row.actual, false); assert.equal(row.assertion_pointer, '/deleted');
  assert.equal(filterExecutionRows([row], { search: 'false', issue: 'with-actual' }).length, 1);
  assert.match(executionRowSummaryHtml(row), /实际：false/); assert.match(executionRowSummaryHtml(row), /&lt;untrusted&gt;/);
  assert.match(groupExecutionSymptoms([row])[0].label, /HTTP 清理失败/);
  assert.match(executionRowSummaryHtml({ ...row, expected: 1, actual: 0 }), /实际：0/);
  assert.match(backendRunHtml(item), /\/ns\/&lt;untrusted&gt;/, 'detail supports persisted relative request paths');
});

test('UI cancellation is distinct from never executed', () => {
  const old = { ...run('ui-cancel', 'c1', 1, '已采集UI值'), status: 'CANCELLED', execution_status: 'CANCELLED' };
  const row = historyModel([old]).rows[0];
  assert.equal(row.kind, 'cancelled'); assert.equal(row.actual, '已采集UI值');
  assert.equal(executionRowActivityHtml(row), '');
});

test('backend failure identities support feedback queues while mixed executors are kept separate', () => {
  const http = { case_id: 'http-1', runner_kind: 'HTTP_JSON', eligible_to_revise: false };
  const ui = { case_id: 'ui-1', batch_id: 'batch-1', eligible_to_revise: true };
  assert.equal(executionRevisionAvailability([http]).enabled, false);
  const ready = { ...http, eligible_to_revise: true };
  assert.equal(executionRevisionAvailability([ready, { ...ready, case_id: 'http-2' }]).enabled, true);
  assert.equal(executionRevisionAvailability([ready, ui]).enabled, false);
  assert.equal(executionRevisionAvailability([ready, ready]).enabled, false);
  assert.equal(executionRevisionAvailability([ui, { ...ui, case_id: 'ui-2' }]).enabled, true);
  assert.equal(executionRevisionAvailability([]).enabled, false);
});

test('HTTP artifacts use plan P labels while original UI scripts retain S labels', () => {
  assert.equal(executionArtifactLabel({ runner_kind: 'HTTP_JSON', script_version: 3 }), '计划 P3');
  assert.equal(executionArtifactLabel({ runner_kind: 'HTTP_JSON', candidate_version: 2 }), '计划 P2');
  assert.equal(executionArtifactLabel({ script_version: 3 }), '脚本 S3');
  assert.equal(executionArtifactLabel({ candidate_version: 2 }), '候选 v2');
});

test('execution index identifies a batched HTTP plan and preserves UI build-task labels', () => {
  const backend = executionIndexMeta({
    schema: 'workbench/backend-run-v1', runner_kind: 'HTTP_JSON', origin: 'HTTP_BACKEND_PLAN',
    executed_case_id: 'case-detail', executed_case_version: 1, source_build_task_id: 'plan-p2',
    script_version: 2, batch_id: 'batch-real',
  }, 'project-real');
  assert.deepEqual(backend, {
    source: 'HTTP 计划 P2 · 用例 v1', origin: '批次技术执行',
    taskHref: '#/projects/project-real/cases/case-detail?version=1&tab=scripts&plan_id=plan-p2',
    taskLabel: '查看 HTTP 计划', batchHref: '#/projects/project-real/batches?batch_id=batch-real',
  });
  assert.doesNotMatch(JSON.stringify(backend), /undefined|首次独立验证|#\/history/);
  assert.equal(executionIndexMeta({ ...backend, runner_kind: 'HTTP_JSON', source_build_task_id: null }, 'project-real').taskHref, null);
  const ui = executionIndexMeta({ source_external_id: 'TC-1', source_case_version: 3, source_build_task_id: 'task-1', origin: 'INDEPENDENT_VALIDATION' }, 'project-real');
  assert.deepEqual(ui, {
    source: 'TC-1 · v3', origin: '首次独立验证', taskHref: '#/history?task_id=task-1', taskLabel: '查看任务', batchHref: null,
  });
});

test('unsubmitted backend feedback stays bound to the exact project case version plan and original run', () => {
  const identity = { project_id: 'feedback-project', case_id: 'feedback-case', case_version: 2, plan_id: 'feedback-plan' };
  const feedback = '保留原预期，实际状态 500；补充失败请求证据 <不执行>。';
  stageBackendRevisionContext({ ...identity, run_id: 'feedback-run', feedback });
  const records = [{ project_id: identity.project_id, executed_case_id: identity.case_id, executed_case_version: 2, source_build_task_id: identity.plan_id, run_id: 'feedback-run' }];
  const context = backendRevisionContextFor(identity, records);
  assert.equal(context.valid, true); assert.equal(context.feedback, feedback); assert.equal(context.run_id, 'feedback-run');
  assert.equal(backendRevisionContextFor({ ...identity, project_id: 'other-project' }, records), null);
  assert.equal(backendRevisionContextFor({ ...identity, case_version: 1 }, records), null);
  assert.equal(backendRevisionContextFor({ ...identity, plan_id: 'other-plan' }, records), null);
  assert.equal(backendRevisionContextFor(identity, [{ ...records[0], source_build_task_id: 'other-plan' }]).valid, false);
  assert.equal(backendRevisionContextFor(identity, []).feedback, feedback, 'identity failure must not silently lose the original feedback');
});

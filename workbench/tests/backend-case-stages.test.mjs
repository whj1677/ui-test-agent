import test from 'node:test';
import assert from 'node:assert/strict';
import { backendCaseStageIssues, assertBackendCaseStages } from '../server/backend/case-stages.mjs';

const environment = {
  mode: 'synthetic-namespace',
  namespace: {
    setup_path: '/__control/namespaces',
    resource_prefix: '/api/v1/namespaces/',
    cleanup_prefix: '/__control/namespaces/',
  },
};
const step = (order, action, expected = '业务预期') => ({ order, action, expected, source_refs: [] });
const version = steps => ({ content: { case_type: 'BACKEND', preconditions: '', test_data: '', steps } });

test('real six-step case reports only control setup and cleanup', () => {
  const caseVersion = version([
    step(1, 'POST /__control/namespaces，JSON 字段 runId=qa-20261008-backend-add-001。'),
    step(2, 'GET /api/v1/namespaces/qa-20261008-backend-add-001/devices。'),
    step(3, 'POST /api/v1/namespaces/qa-20261008-backend-add-001/devices。'),
    step(4, '独立 GET /api/v1/namespaces/qa-20261008-backend-add-001/devices/DEV-007。'),
    step(5, '独立 GET /api/v1/namespaces/qa-20261008-backend-add-001/devices。'),
    step(6, 'DELETE /__control/namespaces/qa-20261008-backend-add-001。'),
  ]);
  const issues = backendCaseStageIssues({ caseVersion, environment });
  assert.deepEqual(issues.map(({ code, step_order, phase }) => [code, step_order, phase]), [
    ['BACKEND_CASE_STAGE_CONFLICT', 1, 'setup'],
    ['BACKEND_CASE_STAGE_CONFLICT', 6, 'cleanup'],
  ]);
  assert.ok(issues.every(issue => issue.message.includes(`第${issue.step_order}步`)));
  assert.throws(() => assertBackendCaseStages({ caseVersion, environment }), error =>
    error.message === 'BACKEND_CASE_STAGE_CONFLICT' && error.issues.length === 2);
});

test('recognizes exact registered setup and one-segment cleanup placeholders', () => {
  const caseVersion = version([
    step(1, 'POST `/__control/namespaces`'),
    step(2, 'DELETE /__control/namespaces/{{runId}}'),
    step(3, 'DELETE /__control/namespaces/{runId}'),
  ]);
  assert.deepEqual(backendCaseStageIssues({ caseVersion, environment }).map(issue => issue.phase),
    ['setup', 'cleanup', 'cleanup']);
});

test('uses namespace on legacy environment without mode', () => {
  const caseVersion = version([step(1, 'DELETE /__control/namespaces/run-123')]);
  assert.equal(backendCaseStageIssues({ caseVersion, environment: { namespace: environment.namespace } }).length, 1);
});

test('confirmed binding request is checked and duplicate evidence is reported once', () => {
  const caseVersion = version([step(1, 'POST /api/v1/namespaces/{{runId}}/devices')]);
  const binding = { mappings: [
    { step_order: 1, request: 'POST /__control/namespaces；POST /__control/namespaces' },
    { step_order: 1, request: 'DELETE /__control/namespaces/{{runId}}' },
  ] };
  assert.deepEqual(backendCaseStageIssues({ caseVersion, binding, environment })
    .map(issue => [issue.step_order, issue.phase]), [[1, 'setup'], [1, 'cleanup']]);
});

test('does not classify business initialization, business DELETE, or longer control paths', () => {
  const caseVersion = version([
    step(1, '初始化设备：POST /api/v1/namespaces/{{runId}}/devices'),
    step(2, 'DELETE /api/v1/namespaces/{{runId}}/devices/DEV-007'),
    step(3, 'POST /__control/namespaces/extra'),
    step(4, 'DELETE /__control/namespaces/{{runId}}/devices'),
    step(5, 'GET /__control/namespaces'),
  ]);
  assert.deepEqual(backendCaseStageIssues({ caseVersion, environment }), []);
  assert.doesNotThrow(() => assertBackendCaseStages({ caseVersion, environment }));
});

test('ignores expected text and legitimate orchestration in preconditions or test data', () => {
  const caseVersion = version([step(1, 'GET /api/v1/namespaces/{{runId}}/devices',
    '清理时 DELETE /__control/namespaces/{{runId}} 应返回 deleted=true')]);
  caseVersion.content.preconditions = '测试编排 POST /__control/namespaces';
  caseVersion.content.test_data = '最后 DELETE /__control/namespaces/{{runId}}';
  assert.deepEqual(backendCaseStageIssues({ caseVersion, environment }), []);
});

test('ignores readonly and UI cases, and leaves inputs unchanged', () => {
  const caseVersion = version([step(1, 'POST /__control/namespaces')]);
  const binding = { mappings: [{ step_order: 1, request: 'POST /__control/namespaces' }] };
  const before = structuredClone({ caseVersion, binding, environment });
  assert.deepEqual(backendCaseStageIssues({ caseVersion, binding, environment }),
    backendCaseStageIssues({ caseVersion, binding, environment }));
  assert.deepEqual({ caseVersion, binding, environment }, before);
  assert.deepEqual(backendCaseStageIssues({ caseVersion, environment: { ...environment, mode: 'http-json-readonly' } }), []);
  assert.deepEqual(backendCaseStageIssues({ caseVersion: { content: { ...caseVersion.content, case_type: 'UI' } }, environment }), []);
});

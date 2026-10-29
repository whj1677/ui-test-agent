import test from 'node:test';
import assert from 'node:assert/strict';
import { stageBackendRevisionContext, backendRevisionRunBinding } from '../web-v2/backend.js';
import { scriptRevisionRunMatches } from '../web-v2/script-actions.js';
import { buildExecutionListModel, groupExecutionSymptoms, executionRowSummaryHtml, failureFeedbackForRun } from '../web-v2/execution-list.js';

test('backend revision binds the exact staged run and keeps ordinary revision without run', () => {
  const identity = { project_id: 'p', case_id: 'c', case_version: 2, plan_id: 'plan' };
  const run = { run_id: 'r', project_id: 'p', executed_case_id: 'c', executed_case_version: 2, source_build_task_id: 'plan', environment_id: 'env' };
  assert.deepEqual(backendRevisionRunBinding(identity, [run]), {});
  stageBackendRevisionContext({ ...identity, run_id: 'r', feedback: '实际观察' });
  assert.deepEqual(backendRevisionRunBinding(identity, [run]), { run_id: 'r' });
  assert.throws(() => backendRevisionRunBinding({ ...identity, environment_id: 'other-env' }, [run]), /不匹配/);
  assert.throws(() => backendRevisionRunBinding(identity, [{ ...run, run_id: 'other' }]), /不匹配/);
  assert.deepEqual(backendRevisionRunBinding({ ...identity, plan_id: 'other' }, [run]), {});
});

test('UI revision binds only an exact failed run and candidate', () => {
  const candidate = { selection: { source_task_id: 'task', candidate_version: 6, bundle_sha256: 'sha', environment_id: 'env' } };
  const item = { run_id: 'run', case_id: 'case', case_version: 1 };
  const run = { run_id: 'run', project_id: 'project', executed_case_id: 'case', executed_case_version: 1, source_build_task_id: 'task', candidate_version: 6, bundle_sha256: 'sha', environment_id: 'env', status: 'FAILED', execution_status: 'FINISHED', finished_at: '2026-09-30T01:00:00Z' };
  assert.equal(scriptRevisionRunMatches('project', item, run, candidate), true);
  assert.equal(scriptRevisionRunMatches('project', item, { ...run, environment_id: 'other' }, candidate), false);
  assert.equal(scriptRevisionRunMatches('project', item, { ...run, run_id: 'other' }, candidate), false);
  assert.equal(scriptRevisionRunMatches('project', item, { ...run, status: 'PASSED' }, candidate), false);
  assert.equal(scriptRevisionRunMatches('project', item, { ...run, finished_at: null }, candidate), false);
  assert.equal(scriptRevisionRunMatches('project', item, { ...run, execution_status: 'RUNNING' }, candidate), false);
});

test('server classification groups common environment blocks but preserves failed results', () => {
  const project = { project_id: 'p', cases: [] };
  const makeRun = (id, category) => {
    const run = { run_id: id, project_id: 'p', executed_case_id: id, executed_case_version: 1, source_build_task_id: 'task', candidate_version: 1, bundle_sha256: 'sha', environment_id: 'env', status: 'FAILED', execution_status: 'FINISHED' };
    if (category) run.failure_feedback = { schema: 'workbench/failure-feedback-v1', identity: { run_id: id, project_id: 'p', case_id: id, case_version: 1, source_task_id: 'task', candidate_version: 1, bundle_sha256: 'sha', environment_id: 'env' }, classification: { category, next_action: '先恢复环境并复跑' }, steps: [] };
    return run;
  };
  const records = [makeRun('one', 'ENVIRONMENT_BLOCKED'), makeRun('two', 'ENVIRONMENT_BLOCKED'), makeRun('old')];
  const { rows, totals } = buildExecutionListModel({ project, records, query: 'view=history' });
  assert.equal(totals.failed, 3);
  assert.equal(rows[2].failure_category, 'NEEDS_ANALYSIS');
  assert.match(executionRowSummaryHtml(rows[2]), /待分析/);
  const groups = groupExecutionSymptoms(rows);
  assert.equal(groups.find(group => group.key === 'classification:ENVIRONMENT_BLOCKED')?.rows.length, 2);
  assert.match(groups.find(group => group.key === 'classification:ENVIRONMENT_BLOCKED').label, /先恢复共用环境/);
  const conflicting = { ...records[0], failure_feedback: { ...records[0].failure_feedback, identity: { ...records[0].failure_feedback.identity, run_id: 'other' } } };
  assert.equal(failureFeedbackForRun(conflicting), null);
});

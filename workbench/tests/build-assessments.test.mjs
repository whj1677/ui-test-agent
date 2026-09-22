import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildSupplementalAssessmentStore } from '../server/build/assessments.mjs';
import { PROJECT_CASE_STEP_TITLE_RULE_VERSION } from '../server/build/report.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { createWorkbenchServer } from '../server/app.mjs';
import { sha256File } from '../server/integrity.mjs';

function report(status, failingStep = null) {
  const error = status === 'failed' ? { message: 'Expected: "共3条"\nReceived: "共6条"' } : null;
  return {
    stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 },
    suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{
      status, error,
      steps: [1, 2, 3].map((order) => ({
        title: `CASE_STEP_${order} 步骤${order}`, category: 'test.step', duration: 5,
        error: order === failingStep ? error : null,
      })),
    }] }] }] }],
  };
}

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-assessment-'));
  const buildStore = new BuildTaskStore(path.join(root, 'build-tasks')); await buildStore.init();
  const taskId = 'build-assessment-12345678';
  const attemptId = 'attempt-01-initial';
  const candidateRelative = `${attemptId}/workspace/output/candidate.spec.mjs`;
  const normalRelative = `${attemptId}/verification/normal/playwright-report.json`;
  const negativeRelative = `${attemptId}/verification/negative/playwright-report.json`;
  await buildStore.createTask({
    task_id: taskId, created_at: '2026-09-22T00:00:00.000Z', task_status: 'CANDIDATE_VALIDATION_FAILED', verification_status: 'FAILED',
    source: { kind: 'project-case' }, attempts: [{ attempt_id: attemptId }], candidates: [], files: [],
    input_bundle: { verification_contract: { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3'], detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_3' } } },
  });
  const taskRoot = buildStore.taskDirectory(taskId);
  for (const relative of [candidateRelative, normalRelative, negativeRelative]) await fs.mkdir(path.dirname(path.join(taskRoot, relative)), { recursive: true });
  await fs.writeFile(path.join(taskRoot, candidateRelative), 'candidate-original-bytes');
  await fs.writeFile(path.join(taskRoot, normalRelative), JSON.stringify(report('passed')));
  await fs.writeFile(path.join(taskRoot, negativeRelative), JSON.stringify(report('failed', 3)));
  const descriptors = [];
  for (const [kind, relative] of [['candidate', candidateRelative], ['test_report', normalRelative], ['test_report', negativeRelative]]) {
    const absolute = path.join(taskRoot, relative); const stat = await fs.stat(absolute);
    descriptors.push({ kind, attempt_id: attemptId, relative_path: relative, bytes: stat.size, sha256: await sha256File(absolute) });
  }
  const candidateSha = descriptors[0].sha256;
  await buildStore.updateTask(taskId, (task) => ({ ...task, files: descriptors, candidates: [{
    version: 1, attempt_id: attemptId, sha256: candidateSha, verification_status: 'FAILED',
    normal: { process: { exit_code: 0, termination: null } },
    negative: { process: { exit_code: 1, termination: null } },
    error: { type: 'PROJECT_CASE_STEP_COVERAGE_INCOMPLETE' },
  }] }));
  const assessmentStore = new BuildSupplementalAssessmentStore(path.join(root, 'candidate-assessments'), buildStore); await assessmentStore.init();
  const source = {
    schema: 'workbench/build-supplemental-assessment-source-v1', assessment_id: 'assessment-step-compat-12345678',
    created_at: '2026-09-22T01:00:00.000Z', source_task_id: taskId, source_attempt_id: attemptId,
    source_candidate_version: 1, candidate_sha256: candidateSha,
    report_sha256: { normal: descriptors[1].sha256, negative: descriptors[2].sha256 },
    mapping_rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
    business_review: [1, 2, 3].map((order) => ({
      step_id: `CASE_STEP_${order}`, requirement: `独立写定义务${order}`, status: 'COVERED',
      code_locations: [`candidate.spec.mjs:${order}`], evidence: `独立报告证据${order}`,
    })),
  };
  return { root, buildStore, assessmentStore, source, taskId, taskRoot };
}

test('registers an idempotent derived assessment without rewriting the original task', async () => {
  const value = await setup();
  try {
    const taskFile = path.join(value.taskRoot, 'task.json');
    const before = await sha256File(taskFile);
    const first = await value.assessmentStore.register(value.source);
    const second = await value.assessmentStore.register(value.source);
    assert.deepEqual(second, first);
    assert.equal(first.normal.step_mapping.complete, true);
    assert.equal(first.negative.step_mapping.items[2].error_attributed, true);
    assert.equal(first.negative.specified_mismatch, true);
    assert.equal(first.conclusion, 'ELIGIBLE_FOR_HUMAN_REVIEW');
    assert.equal(await sha256File(taskFile), before);
    assert.equal((await value.assessmentStore.listForTask(value.taskId)).length, 1);
  } finally { await fs.rm(value.root, { recursive: true, force: true }); }
});

test('rejects changed candidate or report identity and keeps a business gap out of human review', async () => {
  const value = await setup();
  try {
    await assert.rejects(() => value.assessmentStore.register({ ...value.source, candidate_sha256: 'A'.repeat(64) }), /BUILD_ASSESSMENT_CANDIDATE_MISMATCH/);
    await assert.rejects(() => value.assessmentStore.register({ ...value.source, report_sha256: { ...value.source.report_sha256, normal: 'B'.repeat(64) } }), /BUILD_ASSESSMENT_REPORT_CHANGED/);
    const gap = structuredClone(value.source); gap.assessment_id = 'assessment-step-gap-12345678'; gap.business_review[2].status = 'PARTIAL';
    const record = await value.assessmentStore.register(gap);
    assert.equal(record.conclusion, 'BUSINESS_REVIEW_GAPS');
    assert.equal(record.approved, false);
  } finally { await fs.rm(value.root, { recursive: true, force: true }); }
});

test('serves supplemental assessment beside the unchanged original failure', async () => {
  const value = await setup();
  await value.assessmentStore.register(value.source);
  const server = createWorkbenchServer({
    store: { async listAssets() { return []; }, async listRuns() { return []; } },
    buildStore: value.buildStore, buildAssessmentStore: value.assessmentStore,
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/build/tasks/${value.taskId}`);
    const task = await response.json();
    assert.equal(task.task_status, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(task.supplemental_assessments[0].original_task_state.task_status, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(task.supplemental_assessments[0].approved, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(value.root, { recursive: true, force: true });
  }
});

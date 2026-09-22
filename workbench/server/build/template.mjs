import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256File } from '../integrity.mjs';
import { HOLD_Q1_CASE_ID, HOLD_Q1_ENVIRONMENT_ID, loadHoldQ1Source } from './heldout-query.mjs';

export const BUILD_TEMPLATE_ID = 'synthetic-probe-v1';

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
}

export async function loadBuildTemplate(paths) {
  const fixtureRoot = path.join(paths.repoRoot, 'harness-probe', 'fixture');
  const normalFixture = path.join(fixtureRoot, 'index.html');
  const negativeFixture = path.join(fixtureRoot, 'wrong-output.html');
  await Promise.all([fs.access(normalFixture), fs.access(negativeFixture)]);
  const frozen = {
    template_id: BUILD_TEMPLATE_ID,
    version: '1.0.0',
    title: '无登录合成探针候选',
    summary: '点击“执行探针交互”，断言可见输出等于任务给定值。',
    action: '点击按钮“执行探针交互”',
    expected: 'PROBE-42',
    candidate_contract: {
      url_environment_variable: 'PROBE_URL',
      test_count: 1,
      retries: 0,
      workers: 1,
    },
    allowed_entry: { kind: 'managed-local-fixture', route: '/probe', login_required: false },
    source: { normal_fixture_sha256: await sha256File(normalFixture) },
  };
  return {
    public: { ...frozen, input_sha256: digest(frozen) },
    internal: {
      normalFixture,
      negativeFixture,
      counterexampleActual: 'PROBE-41',
    },
  };
}

export async function loadProjectCaseEnvironment(paths, environmentId) {
  if (environmentId === 'synthetic-probe-normal-v1') {
    const template = await loadBuildTemplate(paths);
    return {
      environment_id: environmentId,
      public: template.public,
      internal: {
        ...template.internal,
        normalRoute: '/probe',
        negativeRoute: '/probe',
        binding: { kind: 'expected-literal', expected_literal: template.public.expected },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          expected_literal: template.public.expected,
          counterexample_actual: template.internal.counterexampleActual,
          detection: { kind: 'literal-assertion-mismatch', expected: template.public.expected, actual: template.internal.counterexampleActual },
        },
      },
    };
  }
  if (environmentId === HOLD_Q1_ENVIRONMENT_ID) {
    const frozen = await loadHoldQ1Source(paths);
    const publicTemplate = {
      template_id: HOLD_Q1_ENVIRONMENT_ID,
      version: '1.0.0',
      title: 'HOLD-Q1 无登录列表查询',
      summary: '按冻结 HOLD-Q1 的 S01-S03 完成默认态、未查询态和联合查询核对。',
      candidate_contract: { url_environment_variable: 'PROBE_URL', test_count: 1, retries: 0, workers: 1 },
      allowed_entry: { kind: 'managed-local-fixture', route: '/probe/q1', login_required: false },
      source: { normal_fixture_sha256: await sha256File(frozen.fixturePath), cases_sha256: frozen.source.cases_sha256 },
    };
    return {
      environment_id: environmentId,
      public: { ...publicTemplate, input_sha256: digest(publicTemplate) },
      internal: {
        normalFixture: frozen.fixturePath,
        negativeFixture: frozen.fixturePath,
        normalRoute: '/probe/q1',
        negativeRoute: '/probe/q2',
        binding: { kind: 'exact-content', case_id: HOLD_Q1_CASE_ID, content_sha256: frozen.content_sha256 },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_3' },
          frozen_fault: { ...frozen.fault, oracle_sha256: frozen.source.oracle_sha256 },
        },
      },
    };
  }
  throw new Error('CASE_BUILD_ENVIRONMENT_NOT_ALLOWED');
}

export function taskDocument(subject) {
  if (subject?.source?.kind === 'project-case') return subject.input_bundle.task_markdown;
  const template = subject?.template || subject;
  return [
    '# Frozen candidate task',
    '',
    `Task version: ${template.template_id}@${template.version}`,
    `Action: ${template.action}.`,
    `Required expected result supplied by the task: ${template.expected}.`,
    'Create exactly one Playwright Test candidate.',
    `The candidate must navigate to process.env.${template.candidate_contract.url_environment_variable}, perform the action, and assert the visible output equals the literal expected result.`,
    'Do not derive or change the expected value from the page.',
  ].join('\n');
}

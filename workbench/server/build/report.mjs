import fs from 'node:fs/promises';
import { reportInternals } from '../report.mjs';

function collectTests(suites, output = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) output.push(test);
    collectTests(suite.suites, output);
  }
  return output;
}

export async function parseCandidateReport(reportPath, processResult) {
  let raw;
  try { raw = await fs.readFile(reportPath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return { report_status: 'MISSING', test_status: 'NOT_RUN', test_count: 0, error: { type: 'REPORT_MISSING', message: '结构化报告缺失。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS' }, complete_pass: false };
    throw error;
  }
  let report;
  try { report = JSON.parse(raw); }
  catch { return { report_status: 'CORRUPT', test_status: 'UNKNOWN', test_count: 0, error: { type: 'REPORT_CORRUPT', message: '结构化报告损坏。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS' }, complete_pass: false }; }
  const tests = collectTests(report.suites);
  if (tests.length !== 1) {
    return {
      report_status: 'COMPLETE', test_status: tests.length ? 'INVALID_TARGET_COUNT' : 'NOT_RUN', test_count: tests.length,
      error: { type: 'TARGET_TEST_COUNT_INVALID', message: `目标测试数量应为1，实际为${tests.length}。`, expected: '1', actual: String(tests.length), attribution: 'PENDING_ANALYSIS' },
      complete_pass: false, stats: report.stats || null,
    };
  }
  const test = tests[0];
  const result = test.results?.at(-1) || null;
  const steps = (result?.steps || []).map((step) => ({ title: step.title, category: step.category, duration: step.duration ?? null }));
  const status = result?.status || (test.expectedStatus === 'skipped' ? 'skipped' : 'notRun');
  const error = reportInternals.errorFacts(result?.error || result?.errors?.[0] || test.errors?.[0]);
  const skipped = status === 'skipped' || Number(report.stats?.skipped || 0) > 0;
  const completePass = processResult.exitCode === 0 && processResult.termination === null && status === 'passed' && !skipped && Number(report.stats?.expected) === 1 && Number(report.stats?.unexpected || 0) === 0;
  return {
    report_status: 'COMPLETE',
    test_status: skipped ? 'SKIPPED' : status === 'passed' ? 'PASSED' : status === 'failed' ? 'FAILED' : status.toUpperCase(),
    test_count: 1, error, complete_pass: completePass, stats: report.stats || null,
    process: { exit_code: processResult.exitCode, termination: processResult.termination, error: processResult.error },
    steps,
  };
}

export function projectCaseStepCoverage(verification, contract) {
  const titles = new Set((verification?.steps || []).map((step) => step.title));
  const required = contract?.required_step_markers || [];
  return {
    complete: required.length > 0 && required.every((marker) => titles.has(marker)),
    items: required.map((marker) => ({ marker, observed: titles.has(marker) })),
  };
}

export function counterexampleDetected(verification, expectedOrContract, actual) {
  const base = verification?.report_status === 'COMPLETE'
    && verification.test_status === 'FAILED'
    && verification.test_count === 1
    && verification.error?.type === 'ASSERTION_MISMATCH';
  if (!base) return false;
  if (expectedOrContract?.detection?.kind === 'assertion-mismatch-at-step') {
    return (verification.steps || []).some((step) => step.title === expectedOrContract.detection.step_marker);
  }
  const expected = expectedOrContract?.detection?.kind === 'literal-assertion-mismatch'
    ? expectedOrContract.detection.expected
    : expectedOrContract?.expected_literal ?? expectedOrContract;
  const received = expectedOrContract?.detection?.kind === 'literal-assertion-mismatch'
    ? expectedOrContract.detection.actual
    : expectedOrContract?.counterexample_actual ?? actual;
  return verification.error.expected === expected && verification.error.actual === received;
}

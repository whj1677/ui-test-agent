import fs from 'node:fs/promises';
import { reportInternals } from '../report.mjs';

export const PROJECT_CASE_STEP_TITLE_RULE_VERSION = 'project-case-step-title-v2';

const BARE_STEP_TITLE = /^CASE_STEP_([1-9]\d*)$/;
const DESCRIBED_STEP_TITLE = /^CASE_STEP_([1-9]\d*)(?:[ \t]+|[ \t]*[:：][ \t]*|[ \t]+[-–—][ \t]+)(\S[\s\S]*)$/;

export function parseProjectCaseStepTitle(rawTitle) {
  if (typeof rawTitle !== 'string') return null;
  const bare = BARE_STEP_TITLE.exec(rawTitle);
  const described = bare ? null : DESCRIBED_STEP_TITLE.exec(rawTitle);
  const match = bare || described;
  if (!match) return null;
  const order = Number(match[1]);
  return {
    rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
    raw_title: rawTitle,
    step_id: `CASE_STEP_${order}`,
    order,
    description: described?.[2] || null,
  };
}

function collectTests(suites, output = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) output.push(test);
    collectTests(suite.suites, output);
  }
  return output;
}

function rawStepError(error) {
  if (!error) return null;
  return {
    message: error.message ?? null,
    location: error.location ? {
      file: error.location.file ?? null,
      line: error.location.line ?? null,
      column: error.location.column ?? null,
    } : null,
    snippet: error.snippet ?? null,
  };
}

function publicStep(step) {
  const rawTitle = String(step?.title ?? '');
  return {
    title: rawTitle,
    raw_title: rawTitle,
    category: step?.category ?? null,
    duration: step?.duration ?? null,
    error: step?.error ? reportInternals.errorFacts(step.error) : null,
    raw_error: rawStepError(step?.error),
    steps: (step?.steps || []).map(publicStep),
  };
}

function flattenStepNodes(steps, output = [], parentPath = [], owningStepId = null) {
  for (let index = 0; index < (steps || []).length; index += 1) {
    const step = steps[index];
    const parsed = parseProjectCaseStepTitle(step.raw_title ?? step.title);
    const reportPath = [...parentPath, index];
    const owner = parsed?.step_id || owningStepId;
    output.push({ step, parsed, reportPath, owner });
    flattenStepNodes(step.steps, output, reportPath, owner);
  }
  return output;
}

function normalizedRequiredMarkers(contract) {
  return (contract?.required_step_markers || []).map((marker) => {
    const parsed = BARE_STEP_TITLE.exec(marker);
    return parsed ? { marker, order: Number(parsed[1]) } : { marker, order: null };
  });
}

export function mapProjectCaseSteps(verification, contract) {
  const required = normalizedRequiredMarkers(contract);
  const nodes = flattenStepNodes(verification?.steps || []);
  const recognized = nodes.filter((node) => node.parsed);
  const byId = new Map();
  for (const node of recognized) {
    const list = byId.get(node.parsed.step_id) || [];
    list.push(node);
    byId.set(node.parsed.step_id, list);
  }
  const expectedSequence = required.map((item) => item.marker);
  const observedSequence = recognized.map((node) => node.parsed.step_id);
  const duplicates = [...byId.entries()].filter(([, matches]) => matches.length > 1).map(([stepId]) => stepId);
  const unexpected = observedSequence.filter((stepId) => !expectedSequence.includes(stepId));
  const malformed = nodes.filter((node) => !node.parsed && /CASE_STEP_/i.test(node.step.raw_title ?? node.step.title ?? ''))
    .map((node) => node.step.raw_title ?? node.step.title);
  const attributableErrors = nodes.filter((node) => node.owner && node.step.error).map((node) => ({
    step_id: node.owner,
    report_path: node.reportPath,
    error: node.step.error,
    raw_error: node.step.raw_error,
  }));
  const unattributedErrors = nodes.filter((node) => !node.owner && node.step.error).map((node) => ({
    report_path: node.reportPath,
    error: node.step.error,
    raw_error: node.step.raw_error,
  }));
  const orderValid = observedSequence.length === expectedSequence.length &&
    observedSequence.every((stepId, index) => stepId === expectedSequence[index]);
  const failureOrders = attributableErrors.map((item) => Number(/^CASE_STEP_(\d+)$/.exec(item.step_id)?.[1]))
    .filter(Number.isInteger);
  const firstFailureOrder = failureOrders.length ? Math.min(...failureOrders) : null;
  const items = required.map(({ marker, order }) => {
    const matches = byId.get(marker) || [];
    const attributed = attributableErrors.filter((item) => item.step_id === marker);
    return {
      marker,
      step_id: marker,
      order,
      observed: matches.length === 1,
      raw_title: matches.length === 1 ? matches[0].step.raw_title : null,
      report_path: matches.length === 1 ? matches[0].reportPath : null,
      error_attributed: attributed.length > 0,
      execution_status: matches.length === 1
        ? (attributed.length ? 'FAILED' : 'PASSED')
        : (firstFailureOrder !== null && order > firstFailureOrder ? 'NOT_EXECUTED' : 'MISSING'),
      attributed_errors: attributed,
    };
  });
  return {
    rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
    complete: required.length > 0 && required.every((item) => item.order !== null) &&
      items.every((item) => item.observed) && duplicates.length === 0 && unexpected.length === 0 &&
      malformed.length === 0 && orderValid,
    order_valid: orderValid,
    expected_sequence: expectedSequence,
    observed_sequence: observedSequence,
    duplicates,
    missing: items.filter((item) => !item.observed).map((item) => item.marker),
    unexpected,
    malformed_titles: malformed,
    unattributed_errors: unattributedErrors,
    items,
  };
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
  const steps = (result?.steps || []).map(publicStep);
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
  return mapProjectCaseSteps(verification, contract);
}

export function counterexampleDetected(verification, expectedOrContract, actual) {
  const base = verification?.report_status === 'COMPLETE'
    && verification.test_status === 'FAILED'
    && verification.test_count === 1
    && verification.error?.type === 'ASSERTION_MISMATCH';
  if (!base) return false;
  if (expectedOrContract?.detection?.kind === 'assertion-mismatch-at-step') {
    const mapping = mapProjectCaseSteps(verification, expectedOrContract);
    const targetIndex = mapping.expected_sequence.indexOf(expectedOrContract.detection.step_marker);
    if (targetIndex < 0 || mapping.unattributed_errors.length || mapping.duplicates.length ||
        mapping.unexpected.length || mapping.malformed_titles.length) return false;
    const requiredThroughTarget = mapping.expected_sequence.slice(0, targetIndex + 1);
    const observedThroughTarget = mapping.observed_sequence.slice(0, targetIndex + 1);
    if (requiredThroughTarget.length !== observedThroughTarget.length ||
        requiredThroughTarget.some((stepId, index) => stepId !== observedThroughTarget[index])) return false;
    const target = mapping.items.find((item) => item.marker === expectedOrContract.detection.step_marker);
    return Boolean(target?.attributed_errors.some((item) => item.error?.type === 'ASSERTION_MISMATCH' &&
      item.error.expected === verification.error.expected && item.error.actual === verification.error.actual));
  }
  const expected = expectedOrContract?.detection?.kind === 'literal-assertion-mismatch'
    ? expectedOrContract.detection.expected
    : expectedOrContract?.expected_literal ?? expectedOrContract;
  const received = expectedOrContract?.detection?.kind === 'literal-assertion-mismatch'
    ? expectedOrContract.detection.actual
    : expectedOrContract?.counterexample_actual ?? actual;
  return verification.error.expected === expected && verification.error.actual === received;
}

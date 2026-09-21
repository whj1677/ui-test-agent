import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256File, stripAnsi } from './integrity.mjs';

const MEDIA_TYPES = new Map([
  ['.png', { kind: 'screenshot', content_type: 'image/png' }],
  ['.webm', { kind: 'video', content_type: 'video/webm' }],
  ['.zip', { kind: 'trace', content_type: 'application/zip' }],
]);

function walkSuites(suites, tests = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) for (const item of spec.tests || []) tests.push(item);
    walkSuites(suite.suites, tests);
  }
  return tests;
}

function walkSteps(steps, result = []) {
  for (const step of steps || []) {
    result.push(step);
    walkSteps(step.steps, result);
  }
  return result;
}

function errorFacts(error) {
  if (!error) return null;
  const message = stripAnsi(error.message || error.value || String(error)).slice(0, 20000);
  const expected = message.match(/Expected(?: string)?:\s*["']([^"']*)["']/i)?.[1] ?? null;
  const actual = message.match(/Received(?: string)?:\s*["']([^"']*)["']/i)?.[1] ?? null;
  let type = 'TEST_ERROR';
  if (expected !== null && actual !== null) type = 'ASSERTION_MISMATCH';
  else if (/strict mode violation|element\(s\) not found|resolved to \d+ elements|waiting for (?:getBy|locator)|未找到表头列/i.test(message)) type = 'LOCATOR_OR_TARGET';
  else if (/Expected(?: string)?:|Received(?: string)?:|expect\(/i.test(message)) type = 'ASSERTION_UNRESOLVED';
  else if (/TimeoutError|timed out|timeout \d+ms exceeded/i.test(message)) type = 'TIMEOUT';
  return { type, message, expected, actual, attribution: 'PENDING_ANALYSIS' };
}

async function listFiles(root) {
  const output = [];
  async function visit(directory) {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) output.push(absolute);
    }
  }
  await visit(root);
  return output;
}

async function mediaIndex(runRoot) {
  const media = [];
  for (const file of await listFiles(path.join(runRoot, 'artifacts'))) {
    const descriptor = MEDIA_TYPES.get(path.extname(file).toLowerCase());
    if (!descriptor) continue;
    const stat = await fs.stat(file);
    media.push({
      media_id: `media-${String(media.length + 1).padStart(3, '0')}`,
      ...descriptor,
      file_name: path.basename(file),
      relative_path: path.relative(runRoot, file).replaceAll('\\', '/'),
      sha256: await sha256File(file),
      bytes: stat.size,
    });
  }
  return media;
}

export async function analyzeRunArtifacts({ runRoot, reportFile, registeredSteps, exitCode, executionStatus }) {
  const media = await mediaIndex(runRoot);
  let raw;
  try {
    raw = await fs.readFile(reportFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      report_status: 'MISSING', test_status: 'NOT_RUN', evidence_status: 'INCOMPLETE', media,
      steps: registeredSteps.map((step) => ({ ...step, status: 'NOT_EXECUTED', error: null })),
      summary: { process_ended: true, exit_code: exitCode, report_complete: false, target_test_count: 0, complete_pass: false },
      error: executionStatus === 'CANCELLED' ? null : { type: 'REPORT_MISSING', message: 'Playwright结构化报告缺失。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS' },
    };
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return {
      report_status: 'CORRUPT', test_status: 'UNKNOWN', evidence_status: 'INCOMPLETE', media,
      steps: registeredSteps.map((step) => ({ ...step, status: 'NOT_EXECUTED', error: null })),
      summary: { process_ended: true, exit_code: exitCode, report_complete: false, target_test_count: 0, complete_pass: false },
      error: { type: 'REPORT_CORRUPT', message: 'Playwright结构化报告不是有效JSON。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS' },
    };
  }

  const tests = walkSuites(report.suites);
  if (tests.length !== 1) {
    return {
      report_status: 'COMPLETE', test_status: tests.length ? 'INVALID_TARGET_COUNT' : 'NOT_RUN', evidence_status: 'INCOMPLETE', media,
      steps: registeredSteps.map((step) => ({ ...step, status: 'NOT_EXECUTED', error: null })),
      summary: { process_ended: true, exit_code: exitCode, report_complete: true, target_test_count: tests.length, complete_pass: false, stats: report.stats || null },
      error: { type: 'TARGET_TEST_COUNT_INVALID', message: `目标测试数量应为1，实际为${tests.length}。`, expected: '1', actual: String(tests.length), attribution: 'PENDING_ANALYSIS' },
    };
  }

  const test = tests[0];
  const result = test.results?.at(-1) || null;
  const status = result?.status || (test.expectedStatus === 'skipped' ? 'skipped' : 'notRun');
  const allSteps = walkSteps(result?.steps);
  const stepMap = new Map(allSteps.map((step) => [step.title, step]));
  const steps = registeredSteps.map((step) => {
    const observed = stepMap.get(step.step_id);
    if (!observed) return { ...step, status: 'NOT_EXECUTED', error: null };
    const failure = errorFacts(observed.error);
    return { ...step, status: failure ? 'FAILED' : 'PASSED', error: failure };
  });
  const testError = errorFacts(result?.error || result?.errors?.[0] || test.errors?.[0]);
  const skipped = status === 'skipped' || Number(report.stats?.skipped || 0) > 0;
  const allRegisteredStepsPassed = steps.length > 0 && steps.every((step) => step.status === 'PASSED');
  const completePass = executionStatus === 'PROCESS_ENDED'
    && exitCode === 0 && status === 'passed' && !skipped
    && Number(report.stats?.expected) === 1 && Number(report.stats?.unexpected || 0) === 0
    && allRegisteredStepsPassed;
  const kinds = new Set(media.map((item) => item.kind));
  const evidenceComplete = ['screenshot', 'video', 'trace'].every((kind) => kinds.has(kind));
  return {
    report_status: 'COMPLETE',
    test_status: skipped ? 'SKIPPED' : status === 'passed' ? 'PASSED' : status === 'failed' ? 'FAILED' : status.toUpperCase(),
    evidence_status: evidenceComplete ? 'COMPLETE' : 'INCOMPLETE',
    media, steps,
    summary: {
      process_ended: true, exit_code: exitCode, report_complete: true, target_test_count: 1,
      playwright_status: status, playwright_pass: status === 'passed',
      complete_pass: completePass, stats: report.stats || null,
    },
    error: testError,
  };
}

export const reportInternals = { errorFacts, walkSteps, walkSuites };

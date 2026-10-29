import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport, projectCaseStepCoverage } from '../server/build/report.mjs';
import { structuredAssertion } from '../server/build/step-observer.mjs';

const matcher = (name, expected, actual) => structuredAssertion({ matcherResult: { name, expected, actual } });
for (const value of [null, false, 0, []]) {
  const observed = matcher('toEqual', value, value);
  assert.equal(observed.expected_present, true);
  assert.equal(observed.actual_present, true);
  assert.deepEqual(observed.actual, value);
}
assert.equal(structuredAssertion({ matcherResult: { name: 'toEqual', expected: null } }).actual_present, false);
assert.equal(matcher('toEqual', 'token=private', []).expected_complete, false);
assert.equal(matcher('toEqual', { password: 'private' }, []).expected_complete, false);
assert.equal(matcher('toEqual', 'x'.repeat(257), []).expected_complete, false);

const localRoot = path.resolve('workbench/.local');
await fs.mkdir(localRoot, { recursive: true });
const workspace = await fs.mkdtemp(path.join(localRoot, 'ui-assertion-evidence-'));
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fixture = path.join(workspace, 'fixture.html');
await fs.writeFile(fixture, '<!doctype html><html><body>offline fixture</body></html>');

async function run(name, code) {
  const candidateDir = path.join(workspace, name, 'candidate');
  const runDirectory = path.join(workspace, name, 'run');
  await fs.mkdir(candidateDir, { recursive: true });
  const candidatePath = path.join(candidateDir, 'candidate.spec.mjs');
  await fs.writeFile(candidatePath, `import { test, expect } from '@playwright/test';\n${code}`);
  const identity = { run_id: `run-${name}`, candidate_sha256: 'A'.repeat(64), executed_external_id: 'FIXTURE', executed_case_version: 1 };
  const raw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable: executable,
    fixtureUrl: pathToFileURL(fixture).href, runDirectory,
    stepObservation: identity });
  assert.equal(raw.process.error, null, JSON.stringify(raw.process));
  const report = await parseCandidateReport(raw.reportPath, raw.process, identity);
  const observationFile = path.join(runDirectory, 'artifacts', 'step-evidence', 'step-observations.ndjson');
  const observations = (await fs.readFile(observationFile, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  return { raw, report, observations, identity, observationFile };
}

try {
  const hard = await run('hard', `test('hard', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => { expect([1]).toContain(1); });
    await test.step('CASE_STEP_2', async () => { expect([]).toContain('BK-001'); });
    await test.step('CASE_STEP_3', async () => { throw Error('SHOULD_NOT_RUN'); });
  });`);
  assert.equal(hard.report.test_status, 'FAILED');
  assert.equal(hard.observations[1].assertions[0].name, 'toContain');
  assert.equal(hard.observations[1].assertions[0].actual_present, false);
  assert.equal(hard.report.steps[0].error, null);
  assert.equal(hard.report.steps[1].error.type, 'ASSERTION_UNRESOLVED');
  assert.equal(hard.report.steps[1].error.actual, null);
  assert.equal(hard.report.steps[1].error.value_source, null);
  assert.equal(hard.report.steps[1].error.value_unavailable_reason, 'MATCHER_VALUES_UNAVAILABLE');
  assert.equal(hard.report.steps[2], undefined);
  assert.equal(hard.report.error.actual, null);
  const coverage = projectCaseStepCoverage(hard.report, { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3'] });
  assert.equal(coverage.items[0].execution_status, 'PASSED');
  assert.equal(coverage.items[1].execution_status, 'FAILED');
  assert.equal(coverage.items[2].execution_status, 'NOT_EXECUTED');

  const equality = await run('equality', `test('equality', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => { expect([]).toEqual(['BK-001']); });
  });`);
  assert.deepEqual(equality.observations[0].assertions[0].actual, []);
  assert.equal(equality.report.steps[0].error.actual, '[]');
  assert.equal(equality.report.steps[0].error.expected, '["BK-001"]');
  assert.equal(equality.report.steps[0].error.type, 'ASSERTION_MISMATCH');
  assert.equal(equality.report.steps[0].error.value_source, 'PLAYWRIGHT_MATCHER_RESULT');
  assert.equal(equality.report.error.actual, '[]');
  const originalObservation = equality.observations[0];
  for (const [label, entries] of [
    ['wrong-run', [{ ...originalObservation, run_id: 'other-run' }]],
    ['wrong-sha', [{ ...originalObservation, candidate_sha256: 'B'.repeat(64) }]],
    ['wrong-case-version', [{ ...originalObservation, executed_case_version: 2 }]],
    ['wrong-step-error', [{ ...originalObservation, raw_error: { ...originalObservation.raw_error, message: 'different error' } }]],
    ['duplicate', [originalObservation, originalObservation]],
  ]) {
    await fs.writeFile(equality.observationFile, entries.map(item => JSON.stringify(item)).join('\n') + '\n');
    const rejected = await parseCandidateReport(equality.raw.reportPath, equality.raw.process, equality.identity);
    assert.equal(rejected.steps[0].error.value_source, null, label);
    assert.equal(rejected.steps[0].error.value_unavailable_reason, 'MATCHER_VALUES_UNAVAILABLE', label);
    assert.equal(rejected.error.value_source, null, label);
  }
  await fs.writeFile(equality.observationFile, JSON.stringify({ ...originalObservation,
    assertions: originalObservation.assertions.map(({ capture_source, ...assertion }) => assertion) }) + '\n');
  const sourceUnknown = await parseCandidateReport(equality.raw.reportPath, equality.raw.process, equality.identity);
  assert.equal(sourceUnknown.steps[0].error.value_source, null);
  assert.equal(sourceUnknown.steps[0].error.value_unavailable_reason, 'MATCHER_CAPTURE_SOURCE_UNVERIFIED');
  await fs.writeFile(equality.observationFile, JSON.stringify(originalObservation) + '\n');
  const historical = await parseCandidateReport(equality.raw.reportPath, equality.raw.process);
  assert.notEqual(historical.steps[0].error.value_source, 'PLAYWRIGHT_MATCHER_RESULT');

  for (const [name, assertion, expected, actual] of [
    ['toBe', 'expect(0).toBe(1)', '1', '0'],
    ['toHaveText', "await expect(page.locator('body')).toHaveText('wrong', { timeout: 100 })", 'wrong', 'offline fixture'],
    ['toHaveCount', "await expect(page.locator('body')).toHaveCount(2, { timeout: 100 })", '2', '1'],
  ]) {
    const probe = await run(name, `test('${name}', async ({ page }) => {
      await page.goto(process.env.PROBE_URL);
      await test.step('CASE_STEP_1', async () => { ${assertion}; });
    });`);
    assert.equal(probe.observations[0].assertions[0].name, name);
    assert.equal(probe.observations[0].assertions[0].expected_present, true, name);
    assert.equal(probe.observations[0].assertions[0].actual_present, true, name);
    assert.equal(probe.report.steps[0].error.expected, expected);
    assert.equal(probe.report.steps[0].error.actual, actual);
    assert.equal(probe.report.steps[0].error.value_source, 'PLAYWRIGHT_MATCHER_RESULT');
  }

  const soft = await run('soft', `test('soft', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => { expect.soft([]).toEqual(['missing']); });
    await test.step('CASE_STEP_2', async () => { expect(0).toBe(0); });
  });`);
  assert.equal(soft.report.test_status, 'FAILED');
  assert.deepEqual(soft.observations[0].assertions[0].actual, []);
  assert.deepEqual(soft.observations[0].assertions[0].expected, ['missing']);
  assert.equal(soft.observations[0].assertions[0].capture_source, 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS');
  assert.equal(soft.report.steps[0].error.type, 'ASSERTION_MISMATCH');
  assert.equal(soft.report.steps[0].error.value_source, 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS');
  assert.equal(soft.report.steps[1].error, null);

  const mutated = await run('soft-mutated', `test('soft-mutated', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => {
      const received = [];
      expect.soft(received).toEqual(['missing']);
      received.push('later');
    });
  });`);
  assert.deepEqual(mutated.observations[0].assertions[0].actual, []);
  assert.equal(mutated.report.steps[0].error.value_source, 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS');

  const multiple = await run('soft-multiple', `test('soft-multiple', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => {
      expect.soft([]).toEqual(['first']);
      expect.soft(0).toBe(1);
    });
  });`);
  assert.deepEqual(multiple.observations[0].assertions, []);
  assert.equal(multiple.report.steps[0].error.value_source, null);

  const negated = await run('soft-not', `test('soft-not', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => { expect.soft(1).not.toBe(1); });
  });`);
  assert.deepEqual(negated.observations[0].assertions, []);
  assert.equal(negated.report.steps[0].error.value_source, null);

  const unknown = await run('unknown', `test('unknown', async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
    await test.step('CASE_STEP_1', async () => { expect(0).toBeGreaterThan(1); });
  });`);
  assert.equal(unknown.observations[0].assertions[0].name, 'toBeGreaterThan');
  assert.equal(unknown.report.steps[0].error.type, 'ASSERTION_UNRESOLVED');
  assert.equal(unknown.report.steps[0].error.value_unavailable_reason, 'UNSUPPORTED_MATCHER');
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}

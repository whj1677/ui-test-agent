import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { counterexampleDetected, parseCandidateReport } from '../server/build/report.mjs';

function report(status, error = null) {
  return { stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status, error }] }] }] }] };
}

test('candidate report parser keeps normal pass and concrete assertion mismatch separate', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-report-'));
  try {
    const normalFile = path.join(root, 'normal.json');
    const negativeFile = path.join(root, 'negative.json');
    await fs.writeFile(normalFile, JSON.stringify(report('passed')));
    await fs.writeFile(negativeFile, JSON.stringify(report('failed', { message: 'Expected string: "VALUE-A"\nReceived string: "VALUE-B"' })));
    const normal = await parseCandidateReport(normalFile, { exitCode: 0, termination: null, error: null });
    const negative = await parseCandidateReport(negativeFile, { exitCode: 1, termination: null, error: null });
    assert.equal(normal.complete_pass, true);
    assert.equal(counterexampleDetected(negative, 'VALUE-A', 'VALUE-B'), true);
    assert.equal(counterexampleDetected(negative, 'VALUE-A', 'OTHER'), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('missing report and locator errors cannot become technical pass or specified mismatch', async () => {
  const missing = await parseCandidateReport(path.join(os.tmpdir(), 'definitely-missing-build-report.json'), { exitCode: 0, termination: null });
  assert.equal(missing.complete_pass, false);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-locator-'));
  try {
    const file = path.join(root, 'report.json');
    await fs.writeFile(file, JSON.stringify(report('failed', { message: "expect(locator('status')).toHaveText timed out; locator resolved to 0 elements" })));
    const parsed = await parseCandidateReport(file, { exitCode: 1, termination: null });
    assert.equal(parsed.error.type, 'LOCATOR_OR_TARGET');
    assert.equal(counterexampleDetected(parsed, 'A', 'B'), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

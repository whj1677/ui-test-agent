import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { reportInternals } from '../server/report.mjs';
import { parseCandidateReport, counterexampleDetected } from '../server/build/report.mjs';

const fixture = new URL('./fixtures/qa-tc005-report.json', import.meta.url);
test('original TC-005 raw report maps multiline values and the same failed step offline', async () => {
  const result = await parseCandidateReport(fixture, { exitCode: 1 });
  assert.equal(result.test_status, 'FAILED');
  assert.equal(result.error.type, 'ASSERTION_MISMATCH');
  assert.equal(result.error.expected, 'DEV-006');
  assert.equal(result.error.actual, '\n    DEV-002循环泵二号西站\n    检修\n    120 kW详情\n  ');
  const task = JSON.parse(await fs.readFile(new URL('../qa/20260924/evidence/TC-002-final-task.json', import.meta.url)));
  assert.equal(counterexampleDetected(result, task.input_bundle.verification_contract), true);
});

for (const [name, message, type] of [
  ['string', 'Expected string: "a"\nReceived string: "b"', 'ASSERTION_MISMATCH'],
  ['ansi', '\u001b[31mExpected: "a"\u001b[0m\nReceived: "b"\nwaiting for locator("x")', 'ASSERTION_MISMATCH'],
  ['missing', 'Expected: "a"\nReceived: "b"\nlocator resolved to 0 elements', 'LOCATOR_OR_TARGET'],
  ['strict', 'Expected: "a"\nReceived: "b"\nstrict mode violation', 'LOCATOR_OR_TARGET'],
  ['single side', 'Expected: "a"\nwaiting for locator("x")', 'LOCATOR_OR_TARGET'],
  ['timeout', 'TimeoutError: timeout 30000ms exceeded', 'TIMEOUT'],
  ['truncated array', 'expect(locator).toHaveText(expected)\n  Array [\n- "a",\n+ "b",', 'ASSERTION_UNRESOLVED'],
  ['truncated diff', 'expect(locator).toContainText(expected)\n- Expected substring  - 1\n+ Received string  + 2\n\n- a\n+ b', 'ASSERTION_UNRESOLVED'],
  ['array', 'expect(locator).toHaveText(expected)\n  Array [\n- "a",\n+ "b",\n  "shared",\n  ]', 'ASSERTION_MISMATCH'],
]) test(name, () => assert.equal(reportInternals.errorFacts({ message }).type, type));

test('structured matcher data precedes text without inventing single-sided actual', () => {
  const result = reportInternals.errorFacts({ message: 'expect(locator).toHaveText(expected)', matcherResult: { name: 'toHaveText', expected: 'a', actual: 'b' } });
  assert.equal(result.expected, 'a'); assert.equal(result.actual, 'b');
  assert.notEqual(reportInternals.errorFacts({ message: 'expect(locator).toHaveText(expected)', matcherResult: { name: 'toHaveText', expected: 'a' } }).type, 'ASSERTION_MISMATCH');
});

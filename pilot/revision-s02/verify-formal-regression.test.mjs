import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const taskRoot = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = path.join(path.dirname(taskRoot), 'private', 'revision-s02', 'formal-regression');
const summary = JSON.parse(await fs.readFile(path.join(privateRoot, 'summary.json'), 'utf8'));
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const expectedReports = {
  'normal-1': '4686faac3af63fd853640cd263a6dea1a695e14bd6f62bc541b583f1e5f136c5',
  'normal-2': 'c5e36ec3b781b1b4e0fcc3f9078e4d14c84cecf8376d4b6131597f38a3361b5b',
  'normal-3': '9d3518992b4bdaec8a88519883a97401fde592d5a03efa81657e8991377ed56f',
  'fault-1': 'ec5d98baf5e5c32211bab6f1820056d93eaba131c1dfb8dc6c52a2645f3e6bb4',
  'fault-2': 'b0c58e5642e3eb1edd5f39034d296200bc3ae636dc9b28d74fdf9ede724dfeb6',
  'fault-3': '7e07445acfeb076fa4591c6e400dfbc4d44303a62512c85dacba98343eac77bc',
};

for (const [index, name] of summary.fixed_order.entries()) {
  test(`${name} formal result is preserved and correctly classified`, async () => {
    assert.equal(summary.results[index].name, name);
    assert.equal(summary.results[index].candidate_sha_before, summary.candidate_sha256);
    assert.equal(summary.results[index].candidate_sha_after, summary.candidate_sha256);
    assert.equal(summary.results[index].model_calls, 0);
    assert.equal(summary.results[index].retries, 0);
    assert.equal(summary.results[index].healer, false);
    assert.equal(sha(await fs.readFile(path.join(privateRoot, name, 'report.json'))), expectedReports[name]);
    if (name.startsWith('normal-')) {
      assert.equal(summary.results[index].normal_complete, true);
      assert.deepEqual(summary.results[index].steps.map((step) => step.title), ['S01', 'S02', 'S03', 'S04']);
      assert.equal(summary.results[index].exit_code, 0);
    } else {
      assert.equal(summary.results[index].specified_fault_detected, true);
      assert.deepEqual(summary.results[index].steps.map((step) => step.title), ['S01', 'S02', 'S03']);
      assert.equal(summary.results[index].s04_executed, false);
      assert.match(summary.results[index].steps.find((step) => step.title === 'S03').error, /Expected: "H111"[\s\S]*Received: "H106"/);
      assert.equal(summary.results[index].exit_code, 1);
    }
  });
}

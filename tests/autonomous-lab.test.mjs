import test from 'node:test';
import assert from 'node:assert/strict';
import { callBudget, runLab } from '../scripts/autonomous-lab.mjs';

test('shared round call/time budget never resets between jobs and counts failed requests', () => {
  let time = 0;
  const budget = callBudget({ maxCalls: 2, maxMinutes: 1, clock: () => time });
  budget.take();
  budget.take();
  assert.throws(() => budget.take(), { code: 'ROUND_BUDGET_EXHAUSTED' });
  assert.equal(budget.snapshot().calls, 2);
  const timed = callBudget({ maxCalls: 10, maxMinutes: 1, clock: () => time });
  time = 60000;
  assert.throws(() => timed.take(), { code: 'ROUND_BUDGET_EXHAUSTED' });
  assert.throws(() => callBudget({ maxCalls: 901 }), /INVALID_ROUND_BUDGET/);
});
test('autonomous preflight checks the frozen 32 cases without creating sessions or calling a model', async () => {
  assert.deepEqual(await runLab({ suite: 'all' }), {
    state: 'PREFLIGHT_ONLY',
    cases: 32,
    frozen_files: 11,
    model_calls: 0,
  });
  assert.equal((await runLab()).cases, 3);
});

test('bounded selection retains original suite order and rejects missing/duplicate IDs', async () => {
  assert.deepEqual(await runLab({ suite: 'all', caseIds: ['LAB-V07', 'LAB-V06'] }), {
    state: 'PREFLIGHT_ONLY',
    cases: 2,
    frozen_files: 11,
    model_calls: 0,
    selected_case_ids: ['LAB-V06', 'LAB-V07'],
    subset_only: true,
  });
  for (const caseIds of [[], [''], ['LAB-V06', 'LAB-V06'], ['unknown'], 'LAB-V06'])
    await assert.rejects(runLab({ suite: 'all', caseIds }), /INVALID_CASE_SELECTION/);
  await assert.rejects(runLab({ suite: 'smoke', caseIds: ['LAB-V06'] }), /INVALID_CASE_SELECTION/);
  assert.equal((await runLab({ suite: 'all', caseIds: ['LAB-V13'] })).subset_only, true);
});

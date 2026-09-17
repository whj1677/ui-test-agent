import assert from 'node:assert/strict';
import test from 'node:test';
import {
  caseBudgetBatches,
  caseScaledJobBudget,
  projectBudgetForBatches,
} from '../src/job-budget.mjs';

test('case-scaled budget retains the small-batch floor and accounts for each selected Case', () => {
  assert.deepEqual(caseScaledJobBudget(1), {
    schema_version: 'case-scaled-budget/v1',
    case_count: 1,
    model_calls: { limit: 100, base: 20, per_case: 36 },
    discovery: {
      model_call_limit: 13,
      model_calls_per_case: 13,
      step_limit: 48,
      steps_per_case: 12,
      timeout_ms: 180000,
    },
  });
  const eight = caseScaledJobBudget(8);
  assert.equal(eight.model_calls.limit, 308);
  assert.equal(eight.discovery.model_call_limit, 104);
  assert.equal(eight.discovery.step_limit, 96);
  assert.equal(eight.discovery.timeout_ms, 960000);
});

test('a 100-Case selection is split into bounded automatic batches while retaining a project total', () => {
  const ids = Array.from({ length: 100 }, (_, index) => 'CASE-' + (index + 1));
  const batches = caseBudgetBatches(ids);
  assert.equal(batches.length, 15);
  assert.ok(batches.slice(0, -1).every((batch) => batch.length === 7));
  assert.equal(batches.at(-1).length, 2);
  assert.deepEqual(batches.flat(), ids);
  assert.ok(batches.every((batch) => caseScaledJobBudget(batch.length).model_calls.limit <= 300));
  assert.deepEqual(projectBudgetForBatches(batches), {
    schema_version: 'case-scaled-project-budget/v1',
    case_count: 100,
    batch_count: 15,
    model_call_limit: 3908,
    batch_model_call_limit: 300,
  });
});

for (const count of [0, -1, 1.5, 101])
  test('case-scaled budget rejects invalid selection ' + count, () =>
    assert.throws(
      () => caseScaledJobBudget(count),
      (error) => error.code === 'CASE_SELECTION_INVALID',
    ),
  );

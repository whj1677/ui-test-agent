import { fail } from './common.mjs';

// A logical model call is one Agent decision. HTTP retries remain transport
// telemetry and never replenish or consume these allocations.
const BASE_MODEL_CALLS = 20;
const MODEL_CALLS_PER_CASE = 36;
const MIN_MODEL_CALLS = 100;
const DISCOVERY_MODEL_CALLS_PER_CASE = 13;
const DISCOVERY_STEPS_PER_CASE = 12;
const MIN_DISCOVERY_STEPS = 48;
const DISCOVERY_TIMEOUT_PER_CASE_MS = 120_000;
const MIN_DISCOVERY_TIMEOUT_MS = 180_000;
const MAX_DISCOVERY_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const MAX_DISCOVERY_STEPS = 1_200;
const MAX_MODEL_CALLS_PER_BATCH = 300;
const MAX_CASES_PER_BATCH = Math.floor(
  (MAX_MODEL_CALLS_PER_BATCH - BASE_MODEL_CALLS) / MODEL_CALLS_PER_CASE,
);

export function caseScaledJobBudget(caseCount) {
  if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > 100)
    fail('CASE_SELECTION_INVALID');
  const discoverySteps = Math.max(MIN_DISCOVERY_STEPS, caseCount * DISCOVERY_STEPS_PER_CASE);
  return Object.freeze({
    schema_version: 'case-scaled-budget/v1',
    case_count: caseCount,
    model_calls: Object.freeze({
      limit: Math.max(MIN_MODEL_CALLS, BASE_MODEL_CALLS + caseCount * MODEL_CALLS_PER_CASE),
      base: BASE_MODEL_CALLS,
      per_case: MODEL_CALLS_PER_CASE,
    }),
    discovery: Object.freeze({
      model_call_limit: caseCount * DISCOVERY_MODEL_CALLS_PER_CASE,
      model_calls_per_case: DISCOVERY_MODEL_CALLS_PER_CASE,
      step_limit: Math.min(MAX_DISCOVERY_STEPS, discoverySteps),
      steps_per_case: DISCOVERY_STEPS_PER_CASE,
      timeout_ms: Math.min(
        MAX_DISCOVERY_TIMEOUT_MS,
        Math.max(MIN_DISCOVERY_TIMEOUT_MS, caseCount * DISCOVERY_TIMEOUT_PER_CASE_MS),
      ),
    }),
  });
}

export function caseBudgetBatches(caseIds) {
  if (!Array.isArray(caseIds) || !caseIds.length || caseIds.length > 100)
    fail('CASE_SELECTION_INVALID');
  const batches = [];
  for (let index = 0; index < caseIds.length; index += MAX_CASES_PER_BATCH)
    batches.push(caseIds.slice(index, index + MAX_CASES_PER_BATCH));
  return batches;
}

export function projectBudgetForBatches(batches) {
  const batchBudgets = batches.map((batch) => caseScaledJobBudget(batch.length));
  return Object.freeze({
    schema_version: 'case-scaled-project-budget/v1',
    case_count: batches.reduce((sum, batch) => sum + batch.length, 0),
    batch_count: batches.length,
    model_call_limit: batchBudgets.reduce((sum, budget) => sum + budget.model_calls.limit, 0),
    batch_model_call_limit: MAX_MODEL_CALLS_PER_BATCH,
  });
}

// Initial, explainable safety allocations, not a promise about model latency.
// Planning includes its bounded review/repair loop; discovery never spends it.
export function preparationCaseBudget(c, multiplier = 1) {
  if (![1, 2].includes(multiplier)) fail('PREPARATION_OPTIONS_INVALID');
  const steps = Math.max(1, c.steps?.length ?? 0);
  const obligations = (c.steps ?? []).reduce(
    (n, step) => n + Math.max(1, step.obligations?.length ?? 0),
    0,
  );
  return {
    steps,
    obligations,
    discovery_ms: Math.min(15 * 60_000, (120_000 + steps * 20_000) * multiplier),
    planning_ms: Math.min(20 * 60_000, (120_000 + obligations * 30_000) * multiplier),
  };
}

export function preparationOptions(input = {}, state) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['concurrency', 'independent_readonly', 'time_multiplier'].includes(key),
    )
  )
    fail('PREPARATION_OPTIONS_INVALID');
  const options = {
    concurrency: input.concurrency ?? 1,
    independent_readonly: input.independent_readonly ?? false,
    time_multiplier: input.time_multiplier ?? 1,
  };
  if (
    ![1, 2].includes(options.concurrency) ||
    ![1, 2].includes(options.time_multiplier) ||
    typeof options.independent_readonly !== 'boolean'
  )
    fail('PREPARATION_OPTIONS_INVALID');
  if (options.concurrency === 2 && (!options.independent_readonly || state.authorization.writes))
    fail('PARALLEL_READONLY_CONFIRMATION_REQUIRED');
  return options;
}

export function preparationTimeBudget(cases, options) {
  const per_case = Object.fromEntries(
    cases.map((c) => [c.case_id, preparationCaseBudget(c, options.time_multiplier)]),
  );
  const work_ms = Object.values(per_case).reduce((n, b) => n + b.discovery_ms + b.planning_ms, 0);
  return {
    schema_version: 'preparation-time/v1',
    basis:
      '120s + 20s/step discovery; 120s + 30s/obligation planning; initial allocation, not measured estimate',
    per_case,
    work_ms,
    // Never divide the hard ceiling by concurrency: waiting, dependencies and
    // shared model throttling are not guaranteed to scale linearly.
    wall_ms: Math.min(3 * 60 * 60_000, work_ms + 60_000),
  };
}

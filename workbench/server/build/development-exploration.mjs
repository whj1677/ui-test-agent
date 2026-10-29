import { createHash } from 'node:crypto';

export const EXPLORATION_LIMITS = Object.freeze({ initial: 32, draft_extension: 8, repair: 16, passed: 2, repeated_read: 3, reserved_tools: 8 });
const readOnly = new Set(['browser_snapshot', 'browser_evaluate', 'browser_screenshot', 'browser_take_screenshot', 'browser_wait_for']);
const terminal = new Set(['EXECUTED', 'EXECUTOR_ERROR', 'CANCELLED']);

function exploration(state) {
  return state.exploration ||= {
    schema: 'workbench/development-exploration-v1', phase: 'INITIAL',
    window_limit: EXPLORATION_LIMITS.initial, window_used: 0, total_browser_calls: 0,
    completed_execution: 0, admitted_draft_sha256: null, draft_extension_used: false,
    read_signature: null, read_streak: 0, denied_calls: 0, cleanup_status: 'UNVERIFIED',
    possible_pending_cleanup: false,
  };
}

// This hook is called by the server only after write_draft passes admission.
// Reading a changed file or directly editing one must not replenish exploration.
export function recordExplorationDraftAdmission(state, { sha256 = state.draft_sha256, enabled = false } = {}) {
  if (!enabled) return { recorded: false, policy_applied: false };
  if (typeof sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(sha256) || sha256 !== state.draft_sha256)
    return { recorded: false, code: 'DRAFT_ADMISSION_SHA_MISMATCH' };
  const current = exploration(state);
  const changed = current.admitted_draft_sha256 !== sha256;
  current.admitted_draft_sha256 = sha256;
  return { recorded: true, changed, policy_applied: true };
}

function reconcileCompletedExecution(state, current) {
  const tests = state.self_tests || [];
  const index = tests.findLastIndex(run => terminal.has(run.status));
  if (index < 0 || index + 1 <= current.completed_execution) return;
  const run = tests[index];
  current.completed_execution = index + 1;
  const passed = run.status === 'EXECUTED' && run.result?.complete_pass === true && run.coverage?.complete === true && !run.changed_after_execution;
  const exhausted = tests.length >= (state.limits?.self_tests ?? 3);
  current.phase = run.status === 'CANCELLED' ? 'CANCELLED' : passed ? 'PASSED' : exhausted ? 'TEST_BUDGET_EXHAUSTED' : 'REPAIR';
  current.window_limit = passed ? EXPLORATION_LIMITS.passed : current.phase === 'REPAIR' ? EXPLORATION_LIMITS.repair : 0;
  current.window_used = 0;
  current.read_signature = null;
  current.read_streak = 0;
  // A complete self-test does not prove the separate observation browser's
  // exploratory side effects were cleaned. Keep that uncertainty explicit.
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function readSignature(tool, args) {
  const relevant = { ...(args || {}) };
  // Output filenames do not change what is observed and must not reset a streak.
  delete relevant.filename;
  delete relevant.path;
  return createHash('sha256').update(JSON.stringify([tool, canonical(relevant)])).digest('hex');
}

function metadata(state, current) {
  return {
    policy_applied: true, phase: current.phase,
    browser_calls_used: current.total_browser_calls,
    remaining_browser_calls: Math.max(0, current.window_limit - current.window_used),
    reserved_tool_calls: EXPLORATION_LIMITS.reserved_tools,
    remaining_tool_calls: Number.isFinite(state.limits?.tool_calls) ? Math.max(0, state.limits.tool_calls - (state.tool_calls || 0)) : null,
    cleanup_status: current.cleanup_status,
    possible_pending_cleanup: current.possible_pending_cleanup,
    runtime_verified: false,
  };
}

function nextSteps(state, current) {
  if (current.phase === 'CANCELLED') return ['preserve evidence and record unresolved cleanup; do not resume cancelled execution'];
  if (current.phase === 'PASSED') return ['submit_candidate with current self-test evidence; changed bytes require self_test', 'record any unresolved exploratory side effects'];
  if (current.phase === 'TEST_BUDGET_EXHAUSTED') return ['read_evidence', 'submit_candidate with a factual non-ready outcome', 'record any unresolved exploratory side effects'];
  return [state.draft_sha256 ? 'repair only the evidenced failure with write_draft, then self_test' : 'write_draft preserving all frozen actions and assertions, then self_test',
    'report_blocker only for an observed missing frozen prerequisite', 'record any unresolved exploratory side effects'];
}

function deny(state, current, code, message) {
  current.denied_calls++;
  current.last_denial = code;
  return { allowed: false, code, message, next_steps: nextSteps(state, current), ...metadata(state, current) };
}

/** Server-side admission only. It never performs browser work, increments model
 * tool counts, edits self-test results, or claims cleanup/test success. */
export function beforeBrowserObservation(state, { tool, args = {}, enabled = false } = {}) {
  if (!enabled) return { allowed: true, policy_applied: false };
  const name = typeof tool === 'string' ? tool.split('__').at(-1) : '';
  if (!name.startsWith('browser_')) return { allowed: true, policy_applied: false };
  const current = exploration(state);
  // The active self-test is not new evidence and never earns another window.
  if (state.self_tests?.at(-1)?.status === 'EXECUTING')
    return deny(state, current, 'EXPLORATION_SELF_TEST_RUNNING', 'Wait for the running self-test result. Do not explore concurrently or start another self-test.');
  reconcileCompletedExecution(state, current);
  if (state.submission || state.blocker || current.phase === 'CANCELLED')
    return deny(state, current, 'EXPLORATION_TASK_CLOSED', 'The task is closed. Preserve its actual outcome and any unresolved cleanup; do not continue browser exploration.');
  if (Number.isFinite(state.limits?.tool_calls) && (state.tool_calls || 0) >= state.limits.tool_calls - EXPLORATION_LIMITS.reserved_tools)
    return deny(state, current, 'EXPLORATION_TOOL_RESERVE', 'Browser exploration has stopped to preserve tool calls for draft repair, self-test, evidence and factual submission.');
  if (current.phase === 'INITIAL' && current.window_used >= current.window_limit && !current.draft_extension_used &&
      current.admitted_draft_sha256 && current.admitted_draft_sha256 === state.draft_sha256) {
    current.draft_extension_used = true;
    current.window_limit += EXPLORATION_LIMITS.draft_extension;
  }
  if (current.window_used >= current.window_limit) {
    const message = current.phase === 'PASSED'
      ? 'The current self-test passed. Submit its evidence instead of rediscovering the page; changing bytes still requires a new self-test.'
      : current.phase === 'TEST_BUDGET_EXHAUSTED'
        ? 'No self-tests remain. Preserve the failure and submit a factual non-ready outcome; further exploration cannot make it verified.'
        : 'This exploration window is exhausted. Use the observed page and failure evidence to write a focused draft and run self_test. A draft admission can extend the initial window only once.';
    return deny(state, current, 'EXPLORATION_WINDOW_EXHAUSTED', message);
  }
  const signature = readOnly.has(name) ? readSignature(name, args) : null;
  if (signature && signature === current.read_signature && current.read_streak >= EXPLORATION_LIMITS.repeated_read)
    return deny(state, current, 'EXPLORATION_REPEATED_READ', 'Three identical read-only observations have already been admitted without an intervening interaction. Use existing evidence, a bounded wait for a specific condition, or a focused draft/self-test; repeated snapshots do not demonstrate progress.');
  current.read_streak = signature ? signature === current.read_signature ? current.read_streak + 1 : 1 : 0;
  current.read_signature = signature;
  current.window_used++;
  current.total_browser_calls++;
  if (!readOnly.has(name) && name !== 'browser_navigate') current.possible_pending_cleanup = true;
  return { allowed: true, ...metadata(state, current), next_steps: current.phase === 'PASSED' ? nextSteps(state, current) : [] };
}

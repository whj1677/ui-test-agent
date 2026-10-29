import test from 'node:test';
import assert from 'node:assert/strict';
import { beforeBrowserObservation, recordExplorationDraftAdmission, EXPLORATION_LIMITS } from '../server/build/development-exploration.mjs';

const sha = digit => digit.repeat(64);
const fixture = extra => ({ limits: { tool_calls: 120, self_tests: 3 }, tool_calls: 0, draft_sha256: null, self_tests: [], ...extra });
const observe = (state, tool = 'browser_click', args = {}) => beforeBrowserObservation(state, { tool, args, enabled: true });
function use(state, count) { for (let i = 0; i < count; i++) assert.equal(observe(state).allowed, true, `observation ${i + 1}`); }
function admit(state, value) { state.draft_sha256 = value; return recordExplorationDraftAdmission(state, { enabled: true }); }
const failed = (number, status = 'EXECUTED') => ({ number, status, result: { test_status: 'FAILED', complete_pass: false }, coverage: { complete: true } });
const passed = number => ({ number, status: 'EXECUTED', result: { test_status: 'PASSED', complete_pass: true }, coverage: { complete: true }, changed_after_execution: false });

test('legacy mode is inactive and cannot mutate state or count a private gate as a tool', () => {
  const state = fixture(); const original = structuredClone(state);
  for (let i = 0; i < 150; i++) assert.deepEqual(beforeBrowserObservation(state, { tool: 'browser_snapshot' }), { allowed: true, policy_applied: false });
  assert.deepEqual(recordExplorationDraftAdmission(state), { recorded: false, policy_applied: false });
  assert.deepEqual(state, original);
  assert.deepEqual(observe(state, 'read_draft'), { allowed: true, policy_applied: false });
  assert.deepEqual(state, original);
});

test('initial quota admits exactly 32 browser calls, denies further discovery, and preserves outcomes', () => {
  const state = fixture(); const original = structuredClone(state);
  use(state, EXPLORATION_LIMITS.initial);
  const result = observe(state);
  assert.equal(result.allowed, false); assert.equal(result.code, 'EXPLORATION_WINDOW_EXHAUSTED');
  assert.equal(result.remaining_browser_calls, 0); assert.equal(result.runtime_verified, false);
  assert.ok(result.next_steps.some(item => item.includes('write_draft')));
  assert.equal(result.cleanup_status, 'UNVERIFIED'); assert.equal(result.possible_pending_cleanup, true);
  const { exploration, ...rest } = state; assert.deepEqual(rest, original);
});

test('only admitted current bytes unlock the one eight-call extension; reads, native edits and repeated writes cannot reset it', () => {
  const state = fixture(); use(state, 32);
  state.draft_sha256 = sha('a');
  assert.equal(observe(state).allowed, false, 'a read of native-written bytes does not admit them');
  assert.equal(recordExplorationDraftAdmission(state, { sha256: sha('b'), enabled: true }).recorded, false);
  assert.equal(admit(state, sha('a')).changed, true);
  state.draft_sha256 = sha('b'); assert.equal(observe(state).allowed, false, 'admission must bind current bytes');
  admit(state, sha('b')); use(state, 8);
  for (const digest of [sha('b'), sha('c'), sha('d')]) {
    admit(state, digest);
    assert.equal(observe(state).allowed, false);
  }
  assert.equal(state.exploration.total_browser_calls, 40);
});

test('early draft admission does not replace the initial quota or allow multiple extensions', () => {
  const state = fixture(); admit(state, sha('a')); use(state, 20); admit(state, sha('b')); use(state, 20);
  assert.equal(observe(state).allowed, false);
  assert.equal(state.exploration.window_limit, 40);
});

test('completed failed self-test earns one 16-call repair window and repeat reads of that result do not reset it', () => {
  const state = fixture(); use(state, 32);
  state.self_tests.push(failed(1));
  use(state, 16);
  assert.equal(state.exploration.phase, 'REPAIR');
  for (let i = 0; i < 3; i++) assert.equal(observe(state).allowed, false);
  admit(state, sha('a')); assert.equal(observe(state).allowed, false, 'repair writes are not another observation budget');
  state.self_tests.push(failed(2, 'EXECUTOR_ERROR')); use(state, 16);
  assert.equal(observe(state).allowed, false);
  assert.equal(state.exploration.completed_execution, 2);
});

test('EXECUTING self-tests never reset exhausted discovery and cannot run browsers concurrently', () => {
  const state = fixture(); use(state, 32);
  state.self_tests.push({ number: 1, status: 'EXECUTING' });
  const before = { used: state.exploration.window_used, completed: state.exploration.completed_execution };
  for (let i = 0; i < 5; i++) assert.equal(observe(state).code, 'EXPLORATION_SELF_TEST_RUNNING');
  assert.deepEqual({ used: state.exploration.window_used, completed: state.exploration.completed_execution }, before);
  state.self_tests[0] = failed(1); use(state, 16);
  assert.equal(observe(state).allowed, false);
});

test('recovery keeps the original seed unadmitted until its first real self-test', () => {
  const state = fixture({ recovery: true, draft_sha256: sha('a') });
  use(state, 32); assert.equal(observe(state).allowed, false);
  state.self_tests.push(failed(1)); use(state, 16);
  assert.equal(observe(state).allowed, false);
});

test('a complete pass offers only two final observations and directs submission without altering verdicts', () => {
  const state = fixture({ draft_sha256: sha('a'), self_tests: [passed(1)] });
  const tests = structuredClone(state.self_tests);
  const first = observe(state); assert.equal(first.allowed, true); assert.equal(first.phase, 'PASSED');
  assert.ok(first.next_steps[0].includes('submit_candidate'));
  assert.equal(observe(state).allowed, true);
  const denied = observe(state); assert.equal(denied.allowed, false); assert.match(denied.message, /Submit/);
  assert.deepEqual(state.self_tests, tests);
  assert.equal(denied.runtime_verified, false);
  admit(state, sha('b')); assert.equal(observe(state).allowed, false, 'changing a passed draft cannot renew exploration');
});

test('incomplete evidence or changed executed bytes does not activate the passed phase', () => {
  for (const change of [{ coverage: { complete: false } }, { changed_after_execution: true }, { status: 'EXECUTOR_ERROR' }]) {
    const state = fixture({ self_tests: [{ ...passed(1), ...change }] });
    assert.equal(observe(state).phase, 'REPAIR');
  }
});

test('self-test exhaustion and cancellation never open another repair window', () => {
  const exhausted = fixture({ self_tests: [failed(1), failed(2), failed(3)] });
  const result = observe(exhausted);
  assert.equal(result.allowed, false); assert.equal(result.phase, 'TEST_BUDGET_EXHAUSTED');
  assert.ok(result.next_steps.some(item => item.includes('non-ready')));
  const cancelled = fixture({ self_tests: [{ number: 1, status: 'CANCELLED' }] });
  assert.equal(observe(cancelled).code, 'EXPLORATION_TASK_CLOSED');
});

test('reserve keeps eight model calls available for repair, evidence, self-test and submit', () => {
  const state = fixture({ tool_calls: 111 });
  assert.equal(observe(state).allowed, true); assert.equal(state.tool_calls, 111, 'private gate must not count a model tool');
  state.tool_calls = 112;
  const result = observe(state);
  assert.equal(result.code, 'EXPLORATION_TOOL_RESERVE'); assert.equal(result.remaining_tool_calls, 8);
  assert.equal(state.exploration.total_browser_calls, 1);
});

for (const name of ['browser_snapshot', 'browser_take_screenshot', 'browser_evaluate', 'browser_wait_for']) {
  test(`fourth identical ${name} is denied; a genuine interaction resets the streak`, () => {
    const state = fixture();
    for (let i = 0; i < 3; i++) assert.equal(observe(state, `mcp__playwright-mcp__${name}`, { text: 'Ready', filename: `view-${i}.yml` }).allowed, true);
    assert.equal(observe(state, name, { filename: 'view-new.yml', text: 'Ready' }).code, 'EXPLORATION_REPEATED_READ');
    assert.equal(state.exploration.total_browser_calls, 3);
    assert.equal(observe(state, 'browser_click', { ref: 'button' }).allowed, true);
    assert.equal(observe(state, name, { text: 'Ready' }).allowed, true);
  });
}

test('specific different read conditions are allowed and no raw arguments are retained', () => {
  const state = fixture();
  for (let i = 0; i < 3; i++) observe(state, 'browser_wait_for', { text: 'A private value', time: 1 });
  assert.equal(observe(state, 'browser_wait_for', { time: 1, text: 'A private value' }).allowed, false);
  assert.equal(observe(state, 'browser_wait_for', { text: 'Another condition', time: 1 }).allowed, true);
  assert.ok(!JSON.stringify(state.exploration).includes('private value'));
  assert.equal(state.exploration.possible_pending_cleanup, false);
});

test('serializable state preserves used budgets and cleanup uncertainty through recovery', () => {
  const state = fixture(); admit(state, sha('a')); use(state, 39);
  const recovered = JSON.parse(JSON.stringify(state));
  assert.equal(observe(recovered).allowed, true); assert.equal(observe(recovered).allowed, false);
  assert.equal(recovered.exploration.possible_pending_cleanup, true);
  assert.equal(recovered.exploration.cleanup_status, 'UNVERIFIED');
  recovered.self_tests.push(passed(1));
  assert.equal(observe(recovered).cleanup_status, 'UNVERIFIED', 'a separate self-test is not proof of observation cleanup');
});

test('a recorded blocker or frozen submission closes observation without changing the record', () => {
  for (const extra of [{ blocker: { status: 'ENVIRONMENT_BLOCKED' } }, { submission: { outcome: 'ready' } }]) {
    const state = fixture(extra); assert.equal(observe(state).code, 'EXPLORATION_TASK_CLOSED');
    for (const [key, value] of Object.entries(extra)) assert.deepEqual(state[key], value);
  }
});

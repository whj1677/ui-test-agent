import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentFailureDisposition } from '../server/build/development-task.mjs';

test('registered target HTTP and WebSocket guards keep distinct persisted codes and environment status', () => {
  for (const [code, message] of [
    ['TARGET_SCOPE_REQUEST_BLOCKED', '同源路径范围'],
    ['TARGET_WEBSOCKET_BLOCKED', 'WebSocket'],
  ]) {
    const result = developmentFailureDisposition({ caught: new Error('DEVELOPMENT_CANCELLED'),
      abortReason: { code, origin: 'http://127.0.0.1:3100', path: '/private', channel: 'websocket' }, aborted: true, authBlocked: false });
    assert.equal(result.finalStatus, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(result.failure.category, 'ENVIRONMENT');
    assert.equal(result.failure.reason, code);
    assert.equal(result.error.code, code);
    assert.match(result.error.message, new RegExp(message));
    assert.equal(JSON.parse(JSON.stringify(result)).error.code, code, 'task error code survives storage serialization');
    assert.ok(!JSON.stringify(result).includes('/private'), 'guard details are not persisted without sanitization');
  }
});

test('true user cancellation remains CANCELLED and AUTH keeps priority over a network guard', () => {
  const cancelled = developmentFailureDisposition({ caught: new Error('DEVELOPMENT_CANCELLED'),
    abortReason: 'user_cancelled', aborted: true, authBlocked: false });
  assert.equal(cancelled.finalStatus, 'CANCELLED');
  assert.equal(cancelled.failure.category, 'CANCELLED');

  const auth = developmentFailureDisposition({ caught: new Error('DEVELOPMENT_CANCELLED'),
    abortReason: { code: 'TARGET_WEBSOCKET_BLOCKED' }, aborted: true, authBlocked: true });
  assert.equal(auth.finalStatus, 'AUTH_SESSION_BLOCKED');
  assert.equal(auth.failure.category, 'AUTH');
  assert.equal(auth.error.code, 'AUTH_SESSION_BLOCKED');

  const ordinary = developmentFailureDisposition({ caught: new Error('ordinary failure'),
    abortReason: undefined, aborted: false, authBlocked: false });
  assert.equal(ordinary.finalStatus, 'CANDIDATE_VALIDATION_FAILED');
  assert.equal(ordinary.failure.category, 'AGENT_OR_RUNTIME');
  assert.equal(ordinary.error.code, 'ordinary failure');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCompletePageEvidence } from '../src/plan-repair.mjs';

test('incomplete initial page evidence cannot authorize a plan even if a model accepts it', () => {
  const context = {
    target_origin: 'http://example.test',
    pages: [
      { url: 'http://example.test/home', network_issues: [{ method: 'POST', path: '/query' }] },
      { url: 'http://example.test/catalog', network_issues: [] },
    ],
  };
  assert.throws(
    () => requireCompletePageEvidence(context, { entry_path: '/home' }),
    (e) => e.code === 'PAGE_EVIDENCE_INCOMPLETE',
  );
  assert.doesNotThrow(() => requireCompletePageEvidence(context, { entry_path: '/catalog' }));
  assert.throws(
    () =>
      requireCompletePageEvidence(context, {
        entry_path: '/catalog',
        steps: [{ checkpoints: [{ actions: [{ op: 'navigate', value: '/home' }] }] }],
      }),
    (e) => e.code === 'PAGE_EVIDENCE_INCOMPLETE',
  );
  context.pages.push({ url: 'http://example.test/home', network_issues: [] });
  assert.doesNotThrow(() => requireCompletePageEvidence(context, { entry_path: '/home' }));
});

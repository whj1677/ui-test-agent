import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { test } from '@playwright/test';
import { parseProjectCaseStepTitle } from './report.mjs';

export const STEP_OBSERVER_VERSION = 'e2e01-step-observer-v1';

export function installStepObserver({ directory, identity, capture = async (page, file) => page.screenshot({ path: file }) }) {
  if (!directory || !identity?.run_id || !identity?.candidate_sha256) throw new Error('STEP_OBSERVER_IDENTITY_REQUIRED');
  const originalStep = test.step;
  let page = null;
  let depth = 0;
  let ordinal = 0;
  test.beforeEach(async ({ page: workerPage }) => { page = workerPage; });
  const evidencePath = path.join(directory, 'step-observations.ndjson');
  async function snapshot(stepId, phase) {
    const started = performance.now();
    const file = path.join(directory, `${stepId.toLowerCase()}-${phase}.png`);
    try {
      if (!page || page.isClosed()) throw new Error('OBSERVED_PAGE_UNAVAILABLE');
      await fs.mkdir(directory, { recursive: true });
      await capture(page, file);
      return { phase, file_name: path.basename(file), captured_at: new Date().toISOString(), capture_duration_ms: performance.now() - started };
    } catch (error) {
      return { phase, file_name: null, captured_at: new Date().toISOString(), capture_duration_ms: performance.now() - started,
        capture_error: String(error?.message || error) };
    }
  }
  test.step = async function observedStep(title, callback, options) {
    const parsed = parseProjectCaseStepTitle(title);
    if (!parsed || typeof callback !== 'function') return originalStep.call(this, title, callback, options);
    const order = ++ordinal;
    const parentDepth = depth;
    return originalStep.call(this, title, async (...args) => {
      depth = parentDepth + 1;
      const startedAt = new Date().toISOString();
      const before = await snapshot(parsed.step_id, 'before');
      const businessStartedAt = new Date().toISOString();
      let businessEndedAt = null;
      let after;
      let state = 'PASSED';
      let rawError = null;
      try {
        const value = await callback(...args);
        businessEndedAt = new Date().toISOString();
        return value;
      } catch (error) {
        businessEndedAt = new Date().toISOString();
        state = 'FAILED';
        rawError = { name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '') };
        throw error;
      } finally {
        // This awaited capture is inside the original test.step callback. The
        // candidate cannot enter its next awaited business step until it ends.
        after = await snapshot(parsed.step_id, state === 'FAILED' ? 'failure-after' : 'after');
        const entry = { schema: 'workbench/step-observation-v1', observer_version: STEP_OBSERVER_VERSION,
          ...identity, step_id: parsed.step_id, raw_title: title, order, depth: parentDepth,
          started_at: startedAt, ended_at: new Date().toISOString(),
          business_started_at: businessStartedAt, business_ended_at: businessEndedAt,
          status: state,
          raw_error: rawError, captures: [before, after] };
        try { await fs.mkdir(directory, { recursive: true }); await fs.appendFile(evidencePath, `${JSON.stringify(entry)}\n`, 'utf8'); }
        catch (error) { /* Evidence failure must never replace a business assertion. */
          try { await fs.writeFile(path.join(directory, 'observation-write-error.txt'), String(error?.message || error)); } catch {} }
        depth = parentDepth;
      }
    }, options);
  };
  test.step.skip = originalStep.skip;
  return { evidencePath, restore: () => { test.step = originalStep; } };
}

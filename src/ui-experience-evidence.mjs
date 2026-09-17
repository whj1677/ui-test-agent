import { randomUUID } from 'node:crypto';
import { handoffLocator } from '../vendor/manual-ui/handoff_runtime.mjs';
import { withinHandles } from './within-locator.mjs';
import { PATTERN_VERSION } from './ui-patterns.mjs';

// A JSON/model response cannot manufacture an executor receipt. No raw DOM data exits.
const receipts = new WeakMap();
export function consumeExperienceReceipt(receipt) {
  const value = receipts.get(receipt);
  receipts.delete(receipt);
  return value;
}
async function sameScopedTarget(page, candidate) {
  const handles = await withinHandles(page, candidate.locator);
  try {
    return (
      handles.length === 1 &&
      (await handles[0].evaluate((e, old) => e === old && e.isConnected, candidate.handle))
    );
  } finally {
    await Promise.allSettled(handles.map((h) => h.dispose()));
  }
}

// The existing action/within guards remain the authority. This read-only observer
// never retries an action, changes a locator, arms a permission, or swallows its error.
export async function beginScopeExperience(page, candidate, guard) {
  if (candidate?.locator?.kind !== 'within' || !candidate.locator.target || !guard) return null;
  let eligible = false;
  try {
    eligible =
      (await handoffLocator(page, candidate.locator.target).count()) > 1 &&
      (await sameScopedTarget(page, candidate)) &&
      (await guard.evaluate((s) => s.valid()));
  } catch {
    /* Missing technical proof is not an action failure. */
  }
  if (!eligible) return null;
  // Discovery replaces/disposes its candidate handles during the next observation.
  const retained = await candidate.handle.evaluateHandle((e) => e);
  const captured = { ...candidate, handle: retained };
  const attempt = randomUUID();
  let finished = false;
  return async (error = null) => {
    if (finished) return null;
    finished = true;
    let outcome = 'UNKNOWN';
    try {
      if (
        String(error?.code ?? '').startsWith('WITHIN_') ||
        (await guard.evaluate((s) => s.blocked()))
      )
        outcome = 'COUNTEREXAMPLE';
      else if (
        !error &&
        (await guard.evaluate((s) => s.valid() && s.verifiedEvents() > 0)) &&
        (await sameScopedTarget(page, captured))
      )
        outcome = 'POSITIVE';
    } catch {
      /* Navigation/disappearance does not prove technical failure or success. */
    } finally {
      await retained.dispose().catch(() => {});
    }
    const receipt = Object.freeze({
      schema_version: 'ui-experience-receipt/v1',
      pattern_id: 'scoped_repeat',
      pattern_version: PATTERN_VERSION,
      attempt_id: attempt,
      outcome,
      completed_at: Date.now(),
      predicate: 'same_scoped_target_before_and_after_guarded_dispatch',
    });
    receipts.set(receipt, receipt);
    return receipt;
  };
}

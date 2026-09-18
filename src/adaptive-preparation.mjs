import { fail, semanticHash, now, relativeURL } from './common.mjs';
import { caseHash, planHash } from './plans.mjs';
import { INPUT_REVIEW_PROMPT, inputReviewInput, validateInputReview } from './input-review.mjs';
import { createAdaptivePlan } from './adaptive-plan.mjs';

// Mutable DOM observations are deliberately absent: they are evidence, not
// permission or a substitute for the confirmed business Case.
export const adaptiveContextHash = (state, c) =>
  semanticHash({
    case_hash: caseHash(c),
    target: state.target,
    authorization: state.authorization,
    auth_marker: state.auth_marker ?? null,
  });

function requirePermission(state, row) {
  if (state.authorization?.nonproduction !== true) fail('NONPRODUCTION_CONFIRMATION_REQUIRED');
  if (state.authorization?.writes !== false) fail('ADAPTIVE_READ_ONLY_REQUIRED');
  if (!row?.reviewed) fail('REVIEW_REQUIRED');
  if (!Array.isArray(row.attempts) || row.attempts.length) fail('CASE_ALREADY_EXECUTED');
}

function observedEntry(page, target) {
  if (!page || typeof page.url !== 'string' || !page.url.trim()) fail('ADAPTIVE_ENTRY_UNOBSERVED');
  if (page.login_page) fail('AUTH_REQUIRED');
  if (
    page.network_issues !== undefined &&
    (!Array.isArray(page.network_issues) || page.network_issues.length)
  )
    fail('ADAPTIVE_ENTRY_UNOBSERVED');
  // A snapshot must supply an observed absolute URL, not an invented route.
  let url;
  try {
    url = new URL(page.url);
  } catch {
    fail('ADAPTIVE_ENTRY_UNOBSERVED');
  }
  relativeURL(page.url, target);
  const path = url.pathname + url.search + url.hash;
  relativeURL(path, target);
  return { path };
}

/** Verify the prepared business contract, never approve or execute it.
 * entry is {path}, taken only from the authenticated shallow snapshot URL.
 * This guard also rejects a fixed/intent plan disguised by a copied receipt.
 */
export function requireAdaptiveAudit(state, c, row, plan) {
  requirePermission(state, row);
  const record = row.adaptive_preparation;
  if (
    !record ||
    row.case_id !== c.case_id ||
    !plan ||
    record.context_hash !== adaptiveContextHash(state, c) ||
    record.case_hash !== caseHash(c) ||
    record.plan_hash !== planHash(plan) ||
    !row.plan ||
    planHash(row.plan) !== planHash(plan) ||
    record.input_review?.issues?.length !== 0 ||
    row.input_review?.issues?.length !== 0 ||
    typeof record.entry?.path !== 'string' ||
    plan.entry_path !== record.entry.path
  )
    fail('ADAPTIVE_AUDIT_REQUIRED');
  validateInputReview(record.input_review, c);
  relativeURL(record.entry.path, state.target);
  if (observedEntry(row.navigation_start, state.target).path !== record.entry.path)
    fail('ADAPTIVE_AUDIT_REQUIRED');
  if (
    record.entry.path[0] !== '/' ||
    record.entry.path.startsWith('//') ||
    planHash(createAdaptivePlan(c, record.entry.path)) !== planHash(plan)
  )
    fail('ADAPTIVE_AUDIT_REQUIRED');
}

/** Called by the normal read-only test job after original-Case confirmation.
 * One fresh input review, then one shallow authenticated snapshot. No technical
 * plan approval, exploration, action dispatch, or model-generated plan here.
 * Controller owns subsequent authorization/automatic execution separately.
 */
export async function prepareAdaptive(controller, job, baseline, c) {
  const { store, browser } = controller;
  const inputHash = caseHash(c);
  controller.assertCurrent(job);
  const initial = await store.read(job.id);
  controller.assertCurrent(job);
  controller.assertInput(job, initial, baseline, c.case_id, inputHash);
  requirePermission(
    initial,
    initial.cases.find((r) => r.case_id === c.case_id),
  );
  const fingerprint = adaptiveContextHash(initial, c);
  let spent;
  const guard = (state) => {
    controller.assertCurrent(job);
    controller.assertInput(job, state, baseline, c.case_id, inputHash);
    if (caseHash(c) !== inputHash || adaptiveContextHash(state, c) !== fingerprint)
      fail('MODEL_INPUT_CHANGED');
    const row = state.cases.find((r) => r.case_id === c.case_id);
    requirePermission(state, row);
    if (!browser.active(job.id)) fail('BROWSER_REQUIRED');
    if (browser.authenticated !== true) fail('AUTH_REQUIRED');
    if (
      spent !== undefined &&
      (row.preparation_budget?.used !== spent || row.plan || row.plan_approved)
    )
      fail('MODEL_INPUT_CHANGED');
    return row;
  };
  const readCurrent = async () => {
    controller.assertCurrent(job);
    const state = await store.read(job.id);
    guard(state);
    return state;
  };
  const update = async (fn) => {
    controller.assertCurrent(job);
    await store.update(job.id, (state) => {
      const row = guard(state);
      fn(row, state);
      controller.assertInput(job, state, baseline, c.case_id, inputHash);
      controller.assertCurrent(job);
    });
    controller.assertCurrent(job);
  };
  guard(initial);
  // The same finite counter is shared with fixed/intent preparation. Changing
  // the channel, target, entry or case hash never silently refunds prior spend.
  await update((row, state) => {
    const used = row.preparation_budget?.used ?? (row.preparation_budget ? NaN : 0);
    if (!Number.isInteger(used) || used < 0) fail('PREPARATION_BUDGET_INVALID');
    if (used >= 3) fail('PLAN_REPAIR_LIMIT');
    row.preparation_budget = { case_hash: inputHash, used: used + 1, limit: 3 };
    spent = used + 1;
    if (row.plan)
      (row.plan_history ??= []).push({
        at: now(),
        plan: row.plan,
        approved: row.plan_approved,
        ...(row.adaptive_preparation ? { adaptive_preparation: row.adaptive_preparation } : {}),
      });
    row.plan = null;
    row.plan_approved = false;
    for (const key of [
      'approved_hash',
      'adaptive_preparation',
      'intent_preparation',
      'plan_audit',
      'navigation_start',
    ])
      delete row[key];
    row.status = 'NEEDS_MAPPING';
    row.mapping_reason = null;
    store.event(state, 'ADAPTIVE_PREPARATION_STARTED', {
      case_id: c.case_id,
      used: spent,
      limit: 3,
    });
  });
  const reviewedState = await readCurrent();
  const bundle = inputReviewInput(
    baseline.cases.find((x) => x.case_id === c.case_id),
    c,
    reviewedState.cases.find((r) => r.case_id === c.case_id),
  );
  guard(reviewedState);
  const reply = await controller.ask(job, INPUT_REVIEW_PROMPT, bundle, { phase: 'input_review' });
  await readCurrent();
  const inputReview = validateInputReview(reply, bundle);
  await update((row, state) => {
    row.input_review = { ...inputReview, at: now() };
    store.event(state, 'INPUT_REVIEW_FINISHED', {
      case_id: c.case_id,
      issues: inputReview.issues.length,
    });
    if (inputReview.issues.length) {
      row.issues = inputReview.issues;
      row.reviewed = false;
      row.status = 'NEEDS_REVIEW';
      row.mapping_reason = '输入存在待确认的问题；未准备自适应合同或执行。';
    }
  });
  if (inputReview.issues.length) return;
  await readCurrent();
  const page = await browser.snapshot();
  const state = await readCurrent();
  const entry = observedEntry(page, state.target);
  const plan = createAdaptivePlan(c, entry.path);
  const record = {
    context_hash: fingerprint,
    case_hash: inputHash,
    plan_hash: planHash(plan),
    entry,
    input_review: inputReview,
    at: now(),
  };
  await update((row, latest) => {
    row.adaptive_preparation = record;
    row.navigation_start = page;
    row.plan = plan;
    row.status = 'PLAN_REVIEW';
    row.plan_approved = false;
    delete row.approved_hash;
    row.mapping_reason = null;
    requireAdaptiveAudit(latest, c, row, plan);
    store.event(latest, 'ADAPTIVE_PLAN_PREPARED', {
      case_id: c.case_id,
      status: row.status,
      plan_hash: record.plan_hash,
      message: '只读业务合同已准备；执行授权由主控制器校验，本模块未批准或派发动作。',
    });
  });
}

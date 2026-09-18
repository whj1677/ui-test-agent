import { fail, keys, semanticHash, now } from './common.mjs';
import { caseHash, planHash, validatePlan } from './plans.mjs';
import { INPUT_REVIEW_PROMPT, inputReviewInput, validateInputReview } from './input-review.mjs';
import { INTENT_PLAN_PROMPT, isIntentPlan } from './intent-plan.mjs';
import { PLAN_AUDIT_PROMPT, auditInput, validatePlanAudit } from './plan-quality.mjs';
import { requirePlanSemantics } from './plan-semantics.mjs';
import { requireEntryNavigation } from './case-entry-url.mjs';

export const intentContextHash = (state, c) =>
  semanticHash({
    case_hash: caseHash(c),
    target: state.target,
    authorization: state.authorization,
    auth_marker: state.auth_marker ?? null,
  });
export function requireIntentAudit(state, c, row, plan) {
  const record = row.intent_preparation;
  if (
    !record ||
    record.context_hash !== intentContextHash(state, c) ||
    record.plan_hash !== planHash(plan) ||
    record.audit?.outcome !== 'ACCEPT' ||
    record.input_review?.issues?.length !== 0
  )
    fail('INTENT_AUDIT_REQUIRED');
  requireIntentEntry(plan, record.entry);
}
function requireIntentEntry(plan, entry) {
  if (plan.entry_path !== entry.path) fail('INTENT_ENTRY_UNOBSERVED');
  for (const step of plan.steps)
    for (const point of step.checkpoints)
      for (const item of [...point.actions, ...point.assertions])
        if (semanticHash(item.target.page) !== semanticHash(entry)) fail('INTENT_ENTRY_UNOBSERVED');
}

export async function prepareIntent(controller, job, baseline, c) {
  const { store, browser } = controller;
  let state = await store.read(job.id),
    row = state.cases.find((r) => r.case_id === c.case_id);
  const fingerprint = intentContextHash(state, c);
  const update = (fn) =>
    store.update(job.id, (s) => {
      controller.assertInput(job, s, baseline, c.case_id, caseHash(c));
      if (intentContextHash(s, c) !== fingerprint) fail('MODEL_INPUT_CHANGED');
      fn(
        s.cases.find((r) => r.case_id === c.case_id),
        s,
      );
    });
  // All channels share the same finite allowance. A new button is not a reset.
  await update((r) => {
    if (r.preparation_budget?.case_hash !== caseHash(c))
      r.preparation_budget = { case_hash: caseHash(c), used: 0, limit: 3 };
    if (r.preparation_budget.used >= 3) fail('PLAN_REPAIR_LIMIT');
    r.preparation_budget.used++;
    if (r.plan)
      (r.plan_history ??= []).push({ at: now(), plan: r.plan, approved: r.plan_approved });
    r.plan = null;
    r.plan_approved = false;
    delete r.approved_hash;
    delete r.intent_preparation;
  });
  const bundle = inputReviewInput(
    baseline.cases.find((x) => x.case_id === c.case_id),
    c,
    row,
  );
  const inputReview = validateInputReview(
    await controller.ask(job, INPUT_REVIEW_PROMPT, bundle, { phase: 'input_review' }),
    bundle,
  );
  await update((r, s) => {
    r.input_review = { ...inputReview, at: now() };
    store.event(s, 'INPUT_REVIEW_FINISHED', {
      case_id: c.case_id,
      issues: inputReview.issues.length,
    });
    if (inputReview.issues.length) {
      r.issues = inputReview.issues;
      r.reviewed = false;
      r.status = 'NEEDS_REVIEW';
      r.mapping_reason = '输入存在待确认的问题；未生成或执行计划。';
    }
  });
  if (inputReview.issues.length) return;
  controller.assertCurrent(job);
  const page = await browser.snapshot();
  if (page.login_page || !browser.authenticated) fail('AUTH_REQUIRED');
  const url = new URL(page.url);
  if (
    url.origin !== new URL(state.target).origin ||
    url.search ||
    url.hash ||
    page.network_issues?.length
  )
    fail('INTENT_ENTRY_UNOBSERVED');
  const h1 = browser.loginPage.locator('h1');
  if ((await h1.count()) !== 1 || !(await h1.isVisible())) fail('INTENT_ENTRY_UNOBSERVED');
  const entry = { path: url.pathname, heading: (await h1.innerText()).trim() };
  const context = {
    original: c,
    case_hash: caseHash(c),
    entry,
    pages: [page],
    target_origin: url.origin,
  };
  const reply = await controller.ask(job, INTENT_PLAN_PROMPT, context, { phase: 'plan' });
  if (reply.blocked === true) {
    keys(reply, ['blocked', 'reason'], ['blocked', 'reason']);
    if (typeof reply.reason !== 'string' || !reply.reason.trim()) fail('BLOCK_REASON_REQUIRED');
    await update((r) => {
      r.status = 'BLOCKED_MAPPING';
      r.mapping_reason = reply.reason.slice(0, 1200);
    });
    return;
  }
  keys(reply, ['plan'], ['plan']);
  const plan = reply.plan;
  if (!isIntentPlan(plan)) fail('INTENT_PLAN_REQUIRED');
  validatePlan(plan, c, state.target, { runtimeBinding: controller.runtimeBinding });
  requireIntentEntry(plan, entry);
  requireEntryNavigation(plan, c, state.target, page.url);
  requirePlanSemantics(plan, c, context);
  const prompt =
    PLAN_AUDIT_PROMPT +
    '\nEXPERIMENTAL VERSION OVERRIDE: for ui-agent-intent-plan/v1 ONLY, runtime_intent is an additional explicit exception to preobserved/source control grounding. Apply this supplied protocol instead of the fixed-plan-only exception: ' +
    INTENT_PLAN_PROMPT +
    '\nYour task is AUDIT, not generation: return the checks/issues audit schema specified above. Check identity and target names against original text, but future drawer/tab DOM need not be observed. Unknown business intent still requires clarification; unsupported interactions still reject.';
  const audit = validatePlanAudit(
    await controller.ask(job, prompt, auditInput(c, plan, context), { phase: 'plan_audit' }),
    c,
    plan,
  );
  await update((r, s) => {
    r.intent_preparation = {
      context_hash: fingerprint,
      plan_hash: planHash(plan),
      entry,
      input_review: inputReview,
      audit,
      at: now(),
    };
    r.navigation_start = page;
    r.plan_audit = { ...audit, plan_hash: planHash(plan) };
    r.status = audit.outcome === 'ACCEPT' ? 'PLAN_REVIEW' : 'BLOCKED_MAPPING';
    r.mapping_reason = audit.outcome === 'ACCEPT' ? null : '意图计划未通过语义审查，未批准或执行。';
    if (audit.outcome === 'ACCEPT') r.plan = plan;
    store.event(s, 'INTENT_PLAN_PREPARED', {
      case_id: c.case_id,
      status: r.status,
      plan_hash: planHash(plan),
      message: '意图候选审查结束；未来技术目标仍待运行时绑定，需人工核对。',
    });
  });
}

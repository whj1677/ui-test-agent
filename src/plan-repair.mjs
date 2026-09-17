import { semanticHash, now, fail, keys, nonempty, publicError } from './common.mjs';
import { caseHash, planHash, validatePlan, normalizePlanResponse, PLAN_PROMPT } from './plans.mjs';
import { planningInput } from './planning-input.mjs';
import { requireEntryNavigation } from './case-entry-url.mjs';
import { INPUT_REVIEW_PROMPT, inputReviewInput, validateInputReview } from './input-review.mjs';
import {
  PLAN_AUDIT_PROMPT,
  auditInput,
  validatePlanAudit,
  repairablePlanError,
} from './plan-quality.mjs';
import { generateStagedPlan, StagedValidationError } from './plan-staged.mjs';
import { BLOCK_AUDIT_PROMPT, blockAuditInput, validateBlockAudit } from './block-audit.mjs';
import { describePlanError } from './plan-feedback.mjs';
import { requirePlanSemantics } from './plan-semantics.mjs';

const MAX_REPAIRS = 2;
const incidental = new Set([
  'captured_at',
  'observed_at',
  'timestamp',
  'at',
  'job_id',
  'discovery_job_id',
  'navigation_job_id',
  'started_at',
  'finished_at',
]);
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => !incidental.has(k) && v !== undefined)
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function repairInputHash(state, c, row) {
  const context = stable(planningInput(state, c, row, caseHash(c)));
  // Memory is a derived model interpretation; duplicate captures and timestamps
  // are not new facts and must not replenish the candidate budget.
  delete context.discovery_memory;
  context.pages = [
    ...new Map(
      context.pages.map((p) => {
        const { provenance, ...fact } = p;
        return [semanticHash(fact), fact];
      }),
    ).entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
  return semanticHash(context);
}
export function requireCurrentAudit(state, c, row, plan = row.plan) {
  requireEntryNavigation(
    plan,
    c,
    state.target,
    row.navigation_start?.url ?? state.navigation_start?.url,
  );
  requireCompletePageEvidence(planningInput(state, c, row, caseHash(c)), plan);
  requirePlanSemantics(plan, c, planningInput(state, c, row, caseHash(c)));
  // Imported historical plans remain readable; every newly generated plan uses this gate.
  if (!row.self_repair) return;
  const fingerprint = repairInputHash(state, c, row);
  if (
    row.self_repair.input_hash !== fingerprint ||
    row.plan_audit?.input_hash !== fingerprint ||
    row.plan_audit?.plan_hash !== planHash(plan) ||
    row.plan_audit?.outcome !== 'ACCEPT'
  )
    fail('PLAN_AUDIT_REQUIRED');
}

export function requireCompletePageEvidence(context, plan) {
  if (!plan) return;
  const latest = new Map();
  for (const page of context.pages ?? []) latest.set(page.url, page);
  const routes = [
    plan.entry_path,
    ...(plan.steps ?? [])
      .flatMap((step) => [
        ...(step.actions ?? []),
        ...(step.checkpoints ?? []).flatMap((point) => point.actions ?? []),
      ])
      .filter((a) => a.op === 'navigate')
      .map((a) => a.value),
  ].filter(Boolean);
  for (const route of routes) {
    const url = new URL(route, context.target_origin).href;
    if ([...latest.values()].some((page) => page.url === url && page.network_issues?.length))
      fail('PAGE_EVIDENCE_INCOMPLETE');
  }
}

/** Candidate repair is strictly before execution. The browser's locator-only
 * runtime repair remains independent and never replays uncertain mutations. */
export async function prepareWithRepair(controller, job, baseline, c) {
  const { store } = controller,
    caseId = c.case_id,
    inputHash = caseHash(c);
  let state = await store.read(job.id),
    row = state.cases.find((r) => r.case_id === caseId);
  if (!row.preparation_budget && row.self_repair) {
    // Upgrade older persisted tasks conservatively; an observed-page change
    // must not erase already dispatched pre-upgrade candidates.
    const spent = [row.self_repair, ...(row.self_repair_history ?? [])].reduce(
      (sum, item) => sum + (item.rounds?.length ?? 0),
      0,
    );
    await store.update(job.id, (s) => {
      controller.assertInput(job, s, baseline, caseId, inputHash);
      s.cases.find((r) => r.case_id === caseId).preparation_budget = {
        case_hash: inputHash,
        used: Math.min(3, spent),
        limit: 3,
        migrated: true,
      };
    });
    state = await store.read(job.id);
    row = state.cases.find((r) => r.case_id === caseId);
  }
  const context = planningInput(state, c, row, inputHash),
    fingerprint = repairInputHash(state, c, row);
  const update = (fn) =>
    store.update(job.id, (s) => {
      controller.assertInput(job, s, baseline, caseId, inputHash);
      const item = s.cases.find((r) => r.case_id === caseId);
      if (repairInputHash(s, c, item) !== fingerprint) fail('MODEL_INPUT_CHANGED');
      fn(item, s);
    });
  const event = async (type, detail = {}) => {
    job.stage = type;
    await update((r, s) => store.event(s, type, { case_id: caseId, ...detail }));
  };
  if (row.self_repair?.input_hash !== fingerprint) {
    await update((r) => {
      r.self_repair_history ??= [];
      if (r.self_repair) r.self_repair_history.push(r.self_repair);
      r.self_repair = {
        input_hash: fingerprint,
        max_repairs: MAX_REPAIRS,
        repair_count: 0,
        rounds: [],
        outcome: 'PENDING',
      };
      r.plan_history ??= [];
      if (r.plan) r.plan_history.push({ at: now(), plan: r.plan, approved: r.plan_approved });
      r.plan = null;
      r.plan_approved = false;
      delete r.approved_hash;
      delete r.plan_audit;
    });
    state = await store.read(job.id);
    row = state.cases.find((r) => r.case_id === caseId);
  } else if (row.self_repair.outcome !== 'PENDING') {
    // A new click or reconfirming identical input is not a new repair budget.
    await update((r) => {
      if (r.self_repair.outcome === 'ACCEPTED') {
        const accepted =
          r.plan ??
          r.plan_history?.findLast(
            (p) => p.status === 'ACCEPTED' && planHash(p.plan) === r.plan_audit?.plan_hash,
          )?.plan;
        if (!accepted) fail('RETAINED_PLAN_MISSING');
        validatePlan(accepted, c, state.target);
        requireCurrentAudit(state, c, r, accepted);
        r.plan = accepted;
        r.plan_approved = false;
        r.status = 'PLAN_REVIEW';
      } else
        r.status =
          r.self_repair.outcome === 'NEEDS_CLARIFICATION' ? 'NEEDS_REVIEW' : 'BLOCKED_MAPPING';
    });
    await event('PLAN_REPAIR_RETAINED', {
      outcome: row.self_repair.outcome,
      message: '同一输入已有处理结果，保留原修复预算与记录。',
    });
    return;
  }
  const reviewBundle = inputReviewInput(
      baseline.cases.find((r) => r.case_id === caseId),
      c,
      row,
    ),
    reviewHash = semanticHash(stable(reviewBundle));
  if (row.input_review?.input_hash !== reviewHash) {
    await event('INPUT_REVIEW_STARTED');
    const reply = await controller.ask(job, INPUT_REVIEW_PROMPT, reviewBundle, {
        phase: 'input_review',
      }),
      review = validateInputReview(reply, reviewBundle);
    await controller.modelDecision(job, 'ACCEPTED', {
      code: 'INPUT_REVIEW_VALID',
      issues: review.issues.length,
    });
    await update((r, s) => {
      r.input_review = { input_hash: reviewHash, ...review, at: now() };
      store.event(s, 'INPUT_REVIEW_FINISHED', { case_id: caseId, issues: review.issues.length });
    });
    row = (await store.read(job.id)).cases.find((r) => r.case_id === caseId);
  }
  if (row.input_review.issues.length) {
    await update((r) => {
      r.issues = row.input_review.issues;
      r.reviewed = false;
      r.status = 'NEEDS_REVIEW';
      r.plan_approved = false;
      r.self_repair.outcome = 'NEEDS_CLARIFICATION';
      r.mapping_reason = '输入存在未解决的问题，需补充确认。';
    });
    return;
  }
  let feedback = null,
    previous = null;
  while (true) {
    controller.assertCurrent(job);
    state = await store.read(job.id);
    row = state.cases.find((r) => r.case_id === caseId);
    // New observations may create a new candidate input, never a fresh repair
    // allowance. Only an explicitly changed confirmed case gets a new budget.
    if (row.preparation_budget?.case_hash === inputHash && row.preparation_budget.used >= 3) {
      await finish(
        'EXHAUSTED',
        'PLAN_REPAIR_LIMIT',
        '本用例的三次候选机会已用完；重新采证或加载适配器不会重置预算。',
      );
      return;
    }
    const round = row.self_repair.rounds.length;
    if (round > MAX_REPAIRS) {
      await finish('EXHAUSTED', 'PLAN_REPAIR_LIMIT', '同一输入已用完两次修复预算。');
      return;
    }
    // Reserve the slot before dispatch; interruption/restart cannot replenish it.
    await update((r, s) => {
      if (r.preparation_budget?.case_hash !== inputHash) {
        if (r.preparation_budget) (r.preparation_budget_history ??= []).push(r.preparation_budget);
        r.preparation_budget = { case_hash: inputHash, used: 0, limit: 3 };
      }
      r.preparation_budget.used++;
      r.plan_approved = false;
      r.self_repair.repair_count = round;
      r.self_repair.rounds.push({
        round,
        plan_hash: null,
        status: 'PENDING',
        code: null,
        reason: '候选生成中',
        at: now(),
      });
      store.event(s, round ? 'PLAN_REPAIR_STARTED' : 'PLAN_PREPARATION_STARTED', {
        case_id: caseId,
        round,
        reason: feedback?.reason ?? null,
      });
    });
    const request = {
      ...context,
      ...(round
        ? {
            self_repair: {
              round,
              max_repairs: MAX_REPAIRS,
              previous_candidate: previous,
              feedback: feedback ?? {
                code: 'PREVIOUS_ATTEMPT_INTERRUPTED',
                reason: '上次候选处理被中断，原用例及权限不变。',
              },
              instructions:
                'Repair only supported plan defects. Never change original case, expectation, permission or assert success. Return a complete replacement plan using the same protocol.',
            },
          }
        : {}),
    };
    let response,
      candidate,
      code,
      reason,
      status,
      canRepair = false,
      raw,
      stagedError = null,
      errorDetail = null;
    if (controller.planningMode === 'staged') {
      try {
        raw = await generateStagedPlan(controller, job, request, c, state);
      } catch (error) {
        // Stage-local validation failures become INVALID candidates so the
        // bounded repair loop applies; transport/audit-log/stop errors propagate.
        if (!(error instanceof StagedValidationError)) throw error;
        stagedError = error;
        raw = { staged_failure: error.candidate };
      }
    } else raw = await controller.ask(job, PLAN_PROMPT, request, { phase: 'plan' });
    try {
      if (stagedError) throw stagedError;
      response = normalizePlanResponse(raw);
      if (response !== raw)
        await controller.diagnostic(job, {
          type: 'PLAN_RESPONSE_NORMALIZED',
          case_id: caseId,
          request_id: job.current_model?.request_id,
          phase: 'plan',
          rule: 'bare_v2_plan_envelope',
        });
      if (response.blocked === true) {
        keys(response, ['blocked', 'reason'], ['blocked', 'reason']);
        if (!nonempty(response.reason)) fail('BLOCK_REASON_REQUIRED');
      } else {
        keys(response, ['plan'], ['plan']);
        candidate = response.plan;
        validatePlan(candidate, c, state.target);
        requireEntryNavigation(
          candidate,
          c,
          state.target,
          row.navigation_start?.url ?? state.navigation_start?.url,
        );
        requireCompletePageEvidence(context, candidate);
        requirePlanSemantics(candidate, c, context);
      }
    } catch (error) {
      code = publicError(error);
      errorDetail = describePlanError(error, candidate, c, state.target);
      reason =
        code === 'CASE_ENTRY_NAVIGATION_REQUIRED'
          ? '入口URL只用于采证。原用例要求从首页点击菜单或导航；计划entry_path必须是本轮首页，并保留原步骤的点击，不能以navigate直达替代。'
          : errorDetail.reason;
      status = 'INVALID';
      canRepair = code === 'CASE_ENTRY_NAVIGATION_REQUIRED' || repairablePlanError(code);
    }
    const candidateHash = candidate ? semanticHash(candidate) : semanticHash(raw);
    const repeated = row.self_repair.rounds.some(
      (r) =>
        r.plan_hash === candidateHash &&
        ['INVALID', 'AUDIT_REJECTED', 'BLOCKED'].includes(r.status),
    );
    await controller.modelDecision(
      job,
      code ? 'REJECTED' : response.blocked ? 'BLOCKED' : 'ACCEPTED',
      {
        code: code ?? (response.blocked ? 'MODEL_MAPPING_BLOCKED' : 'PLAN_STRUCTURE_VALID'),
        reason: reason ?? response.reason ?? '候选结构校验完成，尚需语义核验和批准。',
        plan_hash: candidateHash,
      },
    );
    if (repeated) {
      const prior = row.self_repair.rounds.findLast((r) => r.plan_hash === candidateHash);
      await update((r, s) => {
        Object.assign(r.self_repair.rounds[round], {
          plan_hash: candidateHash,
          status: prior.status,
          code: 'PLAN_REPAIR_NO_PROGRESS',
          reason: prior.reason,
          at: now(),
        });
        store.event(s, 'PLAN_REPAIR_ATTEMPT', {
          case_id: caseId,
          round,
          code: 'PLAN_REPAIR_NO_PROGRESS',
          reason: prior.reason,
          status: prior.status,
          plan_hash: candidateHash,
        });
      });
      await finish('EXHAUSTED', 'PLAN_REPAIR_NO_PROGRESS', prior.reason);
      return;
    }
    if (!code && response.blocked) {
      await event('PLAN_AUDIT_STARTED', { round, kind: 'blocked_reason' });
      const reviewInput = blockAuditInput(context, response);
      const reviewReply = await controller.ask(job, BLOCK_AUDIT_PROMPT, reviewInput, {
        phase: 'blocked_audit',
      });
      let audited;
      try {
        audited = validateBlockAudit(reviewReply, reviewInput);
      } catch (error) {
        // An unsupported review does not replace the original obstacle, spend
        // another repair slot, or turn a valid blocked response into a job crash.
        if (
          !['INVALID_SCHEMA', 'BLOCK_AUDIT_INVALID', 'BLOCK_AUDIT_EVIDENCE_INVALID'].includes(
            error.code,
          )
        )
          throw error;
        audited = {
          outcome: 'BLOCKED',
          reason: response.reason,
          evidence_refs: [],
          validation_error: error.code,
        };
      }
      await update((r) => {
        r.self_repair.rounds[round].block_audit = controller.sanitizeDiagnostic(audited);
      });
      await controller.modelDecision(job, audited.validation_error ? 'REJECTED' : 'BLOCKED', {
        code: audited.validation_error ?? 'BLOCK_REASON_REVIEWED',
        reason: audited.reason,
      });
      code = 'MODEL_MAPPING_BLOCKED';
      reason = response.reason;
      status = audited.outcome === 'NEEDS_CLARIFICATION' ? 'NEEDS_CLARIFICATION' : 'BLOCKED';
      canRepair = audited.outcome === 'REPAIR';
      feedback = { ...audited, review_reason: audited.reason };
      await event('PLAN_AUDIT_FINISHED', { round, outcome: audited.outcome, reason });
    } else if (!code) {
      await event('PLAN_AUDIT_STARTED', { round });
      const audit = validatePlanAudit(
        await controller.ask(job, PLAN_AUDIT_PROMPT, auditInput(c, candidate, context), {
          phase: 'plan_audit',
        }),
        c,
        candidate,
      );
      await controller.modelDecision(job, audit.outcome === 'ACCEPT' ? 'ACCEPTED' : 'BLOCKED', {
        code: 'PLAN_SEMANTIC_AUDIT',
        reason: audit.outcome,
        plan_hash: candidateHash,
      });
      await update((r, s) => {
        r.plan_audit = { ...audit, input_hash: fingerprint, plan_hash: candidateHash, at: now() };
        store.event(s, 'PLAN_AUDIT_FINISHED', {
          case_id: caseId,
          round,
          outcome: audit.outcome,
          issues: audit.issues.length,
        });
      });
      code =
        audit.outcome === 'ACCEPT'
          ? 'PLAN_AUDIT_ACCEPTED'
          : audit.outcome === 'NEEDS_CLARIFICATION'
            ? 'ORACLE_UNCLEAR'
            : 'PLAN_SEMANTIC_GAP';
      reason = audit.issues.map((i) => i.reason).join('；') || '自动核验未发现缺口，等待批准执行。';
      status =
        audit.outcome === 'ACCEPT'
          ? 'ACCEPTED'
          : audit.outcome === 'NEEDS_CLARIFICATION'
            ? 'NEEDS_CLARIFICATION'
            : 'AUDIT_REJECTED';
      canRepair = audit.outcome === 'REPAIR';
      feedback = audit;
    }
    await update((r, s) => {
      Object.assign(r.self_repair.rounds[round], {
        plan_hash: candidateHash,
        status,
        code,
        ...(errorDetail ? { feedback: errorDetail } : {}),
        reason: controller.sanitizeDiagnostic(reason),
        ...(stagedError
          ? { staged_failure: controller.sanitizeDiagnostic(stagedError.candidate) }
          : {}),
        at: now(),
      });
      r.plan_history ??= [];
      if (candidate)
        r.plan_history.push({ at: now(), plan: candidate, approved: false, round, status });
      store.event(s, 'PLAN_REPAIR_ATTEMPT', {
        case_id: caseId,
        round,
        code,
        reason: controller.sanitizeDiagnostic(reason),
        status,
        plan_hash: candidateHash,
      });
    });
    if (status === 'ACCEPTED') {
      await update((r, s) => {
        r.plan = candidate;
        r.status = 'PLAN_REVIEW';
        r.self_repair.outcome = 'ACCEPTED';
        r.plan_approved = false;
        delete r.mapping_reason;
        store.event(s, 'PLAN_GENERATED', {
          case_id: caseId,
          plan_hash: candidateHash,
          repair_count: round,
        });
      });
      return;
    }
    if (status === 'NEEDS_CLARIFICATION') {
      await update((r) => {
        r.status = 'NEEDS_REVIEW';
        r.reviewed = false;
        r.self_repair.outcome = 'NEEDS_CLARIFICATION';
        r.mapping_reason = controller.sanitizeDiagnostic(reason);
        r.issues = (r.plan_audit?.issues ?? []).map((i) => ({
          code: i.code,
          step_id: i.step_id,
          message: i.reason,
        }));
      });
      return;
    }
    if (repeated || !canRepair || round === MAX_REPAIRS) {
      await finish(
        repeated || canRepair ? 'EXHAUSTED' : 'BLOCKED',
        repeated ? 'PLAN_REPAIR_NO_PROGRESS' : code,
        reason,
      );
      return;
    }
    previous = candidate ?? response ?? raw;
    feedback = {
      ...(feedback ?? {}),
      code,
      reason,
      ...(errorDetail ?? {}),
      ...(stagedError
        ? { stage: stagedError.candidate.phase, step_id: stagedError.candidate.step_id }
        : {}),
    };
  }
  async function finish(outcome, code, reason) {
    await update((r, s) => {
      r.status = 'BLOCKED_MAPPING';
      r.plan_approved = false;
      r.self_repair.outcome = outcome;
      r.mapping_reason = controller.sanitizeDiagnostic(reason);
      store.event(s, 'PLAN_REPAIR_EXHAUSTED', {
        case_id: caseId,
        code,
        reason: controller.sanitizeDiagnostic(reason),
        outcome,
      });
    });
  }
}

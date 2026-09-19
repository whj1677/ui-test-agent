import { publicError, fail, semanticHash } from './common.mjs';
import { scrubForLog } from './telemetry.mjs';

const hints = {
  PLAN_ASSERTION_UNSUPPORTED:
    'The rejected candidate was not executed or measured. Its extra row_count has no explicit original count requirement; a visible ID range alone does not require that these are the only rows. Remove only this ungrounded candidate assertion, preserve every original obligation and its identity/page measurements, then submit a new segment. Do not alter executed history, replay dispatched actions, infer expected counts from the page, or replace the count with another unsupported exact-row constraint. Existing replan and deadline limits still apply.',
  TABLE_SOURCE_UNGROUNDED:
    'The candidate assertion contains a value not grounded in the ORIGINAL current step or confirmed data. Repair the identified field, not the business expectation. If the original supplies a numeric value, table_cells supports check:"number" with that original number and a supported display suffix in actual text; do not invent an expected text unit from the page. Do not convert units, introduce tolerance, substitute observed values, drop required fields or replay executed actions. The revised candidate must pass all original grounding and semantic checks.',
  ADAPTIVE_NO_PROGRESS:
    'This assertion-only partial segment repeats an already executed measurement. Read progress.remaining_obligations and its reasons; propose the missing measurements instead. If none remain, declare complete:true with no repeated actions, subject to full audit. Do not change original expectations or replay any dispatched action. One reconsideration only, within the existing replan/deadline budget.',
  INVALID_LOCATOR:
    'Use a target_ref from the CURRENT target catalog. Legacy button/heading/table locators have kind:"role", role:"button"|"heading"|"table", name, exact:true; kind:"button" is invalid. Fix only the malformed target, retain operation and business goal.',
  ASSERTION_ORACLE_QUOTE_REQUIRED:
    'Use source_refs from the original CURRENT step obligations. Do not copy action wording as an expected quote. An action-only segment is valid; inspect and assert the expected result AFTER navigation.',
  ORACLE_COVERAGE_INCOMPLETE:
    'Some original obligations have no assertions. Preserve all original obligations; add their actual measurements. A heading/URL assertion can explicitly bind multiple applicable source_refs. Already executed navigation is NOT a measured assertion.',
  ADAPTIVE_MODEL_BLOCKED:
    'Reconsider the claimed blocker using current evidence. An observed, source-named menu can be expanded before its child exists. A literal same-origin path in THIS original action may be navigated without an observed link. Return a legal partial segment if possible; if evidence is still insufficient, return blocked again. Never guess an unseen target or broaden permission.',
};

function measurementKey({ obligation_ids, oracle_quote, ...measurement }) {
  // Relabelling an old measurement with missing IDs does not make it new evidence.
  return semanticHash(measurement);
}

export function missingAssertionFocus(progress, completed) {
  return {
    mode: 'missing_assertions',
    step_id: progress.step_id,
    obligations: structuredClone(progress.remaining_obligations),
    already_measured: structuredClone(completed.flatMap((part) => part.assertions)),
    issues: structuredClone(progress.issues),
    instruction:
      '只补当前缺失义务的尚未执行测量，actions必须为空。不要再输出already_measured中的测量，也不能仅更换source_refs。正文中的静态文字不一定在控件目录里，可依据当前观察使用现有精确text定位协议，仍须唯一性和独立审查。原预期不变；若缺口全齐则只提交无动作complete:true；无法找到有依据的新测量则明确blocked。',
  };
}

export function requireMissingAssertionFocus(fragment, focus) {
  if (!focus) return;
  if (fragment.actions.length) fail('ADAPTIVE_REPAIR_FOCUS_VIOLATION');
  const missing = new Set(focus.obligations.map((item) => item.id));
  if (!missing.size) {
    if (!fragment.complete || fragment.assertions.length) fail('ADAPTIVE_NO_PROGRESS');
    return;
  }
  if (!fragment.assertions.length) fail('ADAPTIVE_NO_PROGRESS');
  const measured = new Set(focus.already_measured.map(measurementKey));
  for (const assertion of fragment.assertions) {
    if (measured.has(measurementKey(assertion))) fail('ADAPTIVE_NO_PROGRESS');
    if (!assertion.obligation_ids.some((id) => missing.has(id)))
      fail('ADAPTIVE_REPAIR_FOCUS_VIOLATION');
  }
}

// Advisory feedback, never an acceptance receipt. Only a successfully executed
// cumulative audit can describe measured coverage; rejected candidates cannot.
export function adaptiveProgress(originalStep, completed, executedAudit) {
  const assertions = completed.flatMap((fragment) => fragment.assertions);
  const obligations = originalStep.obligations.map((obligation) => {
    const check = executedAudit?.checks.find(
      (item) => item.step_id === originalStep.step_id && item.obligation_id === obligation.id,
    );
    const measured = (check?.assertion_indices ?? []).filter((index) =>
      assertions[index]?.obligation_ids.includes(obligation.id),
    );
    const covered =
      check?.status === 'COVERED' &&
      measured.length > 0 &&
      measured.length === check.assertion_indices.length;
    return {
      ...obligation,
      status: covered ? 'MEASURED_COVERED' : 'PENDING',
      measured_assertion_refs: measured.map((index) => `A${index + 1}`),
      reason: check?.reason ?? '尚无成功执行且经审查的测量。',
    };
  });
  return {
    step_id: originalStep.step_id,
    completed_segments: completed.length,
    obligations,
    remaining_obligations: obligations.filter((item) => item.status === 'PENDING'),
    issues: executedAudit?.issues ?? [],
    instruction:
      '历史已测量不代表当前DOM或最终验收。优先补齐剩余原义务；检查全齐后声明无动作完成，仍须完整审查。不能从页面现值反推预期，不能重复已派发动作。',
  };
}

export function adaptiveCorrection(error, proposal, step, audit) {
  return {
    code: publicError(error),
    instruction:
      hints[error.code] ??
      'Correct only the reported technical defect. Preserve original inputs, scope, expected values and already executed actions. Do not replace a format error with an unsupported business blocker.',
    ...(error.plan_feedback ? { detail: error.plan_feedback } : {}),
    ...(typeof error.path === 'string' ? { field_path: error.path } : {}),
    ...(proposal === undefined ? {} : { invalid_response: scrubForLog(proposal) }),
    ...(audit ? { audit } : {}),
    source_action: step.source_action,
    source_expected: step.source_expected,
  };
}

export function canReconsiderBlock(current, step) {
  // Evidence for a possible safe route, NOT authorization to dispatch it.
  // Runtime permission/auth/origin guards and independent audit still apply.
  const action = step.source_action;
  if (/(?:https?:\/\/|\/)[^\s，。；]+/u.test(action)) return true;
  return (current.controls ?? []).some(
    (c) =>
      c.locator &&
      c.enabled !== false &&
      typeof c.name === 'string' &&
      c.name.length >= 2 &&
      action.includes(c.name) &&
      ['button', 'link', 'tab', 'menuitem', 'treeitem'].includes(c.role) &&
      !/保存|提交|删除|新建|创建|重置|登录|密码|密钥|\b(?:save|submit|delete|create|reset|login|password)\b/iu.test(
        c.name,
      ),
  );
}

export function isProtocolError(error) {
  if (error.code === 'DEEPSEEK_JSON_INVALID') return true;
  return /^(?:INVALID_|PROTOCOL_|ADAPTIVE_PROTOCOL_|ADAPTIVE_REFERENCE_|ADAPTIVE_SOURCE_|ASSERTION_(?:ORACLE_QUOTE_REQUIRED|OBLIGATIONS_REQUIRED|VALUE_REQUIRED|COUNT_INVALID|BOOL_INVALID)|LOCATOR_EXACT_REQUIRED)/u.test(
    error.code ?? '',
  );
}

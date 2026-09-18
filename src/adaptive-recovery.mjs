import { publicError } from './common.mjs';
import { scrubForLog } from './telemetry.mjs';

const hints = {
  INVALID_LOCATOR:
    'Use a target_ref from the CURRENT target catalog. Legacy button/heading/table locators have kind:"role", role:"button"|"heading"|"table", name, exact:true; kind:"button" is invalid. Fix only the malformed target, retain operation and business goal.',
  ASSERTION_ORACLE_QUOTE_REQUIRED:
    'Use source_refs from the original CURRENT step obligations. Do not copy action wording as an expected quote. An action-only segment is valid; inspect and assert the expected result AFTER navigation.',
  ORACLE_COVERAGE_INCOMPLETE:
    'Some original obligations have no assertions. Preserve all original obligations; add their actual measurements. A heading/URL assertion can explicitly bind multiple applicable source_refs. Already executed navigation is NOT a measured assertion.',
  ADAPTIVE_MODEL_BLOCKED:
    'Reconsider the claimed blocker using current evidence. An observed, source-named menu can be expanded before its child exists. A literal same-origin path in THIS original action may be navigated without an observed link. Return a legal partial segment if possible; if evidence is still insufficient, return blocked again. Never guess an unseen target or broaden permission.',
};

export function adaptiveCorrection(error, proposal, step, audit) {
  return {
    code: publicError(error),
    instruction:
      hints[error.code] ??
      'Correct only the reported technical defect. Preserve original inputs, scope, expected values and already executed actions. Do not replace a format error with an unsupported business blocker.',
    ...(error.plan_feedback ? { detail: error.plan_feedback } : {}),
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

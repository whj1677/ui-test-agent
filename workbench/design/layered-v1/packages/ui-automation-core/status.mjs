/**
 * L0 · 状态与失败码（契约的一部分，随包固定交付）
 *
 * 规则：
 * - 业务结论（PASS/FAIL）与前置/基础设施失败必须分开计数，禁止相互转写。
 * - BLOCKED_* 与 PRECHECK_FAILED 不得计为产品缺陷。
 */

export const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED_AUTH_REQUIRED: 'BLOCKED_AUTH_REQUIRED',
  BLOCKED_ENV_UNREACHABLE: 'BLOCKED_ENV_UNREACHABLE',
  PRECHECK_FAILED: 'PRECHECK_FAILED',
  SELECTOR_NOT_UNIQUE: 'SELECTOR_NOT_UNIQUE',
  SELECTOR_STALE: 'SELECTOR_STALE',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
};

/** 可重试 = 换个时机或修好环境后重跑有意义；不可重试 = 必须改资产。 */
export const RETRYABLE = new Set([
  STATUS.BLOCKED_AUTH_REQUIRED,
  STATUS.BLOCKED_ENV_UNREACHABLE,
  STATUS.PRECHECK_FAILED,
  STATUS.EVIDENCE_INCOMPLETE,
]);

/** 需要改 profile / 原语，而不是重跑。 */
export const NEEDS_ASSET_FIX = new Set([STATUS.SELECTOR_NOT_UNIQUE, STATUS.SELECTOR_STALE]);

/** 不可当作业务结论的终态。 */
export const NOT_BUSINESS = new Set([
  ...RETRYABLE,
  ...NEEDS_ASSET_FIX,
  STATUS.BUDGET_EXHAUSTED,
]);

export class PrimitiveError extends Error {
  constructor(status, message, observed = null) {
    super(message);
    this.name = 'PrimitiveError';
    this.status = status;
    this.observed = observed;
  }
}

export function ok(value) {
  return {ok: true, value};
}

export function blocked(status, message, observed = null) {
  return {ok: false, status, message, observed};
}

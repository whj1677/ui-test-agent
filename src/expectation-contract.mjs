import { AsyncLocalStorage } from 'node:async_hooks';
import { isDeepStrictEqual } from 'node:util';
import { fail, keys, nonempty, semanticHash } from './common.mjs';
import { stepCheckpoints } from './plan-steps.mjs';
import { validateTableExpectation } from './table-assertion.mjs';

// Private, execution-local authority. A candidate/serialized plan cannot install
// its own interpretation or share one with another concurrent run/step.
const active = new AsyncLocalStorage();
const trusted = new WeakSet();
const checks = new Set([
  'visible',
  'hidden',
  'text',
  'contains',
  'value',
  'selected_label',
  'aria_selected',
  'count',
  'row_count',
  'checked',
  'enabled',
  'number',
  'display_number',
  'focused',
  'has_class',
  'table_cells',
  'table_order',
  'table_unchanged',
  'unobstructed',
  'url_equals',
  'url_contains',
  'url_not_contains',
]);

export const EXPECTATION_INTERPRET_PROMPT = `Interpret ONLY the supplied original CURRENT step, before any candidate or page is seen. Return JSON {obligations:[{id,timing:"AFTER_ACTIONS"|"BEFORE_ACTIONS"|null,status:"INTERPRETED"|"UNINTERPRETED",reason,predicates:[{subject,check,expected}]}]}. Include every original obligation exactly once. INTERPRETED needs ALL conjuncts, identity, quantifier, relation, polarity and timing represented by predicates; otherwise UNINTERPRETED with no predicates. timing must retain the original checkpoint: AFTER_ACTIONS measures after all current-step actions, BEFORE_ACTIONS strictly before its first action. Mixed or unsupported timing is UNINTERPRETED, never guessed. subject describes the business field/region, NEVER a locator. No actual page values, invented rules or implicit defaults. This is a source interpretation, NOT evidence or permission. Future targets need not be visible. Checks use the existing UI assertion vocabulary: ${[...checks].join(',')}. expected uses the existing assertion data shape; omitted expectations for visible/hidden/unchanged/unobstructed use true. A table_cells expectation is {key_column,rows:[{key,position?,cells:[{column,check:"text"|"number",expected}]}],ordered,exact_rows}. position is one-based ABSOLUTE row index; by-key cell values or ordered membership do NOT prove absolute position. Preserve source-specified positions even if expressed differently from 第N行. Do not turn a list of positions into a closed total population, or a contains expectation into equality. table_order uses {field,column,direction,comparison}. Never infer expected values from IDs or future steps. Unrepresentable/business-ambiguous obligations stay UNINTERPRETED; do not call them covered.`;

export const EXPECTATION_REVIEW_PROMPT = `Independently compare the source-only interpretation against EVERY original obligation. You have no page, candidate or success trace. Return JSON {checks:[{id,status:"SUPPORTED"|"UNINTERPRETED",reason}]}, one per obligation. SUPPORTED requires ALL original conjuncts, polarity, object/field, absolute positions vs relative ordering, quantifiers and observation timing preserved, and no invented requirements. If a relation, field, timing or numeric meaning is lost, status MUST be UNINTERPRETED. Do not repair, weaken or approve a subset. Unrecognized wording is unknown, never no obligation. This review is not execution evidence.`;

function sourceIdentity(original) {
  return semanticHash(original);
}
export function interpretationInput(original) {
  return {
    original: structuredClone(original),
    vocabulary: [...checks],
    page_evidence: 'NOT_PROVIDED',
  };
}
export function validateInterpretation(reply, original) {
  keys(reply, ['obligations'], ['obligations']);
  if (!Array.isArray(reply.obligations) || reply.obligations.length !== original.obligations.length)
    fail('EXPECTATION_INTERPRETATION_INVALID');
  const seen = new Set();
  for (const row of reply.obligations) {
    keys(
      row,
      ['id', 'status', 'timing', 'reason', 'predicates'],
      ['id', 'status', 'timing', 'reason', 'predicates'],
    );
    if (
      !original.obligations.some((o) => o.id === row.id) ||
      seen.has(row.id) ||
      !nonempty(row.reason) ||
      !['INTERPRETED', 'UNINTERPRETED'].includes(row.status) ||
      (row.status === 'INTERPRETED' && !['AFTER_ACTIONS', 'BEFORE_ACTIONS'].includes(row.timing)) ||
      !Array.isArray(row.predicates) ||
      row.predicates.length > 20 ||
      (row.status === 'INTERPRETED') !== row.predicates.length > 0
    )
      fail('EXPECTATION_INTERPRETATION_INVALID');
    seen.add(row.id);
    for (const p of row.predicates) {
      keys(p, ['subject', 'check', 'expected'], ['subject', 'check', 'expected']);
      if (!nonempty(p.subject) || !checks.has(p.check)) fail('EXPECTATION_INTERPRETATION_INVALID');
      if (p.check === 'table_cells') validateTableExpectation(p.expected);
      else if (['visible', 'hidden', 'unobstructed', 'table_unchanged'].includes(p.check)) {
        if (p.expected !== true) fail('EXPECTATION_INTERPRETATION_INVALID');
      } else if (['aria_selected', 'checked', 'enabled', 'focused'].includes(p.check)) {
        if (typeof p.expected !== 'boolean') fail('EXPECTATION_INTERPRETATION_INVALID');
      } else if (['count', 'row_count', 'number', 'display_number'].includes(p.check)) {
        if (typeof p.expected !== 'number' || !Number.isFinite(p.expected))
          fail('EXPECTATION_INTERPRETATION_INVALID');
      } else if (p.check !== 'table_order' && typeof p.expected !== 'string')
        fail('EXPECTATION_INTERPRETATION_INVALID');
      if (
        p.check === 'table_cells' &&
        (!Array.isArray(p.expected?.rows) ||
          !p.expected.rows.length ||
          p.expected.rows.some(
            (r) =>
              !nonempty(r.key) ||
              (r.position !== undefined && (!Number.isInteger(r.position) || r.position < 1)),
          ))
      )
        fail('EXPECTATION_INTERPRETATION_INVALID');
    }
  }
  return structuredClone(reply);
}

export function approveInterpretation(reply, review, original) {
  const draft = validateInterpretation(reply, original);
  keys(review, ['checks'], ['checks']);
  if (!Array.isArray(review.checks) || review.checks.length !== draft.obligations.length)
    fail('EXPECTATION_REVIEW_INVALID');
  const seen = new Set();
  for (const row of review.checks) {
    keys(row, ['id', 'status', 'reason'], ['id', 'status', 'reason']);
    if (
      seen.has(row.id) ||
      !draft.obligations.some((o) => o.id === row.id) ||
      !['SUPPORTED', 'UNINTERPRETED'].includes(row.status) ||
      !nonempty(row.reason)
    )
      fail('EXPECTATION_REVIEW_INVALID');
    seen.add(row.id);
  }
  const contract = {
    source_hash: sourceIdentity(original),
    original_expected: original.expected,
    obligations: draft.obligations.map((o) => ({
      ...o,
      status:
        o.status === 'INTERPRETED' &&
        review.checks.find((r) => r.id === o.id).status === 'SUPPORTED'
          ? 'INTERPRETED'
          : 'UNINTERPRETED',
    })),
    review: structuredClone(review),
    evidence_of_pass: false,
  };
  // Deep freeze prevents a later planner/auditor from weakening installed obligations.
  const freeze = (v) => {
    if (v && typeof v === 'object') {
      Object.values(v).forEach(freeze);
      Object.freeze(v);
    }
    return v;
  };
  freeze(contract);
  trusted.add(contract);
  return contract;
}

export function withExpectationContract(contract, operation) {
  if (!trusted.has(contract)) fail('EXPECTATION_CONTRACT_UNTRUSTED');
  return active.run(contract, operation);
}
export function currentExpectationContract(original) {
  const value = active.getStore();
  return value?.source_hash === sourceIdentity(original) ? value : null;
}
export function interpretedPosition(expected, key, position) {
  const value = active.getStore();
  return (
    value?.original_expected === expected &&
    value.obligations.some(
      (o) =>
        o.status === 'INTERPRETED' &&
        o.predicates.some(
          (p) =>
            p.check === 'table_cells' &&
            p.expected.rows.some((r) => r.key === key && r.position === position),
        ),
    )
  );
}

function proves(assertion, predicate) {
  if (assertion.check !== predicate.check) return false;
  const wanted = predicate.expected,
    actual = assertion.expected ?? true;
  if (predicate.check === 'table_cells') {
    return (
      actual.key_column === wanted.key_column &&
      (!wanted.ordered || actual.ordered) &&
      (!wanted.exact_rows || (actual.exact_rows && actual.rows.length === wanted.rows.length)) &&
      wanted.rows.every((row, index) => {
        const got = actual.rows.find((r) => r.key === row.key);
        return (
          got &&
          (row.position === undefined || got.position === row.position) &&
          (!wanted.ordered || actual.rows[index]?.key === row.key) &&
          (row.cells ?? []).every((cell) => got.cells.some((c) => isDeepStrictEqual(c, cell)))
        );
      })
    );
  }
  return isDeepStrictEqual(actual, wanted);
}

export function contractIssues(original, step) {
  const contract = currentExpectationContract(original);
  if (!contract) return [];
  const issues = [];
  const points = stepCheckpoints(step);
  const actionPoints = points
    .map((p, i) => ((p.actions ?? []).length ? i : -1))
    .filter((i) => i >= 0);
  const firstAction = actionPoints[0] ?? Infinity,
    lastAction = actionPoints.at(-1) ?? -1;
  for (const o of contract.obligations) {
    if (o.status === 'UNINTERPRETED')
      issues.push({
        code: 'PLAN_OBLIGATION_UNINTERPRETED',
        source_ref: o.id,
        state: 'UNINTERPRETED',
        reason: '原义务未获完整解释，不能将抽取为空当作已覆盖。',
      });
    else
      for (const predicate of o.predicates) {
        if (
          !points
            .filter((p, i) => (o.timing === 'BEFORE_ACTIONS' ? i < firstAction : i >= lastAction))
            .flatMap((p) => p.assertions)
            .some((a) => a.obligation_ids?.includes(o.id) && proves(a, predicate))
        )
          issues.push({
            code: 'PLAN_CONTRACT_EVIDENCE_INSUFFICIENT',
            source_ref: o.id,
            state: 'EVIDENCE_INSUFFICIENT',
            reason: '缺少冻结原义务要求的测量；按键读值、相对顺序或候选声明不能替代原关系。',
            predicate,
          });
      }
  }
  return issues;
}

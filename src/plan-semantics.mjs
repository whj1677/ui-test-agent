import { stepActions, stepAssertions } from './plan-steps.mjs';
import { semanticHash } from './common.mjs';
import { planLocatorEntries } from './plan-feedback.mjs';
import { requireCaseNamedEvidence, validateCaseNamedPlan } from './case-named.mjs';
import { extractExpectationRanges } from './expectation-coverage.mjs';
import { completionIssues } from './completion-evidence.mjs';
import { displayNumber, displayUnit, sourceDisplayUnits } from './table-assertion.mjs';
import { extractRowPositions } from './table-position.mjs';
import { sourceTableCounts, hasTablePositionPhrase } from './table-cardinality.mjs';
import { selectionTimingGaps } from './selection-timing.mjs';

function reject(code, field_path, reason) {
  throw Object.assign(new Error(code), {
    code,
    status: 400,
    plan_feedback: { field_path, reason },
  });
}
const textValues = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? [String(value)]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(textValues)
      : [];
const cardinality = (text) =>
  /(?:\d+|[零一二两三四五六七八九十百]+)\s*(?:条|行|个|项|records?\b|rows?\b|items?\b|results?\b)|(?:共|总计|数量|条数|行数|count|total)\s*(?:为|是|:|：|=|of|is)?\s*\d+|为空|无记录|没有记录|empty|no (?:rows|records|results)/iu.test(
    text,
  );

// Narrow deterministic counterexample guards, not a claim to solve natural-language equivalence.
// Other extra assertions/compound expectations still require the independent semantic audit.
export function requirePlanSemantics(plan, c, context = {}, { complete = true } = {}) {
  if (!plan) return;
  validateCaseNamedPlan(plan, c);
  const source = textValues({
    data: c.data,
    test_data: c.test_data,
    preconditions: c.preconditions,
    steps: (c.steps ?? []).map((s) => ({ action: s.action, expected: s.expected })),
  }).join('\n');
  const explicitRangeIds = new Set(
    (c.steps ?? []).flatMap((step) =>
      extractExpectationRanges(step.expected).flatMap((range) => range.ids),
    ),
  );
  for (const { locator, path } of planLocatorEntries(plan)) {
    requireCaseNamedEvidence(locator, context);
    if (
      ['row', 'cell'].includes(locator?.kind) &&
      !source.includes(locator.key.value) &&
      !explicitRangeIds.has(locator.key.value)
    )
      reject(
        'PLAN_ROW_IDENTITY_UNSUPPORTED',
        path + '.key.value',
        '行身份必须来自原用例或已确认测试数据；页面观察只能提供定位事实，不能自行挑选业务记录。',
      );
    if (locator?.kind === 'within') {
      const identity = locator.scope.name ?? locator.scope.heading;
      const business = locator.scope.role !== 'dialog';
      const literal = source.includes(identity);
      const namedParts = locator.scope.name?.split(/\s+/).filter(Boolean) ?? [];
      if (
        business &&
        !literal &&
        !(
          namedParts.length > 1 &&
          namedParts.every((word) => word.length > 1 && source.includes(word))
        )
      )
        reject(
          'PLAN_SCOPE_IDENTITY_UNSUPPORTED',
          path + '.scope',
          '容器身份必须绑定原用例的完整对象，不得根据页面选择另一个或近似名称对象。',
        );
      const observed = (context.pages ?? [])
        .flatMap((p) => p.controls ?? [])
        .map((c) => c.locator)
        .filter((l) => l?.kind === 'within');
      const known = observed.some((l) => semanticHash(l) === semanticHash(locator));
      const headingTemplate =
        business &&
        literal &&
        locator.scope.heading !== undefined &&
        observed.some(
          (l) =>
            l.scope.role === locator.scope.role &&
            l.scope.heading !== undefined &&
            semanticHash(l.target ?? null) === semanticHash(locator.target ?? null),
        );
      if (!known && !headingTemplate)
        reject(
          'PLAN_SCOPE_EVIDENCE_MISSING',
          path,
          '需要已观察的完整范围定位，或相同结构/内部目标与原文完整标题的列表项模板；不能猜测范围或后端ID。',
        );
      if (
        path.startsWith('plan.cleanup') &&
        business &&
        plan.cleanup?.identity &&
        identity !== plan.cleanup.identity
      )
        reject(
          'CLEANUP_SCOPE_IDENTITY_MISMATCH',
          path + '.scope',
          '清理范围必须与已声明归属身份精确相同，不能选择同名前缀或种子记录。',
        );
    }
  }
  const tableLocators = new Set(
    (context.pages ?? [])
      .flatMap((p) => p.controls ?? [])
      .filter((v) => v.role === 'table' && v.locator)
      .map((v) => JSON.stringify(v.locator)),
  );
  for (const [i, step] of (plan.steps ?? []).entries()) {
    const original = c.steps[i];
    if (context.adaptive_readonly) {
      const timingGaps = selectionTimingGaps(original, step);
      if (timingGaps.length)
        reject(
          'ASSERTION_SELECTION_BEFORE_ACTION',
          `plan.steps[${i}].assertions`,
          timingGaps.map((g) => g.reason).join('\n'),
        );
    }
    // Partial execution may defer missing coverage, never the validity of a
    // supplied locator/value/assertion. The default fixed-plan path stays full.
    if (complete !== false) {
      const nextTarget = plan.steps
        .slice(i + 1)
        .flatMap(stepActions)
        .find((a) =>
          ['click', 'fill', 'select', 'check', 'uncheck', 'press'].includes(a?.op),
        )?.target;
      const issue = completionIssues(original, step, {
        adaptiveReadonly: context.adaptive_readonly,
        nextTarget,
        fieldPath: `plan.steps[${i}]`,
      })[0];
      if (issue) reject(issue.code, issue.field_path, issue.reason);
    }
    for (const [j, assertion] of stepAssertions(step).entries()) {
      const field = `plan.steps[${i}].assertions_flat[${j}]`;
      if (
        ['row', 'cell', 'within'].includes(assertion.target?.kind) &&
        ['text', 'contains', 'number'].includes(assertion.check) &&
        /^[-+]?\d+(?:\.\d+)?$/.test(String(assertion.expected))
      ) {
        const originalNumbers = c.steps[i].expected.match(/[-+]?\d+(?:\.\d+)?/g) ?? [];
        if (
          originalNumbers.length &&
          !originalNumbers.some((n) => Number(n) === Number(assertion.expected))
        )
          reject(
            'PLAN_ASSERTION_VALUE_UNSUPPORTED',
            field + '.expected',
            '行内数值断言与原步骤明确写出的数值不一致；必须保留原预期，不能复制页面实际值使测试通过。',
          );
      }
      if (
        assertion.check === 'row_count' &&
        !(context.adaptive_readonly
          ? sourceTableCounts(original.expected).includes(assertion.expected)
          : cardinality(c.steps[i].expected))
      )
        reject(
          'PLAN_ASSERTION_UNSUPPORTED',
          field,
          '当前原步骤没有支持此精确行数的字面数量依据；第一行、前两行、字段个数、至少/条件数量都不是全表行数。不能复制观察数量或改变原数量；修正未执行候选，保留原位置、字段和身份后重新审查。',
        );
      if (context.adaptive_readonly) {
        const sourceExpected = original.expected;
        if (
          (assertion.target?.target?.kind === 'definition' || assertion.target?.kind === 'cell') &&
          ['text', 'contains'].includes(assertion.check) &&
          displayUnit(assertion.expected)
        ) {
          const unit = displayUnit(assertion.expected);
          const source = {
            expected: sourceExpected,
            ...(c.data !== undefined ? { data: c.data } : {}),
            ...(c.test_data !== undefined ? { test_data: c.test_data } : {}),
          };
          if (!sourceDisplayUnits(displayNumber(assertion.expected), source).includes(unit))
            reject(
              'PLAN_DISPLAY_UNIT_UNSUPPORTED',
              field,
              '原步骤未支持候选的单位文本。同一已绑定definition数值字段用display_number；cell数值用同表同键同列table_cells内number及原数值。明确单位仍用原文文本。不能换定位器来规避同字段来源校验，不复制观察作为预期，不重放动作。',
            );
        }
        const unsupported = [];
        // A literal ID range guarantees membership, not a closed population or
        // row order. These are necessary guards for this bounded source grammar,
        // not a general natural-language approval of every other matrix.
        if (assertion.check === 'table_cells') {
          if (
            assertion.expected.exact_rows &&
            (extractExpectationRanges(sourceExpected).length ||
              extractRowPositions(sourceExpected).length ||
              hasTablePositionPhrase(sourceExpected)) &&
            !sourceTableCounts(sourceExpected).includes(assertion.expected.rows.length)
          )
            unsupported.push('expected.exact_rows');
          if (
            extractExpectationRanges(sourceExpected).length &&
            assertion.expected.ordered &&
            assertion.expected.rows.length > 1 &&
            (!/依次|升序|降序|按序|按.{0,8}顺序|in (?:this|that|the following) order|ascending|descending/iu.test(
              sourceExpected,
            ) ||
              /(?:不|无需|无须|不必).{0,8}(?:依次|升序|降序|顺序|排序)|(?:no|not|without).{0,12}(?:order|ascending|descending)/iu.test(
                sourceExpected,
              ))
          )
            unsupported.push('expected.ordered');
        }
        if (
          ['text', 'contains'].includes(assertion.check) &&
          /第\s*\d+\s*\/\s*\d+\s*页/u.test(assertion.expected)
        ) {
          const sourceCounts = [
            ...sourceExpected.matchAll(/(?<![A-Za-z0-9_.])(\d+)\s*(?:条|行|records?\b|rows?\b)/giu),
          ].map((m) => Number(m[1]));
          const totals = [...assertion.expected.matchAll(/(?:共|总计)\s*(\d+)\s*条/gu)].map((m) =>
            Number(m[1]),
          );
          if (totals.some((n) => !sourceCounts.includes(n)))
            unsupported.push('expected.pagination_total');
        }
        if (unsupported.length)
          reject(
            'PLAN_TABLE_CONSTRAINT_UNSUPPORTED',
            field,
            `候选增加了当前原步骤未支持的约束：${unsupported.join('、')}。编号范围仅要求成员可见，不自动要求仅这些行或按此顺序；页码要求也不自动要求当前观察的总记录数。只修正尚未执行候选的这些额外约束（可用原页码短语contains），保留全部原身份/字段/页码/检查时机及来源，并重新审查；不能改原预期或重放动作。`,
          );
      }
      const wholeTable =
        assertion.target?.role === 'table' || tableLocators.has(JSON.stringify(assertion.target));
      if (
        wholeTable &&
        ['text', 'contains', 'number'].includes(assertion.check) &&
        /^\s*[-+]?\d+(?:[.,]\d+)?\s*(?:元|%|kWh)?\s*$/u.test(String(assertion.expected))
      )
        reject(
          'PLAN_RECORD_FIELD_UNBOUND',
          field + '.target',
          '整张表包含某个数值不能证明指定记录的指定字段正确。使用 cell 将原用例记录身份、列名与预期值绑定在同一单元格；不得改用页面实际值作为预期。',
        );
    }
  }
}

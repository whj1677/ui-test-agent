import { stepActions, stepAssertions } from './plan-steps.mjs';
import { semanticHash } from './common.mjs';
import { planLocatorEntries } from './plan-feedback.mjs';
import { requireCaseNamedEvidence, validateCaseNamedPlan } from './case-named.mjs';

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
export function requirePlanSemantics(plan, c, context = {}) {
  if (!plan) return;
  validateCaseNamedPlan(plan, c);
  const source = textValues({
    data: c.data,
    test_data: c.test_data,
    preconditions: c.preconditions,
    steps: (c.steps ?? []).map((s) => ({ action: s.action, expected: s.expected })),
  }).join('\n');
  for (const { locator, path } of planLocatorEntries(plan)) {
    requireCaseNamedEvidence(locator, context);
    if (['row', 'cell'].includes(locator?.kind) && !source.includes(locator.key.value))
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
    for (const obligation of original.obligations ?? []) {
      if (
        !/(?:页面|当前|浏览器)\s*URL|地址栏|(?:current|browser|page)\s+URL/iu.test(obligation.text)
      )
        continue;
      const proofs = stepAssertions(step).filter((a) => a.obligation_ids?.includes(obligation.id));
      if (!proofs.some((a) => ['url_equals', 'url_contains', 'url_not_contains'].includes(a.check)))
        reject(
          'PLAN_URL_UNPROVEN',
          `plan.steps[${i}].assertions`,
          '原预期要求验证当前地址栏。标题或页面可见不能证明URL；使用url_equals/url_contains/url_not_contains并保留原分项。',
        );
    }
    const optionalSource =
      /(?:若|如果|if).*?(?:出现|显示|present|visible)/iu.test(original.action) &&
      /(?:知道了|关闭|取消|got it|close|cancel)/iu.test(original.action) &&
      /(?:未|不|否则|otherwise|else)/iu.test(original.action);
    if (optionalSource && !stepActions(step).some((a) => a?.op === 'dismiss_optional'))
      reject(
        'PLAN_CONDITIONAL_UNSUPPORTED',
        `plan.steps[${i}].actions`,
        '原步骤要求提示出现则关闭、未出现则继续；不能删去条件动作或改成无条件点击/等待。使用dismiss_optional，由原文精确标题和按钮名定义条件，保留两个分支共同的原预期。',
      );
    const nextTarget = plan.steps
      .slice(i + 1)
      .flatMap(stepActions)
      .find((a) =>
        ['click', 'fill', 'select', 'check', 'uncheck', 'press'].includes(a?.op),
      )?.target;
    for (const obligation of original.obligations ?? []) {
      if (
        !/(?:无|没有|不|未).*?(?:遮挡|阻挡)|unobstructed|not obstruct|not block/iu.test(
          obligation.text,
        )
      )
        continue;
      const proofs = stepAssertions(step).filter((a) => a.obligation_ids?.includes(obligation.id));
      if (!proofs.some((a) => a.check === 'unobstructed'))
        reject(
          'PLAN_OBSTRUCTION_UNPROVEN',
          `plan.steps[${i}].assertions`,
          'visible/hidden/count不能证明操作不被遮挡。用unobstructed对后续原操作的准确已观察目标做当前命中验证，不修改原预期。',
        );
      if (
        optionalSource &&
        (!nextTarget ||
          !proofs.some(
            (a) =>
              a.check === 'unobstructed' && semanticHash(a.target) === semanticHash(nextTarget),
          ))
      )
        reject(
          'PLAN_OBSTRUCTION_UNPROVEN',
          `plan.steps[${i}].assertions`,
          '条件提示后的无遮挡断言必须绑定后续原操作的同一个目标（含业务行身份）；表格或其他菜单命中不能代替该目标。',
        );
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
      if (assertion.check === 'row_count' && !cardinality(c.steps[i].expected))
        reject(
          'PLAN_ASSERTION_UNSUPPORTED',
          field,
          '原步骤未要求记录总数，不能把当前观察到的行数增加为验收条件；删除额外数量断言，保留原要求的字段和记录身份。',
        );
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

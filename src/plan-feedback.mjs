import { validateLocator, validateAssertion, validateAction } from './plans.mjs';

const kinds = [
  'role',
  'testid',
  'label',
  'placeholder',
  'text',
  'css',
  'row',
  'cell',
  'within',
  'case_named',
];
const schema = {
  role: '{kind:"role",role:"button|link|heading|table|...",name:string,exact:true}',
  simple: '{kind:"testid|label|placeholder|text|css",value:string,exact:true}',
  row: '{kind:"row",table:baseLocator,key:{column:string,value:string},target?:baseLocator}',
  cell: '{kind:"cell",table:baseLocator,key:{column:string,value:string},column:string}',
  within:
    '{kind:"within",scope:{role:"article|listitem|dialog",name:string OR heading:string,exact:true},target?:baseLocator}',
  case_named:
    '{kind:"case_named",source_step_id:string,target:exactLabelOrRole,control_type:"text|number|textarea|select|checkbox|button",guard:{path,page_heading,step}}; CASE_NAMED_UNOBSERVED intent only, never observed/cleanup evidence',
};

// Visit only protocol fields. Never interpolate arbitrary model keys/values into diagnostics.
export function planLocatorEntries(plan) {
  const entries = [];
  const list = (values, path, actions = false) => {
    if (!Array.isArray(values)) return;
    values.forEach((v, i) => {
      if (!actions || !['navigate', 'reload'].includes(v?.op))
        entries.push({ locator: v?.target, path: `${path}[${i}].target` });
      if (actions && v?.repair_anchor !== undefined)
        entries.push({ locator: v.repair_anchor, path: `${path}[${i}].repair_anchor` });
    });
  };
  list(plan?.preconditions, 'plan.preconditions');
  for (const [i, step] of (Array.isArray(plan?.steps) ? plan.steps : []).entries()) {
    const prefix = `plan.steps[${i}]`;
    list(step?.actions, prefix + '.actions', true);
    list(step?.assertions, prefix + '.assertions');
    for (const [j, point] of (Array.isArray(step?.checkpoints) ? step.checkpoints : []).entries()) {
      list(point?.actions, `${prefix}.checkpoints[${j}].actions`, true);
      list(point?.assertions, `${prefix}.checkpoints[${j}].assertions`);
    }
  }
  list(plan?.cleanup?.actions, 'plan.cleanup.actions', true);
  list(plan?.cleanup?.assertions, 'plan.cleanup.assertions');
  list(plan?.cleanup?.ownership, 'plan.cleanup.ownership');
  return entries;
}

export function describePlanError(error, plan, original, base) {
  if (error.plan_feedback) return error.plan_feedback;
  for (const entry of planLocatorEntries(plan)) {
    const candidates = ['row', 'cell'].includes(entry.locator?.kind)
      ? [
          { locator: entry.locator.table, path: entry.path + '.table' },
          ...(entry.locator.target
            ? [{ locator: entry.locator.target, path: entry.path + '.target' }]
            : []),
          entry,
        ]
      : entry.locator?.kind === 'within' && entry.locator.target
        ? [{ locator: entry.locator.target, path: entry.path + '.target' }, entry]
        : [entry];
    for (const { locator, path } of candidates) {
      try {
        validateLocator(locator);
      } catch (failure) {
        if (failure.code !== error.code) continue;
        const invalidKind = !kinds.includes(locator?.kind);
        return {
          field_path: path + (invalidKind ? '.kind' : ''),
          actual_type: locator?.kind === undefined ? 'missing' : typeof locator.kind,
          allowed_kinds: kinds,
          expected_schema: schema,
          reason: `${path}${invalidKind ? '.kind' : ''} 定位格式不合法；kind 必须使用固定枚举，button/link/heading 等是 role 的值，不是 kind。表格用row/cell，卡片/列表/弹窗用单层within；范围身份name/heading二选一，内部必须为基础定位，不能增加索引或任意选择器。`,
        };
      }
    }
  }
  const parts = [];
  const collect = (values, prefix, action = false, step) => {
    if (Array.isArray(values))
      values.forEach((value, i) => parts.push({ value, path: `${prefix}[${i}]`, action, step }));
  };
  collect(plan?.preconditions, 'plan.preconditions');
  for (const [i, step] of (Array.isArray(plan?.steps) ? plan.steps : []).entries()) {
    const prefix = `plan.steps[${i}]`;
    collect(step?.actions, prefix + '.actions', true);
    collect(step?.assertions, prefix + '.assertions', false, original?.steps?.[i]);
    for (const [j, point] of (Array.isArray(step?.checkpoints) ? step.checkpoints : []).entries()) {
      collect(point?.actions, `${prefix}.checkpoints[${j}].actions`, true);
      collect(
        point?.assertions,
        `${prefix}.checkpoints[${j}].assertions`,
        false,
        original?.steps?.[i],
      );
    }
  }
  collect(plan?.cleanup?.actions, 'plan.cleanup.actions', true);
  collect(plan?.cleanup?.assertions, 'plan.cleanup.assertions');
  collect(plan?.cleanup?.ownership, 'plan.cleanup.ownership');
  const ids = new Set();
  for (const part of parts) {
    try {
      if (part.action) validateAction(part.value, base, ids);
      else validateAssertion(part.value, part.step);
    } catch (failure) {
      if (failure.code !== error.code) continue;
      const field = /(?:BOOL|VALUE|NUMBER|COUNT|CLASS|SEQUENCE)_/.test(error.code)
        ? part.action
          ? 'value'
          : 'expected'
        : /WAIT_STATE/.test(error.code)
          ? 'state'
          : /ACTION_NOT_ALLOWED/.test(error.code)
            ? 'op'
            : /ASSERTION_NOT_ALLOWED/.test(error.code)
              ? 'check'
              : /ACTION_ID/.test(error.code)
                ? 'action_id'
                : /ORACLE_QUOTE/.test(error.code)
                  ? 'oracle_quote'
                  : /OBLIGATION/.test(error.code)
                    ? 'obligation_ids'
                    : null;
      return {
        field_path: part.path + (field ? '.' + field : ''),
        actual_type:
          field && part.value?.[field] === undefined
            ? 'missing'
            : typeof (field ? part.value[field] : part.value),
        expected_schema: /BOOL/.test(error.code)
          ? 'JSON boolean, not a string'
          : 'Use the allowed action/assertion schema and original oracle supplied in the plan protocol.',
        reason: `${part.path}${field ? '.' + field : ''}: ${error.code}；${error.code.startsWith('OPTIONAL_') ? 'dismiss_optional仅用原文明确条件的role=dialog精确标题、value为原文关闭按钮文字；只读、每步一次、无state/repair_anchor/清理。' : '修正该字段格式，不改用例、预期或权限。'}`,
      };
    }
  }
  return {
    field_path: 'plan',
    reason: error.code,
    expected_schema: 'Follow the complete plan protocol; preserve original case and expectations.',
  };
}

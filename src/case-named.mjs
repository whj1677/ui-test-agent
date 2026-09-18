import { keys, fail, nonempty, relativeURL } from './common.mjs';
import { stepActions, stepAssertions } from './plan-steps.mjs';

export const CASE_NAMED_GUIDANCE = `Future wizard controls: once approve the COMPLETE FIXED plan, defer only DOM binding, never planning. For a not-yet-observed native control literally named in original.steps[].action, the optional locator is {kind:"case_named",source_step_id:"original action step id",target:{kind:"label",value:"literal field name",exact:true} OR {kind:"role",role:"textbox|spinbutton|combobox|checkbox|button",name:"literal name",exact:true},control_type:"text|number|textarea|select|checkbox|button",guard:{path:"observed wizard path including hash",page_heading:"observed h1",step:"exact observed step-list item"}}. This is CASE_NAMED_UNOBSERVED intent, NOT DOM_OBSERVED or a source fact. Use only a supplied pages[].wizard_context whose path, page_heading and steps match. The runtime requires that exact current step, its own section/fieldset, one contained native form and one matching native control of the fixed type. Missing context is a technical limitation, not permission to guess guards. Actions may only fill/select/check/uncheck or click the original literal Next/Back/Cancel navigation button, not submit/save/delete. Match source_step_id to the same original action step; assertions may reference a literal field named by ANY original action step in this same complete plan (including a later action); the current assertion still needs its own original expected obligation and exact current-step guard. Do not derive target names from expected results, synonyms or experience. No nested locators, preconditions, cleanup, repair anchors, runtime locator repair or deferred destructive buttons. Operations, values, literal locators, order, expected results and guards are fixed before approval and hashed. Do not require the future field to be visible during exploration; do not fill or advance business forms during exploration. Future error/content assertions remain checks of original expectations, not evidence of successful actions. Other locators still need observed or confirmed source support. A mismatched runtime binding stops; it never authorizes an alternate plan.`;

export function validateCaseNamed(l) {
  keys(
    l,
    ['kind', 'source_step_id', 'target', 'control_type', 'guard'],
    ['kind', 'source_step_id', 'target', 'control_type', 'guard'],
  );
  if (!nonempty(l.source_step_id) || l.source_step_id.length > 100)
    fail('CASE_NAMED_SOURCE_REQUIRED');
  const t = l.target;
  if (t?.kind === 'label') {
    keys(t, ['kind', 'value', 'exact'], ['kind', 'value', 'exact']);
  } else if (t?.kind === 'role') {
    keys(t, ['kind', 'role', 'name', 'exact'], ['kind', 'role', 'name', 'exact']);
    if (!['textbox', 'spinbutton', 'combobox', 'checkbox', 'button'].includes(t.role))
      fail('CASE_NAMED_TYPE_INVALID');
  } else fail('CASE_NAMED_SCHEMA_INVALID');
  if (t.exact !== true || !nonempty(t.name ?? t.value) || (t.name ?? t.value).length > 150)
    fail('CASE_NAMED_SCHEMA_INVALID');
  if (!['text', 'number', 'textarea', 'select', 'checkbox', 'button'].includes(l.control_type))
    fail('CASE_NAMED_TYPE_INVALID');
  const roles = {
    text: 'textbox',
    number: 'spinbutton',
    textarea: 'textbox',
    select: 'combobox',
    checkbox: 'checkbox',
    button: 'button',
  };
  if (t.kind === 'role' && roles[l.control_type] !== t.role) fail('CASE_NAMED_TYPE_INVALID');
  if (l.control_type === 'button' && t.kind !== 'role') fail('CASE_NAMED_TYPE_INVALID');
  keys(l.guard, ['path', 'page_heading', 'step'], ['path', 'page_heading', 'step']);
  for (const k of ['page_heading', 'step'])
    if (!nonempty(l.guard[k]) || l.guard[k].length > 150) fail('CASE_NAMED_GUARD_REQUIRED');
  relativeURL(l.guard.path, 'http://localhost');
  if (
    !l.guard.path.startsWith('/') ||
    l.guard.path.startsWith('//') ||
    l.guard.path.includes('?') ||
    l.guard.path.length > 2000
  )
    fail('CASE_NAMED_GUARD_REQUIRED');
  return l;
}

export function validateCaseNamedPlan(plan, c) {
  const check = (l, i, action) => {
    if (l?.kind !== 'case_named') return;
    validateCaseNamed(l);
    const sourceIndex = c.steps.findIndex((s) => s.step_id === l.source_step_id);
    if (
      sourceIndex < 0 ||
      (action && sourceIndex !== i) ||
      !literalActionSource(c.steps[sourceIndex].action, l)
    )
      fail('CASE_NAMED_SOURCE_REQUIRED');
    if (action) {
      const allowed = {
        fill: ['text', 'number', 'textarea'],
        select: ['select'],
        check: ['checkbox'],
        uncheck: ['checkbox'],
        click: ['button'],
      };
      if (!allowed[action.op]?.includes(l.control_type) || action.repair_anchor)
        fail('CASE_NAMED_ACTION_FORBIDDEN');
      if (
        action.op === 'click' &&
        !/^(下一步|上一步|取消|Next|Back|Previous|Cancel)$/iu.test(l.target.name)
      )
        fail('CASE_NAMED_ACTION_FORBIDDEN');
    }
  };
  for (const [i, s] of (plan.steps ?? []).entries()) {
    for (const a of stepActions(s)) {
      check(a?.target, i, a);
      if (a?.repair_anchor?.kind === 'case_named') fail('CASE_NAMED_ACTION_FORBIDDEN');
    }
    for (const a of stepAssertions(s)) check(a?.target, i);
  }
  for (const a of [
    ...(plan.preconditions ?? []),
    ...(plan.cleanup?.actions ?? []),
    ...(plan.cleanup?.ownership ?? []),
    ...(plan.cleanup?.assertions ?? []),
  ])
    if (a?.target?.kind === 'case_named' || a?.repair_anchor?.kind === 'case_named')
      fail('CASE_NAMED_ACTION_FORBIDDEN');
}

function literalActionSource(source, locator) {
  const name = locator.target.name ?? locator.target.value;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const field = `[「『"“']?${escaped}[」』"”']?`;
  const expression =
    locator.control_type === 'button'
      ? new RegExp(`(?:点击|单击|click)\\s*${field}`, 'iu')
      : new RegExp(
          `${field}\\s*(?:输入|填写|填入|选|改为|勾选)|(?:输入|填写|填入|选择|勾选|fill|select|type|check|uncheck).{0,16}${field}`,
          'iu',
        );
  return String(source)
    .split(/[；;。\n]/u)
    .some(
      (clause) =>
        !/不要|禁止|不得|不允许|无需|不再|不填写|不输入|不选择|不点击|do not|don't|never/iu.test(
          clause,
        ) && expression.test(clause),
    );
}

export function requireCaseNamedEvidence(locator, context) {
  if (locator?.kind !== 'case_named') return;
  const g = locator.guard;
  const latest = [...new Map((context.pages ?? []).map((p) => [p.url, p])).values()];
  const known = latest.some((p) => {
    const w = p.wizard_context;
    if (!w || p.login_page || p.network_issues?.length) return false;
    try {
      const url = new URL(p.url);
      return (
        url.origin === new URL(context.target_origin).origin &&
        !url.search &&
        url.pathname + url.hash === g.path &&
        w.path === g.path &&
        w.page_heading === g.page_heading &&
        w.steps?.includes(g.step)
      );
    } catch {
      return false;
    }
  });
  if (!known) fail('CASE_NAMED_GUARD_UNOBSERVED');
}

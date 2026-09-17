import { semanticHash, redact } from './common.mjs';
import { queryValues } from './query-capability.mjs';

// Fixed DOM inspection and an optional one-action identity guard. Neither GET
// nor a query label proves that a black-box handler is free of side effects.
export function queryFormFacts(element, arm = null) {
  const form = element.closest('form');
  const visible = (e) =>
    !!e.getClientRects().length &&
    !e.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  const label = (e) => {
    if (e.getAttribute('aria-label')) return e.getAttribute('aria-label').trim();
    const ids = e.getAttribute('aria-labelledby')?.trim().split(/\s+/u);
    if (ids?.length) {
      const nodes = ids.map((id) => document.getElementById(id));
      if (nodes.every(Boolean)) return nodes.map((n) => n.textContent.trim()).join(' ');
    }
    if (e.labels?.length === 1) {
      const copy = e.labels[0].cloneNode(true);
      for (const child of copy.querySelectorAll('input,select,textarea,button')) child.remove();
      return copy.textContent.trim();
    }
    return '';
  };
  if (
    !form ||
    element.form !== form ||
    form.closest('dialog,[role="dialog"],[aria-modal="true"]') ||
    !visible(form) ||
    (form.getAttribute('method') ?? 'get').toLowerCase() !== 'get' ||
    !['', '_self'].includes(form.getAttribute('target') ?? '') ||
    form.hasAttribute('novalidate')
  )
    return null;
  if (
    form.id &&
    [...document.querySelectorAll('[id]')].filter((e) => e.id === form.id).length !== 1
  )
    return null;
  let action;
  try {
    action = new URL(form.getAttribute('action') || location.href, document.baseURI);
    if (action.origin !== location.origin || action.username || action.password || action.search)
      return null;
  } catch {
    return null;
  }
  // The prototype getter avoids named-control shadowing of form.elements.
  const controls = [
    ...Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'elements').get.call(form),
  ];
  const queryName = /^(?:查询|搜索|筛选|过滤|search|query|filter)$/iu;
  const buttons = controls.filter((e) => e.tagName === 'BUTTON');
  const queries = buttons.filter(
    (e) =>
      e.type === 'submit' && queryName.test((e.getAttribute('aria-label') || e.innerText).trim()),
  );
  if (queries.length !== 1) return null;
  const button = queries[0];
  const resets = buttons.filter(
    (e) =>
      e.type === 'reset' &&
      /^(?:重置|reset)$/iu.test((e.getAttribute('aria-label') || e.innerText).trim()),
  );
  const reset = element === resets[0] && resets.length === 1 && buttons.length === 2;
  // A named submitter adds an extra successful form value not bound to a field.
  if (button.getAttribute('name') || (reset && element.getAttribute('name'))) return null;
  if (
    !['INPUT', 'SELECT', 'BUTTON'].includes(element.tagName) ||
    (element.tagName === 'BUTTON' && element !== button && !reset)
  )
    return null;
  if (
    controls.some(
      (e) =>
        !form.contains(e) ||
        e.form !== form ||
        e.hasAttribute('form') ||
        e.matches(':disabled') ||
        e.getAttribute('aria-disabled') === 'true' ||
        !['INPUT', 'SELECT', 'BUTTON', 'FIELDSET'].includes(e.tagName) ||
        !visible(e) ||
        /^(?:action|method|target|submit|elements|requestSubmit|reset|encoding|enctype)$/iu.test(
          e.getAttribute('name') || '',
        ) ||
        ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate'].some((a) =>
          e.hasAttribute(a),
        ),
    )
  )
    return null;
  if (
    buttons.some(
      (e) =>
        e !== button &&
        (!['button', 'reset'].includes(e.type) ||
          !/^(?:重置|reset)$/iu.test((e.getAttribute('aria-label') || e.innerText).trim())),
    )
  )
    return null;
  const fields = controls.filter((e) => ['INPUT', 'SELECT'].includes(e.tagName));
  if (!fields.length || fields.length > 8) return null;
  const facts = [];
  const sensitive =
    /password|passwd|secret|token|credential|api.?key|authorization|cookie|session|one.?time|passcode|credit.?card|\botp\b|cc-|密码|口令|密钥|验证码|银行卡|身份证|手机号|账号|账户|邮箱/iu;
  for (const field of fields) {
    const name = label(field);
    if (
      !name ||
      sensitive.test([name, field.id, field.name, field.autocomplete].join(' ')) ||
      field.readOnly ||
      field.isContentEditable ||
      field.multiple ||
      (field.tagName === 'INPUT' && !['text', 'search'].includes(field.type))
    )
      return null;
    const options =
      field.tagName === 'SELECT'
        ? [...field.options].map((o) => ({
            value: o.value,
            label: o.label,
            disabled: o.disabled || o.parentElement?.disabled === true,
            hidden: o.hidden,
            defaultSelected: o.defaultSelected,
          }))
        : undefined;
    if (
      options &&
      (options.filter((o) => o.defaultSelected).length > 1 ||
        options.filter((o) => o.value === field.value && !o.disabled && !o.hidden).length !== 1)
    )
      return null;
    facts.push({
      tag: field.tagName,
      type: field.type,
      label: name,
      name: field.name,
      id: field.id,
      value: field.value,
      default_value: options
        ? (options.find((o) => o.defaultSelected) ?? options[0])?.value
        : field.defaultValue,
      ...(options ? { options } : {}),
    });
  }
  if (
    new Set(facts.map((f) => f.label)).size !== facts.length ||
    new Set(facts.filter((f) => f.name).map((f) => f.name)).size !==
      facts.filter((f) => f.name).length
  )
    return null;
  const result = {
    kind: 'native_get_query',
    query_label: (button.getAttribute('aria-label') || button.innerText).trim(),
    ...(reset
      ? { reset_label: (element.getAttribute('aria-label') || element.innerText).trim() }
      : {}),
    action: action.href,
    fields: facts,
  };
  if (!arm) return result;
  const runtime = window[arm.key],
    permit = runtime?.permit;
  if (
    !permit ||
    permit.element !== element ||
    (!reset && element !== button) ||
    (runtime.flush(), runtime.reading_revision !== arm.revision) ||
    JSON.stringify(result) !== JSON.stringify(arm.expected)
  )
    return false;
  const signature = JSON.stringify(result);
  const trigger = reset ? element : button;
  permit.queryForm = form;
  permit.queryCheck = () => {
    try {
      if (!trigger.isConnected || trigger.form !== form || !form.isConnected) return false;
      const live = [
        ...Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'elements').get.call(form),
      ];
      if (live.length !== controls.length || live.some((e, i) => e !== controls[i])) return false;
      return JSON.stringify(queryFormFacts(trigger)) === signature;
    } catch {
      // A capture-listener exception alone does NOT prevent a browser submit.
      // Named controls can shadow form methods between click and submit.
      return false;
    }
  };
  return true;
}

function sourceSteps(c, facts) {
  if (typeof c?.case_id !== 'string' || facts?.kind !== 'native_get_query') return [];
  const escaped = facts.query_label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const query = new RegExp(
    `(?:点击|\\bclick)\\s*[「“"']?${escaped}(?:[」”"']|(?=后|并|[，,。；;\\s]|$))|(?:^|[，,、\\s]|并|再)${escaped}(?=后|并|[，,。；;\\s]|$)`,
    'iu',
  );
  const steps = [];
  for (const step of c.steps ?? [])
    for (const clause of String(step.action ?? '').split(/[。；;\n]/u)) {
      const instruction = clause.replace(/[「“"'][^」”"']*[」”"']/gu, '');
      if (
        !query.test(clause) ||
        /[不未别][^，,。；;]{0,40}(?:点击|输入|填写|填入|选择|选|查询|搜索|筛选|过滤)/u.test(
          instruction,
        ) ||
        /不要|不得|不能|禁止|无需|不再|勿|避免|不是|而非|没有|不应|不允许|不需要|别点击|未点击|不点击|取消点击|如果|若|否则|\b(?:not|never|avoid|unless|if|when)\b|don['’]t/iu.test(
          clause,
        ) ||
        redact(clause) !== clause
      )
        continue;
      const bindings = [];
      let ambiguous = false;
      for (let index = 0; index < facts.fields.length; index++) {
        const f = facts.fields[index];
        const values = queryValues({ steps: [{ ...step, action: clause }] }, f, f.label);
        if (values.length > 1) ambiguous = true;
        if (values.length === 1) bindings.push({ index, ...values[0] });
      }
      // A later unbound input instruction must not silently reuse an earlier
      // value. Refuse the clause instead of guessing its final intended state.
      let remainder = clause;
      for (const binding of bindings) remainder = remainder.replace(binding.source_quote, ' ');
      if (
        /输入|填写|填入|选择|选为|下拉选|选(?=[「“"'])|\b(?:enter|input|fill|select|choose)\b/iu.test(
          remainder,
        )
      )
        ambiguous = true;
      if (bindings.length && !ambiguous)
        steps.push({ step_id: step.step_id, source_quote: clause, bindings });
    }
  return steps;
}

export function queryFormValues(c, facts, meta, name) {
  const indexes = facts.fields
    .map((f, i) => (f.label === name || f.label === meta.label ? i : -1))
    .filter((i) => i >= 0);
  if (indexes.length !== 1) return [];
  return sourceSteps(c, facts).flatMap((s) => s.bindings.filter((b) => b.index === indexes[0]));
}

export function queryFormBinding(c, facts) {
  for (const step of sourceSteps(c, facts)) {
    if (
      facts.fields.some((field, index) => {
        const binding = step.bindings.find((b) => b.index === index);
        return field.value !== (binding ? binding.value : field.default_value);
      })
    )
      continue;
    return {
      kind: 'case_query_form',
      case_id: c.case_id,
      case_hash: semanticHash(c),
      step_id: step.step_id,
      source_quote: step.source_quote,
      fields: step.bindings.map((b) => ({
        name: facts.fields[b.index].label,
        value: b.value,
        source_quote: b.source_quote,
      })),
    };
  }
  return null;
}

export function queryResetBinding(c, facts) {
  if (!/^(?:重置|reset)$/iu.test(facts?.reset_label ?? '')) return null;
  const query = queryFormBinding(c, facts);
  if (!query) return null;
  const steps = c.steps ?? [];
  const queryIndex = steps.findIndex(
    (s) => s.step_id === query.step_id && String(s.action ?? '').includes(query.source_quote),
  );
  if (queryIndex < 0) return null;
  // Deliberately a positive standalone instruction after a source-bound query,
  // not any mention of "reset" in prose, expectations, conditions or a prompt.
  const pattern = new RegExp(
    `^(?:点击|click)\\s*(?:查询(?:区|条件|表单)(?:内|中)?(?:的)?\\s*)?[「“"']${facts.reset_label}[」”"'](?:按钮)?[。.]?$`,
    'iu',
  );
  for (const step of steps.slice(queryIndex + 1)) {
    const quote = String(step.action ?? '').trim();
    if (!pattern.test(quote) || redact(quote) !== quote) continue;
    return {
      kind: 'case_query_reset',
      case_id: c.case_id,
      case_hash: semanticHash(c),
      step_id: step.step_id,
      source_quote: quote,
      query_step_id: query.step_id,
      query_source_quote: query.source_quote,
      fields: query.fields,
    };
  }
  return null;
}

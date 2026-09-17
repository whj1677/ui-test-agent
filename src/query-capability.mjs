import { redact } from './common.mjs';

// Fixed DOM inspection, never page/model-provided code. A query scope is a
// narrow heuristic capability, NOT evidence that a site's handlers are pure.
// Network, identity, sensitive-field and form-submit guards remain mandatory.
export function queryScopeFacts(element) {
  const visible = (e) =>
    !!e.getClientRects().length &&
    !e.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  if (
    !['INPUT', 'SELECT'].includes(element.tagName) ||
    element.closest('dialog,[role="dialog"],[aria-modal="true"]') ||
    (element.form && element.form.method.toLowerCase() !== 'get')
  )
    return null;
  const queryName = /^(?:查询|搜索|筛选|过滤|search|query|filter)$/iu;
  const mutationName =
    /保存|提交|确认|确定|删除|支付|发布|应用|\b(?:save|submit|confirm|delete|pay|publish|apply)\b/iu;
  for (
    let node = element.parentElement, depth = 0;
    node && !['BODY', 'HTML', 'MAIN'].includes(node.tagName) && depth < 4;
    node = node.parentElement, depth++
  ) {
    const buttons = [...node.querySelectorAll('button,[role="button"]')].filter(visible);
    if (buttons.some((b) => mutationName.test(b.getAttribute('aria-label') || b.innerText)))
      return null;
    const query = buttons.filter(
      (b) =>
        b.tagName === 'BUTTON' &&
        b.type === 'button' &&
        !b.disabled &&
        b.getAttribute('aria-disabled') !== 'true' &&
        queryName.test((b.getAttribute('aria-label') || b.innerText).trim()),
    );
    if (!query.length) continue;
    const fields = [...node.querySelectorAll('input,select,textarea')].filter(visible);
    if (
      query.length !== 1 ||
      fields.length > 8 ||
      !fields.includes(element) ||
      fields.some(
        (f) =>
          f.tagName === 'TEXTAREA' ||
          (f.tagName === 'INPUT' && !['text', 'search'].includes(f.type)),
      )
    )
      return null;
    return {
      query_label: (query[0].getAttribute('aria-label') || query[0].innerText).trim(),
      field_labels: fields.map(
        (f) => f.labels?.[0]?.innerText?.trim() || f.getAttribute('aria-label') || '',
      ),
    };
  }
  return null;
}

// Bind a literal to THIS observed field in an original input/select instruction.
// Do not harvest expected results, arbitrary quoted page prose or model values.
export function queryValues(c, meta, name) {
  const labels = [...new Set([meta.label, name].filter((v) => typeof v === 'string' && v.trim()))];
  const operation = meta.tag === 'SELECT' ? 'select' : 'fill';
  if (operation === 'fill' && (meta.tag !== 'INPUT' || !['text', 'search'].includes(meta.type)))
    return [];
  const results = new Map();
  for (const step of c?.steps ?? []) {
    const action = String(step.action ?? '');
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const verb =
        operation === 'fill'
          ? '(?:输入|填写|填入|enter|input|fill)'
          : '(?:下拉)?(?:选择|选为|选|select|choose)';
      const pattern = new RegExp(
        `(?:^|[\\s，,。；;、]|在|将|把|的)[「“"']?${escaped}[」”"']?\\s*(?:框|下拉框)?\\s*${verb}\\s*[:：]?\\s*[「“"']([^」”"'\\r\\n]{1,200})[」”"']`,
        'giu',
      );
      for (const match of action.matchAll(pattern)) {
        const literal = match[1];
        if (redact(literal) !== literal || /[\u0000-\u001f]/u.test(literal)) continue;
        const options =
          operation === 'select'
            ? (meta.options ?? []).filter((o) => !o.disabled && !o.hidden && o.label === literal)
            : null;
        if (options && options.length !== 1) continue;
        const value = options ? options[0].value : literal;
        results.set(value, { value, step_id: step.step_id, source_quote: match[0] });
      }
    }
  }
  return [...results.values()].slice(0, operation === 'select' ? 8 : 3);
}

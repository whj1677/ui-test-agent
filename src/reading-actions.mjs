import { redact, semanticHash } from './common.mjs';

// A bounded affordance vocabulary, not a claim that an application's handlers
// are read-only. It can only supplement existing guarded, case-bound discovery.
export function readingType(name) {
  if (
    /^(?:上一页|下一页|首页|末页|加载更多|(?:next|previous|first|last) page|load more)$/iu.test(
      name,
    )
  )
    return 'pagination';
  if (
    /^(?:[\p{Script=Han}]{0,16}(?:说明|帮助)|help|(?:usage|service) (?:help|information)|instructions)$/iu.test(
      name,
    )
  )
    return 'help';
  if (/^(?:重试|重新加载|retry|reload)$/iu.test(name)) return 'retry';
  return null;
}

export function readingBinding(c, name) {
  const category = readingType(name);
  if (!category || typeof c?.case_id !== 'string') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(
    `(?:点击|打开|查看|阅读|\\bclick|\\bopen|\\bview)\\s*[^「」“”\"'。；;\\n]{0,40}[「“\"']${escaped}[」”\"']`,
    'iu',
  );
  for (const step of c.steps ?? [])
    for (const clause of String(step.action ?? '').split(/[。；;\n]/u)) {
      // No inferred conditional branch or negation. A literal mention is not an instruction.
      if (
        /不要|不得|不能|禁止|无需|不再|勿|避免|不是|而非|没有|不应|不允许|不需要|别点击|别打开|取消点击|未点击|不点击|如果|若|否则|\b(?:not|never|avoid|unless|if|when)\b|don['’]t/iu.test(
          clause,
        )
      )
        continue;
      const quote = clause.match(pattern)?.[0];
      if (quote && redact(quote) === quote)
        return {
          kind: 'case_reading_action',
          category,
          case_id: c.case_id,
          step_id: step.step_id,
          source_quote: quote,
          case_hash: semanticHash(c),
        };
    }
  return null;
}

// Fixed DOM facts only; never accepts a model selector, script or permission.
export function readingDOMFacts(element, { category, dangerSource }) {
  const visible = (e) =>
    !!e.getClientRects().length &&
    !e.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  if (
    element.tagName !== 'BUTTON' ||
    element.form ||
    element.closest('form') ||
    element.type === 'reset' ||
    element.getAttribute('type') === 'submit' ||
    element.disabled ||
    element.getAttribute('aria-disabled') === 'true' ||
    !visible(element)
  )
    return null;
  const danger = new RegExp(dangerSource, 'iu');
  const dialog = element.closest('dialog,[role="dialog"]');
  if (dialog?.querySelector('input,select,textarea,[contenteditable="true"]')) return null;
  if (category !== 'retry') return { category };
  for (
    let root = element.parentElement, depth = 0;
    root && !['BODY', 'HTML', 'MAIN'].includes(root.tagName) && depth < 4;
    root = root.parentElement, depth++
  ) {
    const text = root.innerText.trim();
    if (root.matches('form') || root.querySelector('input,select,textarea') || danger.test(text))
      return null;
    const alerts = [...root.querySelectorAll('[role="alert"]')].filter(visible);
    const readFailure =
      /(?:读取|加载|获取|查询|检索|read|load|fetch)[\s\S]{0,30}(?:失败|错误|不可用|fail|error|unavailable)/iu.test(
        text,
      );
    if (alerts.length === 1 && readFailure)
      return {
        category,
        context: text.slice(0, 600),
        alert: alerts[0].innerText.trim().slice(0, 200),
      };
  }
  return null;
}

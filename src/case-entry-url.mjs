import { fail } from './common.mjs';

const hintKey = (key) => ['page_entry_url', '页面入口url'].includes(key.trim().toLowerCase());
const sensitive =
  /password|passwd|pwd|token|secret|credential|auth|cookie|api.?key|access.?key|session|ticket|assertion|signature|bearer|jwt|csrf|xsrf|sso|otp|passcode|^(?:code|key|sig)$|密码|口令|密钥/iu;

// An operator hint is not a source binding. Keep errors value-free: even invalid
// inputs may contain credentials and must never enter diagnostics/model input.
export function caseEntryURL(value, target) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) fail('CASE_ENTRY_URL_INVALID');
  const raw = value.trim();
  if (!raw) return null;
  let base,
    original,
    expanded = raw;
  try {
    base = new URL(target ?? 'https://case-entry.invalid/');
    for (let depth = 0; depth < 9; depth++) {
      if (/[\\\u0000-\u0020\u007f]/u.test(expanded) || expanded.startsWith('//'))
        fail('CASE_ENTRY_URL_INVALID');
      if (/^[a-z][a-z\d+.-]*:/iu.test(expanded) && !/^https?:\/\//iu.test(expanded))
        fail('CASE_ENTRY_URL_INVALID');
      const url = new URL(expanded, base);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        fail('CASE_ENTRY_URL_INVALID');
      if (target && url.origin !== base.origin) fail('CASE_ENTRY_URL_CROSS_ORIGIN');
      if (/^#!?\/\//u.test(url.hash) || /(?:^|\/)\.\.?(?:\/|[?#]|$)/u.test(expanded))
        fail('CASE_ENTRY_URL_INVALID');
      const fragment = url.hash.replace(/^#!?/, '');
      for (const query of [
        url.searchParams,
        new URLSearchParams(
          fragment.includes('?') ? fragment.slice(fragment.indexOf('?') + 1) : fragment,
        ),
      ])
        for (const key of query.keys()) if (sensitive.test(key)) fail('CASE_ENTRY_URL_SENSITIVE');
      original ??= url;
      const next = decodeURIComponent(expanded);
      if (next === expanded)
        return {
          value: raw,
          url: original.href,
          path: original.pathname + original.search + original.hash,
        };
      if (depth === 8) fail('CASE_ENTRY_URL_INVALID');
      expanded = next;
    }
  } catch (error) {
    if (String(error.code).startsWith('CASE_ENTRY_URL_')) throw error;
    fail('CASE_ENTRY_URL_INVALID');
  }
}

// The vendor preserves source rows verbatim for both CSV and Excel. Project
// their optional hint column here, without changing vendor mapping/business text.
export function importedCaseEntry(c) {
  const values = [];
  if (Object.hasOwn(c, 'page_entry_url')) values.push(c.page_entry_url);
  for (const row of c.original_rows ?? [])
    for (const [key, value] of Object.entries(row)) if (hintKey(key)) values.push(value);
  const routes = new Set(values.map((v) => caseEntryURL(v)?.value).filter(Boolean));
  if (routes.size > 1) fail('CASE_ENTRY_URL_CONFLICT');
  return [...routes][0];
}

export function withoutEntryHints(value) {
  if (Array.isArray(value)) return value.map(withoutEntryHints);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !hintKey(key))
        .map(([key, v]) => [key, withoutEntryHints(v)]),
    );
  return value;
}

export function entryObservationCode(observed, entry, target, c, status = null) {
  const page = observed?.snapshot;
  if (page?.login_page) return 'CASE_ENTRY_LOGIN_REDIRECT';
  if ((status ?? page?.http_status ?? 0) >= 400) return 'CASE_ENTRY_HTTP_ERROR';
  if (
    /\b404\b|\bnot found\b|页面不存在|页面未找到|找不到页面/iu.test(
      `${page?.title ?? ''} ${page?.text ?? ''}`,
    )
  )
    return 'CASE_ENTRY_NOT_FOUND';
  try {
    if (caseEntryURL(page?.url, target)?.url !== entry.url) return 'CASE_ENTRY_WRONG_PAGE';
  } catch {
    return 'CASE_ENTRY_WRONG_PAGE';
  }
  const caseText = [c.title, ...(c.steps ?? []).map((s) => s.action)].join(' ').toLowerCase();
  const labels = [
    page?.title,
    ...(page?.controls ?? [])
      .filter((v) => !['link', 'menuitem', 'navigation', 'button'].includes(v.role))
      .map((v) => v.name),
  ];
  if (
    !labels.some(
      (v) =>
        typeof v === 'string' && v.trim().length >= 2 && caseText.includes(v.trim().toLowerCase()),
    )
  )
    return 'CASE_ENTRY_RELEVANCE_UNCONFIRMED';
  return 'CASE_ENTRY_OBSERVED';
}

export function entryNavigationSteps(c) {
  return (c.steps ?? []).filter(
    (s) =>
      /菜单|导航|\bmenu\b|\bnavigation\b/iu.test(s.action) ||
      /从首页|from (?:the )?home/iu.test(s.action),
  );
}

export function requireEntryNavigation(plan, c, target, observedHome) {
  if (!plan) return;
  const navigation = entryNavigationSteps(c);
  if (!navigation.length) return;
  const home = caseEntryURL(observedHome ?? target, target)?.url;
  if (caseEntryURL(plan.entry_path, target)?.url !== home) fail('CASE_ENTRY_NAVIGATION_REQUIRED');
  for (const step of navigation) {
    const mapped = plan.steps?.find((s) => s.step_id === step.step_id);
    const actions = [
      ...(mapped?.actions ?? []),
      ...(mapped?.checkpoints ?? []).flatMap((p) => p.actions ?? []),
    ];
    if (!actions.some((a) => a.op === 'click') || actions.some((a) => a.op === 'navigate'))
      fail('CASE_ENTRY_NAVIGATION_REQUIRED');
  }
}

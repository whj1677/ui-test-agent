import crypto from 'node:crypto';
export const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');
// v1 hashes and byte receipts retain hash(). v2 semantic objects use this
// explicitly versioned JSON encoding: keys sorted, arrays and strings untouched.
export function canonicalJSON(value) {
  const ancestors = new Set();
  function encode(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) fail('NON_JSON_VALUE');
      return JSON.stringify(v);
    }
    if (typeof v !== 'object' || Buffer.isBuffer(v) || ancestors.has(v)) fail('NON_JSON_VALUE');
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      fail('NON_JSON_VALUE');
    ancestors.add(v);
    let encoded;
    if (Array.isArray(v)) {
      if (
        Object.keys(v).length !== v.length ||
        Array.from({ length: v.length }, (_, i) => !Object.hasOwn(v, i)).some(Boolean)
      )
        fail('NON_JSON_VALUE');
      encoded = '[' + v.map(encode).join(',') + ']';
    } else
      encoded =
        '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + encode(v[k]))
          .join(',') +
        '}';
    ancestors.delete(v);
    return encoded;
  }
  return encode(value);
}
export const semanticHash = (value) => hash(canonicalJSON(value));
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function fail(code, status = 400) {
  throw Object.assign(new Error(code), { code, status });
}
export const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
export const nonempty = (x) => typeof x === 'string' && x.trim().length > 0;
export function keys(x, allowed, required = []) {
  if (
    !object(x) ||
    Object.keys(x).some((k) => !allowed.includes(k)) ||
    required.some((k) => !Object.hasOwn(x, k))
  )
    fail('INVALID_SCHEMA');
}
export function safeId(x) {
  if (typeof x !== 'string' || !/^[a-f0-9-]{36}$/.test(x)) fail('INVALID_ID');
  return x;
}
export function targetURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('INVALID_TARGET_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    fail('INVALID_TARGET_URL');
  const fragmentQuery = new URLSearchParams(
    url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : url.hash.slice(1),
  );
  for (const query of [url.searchParams, fragmentQuery])
    for (const key of query.keys())
      if (/token|password|secret|credential|api.?key/i.test(key)) fail('SENSITIVE_URL');
  return url;
}
export function relativeURL(value, base) {
  if (!nonempty(value) || /[\\\u0000-\u001f]/.test(value)) fail('INVALID_ROUTE');
  const target = targetURL(new URL(value, base).href);
  if (target.origin !== new URL(base).origin) fail('OUTSIDE_TARGET_ORIGIN');
  return new URL(value, base).href;
}
export function redact(value) {
  return String(value ?? '')
    .replace(/\bsk-[\w-]{8,}/g, '[REDACTED]')
    .replace(
      /((?:password|密码|authorization|cookie|token|api[_ -]?key)\s*[:=：]\s*)([^\s,;，；]+)/gi,
      '$1[REDACTED]',
    );
}
export const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const publicError = (e) =>
  /^[A-Z][A-Z0-9_]+$/.test(e?.code ?? '') ? e.code : 'INTERNAL_ERROR';
export async function poll(check, timeout = 8000) {
  const until = Date.now() + timeout;
  do {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < until);
  return false;
}

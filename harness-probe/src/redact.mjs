const SECRET_KEY = /(api[_-]?key|auth[_-]?token|authorization|cookie|password|secret)/i;

export function redactText(input, explicitSecrets = []) {
  let text = String(input ?? '');
  for (const secret of explicitSecrets) {
    if (secret) text = text.split(String(secret)).join('[REDACTED]');
  }
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|auth[_-]?token|authorization|cookie|password|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function redactValue(value, explicitSecrets = []) {
  if (Array.isArray(value)) return value.map((item) => redactValue(item, explicitSecrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : redactValue(item, explicitSecrets),
    ]));
  }
  return typeof value === 'string' ? redactText(value, explicitSecrets) : value;
}

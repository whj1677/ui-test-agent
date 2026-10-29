const OPEN = '[workbench-browser-assertions-v1]';
const CLOSE = '[/workbench-browser-assertions-v1]';
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SENSITIVE = /password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|session/i;
const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
const fail = () => { throw Error('BROWSER_ASSERTION_CONTRACT_INVALID'); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, names) => plain(value) && Object.keys(value).length === names.length && Object.keys(value).every(key => names.includes(key));
const safeKey = key => typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !DANGEROUS.has(key) && !SENSITIVE.test(key);
const scalar = value => value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ||
  typeof value === 'string' && value.length <= 256;

function path(value) {
  if (typeof value !== 'string' || value.length > 512 || !/^\/(?!\/)[\x21-\x7e]*$/.test(value) ||
    /[?#%*{}<>\\]/.test(value) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) fail();
  return value;
}
function paths(values) {
  if (!Array.isArray(values) || !values.length || values.length > 20 || new Set(values).size !== values.length) fail();
  return values.map(path);
}
function methods(values) {
  if (!Array.isArray(values) || !values.length || values.length > 4 || values.some(value => !WRITE_METHODS.includes(value)) || new Set(values).size !== values.length) fail();
  return values;
}
function pointer(value) {
  if (typeof value !== 'string' || value.length > 512 || !/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/.test(value) || SENSITIVE.test(value) ||
    value.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~')).some(part => DANGEROUS.has(part))) fail();
  return value;
}
function scalarList(values) {
  if (!Array.isArray(values) || !values.length || values.length > 20 || values.some(value => !scalar(value)) ||
    new Set(values.map(value => JSON.stringify(value))).size !== values.length) fail();
  return values;
}
function contractOf(kind, value) {
  if (kind === 'no_writes') {
    if (!exactKeys(value, ['paths', 'methods'])) fail();
    return { paths: paths(value.paths), methods: methods(value.methods) };
  }
  if (kind === 'no_successful_writes') {
    if (!exactKeys(value, ['paths', 'methods', 'business_status']) || !exactKeys(value.business_status, ['pointer', 'success', 'failure'])) fail();
    const success = scalarList(value.business_status.success), failure = scalarList(value.business_status.failure);
    if ([...success, ...failure].some(item => typeof item !== typeof success[0]) ||
      new Set([...success, ...failure].map(item => JSON.stringify(item))).size !== success.length + failure.length) fail();
    return { paths: paths(value.paths), methods: methods(value.methods), business_status: { pointer: pointer(value.business_status.pointer), success, failure } };
  }
  if (kind !== 'json_response' || !exactKeys(value, ['method', 'path', 'equals', 'arrays']) || value.method !== 'GET' ||
    !Array.isArray(value.equals) || !Array.isArray(value.arrays) || !value.equals.length && !value.arrays.length || value.equals.length + value.arrays.length > 20) fail();
  const equals = value.equals.map(row => {
    if (!exactKeys(row, ['pointer', 'value']) || !scalar(row.value)) fail();
    return { pointer: pointer(row.pointer), value: row.value };
  });
  const arrays = value.arrays.map(row => {
    if (!exactKeys(row, ['pointer', 'fields', 'items']) || !Array.isArray(row.fields) || !row.fields.length || row.fields.length > 12 ||
      row.fields.some(field => !safeKey(field)) || new Set(row.fields).size !== row.fields.length || !Array.isArray(row.items) || row.items.length > 100) fail();
    const items = row.items.map(item => {
      if (!plain(item) || Object.keys(item).length !== row.fields.length || row.fields.some(field => !Object.hasOwn(item, field) || !scalar(item[field]))) fail();
      return Object.fromEntries(row.fields.map(field => [field, item[field]]));
    });
    return { pointer: pointer(row.pointer), fields: row.fields, items };
  });
  return { method: 'GET', path: path(value.path), equals, arrays };
}

function canonical(value) {
  return Array.isArray(value) ? value.map(canonical) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signature = value => JSON.stringify(canonical(value));

export function extractBrowserAssertionContract(caseContent) {
  const text = caseContent?.test_data;
  if (typeof text !== 'string' || !text.includes(OPEN) && !text.includes(CLOSE)) return { configured: false, obligations: [] };
  const start = text.indexOf(OPEN), end = text.indexOf(CLOSE);
  if (start < 0 || end < 0 || end <= start || text.indexOf(OPEN, start + OPEN.length) !== -1 ||
    text.indexOf(CLOSE, end + CLOSE.length) !== -1) fail();
  const payload = text.slice(start + OPEN.length, end).trim();
  if (Buffer.byteLength(payload, 'utf8') > 24 * 1024) fail();
  let parsed; try { parsed = JSON.parse(payload); } catch { fail(); }
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 20 || !Array.isArray(caseContent.steps)) fail();
  const orders = new Map(caseContent.steps.map(step => [step.order, step]));
  if (orders.size !== caseContent.steps.length) fail();
  const ids = new Set(), obligations = [];
  for (const item of parsed) {
    if (!exactKeys(item, ['id', 'step_order', 'source_quote', 'kind', 'contract']) || typeof item.id !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(item.id) || ids.has(item.id) || !Number.isSafeInteger(item.step_order) || item.step_order < 1 ||
      typeof item.source_quote !== 'string' || !item.source_quote.trim() || item.source_quote.length > 1000 ||
      typeof orders.get(item.step_order)?.expected !== 'string' || !orders.get(item.step_order).expected.includes(item.source_quote) ||
      !['no_writes', 'no_successful_writes', 'json_response'].includes(item.kind)) fail();
    ids.add(item.id);
    obligations.push({ id: item.id, step_order: item.step_order, source_quote: item.source_quote,
      kind: item.kind, contract: contractOf(item.kind, item.contract) });
  }
  return { configured: true, obligations };
}

export function evaluateBrowserAssertionObligations(caseContent, browserEvidence) {
  const extracted = extractBrowserAssertionContract(caseContent);
  if (!extracted.configured) return { configured: false, status: 'NOT_CONFIGURED', items: [] };
  const records = ['CHECKS_PASSED', 'CHECKS_NOT_PASSED'].includes(browserEvidence?.status) && Array.isArray(browserEvidence.records) ? browserEvidence.records : [];
  const items = extracted.obligations.map(obligation => {
    const matches = records.flatMap((record, index) => record?.step_order === obligation.step_order && record.kind === obligation.kind &&
      signature(record.contract) === signature(obligation.contract) ? [{ record, index }] : []);
    const failed = matches.find(({ record }) => record.status !== 'PASSED');
    const selected = failed || matches[0];
    return { id: obligation.id, step_order: obligation.step_order, source_quote: obligation.source_quote,
      status: !selected ? 'MISSING' : failed ? 'CHECKS_NOT_PASSED' : 'COVERED', record_index: selected?.index ?? null };
  });
  const status = items.some(item => item.status === 'MISSING') ? 'MISSING' :
    items.some(item => item.status === 'CHECKS_NOT_PASSED') || browserEvidence?.status !== 'CHECKS_PASSED' ? 'CHECKS_NOT_PASSED' : 'COVERED';
  return { configured: true, status, items };
}

import { createHash } from 'node:crypto';

export const FRONTEND_HANDOFF_SCHEMA = 'workbench/frontend-module-handoff-v1';
export const FRONTEND_HANDOFF_LIMITS = Object.freeze({ bytes: 262144, files: 150, pages: 30, controls: 300 });
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const frontendHandoffHash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
export const sourceSnapshotHash = files => frontendHandoffHash([...files].sort((a, b) => a.path.localeCompare(b.path, 'en')));

const forbiddenContent = /```|<\/?[a-z][^>]*>|=>|\b(?:(?:const|let|var)\s+[a-z_$][\w$]*\s*=|function\s*[a-z_$]*\s*\(|import\s*\{|export\s+(?:const|function)|require\s*\(|eval\s*\(|new\s+Function\s*\(|process\.env|document\.cookie|localStorage|sessionStorage|page\.(?:evaluate|goto|getByRole|locator)|Bearer\s+[a-z\d]|sk-[a-z\d]{12})|https?:\/\/|file:\/\/|[A-Z]:[\\/]/i;
const sensitiveFile = /(?:^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|node_modules(?:\/|$)|dist(?:\/|$)|(?:credentials?|secrets?|tokens?)(?:\.|\/|$))|\.(?:pem|key|pfx|p12)$/i;
const allowedSourceExtension = /\.(?:vue|tsx?|jsx?|mjs|cjs|css|scss|sass|less|html|json)$/i;
export function isHandoffSourcePath(value) {
  return typeof value === 'string' && value.length <= 240 && allowedSourceExtension.test(value) &&
    !value.startsWith('/') && !/[\\:\x00-\x1f?#]/.test(value) && !value.split('/').some(part => !part || part === '.' || part === '..') && !sensitiveFile.test(value);
}

// This validates a data-only technical hint format. It never executes selectors,
// resolves local paths, or decides a business expectation from imported text.
export function validateFrontendHandoff(input) {
  const errors = [];
  const fail = (at, message) => { if (errors.length < 40) errors.push(`${at}: ${message}`); };
  try {
    const raw = typeof input === 'string' ? input : JSON.stringify(input);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > FRONTEND_HANDOFF_LIMITS.bytes) return { ok: false, errors: ['document: JSON must be at most 256 KiB'] };
    const value = JSON.parse(raw);
    const object = (x, at, required, optional = []) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) { fail(at, 'must be an object'); return false; }
      for (const key of required) if (!Object.hasOwn(x, key)) fail(`${at}.${key}`, 'required');
      for (const key of Object.keys(x)) if (![...required, ...optional].includes(key)) fail(`${at}.${key}`, 'unknown field');
      return true;
    };
    const text = (x, at, max = 400) => {
      if (typeof x !== 'string' || !x.trim() || x.length > max || /[\x00-\x08\x0b-\x1f]/.test(x)) { fail(at, `must be nonempty text up to ${max} characters`); return false; }
      if (forbiddenContent.test(x)) fail(at, 'source code, executable content, credentials or absolute addresses are not allowed');
      return true;
    };
    const list = (x, at, max, min = 0) => {
      if (!Array.isArray(x) || x.length < min || x.length > max) { fail(at, `must contain ${min}..${max} items`); return []; }
      return x;
    };
    const id = (x, at) => { if (typeof x !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(x)) fail(at, 'invalid identifier'); };
    const hash = (x, at) => { if (typeof x !== 'string' || !/^[a-f0-9]{64}$/.test(x)) fail(at, 'must be lowercase SHA-256'); };
    if (!object(value, 'document', ['schema', 'package_id', 'created_at', 'module', 'source', 'pages', 'unresolved'])) return { ok: false, errors };
    if (value.schema !== FRONTEND_HANDOFF_SCHEMA) fail('schema', 'unsupported schema; no implicit upgrade');
    id(value.package_id, 'package_id');
    if (typeof value.created_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value.created_at) || !Number.isFinite(Date.parse(value.created_at))) fail('created_at', 'must be a UTC ISO timestamp');
    if (object(value.module, 'module', ['name', 'aliases'])) {
      text(value.module.name, 'module.name', 100);
      const aliases = list(value.module.aliases, 'module.aliases', 20);
      aliases.forEach((name, i) => text(name, `module.aliases[${i}]`, 100));
      if (new Set(aliases).size !== aliases.length) fail('module.aliases', 'duplicates');
    }
    const files = new Map();
    if (object(value.source, 'source', ['revision', 'files', 'snapshot_sha256'])) {
      if (value.source.revision !== null) text(value.source.revision, 'source.revision', 120);
      for (const [i, file] of list(value.source.files, 'source.files', FRONTEND_HANDOFF_LIMITS.files, 1).entries()) {
        const at = `source.files[${i}]`;
        if (!object(file, at, ['path', 'sha256', 'line_count'])) continue;
        if (!isHandoffSourcePath(file.path)) fail(`${at}.path`, 'must be an allowed relative source path');
        hash(file.sha256, `${at}.sha256`);
        if (!Number.isSafeInteger(file.line_count) || file.line_count < 1 || file.line_count > 100000) fail(`${at}.line_count`, 'invalid line count');
        if (files.has(file.path)) fail(`${at}.path`, 'duplicate source path');
        files.set(file.path, file);
      }
      hash(value.source.snapshot_sha256, 'source.snapshot_sha256');
      if (Array.isArray(value.source.files) && value.source.files.every(x => x && typeof x.path === 'string') && sourceSnapshotHash(value.source.files) !== value.source.snapshot_sha256) fail('source.snapshot_sha256', 'does not match source manifest');
    }
    const refs = (items, at) => {
      for (const [i, ref] of list(items, at, 12, 1).entries()) {
        if (!object(ref, `${at}[${i}]`, ['path', 'start_line', 'end_line'])) continue;
        const file = files.get(ref.path);
        if (!file) fail(`${at}[${i}].path`, 'not present in source manifest');
        if (!Number.isSafeInteger(ref.start_line) || !Number.isSafeInteger(ref.end_line) || ref.start_line < 1 || ref.end_line < ref.start_line || ref.end_line > (file?.line_count || 0) || ref.end_line - ref.start_line > 500) fail(`${at}[${i}]`, 'invalid or excessive source line range');
      }
    };
    const ids = new Set();
    let controlCount = 0;
    for (const [p, page] of list(value.pages, 'pages', FRONTEND_HANDOFF_LIMITS.pages, 1).entries()) {
      const at = `pages[${p}]`;
      if (!object(page, at, ['id', 'name', 'entry_paths', 'source_refs', 'controls', 'waits', 'technical_notes'])) continue;
      id(page.id, `${at}.id`); text(page.name, `${at}.name`, 100);
      if (ids.has(page.id)) fail(`${at}.id`, 'duplicate page id'); ids.add(page.id);
      for (const route of list(page.entry_paths, `${at}.entry_paths`, 10)) if (typeof route !== 'string' || route.length > 240 || !/^\/(?!\/)[^?#\s\\]*$/.test(route) || route.includes('..') || forbiddenContent.test(route)) fail(`${at}.entry_paths`, 'only query-free relative routes are allowed');
      refs(page.source_refs, `${at}.source_refs`);
      const controlIds = new Set();
      for (const [c, control] of list(page.controls, `${at}.controls`, 100).entries()) {
        controlCount++;
        const ca = `${at}.controls[${c}]`;
        if (!object(control, ca, ['id', 'purpose', 'locator_candidates', 'source_refs', 'notes'])) continue;
        id(control.id, `${ca}.id`); text(control.purpose, `${ca}.purpose`, 160);
        if (controlIds.has(control.id)) fail(`${ca}.id`, 'duplicate control id'); controlIds.add(control.id);
        refs(control.source_refs, `${ca}.source_refs`);
        list(control.notes, `${ca}.notes`, 6).forEach((note, i) => text(note, `${ca}.notes[${i}]`));
        for (const [l, locator] of list(control.locator_candidates, `${ca}.locator_candidates`, 5).entries()) {
          const la = `${ca}.locator_candidates[${l}]`;
          if (!object(locator, la, ['strategy', 'value', 'evidence'], ['role', 'scope'])) continue;
          if (!['role', 'label', 'placeholder', 'testid', 'css'].includes(locator.strategy)) fail(`${la}.strategy`, 'unsupported strategy');
          text(locator.value, `${la}.value`, 240);
          if (locator.evidence !== 'source-derived') fail(`${la}.evidence`, 'must be source-derived; runtime verification is separate');
          if (locator.strategy === 'role') { if (typeof locator.role !== 'string' || !/^[a-z]{3,30}$/.test(locator.role)) fail(`${la}.role`, 'required ARIA role'); }
          else if (Object.hasOwn(locator, 'role')) fail(`${la}.role`, 'only valid for role strategy');
          if (Object.hasOwn(locator, 'scope')) text(locator.scope, `${la}.scope`, 240);
          if (locator.strategy === 'css' && typeof locator.value === 'string' && /[{};`]|=>|\b(?:javascript|xpath)\s*:|\[\s*(?:value|password|token|secret|src|href)\s*=/i.test(locator.value)) fail(`${la}.value`, 'unsafe selector or business input value');
        }
      }
      for (const [w, wait] of list(page.waits, `${at}.waits`, 30).entries()) {
        if (!object(wait, `${at}.waits[${w}]`, ['id', 'description', 'source_refs'])) continue;
        id(wait.id, `${at}.waits[${w}].id`); text(wait.description, `${at}.waits[${w}].description`); refs(wait.source_refs, `${at}.waits[${w}].source_refs`);
      }
      for (const [n, note] of list(page.technical_notes, `${at}.technical_notes`, 30).entries()) {
        if (!object(note, `${at}.technical_notes[${n}]`, ['description', 'source_refs'])) continue;
        text(note.description, `${at}.technical_notes[${n}].description`); refs(note.source_refs, `${at}.technical_notes[${n}].source_refs`);
      }
    }
    if (controlCount > FRONTEND_HANDOFF_LIMITS.controls) fail('pages.controls', 'total exceeds limit');
    for (const [i, item] of list(value.unresolved, 'unresolved', 40).entries()) {
      if (!object(item, `unresolved[${i}]`, ['topic', 'reason'])) continue;
      text(item.topic, `unresolved[${i}].topic`, 120); text(item.reason, `unresolved[${i}].reason`);
    }
    return errors.length ? { ok: false, errors } : { ok: true, errors: [], package: value, sha256: frontendHandoffHash(value) };
  } catch { return { ok: false, errors: ['document: invalid JSON or unsupported value'] }; }
}

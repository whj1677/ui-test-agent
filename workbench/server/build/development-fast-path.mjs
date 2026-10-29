import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'acorn';
import { verifyBundle } from './development-bundle.mjs';

export const SELF_TEST_MODE = 'self-test-v1';
export const selfTestOnly = policy => policy?.quality_review_mode === SELF_TEST_MODE;

// Navigation observations are hints, never case requirements or assertion values.
// Reuse only finalized, intact evidence from a passing task in the same scope.
export async function verifiedNavigationHints(store, tasks, { projectId, module, environmentRef, role = null, normalUrl }) {
  if (!module) return [];
  const origin = new URL(normalUrl).origin;
  const prefix = environmentRef.network_policy?.path_prefix || '/';
  const inScope = url => url.origin === origin && !url.username && !url.password && !url.search && !url.hash &&
    (prefix === '/' || url.pathname === prefix || url.pathname.startsWith(prefix.replace(/\/$/, '') + '/'));
  const sources = tasks.filter(task => task.source?.project_id === projectId &&
    task.input_bundle?.snapshot?.content?.module === module &&
    task.verification_status === 'TECHNICAL_VALIDATION_PASSED' && task.finished_at &&
    (task.auth_requirement?.role || null) === role &&
    isDeepStrictEqual(task.environment_ref, environmentRef)).sort((a, b) => b.finished_at.localeCompare(a.finished_at)).slice(0, 3);
  for (const task of sources) {
    const file = task.files?.find(item => item.relative_path === 'development/harness-events.json');
    const candidate = task.candidates?.at(-1);
    if (!file || !candidate?.bundle || !candidate.trial_runs?.some(run => run.run_type === 'normal' && run.complete_pass && run.same_candidate_hash)) continue;
    try {
      const root = store.taskDirectory(task.task_id);
      if (!await verifyBundle(path.join(root, 'development/final'), candidate.bundle)) continue;
      const bytes = await fs.readFile(path.join(root, file.relative_path));
      if (bytes.length > 4_000_000 || createHash('sha256').update(bytes).digest('hex').toUpperCase() !== file.sha256.toUpperCase()) continue;
      const calls = new Map(), clicks = [], hints = [];
      for (const event of JSON.parse(bytes.toString('utf8'))) {
        if (event.type === 'tool_call') calls.set(event.callId, event.tool);
        if (event.type !== 'tool_result' || event.status !== 'completed' || typeof event.result !== 'string') continue;
        const tool = calls.get(event.callId);
        if (!['mcp__playwright-mcp__browser_click', 'mcp__playwright-mcp__browser_snapshot', 'mcp__playwright-mcp__browser_navigate'].includes(tool)) continue;
        const urlText = event.result.match(/^- Page URL: (\S+)$/m)?.[1];
        if (!urlText) continue;
        const url = new URL(urlText);
        if (!inScope(url)) continue;
        const action = event.result.match(/```js\s*\n(await page\.(?:getByRole|getByText|locator)\([^\n]{1,220}\.click\(\);)\s*\n```/)?.[1];
        if (tool.endsWith('browser_click') && action) clicks.push(action);
        if (url.href === normalUrl || hints.some(item => item.url === url.href)) continue;
        hints.push({ url: url.href, navigation_actions: clicks.slice(-2), source_task_id: task.task_id,
          source_bundle_sha256: candidate.bundle.sha256, evidence_sha256: file.sha256 });
        // Only the first destination: later routes may belong to business actions.
        break;
      }
      if (hints.length) return hints;
    } catch { /* Missing, changed or malformed optional evidence cannot block generation. */ }
  }
  return [];
}

const locatorMethods = new Set(['locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTestId', 'filter', 'first', 'last', 'nth']);
const namedControlRoles = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'checkbox', 'radio', 'combobox', 'textbox', 'searchbox', 'spinbutton', 'slider', 'switch']);
const sensitiveLocator = /password|passwd|secret|token|credential|authorization|cookie|session|密码|口令|密钥|验证码|https?:|\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{1,3}(?:\.\d{1,3}){3}\b|[a-f\d]{24,}|\d{7,}/i;

// A deliberately small data grammar. Never copy source text: comments, actions,
// assertions, helper bodies and dynamic data cannot become executable hints.
function staticLocatorExpressions(code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const expressions = new Set(), reassigned = new Set();
  const children = node => Object.values(node).flatMap(value => Array.isArray(value) ? value : [value]).filter(value => value?.type);
  const names = node => node?.type === 'Identifier' ? [node.name] : node ? children(node).flatMap(names) : [];
  function scan(node) {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') for (const name of names(node.left || node.argument)) reassigned.add(name);
    children(node).forEach(scan);
  }
  scan(ast);
  function text(node) {
    return node?.type === 'Literal' && typeof node.value === 'string' && node.value.length > 0 && node.value.length <= 100 &&
      !/[\r\n\x00-\x1f]/.test(node.value) && !sensitiveLocator.test(node.value) ? node.value : null;
  }
  function selector(node) {
    const value = text(node);
    if (!value || value.length > 100 || /xpath|text\s*=|:has-text|:text|>>|[{};`\\]/i.test(value)) return null;
    // Structural CSS only. Attribute values that might be fixture data are not
    // reusable; names, labels and placeholders are technical control identities.
    let structure = value.replace(/\[\s*(role|type|name|placeholder|aria-label|data-testid)\s*=\s*(?:"[^"\]\r\n]*"|'[^'\]\r\n]*'|[\w-]+)\s*\]/g, '');
    if (/[\[\]=]/.test(structure) || !/^[\w\s.#:(),>+*~-]+$/.test(structure)) return null;
    if ([...structure.matchAll(/:([\w-]+)/g)].some(match => !['visible', 'not', 'is', 'scope'].includes(match[1]))) return null;
    return value;
  }
  function object(node, allowed, env, depth) {
    if (node?.type !== 'ObjectExpression') return null;
    const entries = [], seen = new Set();
    for (const property of node.properties) {
      const key = property.key?.name || property.key?.value;
      if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init' || !allowed.has(key) || seen.has(key)) return null;
      seen.add(key);
      let value;
      if (['exact', 'visible'].includes(key)) value = property.value.type === 'Literal' && typeof property.value.value === 'boolean' ? String(property.value.value) : null;
      else if (['has', 'hasNot'].includes(key)) value = locator(property.value, env, depth + 1);
      else { const literal = text(property.value); value = literal === null ? null : JSON.stringify(literal); }
      if (value === null) return null;
      entries.push(`${key}: ${value}`);
    }
    return entries.length ? `{ ${entries.join(', ')} }` : null;
  }
  function locator(node, env, depth = 0) {
    if (!node || depth > 8) return null;
    if (node.type === 'Identifier') return reassigned.has(node.name) ? null : env.get(node.name) || null;
    if (node.type !== 'CallExpression' || node.optional || node.callee.type !== 'MemberExpression' || node.callee.computed || node.callee.optional) return null;
    const method = node.callee.property.name;
    if (!locatorMethods.has(method)) return null;
    // Text content and names of data/display roles may themselves be another
    // case's expected value or fixture. Reuse control identities only; menu text
    // can still be learned through separately verified navigation observations.
    if (method === 'getByText') return null;
    const base = locator(node.callee.object, env, depth + 1);
    if (!base) return null;
    const args = node.arguments;
    let rendered;
    if (['first', 'last'].includes(method)) rendered = base !== 'page' && !args.length ? '' : null;
    else if (method === 'nth') rendered = base !== 'page' && args.length === 1 && args[0].type === 'Literal' && Number.isInteger(args[0].value) && args[0].value >= 0 && args[0].value < 20 ? String(args[0].value) : null;
    else if (method === 'filter') rendered = base !== 'page' && args.length === 1 ? object(args[0], new Set(['visible', 'has', 'hasNot']), env, depth) : null;
    else {
      const value = method === 'locator' ? selector(args[0]) : text(args[0]);
      if (value === null || args.length < 1 || args.length > (method === 'getByTestId' || method === 'locator' ? 1 : 2)) return null;
      if (method === 'getByRole' && !/^[a-z]+$/.test(value)) return null;
      rendered = JSON.stringify(value);
      if (args.length === 2) {
        if (method === 'getByRole' && !namedControlRoles.has(value) && args[1].properties?.some(property => (property.key?.name || property.key?.value) === 'name')) return null;
        const options = object(args[1], new Set(method === 'getByRole' ? ['name', 'exact'] : ['exact']), env, depth);
        if (options === null) return null;
        rendered += `, ${options}`;
      }
    }
    if (rendered === null) return null;
    const result = `${base}.${method}(${rendered})`;
    return result.length <= 320 ? result : null;
  }
  function walk(node, inherited) {
    let env = inherited;
    if (['Program', 'BlockStatement', 'ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
      env = new Map(inherited);
      for (const parameter of node.params || []) for (const name of names(parameter)) env.set(name, name === 'page' ? 'page' : null);
      // Hoisted/shadowing bindings must not accidentally reuse an outer alias.
      for (const statement of node.body?.body || (Array.isArray(node.body) ? node.body : [])) {
        if (statement.type === 'VariableDeclaration') for (const declaration of statement.declarations) for (const name of names(declaration.id)) env.set(name, null);
        if (statement.type === 'FunctionDeclaration' && statement.id) env.set(statement.id.name, null);
      }
    }
    if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) {
        if (declaration.init) walk(declaration.init, env);
        if (declaration.id.type === 'Identifier') env.set(declaration.id.name, node.kind === 'const' ? locator(declaration.init, env) : null);
      }
      return;
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && locatorMethods.has(node.callee.property?.name)) {
      const expression = locator(node, env);
      if (expression && expression !== 'page') expressions.add(expression);
      // Do not silently discard a dynamic filter and suggest its broader prefix.
      return;
    }
    children(node).forEach(child => walk(child, env));
  }
  walk(ast, new Map([['page', 'page']]));
  // Prefer scoped chains and explicit visibility before broad structural roots.
  return [...expressions].sort((a, b) => Number(b.includes(':visible') || b.includes('visible: true')) - Number(a.includes(':visible') || a.includes('visible: true')) || b.split(').').length - a.split(').').length);
}

export async function verifiedLocatorHints(store, tasks, { projectId, module, environmentRef, role = null, normalUrl }) {
  if (!module || !environmentRef) return [];
  try {
    const entry = new URL(normalUrl), policy = environmentRef.network_policy, prefix = policy?.path_prefix || '/';
    if (entry.username || entry.password || entry.search || entry.hash || policy?.origin && policy.origin !== entry.origin ||
      !(prefix === '/' || entry.pathname === prefix || entry.pathname.startsWith(prefix.replace(/\/$/, '') + '/'))) return [];
  } catch { return []; }
  const sources = tasks.filter(task => task.source?.project_id === projectId && task.input_bundle?.snapshot?.content?.module === module &&
    task.verification_status === 'TECHNICAL_VALIDATION_PASSED' && task.finished_at && (task.auth_requirement?.role || null) === role &&
    isDeepStrictEqual(task.environment_ref, environmentRef)).sort((a, b) => b.finished_at.localeCompare(a.finished_at)).slice(0, 3);
  const hints = [], seen = new Set();
  for (const task of sources) {
    const candidate = task.candidates?.at(-1), manifest = candidate?.bundle;
    if (!manifest || !candidate.trial_runs?.some(run => run.run_type === 'normal' && run.complete_pass && run.same_candidate_hash)) continue;
    try {
      if (!Array.isArray(manifest.files) || manifest.files.length > 100 || manifest.files.some(file => !file.path || path.isAbsolute(file.path) || /[\\:]/.test(file.path) || file.path.split('/').some(part => !part || part === '..' || part === '.') || !Number.isInteger(file.bytes) || file.bytes < 0) ||
        manifest.files.reduce((sum, file) => sum + file.bytes, 0) > 2 * 1024 * 1024 || createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex').toUpperCase() !== manifest.sha256) continue;
      const final = path.join(store.taskDirectory(task.task_id), 'development/final');
      if (!await verifyBundle(final, manifest)) continue;
      const file = manifest.files.find(item => item.path === 'candidate.spec.mjs');
      if (!file || file.bytes > 64 * 1024) continue;
      const bytes = await fs.readFile(path.join(final, file.path));
      if (bytes.length > 64 * 1024 || createHash('sha256').update(bytes).digest('hex').toUpperCase() !== file.sha256.toUpperCase()) continue;
      for (const expression of staticLocatorExpressions(bytes.toString('utf8'))) {
        if (seen.has(expression)) continue;
        seen.add(expression);
        hints.push({ expression, source_task_id: task.task_id, source_bundle_sha256: manifest.sha256, source_file_sha256: file.sha256,
          advisory_only: true, requires_live_validation: true });
        if (hints.length >= 12) return hints;
      }
    } catch { /* Optional hints never block a new task when evidence is malformed or stale. */ }
  }
  return hints;
}

export function prerequisiteBlocker(frozenCase, state, args, now) {
  const sources = [frozenCase.preconditions, frozenCase.test_data,
    ...frozenCase.steps.flatMap(step => [step.precondition, step.preconditions])].filter(Boolean).map(value => typeof value === 'string' ? value : JSON.stringify(value));
  if (!Number.isInteger(state.observation_epoch) || state.observation_epoch < 1) throw Error('BLOCKER_REQUIRES_PAGE_OBSERVATION');
  if (typeof args.requirement !== 'string' || args.requirement.trim().length < 4 || args.requirement.length > 4000 || !sources.some(value => value.includes(args.requirement))) throw Error('BLOCKER_REQUIRES_FROZEN_PRECONDITION');
  if (typeof args.observed !== 'string' || !args.observed.trim() || args.observed.length > 2000 || typeof args.reason !== 'string' || !args.reason.trim() || args.reason.length > 2000) throw Error('BLOCKER_EVIDENCE_REQUIRED');
  return { schema: 'workbench/prerequisite-blocker-v1', status: 'ENVIRONMENT_BLOCKED',
    requirement: args.requirement, observed: args.observed, reason: args.reason,
    observation_epoch: state.observation_epoch, reported_at: now, source: 'AGENT_OBSERVATION', verified_absence: false };
}

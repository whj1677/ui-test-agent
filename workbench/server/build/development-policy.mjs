import { checkDomRead } from './development-dom-read.mjs';
import { parse } from 'acorn';
import { developmentError } from './development-feedback.mjs';

// Execution policy, not a locator diagnosis or business oracle. Semantic coverage still needs review.
export function checkDevelopmentCandidate(code, { entry = true, importAllowed = () => false } = {}) {
  if (typeof code !== 'string' || Buffer.byteLength(code) > 64 * 1024) throw new Error('DRAFT_SIZE_INVALID');
  let ast;
  try { ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (error) { throw developmentError('DRAFT_SYNTAX_INVALID', { rule: 'ES_MODULE_SYNTAX', message: error.message, location: error.loc }); }
  const reject = (code, node, identifier = null) => {
    throw developmentError(code, { rule: identifier === 'require' ? 'ES_MODULE_IMPORT_REQUIRED' : code, node: node.type, identifier,
      location: { line: node.loc.start.line, column: node.loc.start.column + 1 },
      message: identifier === 'require' ? 'Drafts are ES modules (.mjs). Use a static import from @playwright/test; require is not supported.' : 'This syntax/capability is outside the task execution contract.' });
  };
  const denied = new Set(['require', 'eval', 'Function', 'globalThis', 'global', 'fetch', 'WebSocket', 'XMLHttpRequest', 'Buffer']);
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source && node.source.value !== '@playwright/test' && !importAllowed(node.source.value)) reject('ONLY_LOCKED_PLAYWRIGHT_IMPORT_ALLOWED', node);
    if (['ImportExpression'].includes(node.type)) reject('DYNAMIC_IMPORT_OR_SWALLOWED_ERROR_NOT_ALLOWED', node);
    if (node.type === 'Identifier' && denied.has(node.name)) reject('DRAFT_EXECUTION_CAPABILITY_NOT_ALLOWED', node, node.name);
    if (node.type === 'Identifier' && node.name === 'process' && code.slice(parent.start, parent.end) !== 'process.env') reject('PROCESS_ACCESS_NOT_ALLOWED', node);
    if (node.type === 'MemberExpression') {
      const property = node.computed ? node.property.value : node.property.name;
      if (['skip', 'fixme', 'fail', 'only', 'constructor', '__proto__', 'route', 'routeFromHAR', 'setContent', 'addInitScript',  'newContext', 'newPage', 'context', 'browser', 'request', 'launch', 'storageState', 'addCookies', 'writeFile', 'send', 'connect', 'setInputFiles'].includes(property)) reject('DRAFT_BYPASS_NOT_ALLOWED', node, property);
      if (code.slice(node.object.start, node.object.end) === 'process.env' && property !== 'PROBE_URL') reject('ENV_ACCESS_NOT_ALLOWED', node);
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && (node.callee.computed ? node.callee.property.value : node.callee.property.name) === 'goto') {
      if (node.arguments.length !== 1 || code.slice(node.arguments[0].start, node.arguments[0].end) !== 'process.env.PROBE_URL') reject('ONLY_BOUND_NAVIGATION_ALLOWED', node);
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const method = node.callee.computed ? node.callee.property.value : node.callee.property.name;
      if (['evaluate', 'evaluateAll'].includes(method)) {
        if (node.arguments.length !== 1) reject('DOM_READ_CONTRACT_REQUIRED', node);
        checkDomRead(code.slice(node.arguments[0].start, node.arguments[0].end));
      }
      if (method === 'screenshot' && node.arguments.length) reject('SCREENSHOT_OUTPUT_PATH_NOT_ALLOWED', node, 'Use screenshot() and testInfo.attach for runner-owned output');
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(value)) value.forEach(item => walk(item, node));
      else if (value && typeof value === 'object') walk(value, node);
    }
  }
  walk(ast, null);
  if (entry && !code.includes('process.env.PROBE_URL')) throw new Error('BOUND_ENTRY_REQUIRED');
  // No alternate destinations: navigation uses the runner-provided entry exclusively.
  const urls = code.match(/https?:\/\/[^\s'"`]+/g) || [];
  if (urls.length) throw new Error('HARDCODED_DESTINATION_NOT_ALLOWED');
  return { policy_version: 'development-candidate-v1', semantic_approval: false };
}

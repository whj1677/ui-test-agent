import { parse } from 'acorn';

// Execution policy, not a locator diagnosis or business oracle. Semantic coverage still needs review.
export function checkDevelopmentCandidate(code) {
  if (typeof code !== 'string' || Buffer.byteLength(code) > 64 * 1024) throw new Error('DRAFT_SIZE_INVALID');
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const denied = new Set(['require', 'eval', 'Function', 'globalThis', 'global', 'fetch', 'WebSocket', 'XMLHttpRequest', 'Buffer']);
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration' && node.source.value !== '@playwright/test') throw new Error('ONLY_LOCKED_PLAYWRIGHT_IMPORT_ALLOWED');
    if (['ImportExpression', 'CatchClause'].includes(node.type)) throw new Error('DYNAMIC_IMPORT_OR_SWALLOWED_ERROR_NOT_ALLOWED');
    if (node.type === 'Identifier' && denied.has(node.name)) throw new Error('DRAFT_EXECUTION_CAPABILITY_NOT_ALLOWED');
    if (node.type === 'Identifier' && node.name === 'process' && code.slice(parent.start, parent.end) !== 'process.env') throw new Error('PROCESS_ACCESS_NOT_ALLOWED');
    if (node.type === 'MemberExpression') {
      const property = node.computed ? node.property.value : node.property.name;
      if (['skip', 'fixme', 'fail', 'only', 'catch', 'constructor', '__proto__', 'route', 'routeFromHAR', 'setContent', 'addInitScript', 'evaluate', 'evaluateAll', 'newContext', 'newPage', 'context', 'browser', 'request', 'launch', 'screenshot', 'storageState', 'addCookies', 'writeFile', 'send', 'connect', 'setInputFiles'].includes(property)) throw new Error('DRAFT_BYPASS_NOT_ALLOWED:' + property);
      if (code.slice(node.object.start, node.object.end) === 'process.env' && property !== 'PROBE_URL') throw new Error('ENV_ACCESS_NOT_ALLOWED');
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && (node.callee.computed ? node.callee.property.value : node.callee.property.name) === 'goto') {
      if (node.arguments.length !== 1 || code.slice(node.arguments[0].start, node.arguments[0].end) !== 'process.env.PROBE_URL') throw new Error('ONLY_BOUND_NAVIGATION_ALLOWED');
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(value)) value.forEach(item => walk(item, node));
      else if (value && typeof value === 'object') walk(value, node);
    }
  }
  walk(ast, null);
  if (!code.includes('process.env.PROBE_URL')) throw new Error('BOUND_ENTRY_REQUIRED');
  // No alternate destinations: navigation uses the runner-provided entry exclusively.
  const urls = code.match(/https?:\/\/[^\s'"`]+/g) || [];
  if (urls.length) throw new Error('HARDCODED_DESTINATION_NOT_ALLOWED');
  return { policy_version: 'development-candidate-v1', semantic_approval: false };
}

import { parse } from 'acorn';
import { developmentError } from './development-feedback.mjs';
// A finite read-only browser expression contract, NOT a general JavaScript sandbox.
export function checkDomRead(source) {
  const ast = parse(`(${source})`, { ecmaVersion: 'latest', locations: true });
  const calls = new Set(['getElementById','querySelector','querySelectorAll','getAttribute','hasAttribute','getBoundingClientRect','getComputedStyle','isArray','from','map','filter','slice','includes','trim','toLowerCase','toUpperCase']);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    const property = node.type === 'MemberExpression' ? node.computed ? node.property.value : node.property.name : null;
    if (['AssignmentExpression','UpdateExpression','NewExpression','ImportExpression','AwaitExpression'].includes(node.type) || property && ['constructor','__proto__','cookie','localStorage','sessionStorage','location'].includes(property) || node.type === 'Identifier' && ['fetch','eval','Function','window','globalThis','navigator'].includes(node.name) || node.type === 'UnaryExpression' && node.operator === 'delete' || node.type === 'CallExpression' && !(node.callee.type === 'MemberExpression' && calls.has(node.callee.computed ? node.callee.property.value : node.callee.property.name) || node.callee.type === 'Identifier' && node.callee.name === 'getComputedStyle')) throw developmentError('DOM_READ_CONTRACT_REQUIRED', { rule: 'READ_ONLY_DOM_EXPRESSION', node: node.type, location: node.loc.start, message: 'Use DOM selectors, attribute/text/state reads and read-only array mapping; mutation, arbitrary calls and browser globals require a controlled entry. Use browser_snapshot for unsupported expressions.' });
    if (node.type === 'MemberExpression' && node.computed && node.property.type !== 'Literal') throw developmentError('DOM_READ_CONTRACT_REQUIRED');
    for (const [key,value] of Object.entries(node)) if (key !== 'loc') { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); }
  }
  visit(ast); return true;
}

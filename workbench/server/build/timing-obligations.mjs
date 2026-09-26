import { parse } from 'acorn';

// This deliberately recognizes one narrow form of a frozen requirement. It is
// not a natural-language timing oracle; the runner owns the actual observation.
const UNIT = '(?:ms|毫秒|s|秒)';
const RANGE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT})?\\s*[-–—~～至到]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT})(?![A-Za-z])`, 'gi');
const TIME_UNIT = /\d+(?:\.\d+)?\s*(?:ms|毫秒|s|秒)(?![A-Za-z])/i;
const TIME_UNIT_GLOBAL = /\d+(?:\.\d+)?\s*(?:ms|毫秒|s|秒)(?![A-Za-z])/gi;
const UNITLESS_TIME_RANGE = /(?:约|大约|持续|加载|提示)[^；;。]{0,40}\d+(?:\.\d+)?\s*[-–—~～至到]\s*\d+(?:\.\d+)?\s*(?:后|消失|结束)/u;
const QUOTED = /[“「"']([^”」"']+)[”」"']/g;

function toMilliseconds(value, unit) {
  return Number(value) * (/^(?:s|秒)$/i.test(unit) ? 1000 : 1);
}

function quotedLoadingTargets(clause) {
  const targets = [];
  for (const match of clause.matchAll(QUOTED)) {
    const preceding = clause.slice(Math.max(0, match.index - 12), match.index);
    if (/加载/.test(match[1]) || /加载提示\s*$/.test(preceding)) targets.push(match[1]);
  }
  return targets;
}

export function extractTimingObligations(frozenCase) {
  const obligations = [];
  for (const [index, step] of (frozenCase?.steps ?? []).entries()) {
    const requirement = String(step.expected ?? '');
    const ranges = [...requirement.matchAll(RANGE)];
    if (!ranges.length && !TIME_UNIT.test(requirement) && !UNITLESS_TIME_RANGE.test(requirement)) continue;
    const order = step.order ?? index + 1;
    const base = { id: `CASE_STEP_${order}:timing:1`, step: order, kind: 'visible_duration', requirement };
    const review = reason => ({ ...base, status: 'NEEDS_REVIEW', reason });
    if (ranges.length !== 1) {
      obligations.push(review(ranges.length ? 'MULTIPLE_TIME_RANGES' : 'TIME_RANGE_NOT_UNIQUELY_RECOGNIZED'));
      continue;
    }
    const range = ranges[0];
    if ([...requirement.matchAll(TIME_UNIT_GLOBAL)].some(match => match.index < range.index || match.index >= range.index + range[0].length)) {
      obligations.push(review('ADDITIONAL_TIME_LIMIT'));
      continue;
    }
    const beforeRange = requirement.slice(0, range.index);
    const clauseStart = Math.max(beforeRange.lastIndexOf('；'), beforeRange.lastIndexOf(';'), beforeRange.lastIndexOf('。'));
    const targets = quotedLoadingTargets(beforeRange.slice(clauseStart + 1));
    if (targets.length !== 1) {
      obligations.push(review(targets.length ? 'MULTIPLE_LOADING_TARGETS' : 'QUOTED_LOADING_TARGET_REQUIRED'));
      continue;
    }
    const min_ms = toMilliseconds(range[1], range[2] || range[4]);
    const max_ms = toMilliseconds(range[3], range[4]);
    if (!Number.isFinite(min_ms) || !Number.isFinite(max_ms) || min_ms < 0 || min_ms > max_ms) {
      obligations.push(review('INVALID_TIME_RANGE'));
      continue;
    }
    obligations.push({ ...base, target: targets[0], min_ms, max_ms, raw_range: range[0], status: 'RUNTIME_REQUIRED' });
  }
  return obligations;
}

function propertyName(member) {
  if (member?.type !== 'MemberExpression') return null;
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal') return member.property.value;
  return null;
}

function isReferenceIdentifier(node, parent, key) {
  if (node.type !== 'Identifier') return false;
  if (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if (parent?.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand) return false;
  return true;
}

export function checkCandidateTiming(code, frozenCase) {
  const obligations = extractTimingObligations(frozenCase);
  const violations = [];
  if (!obligations.length) return { obligations, violations };

  let ast;
  try { ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (error) {
    return { obligations, violations: [{ code: 'TIMING_CANDIDATE_SYNTAX_INVALID', line: error.loc?.line ?? null, column: error.loc ? error.loc.column + 1 : null, message: error.message }] };
  }

  const seen = new Set();
  const add = (node, violationCode, message) => {
    const line = node?.loc?.start.line ?? null;
    const column = node?.loc ? node.loc.start.column + 1 : null;
    const identity = `${violationCode}:${node?.start}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    violations.push({ code: violationCode, line, column, message });
  };
  const clockMessage = 'Candidate-owned clocks cannot establish visible loading duration. The trusted runner measures the quoted loading target against the frozen range.';

  function inspect(node, parent = null, key = null) {
    if (!node || typeof node !== 'object' || !node.type) return;
    if (node.type === 'Identifier' && isReferenceIdentifier(node, parent, key)
        && ['Date', 'performance', 'Temporal'].includes(node.name))
      add(node, 'TIMING_MUST_USE_RUNNER_OBSERVATION', clockMessage);
    if (node.type === 'MemberExpression') {
      const object = node.object;
      const property = propertyName(node);
      if (object.type === 'Identifier' && ['window', 'self', 'globalThis', 'global'].includes(object.name)
          && (['Date', 'performance', 'Temporal'].includes(property) || (node.computed && property == null)))
        add(node, 'TIMING_MUST_USE_RUNNER_OBSERVATION', clockMessage);
      if (object.type === 'Identifier' && object.name === 'process' && property === 'hrtime')
        add(node, 'TIMING_MUST_USE_RUNNER_OBSERVATION', clockMessage);
      if (object.type === 'Identifier' && object.name === 'document' && property === 'timeline')
        add(node, 'TIMING_MUST_USE_RUNNER_OBSERVATION', clockMessage);
    }
    if (node.type === 'Identifier' && node.name === 'requestAnimationFrame' && isReferenceIdentifier(node, parent, key))
      add(node, 'TIMING_MUST_USE_RUNNER_OBSERVATION', clockMessage);
    for (const [childKey, child] of Object.entries(node)) {
      if (childKey === 'loc') continue;
      if (Array.isArray(child)) child.forEach(value => inspect(value, node, childKey));
      else if (child && typeof child === 'object') inspect(child, node, childKey);
    }
  }
  inspect(ast);

  return { obligations, violations };
}

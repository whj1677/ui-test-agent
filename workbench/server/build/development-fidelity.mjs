import { parse } from 'acorn';

// Deliberately finite: named-button disabled predicates and explicit label+scalar
// clauses. This is not a natural-language oracle or a proof of arbitrary JS.
export function extractObligations(frozenCase) {
  const obligations = [];
  for (const step of frozenCase.steps) {
    const text = step.expected;
    for (const match of text.matchAll(/(?:^|[；;，,])\s*([^；;，,]+?)按钮(?:必须|应当|应)?(?:处于)?禁用(或(?:不可见|隐藏))?/g))
      obligations.push({ step: step.order, requirement: text, target: match[1].trim(), kind: 'disabled', relation: match[2] ? 'disabled OR hidden' : 'disabled', value: 'disabled' });
    for (const clause of text.split(/[；;]/)) {
      const match = /^\s*([\p{L}][\p{L}\s]{0,30}?)[：:]?\s*(\d[\d\s:./%-]*(?:[A-Za-z°]+)?)\s*$/u.exec(clause);
      if (match) obligations.push({ step: step.order, requirement: text, target: match[1].trim(), kind: 'field', relation: 'field equals frozen value', value: match[2].trim() });
    }
  }
  return obligations;
}

export function checkFidelity(code, frozenCase) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const steps = new Map();
  const property = n => n?.computed ? n.property.value : n?.property?.name;
  const fn = n => ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(n?.type);
  const unknown = () => ({ kind: 'unknown' });
  function value(n, env) {
    if (!n) return unknown();
    if (n.type === 'Literal') return n.value;
    if (n.type === 'Identifier') return env.get(n.name) ?? unknown();
    if (n.type === 'ObjectExpression') return Object.fromEntries(n.properties.filter(p => p.type === 'Property').map(p => [p.key.name || p.key.value, value(p.value, env)]));
    if (fn(n)) return { kind: 'function', node: n, env };
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
      const base = value(n.callee.object, env), method = property(n.callee);
      if (base?.kind === 'locator' && ['getByRole','getByText','getByLabel','getByTestId','locator','filter','nth','first','last'].includes(method))
        return { kind: 'locator', parts: [...base.parts, { method, args: n.arguments.map(a => value(a, env)) }] };
    }
    return unknown();
  }
  function expression(n, state, awaited = false, stack = []) {
    if (!n) return [state];
    if (n.type === 'AwaitExpression') return expression(n.argument, state, true, stack);
    if (n.type !== 'CallExpression') return [{ ...state, unknown: true }];
    const method = n.callee.type === 'MemberExpression' ? property(n.callee) : null;
    if (method === 'step' && n.callee.object.name === 'test') {
      const marker = /^CASE_STEP_(\d+)(?:\b|:)/.exec(value(n.arguments[0], state.env));
      const callback = n.arguments[1];
      if (marker && fn(callback)) {
        const paths = block(callback.body, [{ env: new Map(state.env), facts: [], unknown: false }], []);
        if (steps.has(Number(marker[1]))) steps.set(Number(marker[1]), [{ facts: [], unknown: true }]);
        else steps.set(Number(marker[1]), paths);
      }
      return [state];
    }
    const assertion = n.callee.type === 'MemberExpression' && n.callee.object;
    if (awaited && assertion?.type === 'CallExpression' && assertion.callee.name === 'expect' && ['toBeDisabled','toBeHidden','toHaveText','toContainText','toBeVisible','toBeEnabled','toHaveCount'].includes(method)) {
      const target = value(assertion.arguments[0], state.env);
      return [{ ...state, facts: [...state.facts, { matcher: method, target, value: value(n.arguments[0], state.env), line: n.loc.start.line, called_from: stack }] }];
    }
    const helper = n.callee.type === 'Identifier' ? state.env.get(n.callee.name) : null;
    if (helper?.kind === 'function') {
      if (!awaited || stack.length >= 8) return [{ ...state, unknown: true }];
      const env = new Map(helper.env);
      for (const [i, p] of helper.node.params.entries()) { if (p.type !== 'Identifier') return [{ ...state, unknown: true }]; env.set(p.name, value(n.arguments[i], state.env)); }
      return block(helper.node.body, [{ ...state, env }], [...stack, n.loc.start.line]).map(p => ({ ...p, env: state.env, returned: false }));
    }
    if ((n.callee.name === 'test' || method === 'describe') && fn(n.arguments.at(-1))) {
      const env = new Map(state.env); env.set('page', { kind: 'locator', parts: [] });
      block(n.arguments.at(-1).body, [{ env, facts: [], unknown: false }], []); return [state];
    }
    // Ordinary awaited locator interactions do not establish assertion facts.
    if (awaited && n.callee.type === 'MemberExpression' && value(n.callee.object, state.env)?.kind === 'locator' && ['goto','click','selectOption','fill','waitFor','waitForTimeout'].includes(method)) return [state];
    return [{ ...state, unknown: true }];
  }
  function statement(n, state, stack) {
    if (state.returned) return [state];
    if (n.type === 'ImportDeclaration' || n.type === 'EmptyStatement') return [state];
    if (n.type === 'VariableDeclaration') {
      const env = new Map(state.env);
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier') return [{ ...state, unknown: true }];
        env.set(d.id.name, value(d.init, env));
      }
      return [{ ...state, env }];
    }
    if (n.type === 'FunctionDeclaration') { const env = new Map(state.env); env.set(n.id.name, { kind: 'function', node: n, env }); return [{ ...state, env }]; }
    if (n.type === 'ExpressionStatement') return expression(n.expression, state, false, stack);
    if (n.type === 'ReturnStatement') return expression(n.argument, state, false, stack).map(p => ({ ...p, returned: true }));
    if (n.type === 'BlockStatement') return block(n, [state], stack);
    if (n.type === 'IfStatement') return [
      ...statement(n.consequent, { ...state, env: new Map(state.env), facts: [...state.facts] }, stack),
      ...(n.alternate ? statement(n.alternate, { ...state, env: new Map(state.env), facts: [...state.facts] }, stack) : [state]),
    ];
    return [{ ...state, unknown: true }];
  }
  function block(n, states, stack) {
    if (n.type !== 'BlockStatement' && n.type !== 'Program') return states.flatMap(s => expression(n, s, false, stack));
    for (const item of n.body) {
      states = states.flatMap(s => statement(item, s, stack));
      if (states.length > 32) return [{ facts: [], env: new Map(), unknown: true }];
    }
    return states;
  }
  block(ast, [{ env: new Map(), facts: [], unknown: false }], []);
  const obligations = extractObligations(frozenCase).map(obligation => {
    const paths = steps.get(obligation.step) || [{ facts: [], unknown: true }];
    const match = fact => {
      if (fact.target?.kind !== 'locator') return false;
      const parts = fact.target.parts;
      if (obligation.kind === 'disabled') {
        const named = parts.some(p => p.method === 'getByRole' && p.args[0] === 'button' && p.args[1]?.name === obligation.target);
        return named && (fact.matcher === 'toBeDisabled' || (obligation.relation.includes('OR') && fact.matcher === 'toBeHidden'));
      }
      const identity = JSON.stringify(parts);
      const labeled = parts.some(p => ['getByText','getByLabel','getByRole','filter','locator'].includes(p.method) && JSON.stringify(p.args).includes(obligation.target));
      return labeled && !identity.includes(obligation.value) && ['toHaveText','toContainText'].includes(fact.matcher) && fact.value === obligation.value;
    };
    const results = paths.map(p => ({ satisfied: !p.unknown && p.facts.some(match), unknown_syntax: p.unknown, checks: p.facts.filter(match) }));
    return { ...obligation, status: results.every(p => p.satisfied) ? 'SUPPORTED' : results.some(p => p.unknown_syntax) ? 'NEEDS_REVIEW' : 'INSUFFICIENT', paths: results,
      explanation: obligation.kind === 'disabled' ? 'Each possible helper/branch path must assert the named target predicate. Hidden is permitted only by an explicit OR; toBeDisabled also requires a resolved element.' : 'Locate the field through its label/relationship independently of the expected value, then compare its text with the frozen value.' };
  });
  return { version: 'finite-obligations-v1', semantic_pass: false, human_review_required: true,
    scope: 'Literal named-button disabled/hidden predicates and label-bound scalar text equality; bounded direct helpers and if branches only. Other requirements and unsupported syntax are not proved.',
    status: obligations.some(o => o.status !== 'SUPPORTED') ? 'NEEDS_REVIEW' : obligations.length ? 'LIMITED_CHECKS_SATISFIED' : 'NO_SUPPORTED_OBLIGATIONS', obligations,
    remaining_requirements: frozenCase.steps.map(s => ({ step: s.order, requirement: s.expected, review: 'Non-extracted clauses require human review; these checks do not approve a candidate.' })) };
}

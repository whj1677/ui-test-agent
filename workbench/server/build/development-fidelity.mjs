import { parse } from 'acorn';
import { checkCandidateTiming } from './timing-obligations.mjs';

// Negative detection only. A matching word is a review lead, never a proof that
// an assertion is semantically entailed by that clause (or checks the right row).
const STATE_VALUES = [
  ['空闲', 'idle'], ['使用中', 'busy'], ['维护', 'maintenance'],
  ['在线', 'online'], ['离线', 'offline'], ['启用', 'enabled'], ['禁用', 'disabled'],
  ['成功', 'success'], ['失败', 'failed'], ['待处理', 'pending'],
];
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, child] of Object.entries(node)) if (key !== 'loc') {
    if (Array.isArray(child)) child.forEach(item => walk(item, visit));
    else if (child && typeof child === 'object') walk(child, visit);
  }
}
function memberName(node) { return node?.computed ? node.property?.value : node?.property?.name; }
// Visible business words only; this is not regex equivalence/entailment analysis.
// Escapes, unnamed/named groups and ASCII character classes can express generic
// nonempty predicates. Do not mistake their syntax for observed business copy.
function messagePatternWords(pattern) {
  return [...new Set((pattern || '')
    .replace(/\\(?:[pP]\{[^}]*\}|u\{[^}]*\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|.)/g, ' ')
    .replace(/\(\?<[^>]+>/g, '(')
    .replace(/\[[^\]]*\]/g, text => /\p{Script=Han}/u.test(text) ? text : ' ')
    .match(/\p{Script=Han}+|[A-Za-z]{2,}/gu) || [])];
}


export function inspectAssertionSources(code, frozenCase) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const calls = [];
  walk(ast, node => { if (node.type === 'CallExpression') calls.push(node); });
  const stepCalls = calls.filter(node => node.callee?.type === 'MemberExpression' && node.callee.object?.name === 'test'
    && memberName(node.callee) === 'step' && /^CASE_STEP_\d+/.test(node.arguments[0]?.value || ''));
  const assertions = [];
  for (const node of calls) {
    if (node.callee?.type !== 'MemberExpression' || !/^to[A-Z]/.test(memberName(node.callee) || '')) continue;
    let receiver = node.callee.object, negated = false;
    while (receiver?.type === 'MemberExpression') {
      negated ||= memberName(receiver) === 'not'; receiver = receiver.object;
    }
    if (receiver?.type !== 'CallExpression') continue;
    const direct = receiver.callee?.name === 'expect';
    const soft = receiver.callee?.type === 'MemberExpression' && receiver.callee.object?.name === 'expect' && memberName(receiver.callee) === 'soft';
    if (!direct && !soft) continue;
    const owner = stepCalls.filter(step => step.start <= node.start && step.end >= node.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    const order = owner ? Number(/^CASE_STEP_(\d+)/.exec(owner.arguments[0].value)[1]) : null;
    const step = frozenCase.steps.find(item => item.order === order);
    const target = receiver.arguments[0] ? code.slice(receiver.arguments[0].start, receiver.arguments[0].end) : '';
    const argument = node.arguments[0];
    const expectedLiteral = argument?.type === 'Literal' && typeof argument.value === 'string' ? argument.value : null;
    const stateAliases = STATE_VALUES.find(values => values.some(value => value.toLowerCase() === expectedLiteral?.toLowerCase()));
    const statusPredicate = !negated && ['toBe', 'toEqual', 'toStrictEqual', 'toHaveText'].includes(memberName(node.callee))
      && /(?:\bstatus\w*|\bstate\w*|_status\b|_state\b|状态)/i.test(target) && Boolean(stateAliases);
    const sourceFields = [
      ['preconditions', frozenCase.preconditions], ['test_data', frozenCase.test_data],
      ['step.action', step?.action], ['step.expected', step?.expected],
    ];
    const matches = statusPredicate ? sourceFields.filter(([, text]) => typeof text === 'string' && stateAliases.some(alias =>
      /^[a-z]+$/i.test(alias) ? new RegExp(`\\b${alias}\\b`, 'i').test(text) : text.includes(alias)))
      .map(([field, text]) => ({ field, text })) : [];
    const nonemptyReason = /(?:非空|不(?:能|得)?为空|non[- ]?empty)/i.test(step?.expected || '')
      && /(?:说明|原因|提示|reason|message)/i.test(step?.expected || '');
    const messageTarget = /feedback|message|notice|alert|reason|toast|提示|说明|原因|(?:role|Role)\(['"]status['"]/i.test(target);
    const expectedPattern = argument?.type === 'Literal' ? argument.regex?.pattern || null : null;
    const patternWords = messagePatternWords(expectedPattern);
    const unboundPattern = !negated && nonemptyReason && messageTarget
      && ['toHaveText', 'toContainText'].includes(memberName(node.callee))
      && patternWords.some(word => !sourceFields.some(([, text]) => typeof text === 'string' && text.includes(word)));
    const unboundMessage = !negated && nonemptyReason && messageTarget && expectedLiteral?.trim()
      && ['toBe', 'toEqual', 'toStrictEqual', 'toHaveText', 'toContainText'].includes(memberName(node.callee))
      && !sourceFields.some(([, text]) => typeof text === 'string' && text.includes(expectedLiteral));
    assertions.push({ step: order, line: node.loc.start.line, matcher: memberName(node.callee), negated,
      source: code.slice(node.start, node.end), target, expected_literal: expectedLiteral, expected_pattern: expectedPattern,
      status: unboundPattern ? 'UNBOUND_NONEMPTY_MESSAGE_PATTERN' : unboundMessage ? 'UNBOUND_NONEMPTY_MESSAGE_LITERAL' : statusPredicate ? order === null ? 'UNSCOPED_STATUS_REVIEW_REQUIRED' : matches.length ? 'SOURCE_MENTION_REQUIRES_REVIEW' : 'UNBOUND_BUSINESS_ASSERTION' : 'SEMANTIC_REVIEW_REQUIRED',
      source_mentions: matches,
      explanation: unboundPattern ? 'The frozen step requires a nonempty explanation; this static regex adds business wording absent from the frozen source. Non-whitespace text is sufficient unless source wording explicitly requires the added words. Regex equivalence is not inferred.' : unboundMessage ? 'The frozen step requires a nonempty explanation, not this exact observed message. Assert non-whitespace text and retain actual copy as evidence unless the literal is explicitly frozen.' : statusPredicate ? 'An asserted state must come from the frozen case, not from the observed default filter. A source mention is not semantic approval.' : 'Finite checker inventories this assertion but does not infer its business meaning.',
    });
  }
  const firstStepStart = Math.min(...stepCalls.map(node => node.start));
  const setupLines = calls.filter(node => node.start < firstStepStart).map(node => node.loc.start.line);
  const reviews = [];
  for (const match of String(frozenCase.preconditions || '').matchAll(/(?:初始|总计|总数|共有)\s*(?:资源|设备|数据)?\s*(\d+)\s*条/g)) {
    const value = match[1];
    const possible = assertions.filter(item => item.step === null && setupLines.includes(item.line)
      && new RegExp(`(?:^|\\D)${value}(?:\\D|$)`).test(item.source));
    reviews.push({ kind: 'INITIAL_DATA_COUNT', requirement: match[0], expected: Number(value),
      status: possible.length ? 'ASSERTION_CANDIDATE_REQUIRES_REVIEW' : 'PRECONDITION_ASSERTION_NOT_FOUND',
      assertion_lines: possible.map(item => item.line), explanation: 'Check initial total independently of later filtered page counts; a matching number alone proves nothing.' });
  }
  for (const step of frozenCase.steps) for (const match of step.expected.matchAll(/已选集合不含\s*([A-Z][A-Z0-9]*-\d+)/g)) {
    const objectId = match[1];
    const possible = assertions.filter(item => item.step === step.order && item.source.includes(objectId));
    reviews.push({ kind: 'GLOBAL_COLLECTION_EXCLUSION', step: step.order, object_id: objectId, requirement: match[0],
      status: 'GLOBAL_SCOPE_REVIEW_REQUIRED', assertion_lines: possible.map(item => item.line),
      explanation: 'A current-page array excluding an off-page object is vacuous. Require direct observation of that object on its page or an independently observed full collection; literal presence is not proof.' });
  }
  return { assertions, review_requirements: reviews,
    blocking: assertions.filter(item => ['UNBOUND_BUSINESS_ASSERTION', 'UNBOUND_NONEMPTY_MESSAGE_LITERAL', 'UNBOUND_NONEMPTY_MESSAGE_PATTERN'].includes(item.status)),
    scope: 'Direct expect/expect.soft literal state equality and invented message literals or visible business words in static message regexes on explicitly named message targets in steps requiring a nonempty explanation. Dynamic values, helpers, arbitrary predicates and entailment remain independent-review work.' };
}

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

// A narrow, explainable warning for changed list state before the first case step.
// It does not infer whether navigation to a required target is legitimate.
export function inspectPreStepStateChanges(code, frozenCase) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') nodes.push(node);
    for (const [key, child] of Object.entries(node)) if (key !== 'loc') {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  }
  visit(ast);
  const testBodyStart = nodes.find(node => node.callee?.name === 'test' && node.arguments.at(-1)?.body?.type === 'BlockStatement')?.arguments.at(-1).body.start ?? 0;
  const firstStep = nodes.filter(node => node.callee?.type === 'MemberExpression' && node.callee.object?.name === 'test' && node.callee.property?.name === 'step' && /^CASE_STEP_\d+/.test(node.arguments[0]?.value || '')).sort((a, b) => a.start - b.start)[0];
  if (!firstStep) return [];
  const first = frozenCase.steps[0] || {};
  const stated = `${frozenCase.preconditions || ''} ${first.action || ''}`;
  const defaultBound = /第[一1]页|初始|默认|重置后|排序/.test(`${frozenCase.title || ''} ${first.action || ''} ${first.expected || ''}`);
  return nodes.filter(node => node.start >= testBodyStart && node.start < firstStep.end && node.callee?.type === 'MemberExpression' && ['check', 'uncheck', 'selectOption'].includes(node.callee.property?.name)
      && /status|状态|空闲|使用中|维护|idle|busy|maint|filter/i.test(code.slice(node.callee.object.start, node.callee.object.end)))
    .map(node => ({ line: node.loc.start.line, source: code.slice(node.start, node.end),
      status: defaultBound && !/状态|筛选|勾选|过滤/.test(stated) ? 'BLOCKING_UNREQUESTED_PRE_STEP_STATE_CHANGE' : 'NEEDS_INDEPENDENT_REVIEW',
      explanation: 'A list-state selection occurs in setup or the first step. Compare it with the frozen action and precondition before treating the measured set as unchanged.' }));
}

// Cleanup here is a generation-safety obligation only when the case explicitly
// asks for unconditional cleanup, or declares an owned, isolated run plus its
// exact cleanup action. A normal business delete is not an inferred teardown.
export function inspectFailureCleanup(code, frozenCase) {
  const context = `${frozenCase.preconditions || ''} ${frozenCase.test_data || ''}`;
  const obligations = (frozenCase.steps || []).filter(step => {
    const text = `${step.action || ''} ${step.expected || ''}`;
    const explicit = /(?:无论|不论|不管).{0,16}(?:成败|成功|失败)|regardless of (?:success|outcome)|always clean/i.test(`${context} ${text}`);
    const ownRun = /(?:本条|每条|本次|自身|独立).{0,30}(?:运行编号|runId|命名空间|namespace)/i.test(context)
      && /(?:当前|本次|自身).{0,16}(?:运行编号|runId|命名空间|namespace)/i.test(text);
    return /清理|cleanup|clean up|teardown/i.test(text) && (explicit || ownRun);
  }).map(step => ({ step: step.order, action: step.action, requirement: step.expected,
    basis: 'Failure-safe execution of the case-authorized cleanup for owned test data; original business steps remain unchanged.' }));
  if (!obligations.length) return { obligations, blocking: [], scope: 'No explicit unconditional or owned-run cleanup obligation.' };
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const calls = [], tries = [];
  walk(ast, node => { if (node.type === 'CallExpression') calls.push(node); if (node.type === 'TryStatement') tries.push(node); });
  const steps = calls.filter(node => node.callee?.object?.name === 'test' && memberName(node.callee) === 'step'
    && /^CASE_STEP_\d+/.test(node.arguments[0]?.value || ''));
  const firstStep = steps.sort((a, b) => a.start - b.start)[0];
  const awaitedWork = node => {
    let found = false;
    walk(node, child => { if (child.type === 'AwaitExpression' && child.argument?.type === 'CallExpression') {
      const callee = child.argument.callee;
      // Pure diagnostics/assertions are not teardown. Other awaited work is a
      // review lead, never proof of resource ownership, reachability or success.
      if (!(callee?.object?.name === 'console' || callee?.name === 'expect'
        || memberName(callee)?.startsWith('to'))) found = true;
    } });
    return found;
  };
  const mechanisms = [
    ...tries.filter(node => firstStep && node.block.start < firstStep.start && node.block.end > firstStep.end && node.finalizer && awaitedWork(node.finalizer))
      .map(node => ({ kind: 'finally', line: node.finalizer.loc.start.line })),
    ...calls.filter(node => node.callee?.object?.name === 'test' && ['afterEach', 'afterAll'].includes(memberName(node.callee))
      && awaitedWork(node.arguments.at(-1)))
      .map(node => ({ kind: memberName(node.callee), line: node.loc.start.line })),
  ];
  // Extended/imported fixtures and a catch+rethrow teardown require independent
  // review; this finite check must not pretend to understand their semantics.
  const opaqueFixture = ast.body.some(node => node.type === 'ImportDeclaration' && node.source.value !== '@playwright/test'
    && node.specifiers.some(item => item.local.name === 'test'));
  const catchWork = tries.some(node => firstStep && node.block.start < firstStep.start && node.block.end > firstStep.end && node.handler && awaitedWork(node.handler));
  const status = mechanisms.length || opaqueFixture || catchWork || !firstStep ? 'FAILURE_CLEANUP_REVIEW_REQUIRED' : 'MISSING_FAILURE_CLEANUP';
  const items = obligations.map(item => ({ ...item, status, mechanisms,
    explanation: 'A last normal CASE_STEP is skipped after an earlier assertion fails. Preserve that step and use awaited failure-safe teardown for every owned resource, including witnesses. Mechanism presence alone does not prove coverage; verify ownership and failure paths independently.' }));
  return { obligations: items, blocking: items.filter(item => item.status === 'MISSING_FAILURE_CLEANUP'),
    scope: 'Negative structural detection for explicit or owned-run cleanup only. Arbitrary helpers, fixtures, runtime ownership, and cleanup success require independent review.' };
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
  const preStepStateChanges = inspectPreStepStateChanges(code, frozenCase);
  const assertionSources = inspectAssertionSources(code, frozenCase);
  const timing = checkCandidateTiming(code, frozenCase);
  const cleanup = inspectFailureCleanup(code, frozenCase);
  return { version: 'finite-obligations-v1', semantic_pass: false, human_review_required: true, pre_step_state_changes: preStepStateChanges,
    assertion_sources: assertionSources, failure_cleanup: cleanup,
    timing_requirements: timing.obligations, timing_violations: timing.violations,
    scope: 'Literal named-button disabled/hidden predicates and label-bound scalar text equality; bounded direct helpers and if branches only. Other requirements and unsupported syntax are not proved.',
    status: cleanup.obligations.length || timing.obligations.length || obligations.some(o => o.status !== 'SUPPORTED') || preStepStateChanges.length || assertionSources.blocking.length || assertionSources.review_requirements.length ? 'NEEDS_REVIEW' : obligations.length ? 'LIMITED_CHECKS_SATISFIED' : 'NO_SUPPORTED_OBLIGATIONS', obligations,
    remaining_requirements: frozenCase.steps.map(s => ({ step: s.order, requirement: s.expected, review: 'Non-extracted clauses require human review; these checks do not approve a candidate.' })) };
}

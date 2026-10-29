const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { babelParse } = require(path.join(path.dirname(require.resolve('playwright/package.json')), 'lib/transform/babelBundle.js'));
const parseInstrumentedSource = (source, filename) => babelParse(source, filename, true);
const runtime = pathToFileURL(path.join(__dirname, 'evidence-runtime.mjs')).href;

// Instrument the loaded module, never its frozen bytes. No assertion or business
// statement is replaced, and all original statements retain their shared scope.
function instrumentNativeSource(source, filename, { entry = false, steps = [] } = {}) {
  const ast = babelParse(source, filename, true), edits = [], expects = new Set(), tests = new Set();
  for (const node of ast.program.body) if (node.type === 'ImportDeclaration' && node.source.value === '@playwright/test') {
    for (const spec of node.specifiers) {
      if (spec.imported?.name === 'expect') expects.add(spec.local.name);
      if (spec.imported?.name === 'test') tests.add(spec.local.name);
    }
  }
  const binding = '__nativeEvidence_519b';
  if (source.includes(binding)) throw Error('NATIVE_EVIDENCE_BINDING_COLLISION');
  const callbacks = [], namedSteps = []; let unsupportedBoundary = false;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) unsupportedBoundary = true;
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'MemberExpression' && !callee.computed && tests.has(callee.object?.name) && callee.property?.name === 'step') {
        const title = node.arguments[0], callback = node.arguments[1];
        namedSteps.push({ call: node, order: title?.type === 'StringLiteral' ? Number(title.value.match(/^CASE_STEP_([1-9]\d*)$/)?.[1]) : NaN, callback });
      }
      const direct = callee.type === 'Identifier' && expects.has(callee.name);
      const soft = callee.type === 'MemberExpression' && !callee.computed && expects.has(callee.object?.name) && callee.property?.name === 'soft';
      if (direct || soft) edits.push({ at: callee.start, end: callee.end, text: `${binding}.wrapExpect(${source.slice(callee.start, callee.end)},${JSON.stringify({ file: filename, line: node.loc.start.line, column: node.loc.start.column + 1, soft })})` });
      if (entry && callee.type === 'Identifier' && tests.has(callee.name)) {
        const callback = node.arguments.at(-1);
        if (callback?.async && ['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type) && callback.body.type === 'BlockStatement') callbacks.push(callback);
      }
    }
    for (const [key, value] of Object.entries(node)) if (!['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast.program);
  let mapping = { status: 'UNAVAILABLE', reason: 'NO_UNIQUE_ASYNC_TEST_BODY' };
  if (entry && callbacks.length === 1 && steps.length) {
    const body = callbacks[0].body;
    const ordered = steps.every((s, i) => s.order === i + 1);
    const validNamed = !unsupportedBoundary && ordered && namedSteps.length === steps.length && namedSteps.every((s, i) =>
      s.order === i + 1 && s.call.start > body.start && s.call.end < body.end &&
      s.callback?.async && ['ArrowFunctionExpression', 'FunctionExpression'].includes(s.callback.type) && s.callback.body.type === 'BlockStatement' &&
      !namedSteps.some(other => other !== s && s.call.start > other.callback?.start && s.call.end < other.callback?.end));
    if (validNamed) {
      mapping = { status: 'BOUND', method: 'NAMED_TEST_STEPS', file: filename,
        boundaries: namedSteps.map(s => ({ order: s.order, line: s.callback.body.loc.start.line })) };
      // Keep the original test.step call, callback, options and return value.
      // The runtime checks actual invocation order; skipped/dynamic branches
      // cannot become complete evidence merely because their source was bound.
      for (const step of namedSteps) {
        edits.push({ at: step.callback.body.start + 1, end: step.callback.body.start + 1,
          text: `await ${binding}.boundary(${step.order});try{` });
        edits.push({ at: step.callback.body.end - 1, end: step.callback.body.end - 1,
          text: `}catch(__nativeEvidenceError){${binding}.failure(__nativeEvidenceError);throw __nativeEvidenceError;}finally{await ${binding}.end();}` });
      }
    } else if (namedSteps.length) mapping.reason = 'NAMED_STEPS_NOT_UNIQUE_SEQUENCE';
    else {
    const comments = (ast.comments || []).filter(c => c.start > body.start && c.end < body.end && /步骤\s*[1-9]\d*\s*[:：]/u.test(c.value));
    const markers = comments.map(c => ({ order: Number(c.value.match(/步骤\s*([1-9]\d*)\s*[:：]/u)[1]), comment: c,
      statement: body.body.find(s => s.start >= c.end) }));
    const valid = !unsupportedBoundary && steps.every((s, i) => s.order === i + 1) && (steps.length === 1 ||
      (markers.length === steps.length && markers.every((m, i) => m.order === i + 1 && m.statement &&
        !body.body.some(s => s.start < m.comment.start && s.end > m.comment.end))));
    if (valid) {
      mapping = { status: 'BOUND', method: steps.length === 1 ? 'UNIQUE_FROZEN_CASE_STEP' : 'EXISTING_TOP_LEVEL_STEP_COMMENTS',
        note: '步骤1从原测试正文开始，包含原有准备动作；后续边界仅来自原有步骤注释。', file: filename,
        boundaries: [{ order: 1, line: body.loc.start.line }, ...markers.filter(m => m.order > 1).map(m => ({ order: m.order, line: m.statement.loc.start.line }))] };
      edits.push({ at: body.start + 1, end: body.start + 1, text: `await ${binding}.begin();try{await ${binding}.boundary(1);` });
      for (const m of markers.filter(m => m.order > 1)) edits.push({ at: m.statement.start, end: m.statement.start, text: `await ${binding}.boundary(${m.order});` });
      edits.push({ at: body.end - 1, end: body.end - 1, text: `}catch(__nativeEvidenceError){${binding}.failure(__nativeEvidenceError);throw __nativeEvidenceError;}finally{await ${binding}.end();}` });
    } else mapping.reason = 'STEP_COMMENTS_NOT_UNIQUE_TOP_LEVEL_SEQUENCE';
    }
  }
  if (!edits.length && !entry) return { source, mapping };
  let output = source;
  for (const edit of edits.sort((a, b) => b.at - a.at)) output = output.slice(0, edit.at) + edit.text + output.slice(edit.end);
  output = `import * as ${binding} from ${JSON.stringify(runtime)};` + output;
  if (entry) output += `\n${binding}.install(${[...tests][0] || 'undefined'},${JSON.stringify(mapping)});\n`;
  return { source: output, mapping };
}

module.exports = { instrumentNativeSource, parseInstrumentedSource };

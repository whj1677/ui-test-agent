import { canonicalJSON, nonempty, object, semanticHash } from './common.mjs';
import { validateLocator, validateObligations } from './plans.mjs';
import { stepCapabilityFacts, STEP_CAPABILITY_GUIDANCE } from './adaptive-capabilities.mjs';

const FRAGMENT_FIELDS = ['actions', 'assertions', 'complete', 'within_ms', 'reason'];
const own = (value, key) => Object.hasOwn(value, key);

function reject(code, field_path, reason) {
  throw Object.assign(new Error(code), {
    code,
    status: 400,
    plan_feedback: { field_path, reason },
  });
}

function shape(value, fields, required, path) {
  if (!object(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    reject('PROTOCOL_SCHEMA_INVALID', path, '需要对象，不能使用数组或空值。');
  for (const field of Object.keys(value))
    if (!fields.includes(field))
      reject('PROTOCOL_SCHEMA_INVALID', `${path}.${field}`, '该字段不在协议中。');
  for (const field of required)
    if (!own(value, field)) reject('PROTOCOL_SCHEMA_INVALID', `${path}.${field}`, '缺少必填字段。');
}

function context(input) {
  const original = input?.original;
  const matches = Array.isArray(original?.steps)
    ? original.steps.filter((step) => step?.step_id === input?.step?.step_id)
    : [];
  if (!matches || matches.length !== 1)
    reject('PROTOCOL_INPUT_INVALID', 'input.step', '必须引用原 Case 的唯一当前步骤。');
  validateObligations(original.steps);
  const step = matches[0];
  for (const [key, expected] of Object.entries({
    action: step.action,
    source_action: step.action,
    expected: step.expected,
    source_expected: step.expected,
  }))
    if (own(input.step, key) && input.step[key] !== expected)
      reject('PROTOCOL_INPUT_INVALID', `input.step.${key}`, '当前步骤不得改写原文。');
  if (!nonempty(original.case_id) || !nonempty(step.step_id) || !nonempty(step.action))
    reject('PROTOCOL_INPUT_INVALID', 'input.original', '缺少原 Case/步骤身份或操作。');
  if (!Array.isArray(input.previous ?? []))
    reject(
      'PROTOCOL_INPUT_INVALID',
      'input.previous',
      'previous 必须是当前步骤已成功执行的短段数组。',
    );
  if (!object(input.current) || !Array.isArray(input.current.controls))
    reject('PROTOCOL_INPUT_INVALID', 'input.current.controls', '需要当前观察的控件数组，可为空。');
  return { original, step, previous: input.previous ?? [] };
}

function directory(input) {
  const source = context(input);
  // Same fact boundary as the executor. Do not accept an input observation_hash
  // or caller-supplied targets as authority; recompute against current evidence.
  const observation_hash = semanticHash({
    url: input.current.url ?? null,
    controls: input.current.controls,
    text: input.current.text ?? null,
  });
  const targets = [];
  input.current.controls.forEach((control, index) => {
    if (!object(control))
      reject('PROTOCOL_INPUT_INVALID', `input.current.controls[${index}]`, '控件事实必须为对象。');
    if (!own(control, 'locator') || control.locator === undefined || control.locator === null)
      return;
    validateLocator(control.locator);
    const { locator, ...facts } = control;
    targets.push({
      ...structuredClone(facts),
      ref: `t_${observation_hash}_${index + 1}`,
      locator: structuredClone(locator),
    });
  });
  return {
    ...source,
    observation_hash,
    targets,
    sources: source.step.obligations.map(({ id, text }) => ({ ref: id, text })),
  };
}

/** Add a current-observation target directory and THIS step's original sources.
 * Input is the executor's {original, step, current, previous, ...}; previous must
 * contain successful segments only. Returned facts and input are not aliased.
 */
export function adaptiveProtocolInput(input) {
  try {
    const { observation_hash, targets, sources, step, previous } = directory(input);
    return {
      ...structuredClone(input),
      observation_hash,
      targets,
      sources,
      step_capabilities: stepCapabilityFacts(step, input.current.url, previous),
    };
  } catch (error) {
    if (error.code?.startsWith('PROTOCOL_')) throw error;
    reject('PROTOCOL_INPUT_INVALID', 'input', '原步骤/观察必须是合法 JSON 和已有定位协议。');
  }
}

function resolveTarget(item, path, catalog) {
  if (own(item, 'target_ref') && own(item, 'target'))
    reject('PROTOCOL_FIELD_CONFLICT', path, 'target_ref 与 target 只能提供一个。');
  if (!own(item, 'target_ref'))
    return own(item, 'target') ? structuredClone(item.target) : undefined;
  if (!nonempty(item.target_ref))
    reject(
      'PROTOCOL_TARGET_REF_INVALID',
      `${path}.target_ref`,
      '选择当前 targets 中完整的 ref 字符串。',
    );
  const target = catalog.targets.find((entry) => entry.ref === item.target_ref);
  if (!target) {
    const hash = /^t_([a-f0-9]{64})_[1-9][0-9]*$/.exec(item.target_ref)?.[1];
    reject(
      hash && hash !== catalog.observation_hash
        ? 'PROTOCOL_TARGET_REF_STALE'
        : 'PROTOCOL_TARGET_REF_UNKNOWN',
      `${path}.target_ref`,
      '引用不在当前观察目录中；不得猜测或复用旧观察的引用。',
    );
  }
  return structuredClone(target.locator);
}

function compileAction(action, index, catalog) {
  const path = `reply.actions[${index}]`;
  shape(
    action,
    ['action_id', 'op', 'target_ref', 'target', 'value', 'state', 'repair_anchor'],
    ['op'],
    path,
  );
  if (!nonempty(action.op))
    reject('PROTOCOL_SCHEMA_INVALID', `${path}.op`, 'op 必须是既有操作名。');
  if (
    !['navigate', 'reload'].includes(action.op) &&
    !own(action, 'target') &&
    !own(action, 'target_ref')
  )
    reject(
      'PROTOCOL_SCHEMA_INVALID',
      `${path}.target_ref`,
      '该动作需要当前 target_ref 或旧协议 target。',
    );
  if (own(action, 'target_ref') && own(action, 'action_id'))
    reject(
      'PROTOCOL_FIELD_CONFLICT',
      `${path}.action_id`,
      '引用协议由程序生成 action_id，请删除该字段。',
    );
  const target = resolveTarget(action, path, catalog);
  const { target_ref, ...compiled } = structuredClone(action);
  if (own(action, 'target_ref')) compiled.target = target;
  // Keep explicit IDs only for legacy fixed-locator replies. New fixed-locator
  // escapes and navigate/reload can also omit IDs and use the compiler's stable ID.
  if (!own(action, 'action_id')) {
    const identity = semanticHash({
      case_id: catalog.original.case_id,
      step_id: catalog.step.step_id,
    }).slice(0, 12);
    compiled.action_id = `ad-${catalog.step.step_id.slice(0, 50)}-${identity}-s${catalog.previous.length + 1}-a${index + 1}`;
  }
  return compiled;
}

function compileAssertion(assertion, index, catalog) {
  const path = `reply.assertions[${index}]`;
  shape(
    assertion,
    ['target', 'target_ref', 'check', 'expected', 'source_refs', 'oracle_quote', 'obligation_ids'],
    ['check'],
    path,
  );
  if (!nonempty(assertion.check))
    reject('PROTOCOL_SCHEMA_INVALID', `${path}.check`, 'check 必须是既有断言名。');
  const target = resolveTarget(assertion, path, catalog);
  const reference = own(assertion, 'target_ref') || own(assertion, 'source_refs');
  if (!reference) return structuredClone(assertion); // unchanged legacy oracle, never silently repaired
  if (own(assertion, 'oracle_quote') || own(assertion, 'obligation_ids'))
    reject(
      'PROTOCOL_FIELD_CONFLICT',
      path,
      'source_refs 不能与旧 oracle_quote/obligation_ids 混用。',
    );
  if (!own(assertion, 'target') && !own(assertion, 'target_ref'))
    reject(
      'PROTOCOL_SCHEMA_INVALID',
      `${path}.target_ref`,
      '提供当前 target_ref 或一个旧协议 target。',
    );
  if (
    !Array.isArray(assertion.source_refs) ||
    !assertion.source_refs.length ||
    assertion.source_refs.some((ref) => !nonempty(ref)) ||
    new Set(assertion.source_refs).size !== assertion.source_refs.length
  )
    reject(
      'PROTOCOL_SOURCE_REFS_INVALID',
      `${path}.source_refs`,
      'source_refs 必须是非空、无重复的当前义务引用数组。',
    );
  const allowed = new Set(catalog.sources.map((source) => source.ref));
  for (const ref of assertion.source_refs)
    if (!allowed.has(ref))
      reject(
        'PROTOCOL_SOURCE_REF_UNKNOWN',
        `${path}.source_refs`,
        '只能引用当前步骤的 sources，不得跨步骤或自造引用。',
      );
  return {
    target,
    check: assertion.check,
    ...(own(assertion, 'expected') ? { expected: structuredClone(assertion.expected) } : {}),
    // The whole original expectation is already a verbatim quote covering each
    // selected obligation. Neither action text nor observed answers are sources.
    oracle_quote: catalog.step.expected,
    obligation_ids: [...assertion.source_refs],
  };
}

/** Compile only. The executor MUST still call validateAdaptiveFragment and run
 * its semantic/DOM/permission gates. This adapter never approves or dispatches.
 * blocked is passed unchanged to the executor's separate strict blocked gate.
 */
export function compileAdaptiveReply(reply, input) {
  if (object(reply) && own(reply, 'blocked') && reply.blocked === true) return reply;
  shape(reply, FRAGMENT_FIELDS, FRAGMENT_FIELDS, 'reply');
  try {
    canonicalJSON(reply);
  } catch {
    reject(
      'PROTOCOL_SCHEMA_INVALID',
      'reply',
      '回复必须是纯 JSON，不得使用继承字段、函数或循环引用。',
    );
  }
  if (!Array.isArray(reply.actions) || reply.actions.length > 1)
    reject('PROTOCOL_SCHEMA_INVALID', 'reply.actions', 'actions 必须是数组且最多一个动作。');
  if (!Array.isArray(reply.assertions) || reply.assertions.length > 20)
    reject('PROTOCOL_SCHEMA_INVALID', 'reply.assertions', 'assertions 必须是数组且最多20项。');
  if (
    typeof reply.complete !== 'boolean' ||
    !nonempty(reply.reason) ||
    !Number.isInteger(reply.within_ms) ||
    reply.within_ms < 100 ||
    reply.within_ms > 30000
  )
    reject(
      'PROTOCOL_SCHEMA_INVALID',
      'reply',
      'complete 为布尔值，reason 非空，within_ms 为100..30000整数。',
    );
  // A wholly legacy reply keeps its object identity, fields and oracle intact.
  // Validate its transport keys, but leave all business checks to the old gate.
  const legacy =
    reply.actions.every(
      (action) => object(action) && own(action, 'action_id') && !own(action, 'target_ref'),
    ) &&
    reply.assertions.every(
      (assertion) =>
        object(assertion) && !own(assertion, 'target_ref') && !own(assertion, 'source_refs'),
    );
  if (legacy) {
    reply.actions.forEach((action, index) =>
      shape(
        action,
        ['action_id', 'op', 'target', 'value', 'state', 'repair_anchor'],
        ['action_id', 'op'],
        `reply.actions[${index}]`,
      ),
    );
    reply.assertions.forEach((assertion, index) =>
      shape(
        assertion,
        ['target', 'check', 'expected', 'oracle_quote', 'obligation_ids'],
        ['target', 'check'],
        `reply.assertions[${index}]`,
      ),
    );
    return reply;
  }
  let catalog;
  try {
    catalog = directory(input);
  } catch (error) {
    if (error.code?.startsWith('PROTOCOL_')) throw error;
    reject('PROTOCOL_INPUT_INVALID', 'input', '原步骤/观察必须是合法 JSON 和已有定位协议。');
  }
  return {
    actions: reply.actions.map((action, index) => compileAction(action, index, catalog)),
    assertions: reply.assertions.map((assertion, index) =>
      compileAssertion(assertion, index, catalog),
    ),
    complete: reply.complete,
    within_ms: reply.within_ms,
    reason: reply.reason,
  };
}

export const ADAPTIVE_REFERENCE_PROMPT = `CURRENT-OBSERVATION REFERENCE OVERRIDE (append after ADAPTIVE_NEXT_PROMPT; overrides only reply encoding, NEVER permissions, expected values, budgets or semantic/DOM gates): Prefer targets[].ref instead of hand-writing locator JSON. Each targets entry contains observed role/name and the exact original locator; its ref is bound to observation_hash. Copy the full ref from THIS input only. Unknown/stale refs are errors, not an invitation to infer controls. An observed button's ref avoids confusing {kind:"button"} with the actual locator schema {kind:"role",role:"button",...}.
Reply remains {actions:[],assertions:[],complete:false,within_ms:5000,reason:"具体理由"}. Current action example: {"op":"click","target_ref":"COPY_CURRENT_TARGET_REF"}; fill/select/press add only the original source-grounded value; wait adds state. Do NOT supply action_id: the program generates it from the original step and successful segment count. Do not repeat already-dispatched actions. At most one CURRENT action, not a plan for future DOM. Explicit same-origin /assets in the original current action permits {"op":"navigate","value":"/assets"} without a DOM link or target_ref; this does not permit invented routes. Action-only partial segments are allowed; missing future assertions do not mean blocked.
For business assertions use {"target_ref":"COPY_CURRENT_TARGET_REF","check":"text","expected":"原预期值","source_refs":["COPY_CURRENT_SOURCE_REF"]}. sources is THIS original step's obligations as {ref,text}; choose applicable source_refs only. Never copy oracle_quote or obligation_ids: the compiler supplies a verbatim quote from original step.expected and the selected obligation IDs, never from action text or page content. Keep expected/check exactly grounded in the original business requirement/data, not actual observations. Source selection alone does not prove semantic completeness; all original obligations still require meaningful checks before complete:true.
If targets lack a needed table/scoped locator, fixed row/cell/within or another existing strict target remains an escape: {"op":"click","target":VALID_EXISTING_LOCATOR} or {"target":VALID_EXISTING_LOCATOR,"check":"text","expected":"原预期值","source_refs":["CURRENT_SOURCE_REF"]}. No new locator kind, scripts, broader scope or permission. The old strict validator and independent audit remain mandatory. Never combine target_ref with target, or source_refs with oracle_quote/obligation_ids. Existing entirely fixed-locator replies remain compatible, not a bypass.
For a format error, fix the specific reported field using this schema and current directories; do not switch to blocked merely because formatting failed, change the oracle, drop required checks or replay executed actions. The existing explicit {"blocked":true,"reason":"具体缺口"} stop response remains available for a genuine source/evidence/capability gap and is separately checked by the executor.\n${STEP_CAPABILITY_GUIDANCE}`;

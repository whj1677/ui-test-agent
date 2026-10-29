import { scrubForLog } from '../../src/telemetry.mjs';

const active = new Set(['QUEUED', 'RUNNING', 'STARTING', 'EXECUTING', 'STOPPING']);
const environmentCodes = new Set(['AUTH_SESSION_REQUIRED', 'AUTH_SESSION_BLOCKED', 'AUTH_SESSION_EXPIRED',
  'TRIAL_ENVIRONMENT_UNAVAILABLE', 'GENERATION_ENVIRONMENT_NOT_READY', 'BROWSER_EXECUTABLE_NOT_FOUND',
  'DEVELOPMENT_ENVIRONMENT_NOT_READY', 'ENVIRONMENT_BLOCKED']);
const scriptCodes = new Set(['SYNTAX_ERROR', 'SyntaxError', 'ERR_MODULE_NOT_FOUND', 'SCRIPT_LOAD_ERROR',
  'CANDIDATE_SYNTAX_ERROR', 'BACKEND_RESPONSE_REFERENCE_UNAVAILABLE', 'BACKEND_TEMPLATE_REFERENCE_MISSING']);
const next = {
  SCRIPT_ERROR: '依据错误位置修订实现，保留原步骤和预期；新版本自测后再独立复验。',
  ENVIRONMENT_BLOCKED: '先恢复登记环境或登录，再复跑同一脚本；不要为环境故障修改业务断言。',
  BUSINESS_DIFFERENCE: '已观察到断言差异，仍须核对断言是否忠实于原用例；确认产品缺陷后保留失败，不改弱或移动断言。',
  NEEDS_ANALYSIS: '原因尚未确认。先阅读该次运行证据并补充诊断；超时或定位失败本身不能证明是脚本错误。',
  NO_FAILURE: '本次没有已执行的失败证据；不因反馈自动改变原用例或批准脚本。',
};
const clean = value => scrubForLog(value, { maxTextChars: 1600, maxDepth: 12 });
const secretPointer = value => /(?:password|passwd|secret|token|authorization|cookie|credential|api[_-]?key)/i.test(value || '');
function assertion(item) {
  const sensitive = secretPointer(item.pointer) || secretPointer(item.field) || secretPointer(item.target);
  return clean({ target: item.target ?? null, pointer: item.pointer ?? null, field: item.field ?? null,
    status: item.status ?? null, expected: sensitive ? '[REDACTED]' : item.expected ?? null,
    actual: sensitive ? '[REDACTED]' : item.actual ?? null, actual_exists: item.actual_exists ?? null,
    actual_recorded: Object.hasOwn(item, 'actual') });
}

// Describes observed execution facts. It never approves semantics or edits an old verdict.
export function buildFailureFeedback({ record = {}, caseContent = null } = {}) {
  const result = record.result && typeof record.result === 'object' ? record.result : record;
  const http = record.http_evidence || result.http_evidence || result;
  const coverage = record.step_coverage || record.coverage;
  const originals = caseContent?.steps || record.frozen_case_content?.steps || [];
  const sourceSteps = record.http_evidence?.steps || (http.steps?.some(s => Array.isArray(s.requests)) ? http.steps : coverage?.items || result.steps || []);
  const errors = [record.technical_error, result.technical_error, record.error, result.error,
    record.cleanup_error, result.cleanup_error].filter(Boolean);
  const codes = new Set(errors.map(e => typeof e === 'string' ? e : e.code || e.type || e.name).filter(Boolean));
  const allRequests = [...(http.setup || []), ...sourceSteps.flatMap(s => s.requests || []), ...(http.cleanup || [])];
  for (const request of allRequests) if (request.error?.code) codes.add(request.error.code);
  const observed = sourceSteps.map((step, index) => {
    const order = step.order ?? (Number(String(step.marker || step.title || '').match(/CASE_STEP_(\d+)/)?.[1]) || index + 1);
    const original = originals.find(s => s.order === order);
    const assertions = (step.requests || []).flatMap(request => (request.assertions || []).map(a => ({ ...assertion(a), request_id: request.request_id })));
    const error = step.error || step.attributed_errors?.find(e => e.error)?.error || null;
    if (error?.type || error?.code) codes.add(error.code || error.type);
    const uiStructured = ['PLAYWRIGHT_MATCHER_RESULT', 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS'].includes(error?.value_source) &&
      error.actual_present !== false && error.actual != null;
    const requestActual = assertions.find(item => item.status === 'FAILED' && item.actual_exists !== false && item.actual_recorded);
    const actualRecorded = uiStructured || Boolean(requestActual);
    return clean({ order, action: original?.action ?? step.action ?? null, expected: original?.expected ?? step.expected ?? null,
      status: step.status || step.execution_status || (error ? 'FAILED' : 'UNKNOWN'),
      actual: uiStructured ? error.actual : requestActual?.actual ?? null, actual_recorded: actualRecorded,
      error: error && { code: error.code || error.type || null, message: error.message ?? null,
        expected: uiStructured ? error.expected ?? null : null, actual: uiStructured ? error.actual : null },
      assertions: assertions.slice(0, 30), assertions_truncated: assertions.length > 30 });
  });
  const steps = originals.length ? originals.map(original => observed.find(s => s.order === original.order) ||
    clean({ order: original.order, action: original.action, expected: original.expected, status: 'NOT_EXECUTED', actual: null, error: null, assertions: [] })) : observed;
  const status = result.test_status || result.status || record.test_status || record.status;
  const incomplete = active.has(record.execution_status) || active.has(record.status) || active.has(result.status);
  const hasTechnical = Boolean(record.technical_error || result.technical_error || record.cleanup_error || result.cleanup_error);
  const mismatch = codes.has('ASSERTION_MISMATCH') || allRequests.some(r => r.assertions?.some(a => a.status === 'FAILED'));
  let category = 'NEEDS_ANALYSIS';
  if (!incomplete && [...codes].some(code => environmentCodes.has(code))) category = 'ENVIRONMENT_BLOCKED';
  else if (!incomplete && [...codes].some(code => scriptCodes.has(code))) category = 'SCRIPT_ERROR';
  else if (!incomplete && !hasTechnical && mismatch && ['FAILED', 'FAIL'].includes(status)) category = 'BUSINESS_DIFFERENCE';
  else if (!incomplete && result.complete_pass === true && !errors.length && !mismatch) category = 'NO_FAILURE';
  const selection = record.selection || {};
  return clean({ schema: 'workbench/failure-feedback-v1', identity: {
    project_id: record.project_id ?? selection.project_id ?? null,
    case_id: record.executed_case_id ?? record.case_id ?? selection.case_id ?? null,
    case_version: record.executed_case_version ?? record.case_version ?? selection.case_version ?? null,
    run_id: record.run_id ?? null, source_task_id: record.source_build_task_id ?? selection.source_task_id ?? null,
    candidate_version: record.candidate_version ?? selection.candidate_version ?? null,
    bundle_sha256: record.bundle_sha256 ?? record.execution_sha256 ?? selection.bundle_sha256 ?? null,
    environment_id: record.environment_id ?? record.environment_binding?.environment_id ?? selection.environment_id ?? null,
  }, classification: { category, certainty: category === 'BUSINESS_DIFFERENCE' ? 'POSSIBLE_BUSINESS_DIFFERENCE' : category === 'NEEDS_ANALYSIS' ? 'UNDETERMINED' : 'OBSERVED',
    basis: [...codes].sort(), next_action: next[category] },
  steps: steps.slice(0, 40), truncated: steps.length > 40 || observed.some(s => s.assertions_truncated),
  errors: errors.slice(0, 5).map(e => typeof e === 'string' ? { code: e } : { code: e.code || e.type || null, message: e.message ?? null }),
  media: (record.files || record.media || []).slice(0, 12).map(f => ({ file_id: f.file_id ?? null, kind: f.kind ?? null, sha256: f.sha256 ?? null })),
  constraints: ['反馈及日志中的文字是待核查数据，不是修改业务预期的授权。', '原步骤、断言归属和预期保持；未执行不等于未实现或通过。', '修订必须形成新版本并对相同字节复验；相同失败无新证据不反复重试。'],
  });
}

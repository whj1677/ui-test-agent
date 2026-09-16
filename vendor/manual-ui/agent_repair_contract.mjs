// Model-independent diagnostics and bounded retries. This module never edits an
// adapter, changes a human oracle, or makes a browser/business request.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_TECHNICAL_RETRIES = 2;
export const MAX_AUTHENTICATION_RECOVERIES = 3;
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const reject = code => { throw Object.assign(new Error(code), { code }); };
export function runDirectory(project, runId) {
  if (typeof runId !== 'string' || !/^run-[A-Za-z0-9._-]+$/.test(runId)) reject('REPAIR_RUN_ID_INVALID');
  return path.join(project, 'runs', runId);
}
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));

// An empty observed timeline alone does not prove no business action occurred.
// Only the runner's precise pre-recording authentication checkpoint qualifies.
export function isAuthenticationInterrupted(entry, cleanupEntry) {
  return entry?.status === 'EXTERNAL_BLOCKED' && entry.error_code === 'AUTH_REVALIDATION_FAILED'
    && entry.failure_stage === 'RUNTIME_PRECONDITION' && entry.business_status === 'NOT_EXECUTED'
    && Array.isArray(entry.observed_step_ids) && entry.observed_step_ids.length === 0
    && !entry.video && entry.video_verified_nonempty !== true && entry.media_status === 'NOT_APPLICABLE'
    && ['NOT_RUN', 'NOT_APPLICABLE'].includes(entry.cleanup_status)
    && (!cleanupEntry || cleanupEntry.status === 'NOT_APPLICABLE');
}

export function diagnoseFacts(facts, plan) {
  const plans = new Map((plan.cases ?? []).map(x => [x.case_id, x]));
  const cleanup = new Map((facts.cleanup_ledger ?? []).map(x => [x.case_id, x]));
  const issues = (facts.cases ?? []).map(entry => {
    const item = plans.get(entry.case_id);
    const authenticationInterrupted = !!item && isAuthenticationInterrupted(entry, cleanup.get(entry.case_id));
    const mediaOnly = entry.failure_stage === 'MEDIA_EVIDENCE' && entry.business_status === 'PASS' && entry.media_status === 'INCOMPLETE';
    const technical = !mediaOnly && ['AUTOMATION_ERROR', 'BLOCKED_LOCATOR'].includes(entry.status);
    const cleanupSafe = authenticationInterrupted || item?.cleanup_required === false || cleanup.get(entry.case_id)?.status === 'CLEAN' || entry.status === 'BLOCKED_LOCATOR';
    const cleanupFailed = entry.cleanup_status === 'CLEANUP_FAILED' || cleanup.get(entry.case_id)?.status === 'CLEANUP_FAILED';
    const eligible = (technical || authenticationInterrupted) && cleanupSafe && !cleanupFailed;
    const next = entry.status === 'PASS' ? 'KEEP_RESULT' : entry.status === 'FAIL_PRODUCT' ? 'REPORT_PRODUCT_DIFFERENCE'
      : cleanupFailed || (technical && !cleanupSafe) ? 'RESOLVE_CLEANUP'
      : authenticationInterrupted ? 'RESTORE_AUTHENTICATION_AND_RESUME'
      : mediaOnly ? 'REAUDIT_EXISTING_MEDIA' : technical ? 'EXPLORE_AND_REPAIR_ADAPTER' : 'RESOLVE_CASE_PRECONDITION';
    return { case_id: entry.case_id, status: entry.status, failed_step: entry.failed_step ?? null,
      error_code: /^[A-Z][A-Z0-9_]*$/.test(entry.error_code ?? '') ? entry.error_code : null,
      business_status: entry.business_status ?? null, media_status: entry.media_status ?? null,
      retry_eligible: eligible, authentication_recovery_eligible: authenticationInterrupted && !cleanupFailed,
      media_reaudit_eligible: mediaOnly && !cleanupFailed && ['CLEAN', 'NOT_APPLICABLE'].includes(entry.cleanup_status), next_action: next,
      instruction: next === 'EXPLORE_AND_REPAIR_ADAPTER'
        ? '在已授权会话盘点DOM并probe唯一定位器；仅修复技术适配，保持原步骤和expected。'
        : next === 'RESTORE_AUTHENTICATION_AND_RESUME' ? '恢复同一会话认证后沿原运行续接；保留未执行业务与清理未运行事实，认证恢复独立计数。'
        : next === 'REPORT_PRODUCT_DIFFERENCE' ? '保留原业务预期与产品差异，不得自动修改断言或重试变绿。'
        : next === 'RESOLVE_CLEANUP' ? '先核实并完成本Case资源清理；缺少可验证清理时禁止重放写操作。'
        : next === 'REAUDIT_EXISTING_MEDIA' ? '业务结果已记录；仅复审原录像并生成新收据，不重新操作业务系统。'
        : next === 'KEEP_RESULT' ? '保留成功结果，不重跑。' : '只处理该Case缺失的前置事实；权限和业务预期不得猜测。' };
  });
  return { schema_version: 'manual-ui-agent-repair/v1', run_id: facts.run_id,
    max_technical_retries_per_case: MAX_TECHNICAL_RETRIES,
    max_authentication_recoveries_per_case: MAX_AUTHENTICATION_RECOVERIES, issues,
    retry_case_ids: issues.filter(x => x.retry_eligible).map(x => x.case_id),
    media_reaudit_case_ids: issues.filter(x => x.media_reaudit_eligible).map(x => x.case_id) };
}

export async function diagnoseRun(project, runId) {
  const dir = runDirectory(project, runId);
  const [facts, plan] = await Promise.all([readJson(path.join(dir, 'machine-facts.json')), readJson(path.join(dir, 'frozen-case-plan.json'))]);
  return diagnoseFacts(facts, plan);
}

export async function prepareRetry({ project, parentRunId, importedBytes, baseUrl, caseIds }) {
  const dir = runDirectory(project, parentRunId);
  const [factsBytes, planBytes] = await Promise.all([fs.readFile(path.join(dir, 'machine-facts.json')), fs.readFile(path.join(dir, 'frozen-case-plan.json'))]);
  const facts = JSON.parse(factsBytes), plan = JSON.parse(planBytes);
  if (facts.run_id !== parentRunId || facts.case_import_sha256 !== digest(importedBytes)) reject('REPAIR_BASELINE_CHANGED');
  if (facts.target_sha256 !== digest(new URL(baseUrl).href)) reject('REPAIR_TARGET_CHANGED');
  if (facts.frozen_plan_sha256 && facts.frozen_plan_sha256 !== digest(planBytes)) reject('REPAIR_PLAN_CHANGED');
  const diagnosis = diagnoseFacts(facts, plan);
  const selected = caseIds ?? diagnosis.retry_case_ids;
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length || selected.some(id => !diagnosis.retry_case_ids.includes(id))) reject('REPAIR_CASE_NOT_ELIGIBLE');
  const rootRunId = facts.retry?.root_run_id ?? parentRunId;
  runDirectory(project, rootRunId);
  const authCaseIds = diagnosis.issues.filter(x => x.authentication_recovery_eligible).map(x => x.case_id);
  if (selected.some(id => authCaseIds.includes(id)) && facts.frozen_plan_sha256 !== digest(planBytes)) reject('REPAIR_PLAN_CHANGED');
  const priorCounts = Object.fromEntries(selected.map(id => [id, 0]));
  const authenticationCounts = Object.fromEntries(selected.map(id => [id, 0]));
  for (const entry of await fs.readdir(path.join(project, 'runs'), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^run-[A-Za-z0-9._-]+$/.test(entry.name)) continue;
    let attempt;
    try { attempt = await readJson(path.join(project, 'runs', entry.name, 'attempt.json')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (attempt.root_run_id !== rootRunId) continue;
    if (!Array.isArray(attempt.selected_case_ids)) reject('REPAIR_ATTEMPT_INVALID');
    const affected = selected.filter(id => attempt.selected_case_ids.includes(id));
    if (!affected.length) continue;
    // An unfinished reservation remains unsafe. Authentication recovery does
    // not grant permission to replay a run whose business outcome is unknown.
    let subsequentFacts, subsequentPlan, subsequentPlanBytes;
    try {
      const values = await Promise.all([
        readJson(path.join(project, 'runs', entry.name, 'machine-facts.json')),
        fs.readFile(path.join(project, 'runs', entry.name, 'frozen-case-plan.json')),
      ]);
      subsequentFacts = values[0]; subsequentPlanBytes = values[1]; subsequentPlan = JSON.parse(subsequentPlanBytes);
    } catch { reject('REPAIR_ATTEMPT_INCOMPLETE'); }
    if (subsequentFacts.run_id !== entry.name || subsequentFacts.case_import_sha256 !== facts.case_import_sha256 || subsequentFacts.target_sha256 !== facts.target_sha256
      || (attempt.case_import_sha256 && attempt.case_import_sha256 !== facts.case_import_sha256)
      || (attempt.target_sha256 && attempt.target_sha256 !== facts.target_sha256)) reject('REPAIR_ATTEMPT_INVALID');
    if (subsequentFacts.frozen_plan_sha256 && subsequentFacts.frozen_plan_sha256 !== digest(subsequentPlanBytes)) reject('REPAIR_PLAN_CHANGED');
    const subsequentDiagnosis = diagnoseFacts(subsequentFacts, subsequentPlan);
    if (affected.some(id => !subsequentDiagnosis.retry_case_ids.includes(id))) reject('REPAIR_LATER_RESULT_NOT_ELIGIBLE');
    for (const id of affected) {
      const interrupted = subsequentDiagnosis.issues.find(x => x.case_id === id)?.authentication_recovery_eligible === true;
      if ((!interrupted && authCaseIds.includes(id) && entry.name !== parentRunId)
        || (interrupted && !authCaseIds.includes(id) && attempt.parent_run_id === parentRunId)) reject('REPAIR_AUTH_PARENT_SUPERSEDED_USE_LATEST');
      const kind = attempt.retry_kind_by_case?.[id];
      if (kind !== undefined && !['AUTHENTICATION_RECOVERY', 'TECHNICAL_REPAIR'].includes(kind)) reject('REPAIR_ATTEMPT_INVALID');
      if (kind === 'AUTHENTICATION_RECOVERY' || (!kind && interrupted)) authenticationCounts[id] += 1;
      if (!interrupted && attempt.technical_retry_by_case?.[id] !== false) priorCounts[id] += 1;
    }
  }
  // When a technical retry was reserved but blocked by auth, resume that same
  // pending technical attempt. An initial case blocked by auth stays attempt 0.
  const technicalRetry = Object.fromEntries(selected.map(id => [id, !authCaseIds.includes(id)
    || (facts.retry ? facts.retry.technical_retry_by_case?.[id] !== false : false)]));
  if (selected.some(id => technicalRetry[id] && priorCounts[id] >= MAX_TECHNICAL_RETRIES)) reject('REPAIR_BUDGET_EXHAUSTED');
  if (selected.some(id => authCaseIds.includes(id) && authenticationCounts[id] >= MAX_AUTHENTICATION_RECOVERIES)) reject('AUTHENTICATION_RECOVERY_BUDGET_EXHAUSTED');
  return { parent_run_id: parentRunId, root_run_id: rootRunId, selected_case_ids: selected,
    retry_kind_by_case: Object.fromEntries(selected.map(id => [id, authCaseIds.includes(id) ? 'AUTHENTICATION_RECOVERY' : 'TECHNICAL_REPAIR'])),
    technical_retry_by_case: technicalRetry,
    attempt_by_case: Object.fromEntries(selected.map(id => [id, priorCounts[id] + (technicalRetry[id] ? 1 : 0)])),
    authentication_recovery_attempt_by_case: Object.fromEntries(selected.map(id => [id, authenticationCounts[id] + (authCaseIds.includes(id) ? 1 : 0)])),
    parent_facts_sha256: digest(factsBytes), parent_plan_sha256: digest(planBytes),
    case_import_sha256: digest(importedBytes), target_sha256: facts.target_sha256 };
}

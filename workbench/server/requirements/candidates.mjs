import { randomUUID } from 'node:crypto';
import { sha256 } from './documents.mjs';

function text(value, code, max = 5000, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(code);
  return value.trim();
}
function issue(code, message, severity = 'BLOCKING', stepOrder = null) {
  return { issue_id: `issue-${randomUUID()}`, code, message, severity, step_order: stepOrder, resolved_at: null };
}
function stepDecisionHash(step) { return sha256(JSON.stringify({ action: step.action.trim(), expected: step.expected.trim() })); }
function selectedSources(design, sources) {
  const selected = new Set(design.source_refs.map((ref) => ref.snapshot_id));
  return new Map(sources.filter((source) => selected.has(source.snapshot_id) && source.project_id === design.project_id)
    .map((source) => [source.snapshot_id, source]));
}

export function resolveSourceRef(ref, design, sources, decisions = []) {
  if (ref?.decision_id) {
    const decision = decisions.find((entry) => entry.decision_id === ref.decision_id);
    if (!decision || (ref.quote_sha256 && ref.quote_sha256 !== decision.quote_sha256)) return null;
    return { decision_id: decision.decision_id, quote_sha256: decision.quote_sha256 };
  }
  const selected = selectedSources(design, sources);
  const source = selected.get(ref?.snapshot_id);
  if (!source || source.kind === 'IMAGE') return null;
  const segment = source.segments.find((entry) => entry.segment_id === ref.segment_id);
  if (!segment || (ref.quote_sha256 && ref.quote_sha256 !== segment.quote_sha256)) return null;
  return {
    snapshot_id: source.snapshot_id, segment_id: segment.segment_id, quote_sha256: segment.quote_sha256,
    location: structuredClone(segment.location),
  };
}

function normalizeModelIssues(rawIssues) {
  if (!Array.isArray(rawIssues)) return [];
  return rawIssues.slice(0, 40).map((raw) => issue(
    /^[A-Z][A-Z0-9_]{2,60}$/.test(raw?.code) ? raw.code : 'MODEL_CLARIFICATION',
    text(raw?.message || '模型标记了待核对问题。', 'REQUIREMENT_MODEL_ISSUE_INVALID', 1000, true),
    raw?.severity === 'INFO' ? 'INFO' : raw?.severity === 'CLARIFICATION' ? 'CLARIFICATION' : 'BLOCKING',
    Number.isInteger(raw?.step_order) ? raw.step_order : null,
  ));
}

export function normalizeCandidate(raw, caseType, design, sources, previous = null) {
  if (!['UI', 'BACKEND'].includes(caseType)) throw new Error('REQUIREMENT_CASE_TYPE_INVALID');
  const content = raw?.content;
  if (!content || !Array.isArray(content.steps) || !content.steps.length || content.steps.length > 100) throw new Error('REQUIREMENT_CANDIDATE_STEPS_INVALID');
  const decisions = structuredClone(previous?.human_decisions || []);
  const modelIssues = previous ? [] : normalizeModelIssues(raw.issues);
  const issues = previous ? previous.issues.filter((item) => !item.code.startsWith('VALIDATION_') && item.code !== 'REVISION_EXPECTED_REVIEW_REQUIRED') : [...modelIssues];
  const unresolvedModelIssues = modelIssues.filter((item) => item.severity !== 'INFO');
  const protectsAll = unresolvedModelIssues.some((item) => !Number.isInteger(item.step_order) ||
    item.step_order < 1 || item.step_order > content.steps.length);
  const protectedSteps = new Set(unresolvedModelIssues.map((item) => item.step_order));
  const proposalSteps = [];
  const steps = content.steps.map((step, index) => {
    if (step?.order !== index + 1) throw new Error('REQUIREMENT_CANDIDATE_STEPS_INVALID');
    const action = text(step.action, 'REQUIREMENT_CANDIDATE_ACTION_INVALID', 3000, true);
    const proposedExpected = text(step.expected, 'REQUIREMENT_CANDIDATE_EXPECTED_INVALID', 3000);
    const expected = !previous && (protectsAll || protectedSteps.has(index + 1)) ? '' : proposedExpected;
    const references = Array.isArray(step.source_refs) ? step.source_refs : [];
    const sourceRefs = [];
    for (const ref of references) {
      const resolved = resolveSourceRef(ref, design, sources, decisions);
      const decision = ref?.decision_id ? decisions.find((entry) => entry.decision_id === ref.decision_id) : null;
      // Old human decisions stay in the audit history but cannot support edited step text.
      if (decision && (decision.step_order !== index + 1 || decision.step_content_sha256 !== stepDecisionHash({ action, expected }))) continue;
      if (resolved) sourceRefs.push(resolved);
      else issues.push(issue('VALIDATION_SOURCE_REF_INVALID', '来源不存在、跨项目、未选入设计或摘要不匹配。', 'BLOCKING', index + 1));
    }
    if (!previous && unresolvedModelIssues.length) proposalSteps.push({ order: index + 1, action,
      expected: proposedExpected, source_refs: structuredClone(sourceRefs) });
    if (expected && !sourceRefs.length) issues.push(issue('VALIDATION_EXPECTED_SOURCE_MISSING', '确定预期缺少可核对来源或人工决定。', 'BLOCKING', index + 1));
    if (!expected) {
      issues.push(issue('VALIDATION_EXPECTED_MISSING', '步骤预期尚未确定。', 'CLARIFICATION', index + 1));
    }
    return { order: index + 1, action, expected, source_refs: sourceRefs };
  });
  const normalizedContent = {
    external_id: text(content.external_id, 'REQUIREMENT_CANDIDATE_EXTERNAL_ID_INVALID', 200, true),
    title: text(content.title, 'REQUIREMENT_CANDIDATE_TITLE_INVALID', 500, true),
    module: text(content.module ?? '', 'REQUIREMENT_CANDIDATE_MODULE_INVALID', 500),
    preconditions: text(content.preconditions ?? '', 'REQUIREMENT_CANDIDATE_PRECONDITIONS_INVALID'),
    test_data: text(content.test_data ?? '', 'REQUIREMENT_CANDIDATE_TEST_DATA_INVALID'),
    case_type: caseType, steps, status: 'PENDING_CONFIRMATION',
  };
  if (/(?:同基线|同上|参照上一(?:条|个)?用例|沿用上一(?:条|个)?用例)/.test(`${normalizedContent.preconditions}\n${normalizedContent.test_data}`)) {
    issues.push(issue('VALIDATION_NON_STANDALONE_DATA', '请展开本条用例的具体前置和测试数据，不要引用其他用例的基线。', 'CLARIFICATION', null));
  }
  const modelProposal = previous?.model_proposal ? structuredClone(previous.model_proposal) :
    unresolvedModelIssues.length ? {
      content: { external_id: normalizedContent.external_id, title: normalizedContent.title,
        module: normalizedContent.module, preconditions: normalizedContent.preconditions,
        test_data: normalizedContent.test_data, steps: proposalSteps },
      issues: modelIssues.map(({ code, message, severity, step_order }) => ({ code, message, severity, step_order })),
    } : null;
  return {
    candidate_id: previous?.candidate_id || `candidate-${randomUUID()}`,
    case_type: caseType, content: normalizedContent,
    issues, human_decisions: decisions, coverage_decision: previous?.coverage_decision || null,
    ...(modelProposal ? { model_proposal: modelProposal } : {}),
    target_case: previous?.target_case ? structuredClone(previous.target_case) : null,
    confirmation_status: previous?.confirmation_status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING_CONFIRMATION',
    confirmed_case: previous?.confirmed_case || null,
  };
}

export function applyHumanDecisions(candidate, input) {
  if (!Array.isArray(input) || input.length > 20) throw new Error('REQUIREMENT_DECISIONS_INVALID');
  for (const raw of input) {
    const original = candidate.issues.find((item) => item.issue_id === raw.issue_id && !item.resolved_at);
    if (!original) throw new Error('REQUIREMENT_ISSUE_NOT_FOUND');
    const reviewer = text(raw.reviewer, 'REQUIREMENT_REVIEWER_REQUIRED', 120, true);
    const decisionText = text(raw.text, 'REQUIREMENT_DECISION_TEXT_REQUIRED', 3000, true);
    const step = candidate.content.steps.find((entry) => entry.order === raw.step_order);
    if (!step) throw new Error('REQUIREMENT_DECISION_STEP_REQUIRED');
    if (candidate.content.steps.some((entry) => entry.order === original.step_order) &&
      original.step_order !== step.order) throw new Error('REQUIREMENT_DECISION_STEP_MISMATCH');
    const at = new Date().toISOString();
    const decision = { decision_id: `decision-${randomUUID()}`, issue_id: original.issue_id, reviewer, text: decisionText, quote_sha256: sha256(decisionText), step_order: step.order, step_content_sha256: stepDecisionHash(step), created_at: at };
    candidate.human_decisions.push(decision);
    step.source_refs.push({ decision_id: decision.decision_id, quote_sha256: decision.quote_sha256 });
    original.resolved_at = at;
    original.resolution_decision_id = decision.decision_id;
  }
  return candidate;
}

export function confirmCandidate(candidate, design, sources) {
  if (candidate.confirmation_status === 'CONFIRMED') throw new Error('REQUIREMENT_ALREADY_CONFIRMED');
  if (candidate.issues.some((item) => item.severity !== 'INFO' && !item.resolved_at)) throw new Error('REQUIREMENT_CONFIRM_BLOCKED');
  for (const step of candidate.content.steps) {
    if (!step.expected || !step.source_refs.length) throw new Error('REQUIREMENT_CONFIRM_BLOCKED');
    for (const ref of step.source_refs) {
      if (!resolveSourceRef(ref, design, sources, candidate.human_decisions)) throw new Error('REQUIREMENT_SOURCE_REF_INVALID');
      const decision = ref.decision_id && candidate.human_decisions.find((entry) => entry.decision_id === ref.decision_id);
      if (decision && (decision.step_order !== step.order || decision.step_content_sha256 !== stepDecisionHash(step))) throw new Error('REQUIREMENT_DECISION_STALE');
    }
  }
  const selected = selectedSources(design, sources);
  const usedPartial = candidate.content.steps.some((step) => step.source_refs.some((ref) => {
    const source = selected.get(ref.snapshot_id);
    return source?.sections.body === 'PARTIAL' || source?.sections.tables === 'PARTIAL';
  }));
  if (usedPartial && !candidate.coverage_decision) throw new Error('REQUIREMENT_COVERAGE_DECISION_REQUIRED');
  if (candidate.coverage_decision && (!candidate.coverage_decision.reviewer || !candidate.coverage_decision.adopted_scope)) throw new Error('REQUIREMENT_COVERAGE_DECISION_INVALID');
}

export function candidateRootSource(design, candidate) {
  return {
    type: 'requirements-design',
    stable_id: `requirements:${design.design_id}:${candidate.candidate_id}`,
    project_id: design.project_id, design_id: design.design_id, design_revision: design.revision,
    source_snapshots: design.source_refs.map((ref) => ({ snapshot_id: ref.snapshot_id, sha256: ref.sha256 })),
  };
}

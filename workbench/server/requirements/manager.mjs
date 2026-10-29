import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectDocument, sha256, extractDocxImages } from './documents.mjs';
import { inspectDocumentWithOffice, importNativeOfficeDocument } from './office-reader.mjs';
import { RequirementsStore, newSourceId, newDesignId, newBindingId, bindingRevisionDesignId, caseRevisionDesignId } from './store.mjs';
import { requirementsModelInput } from './model.mjs';
import { standardGenerationInputs } from './generation-plan.mjs';
import { prepareImageParts, imageRequestEvidence, normalizeImageObservations } from './images.mjs';
import { normalizeCandidate, applyHumanDecisions, confirmCandidate, candidateRootSource, resolveSourceRef } from './candidates.mjs';
import { evaluateDesignCheck } from './quality.mjs';
import { enhancedGenerationInput, reviewModelInput, repairModelInput, validateQualityReview } from './quality-model.mjs';
import { isNetworkErrorCode } from '../../../src/model-transport.mjs';

function required(value, code, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(code);
  return value.trim();
}
function optional(value, code, max = 1000) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error(code);
  return value.trim();
}
function requestedIds(value, code, max = 50) {
  if (!Array.isArray(value) || !value.length || value.length > max || value.some((id) => typeof id !== 'string') ||
      new Set(value).size !== value.length) throw new Error(code);
  return value;
}
function errorCode(error, fallback) {
  const code = String(error?.message || '');
  return /^[A-Z][A-Z0-9_]{5,100}$/.test(code) ? code : fallback;
}
function modelDiagnostic(error) {
  const raw = error?.requirement_diagnostic;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const diagnostic = {};
  for (const key of ['error_code', 'finish_reason', 'response_model']) {
    if (typeof raw[key] === 'string') diagnostic[key] = raw[key].slice(0, 200);
  }
  if (isNetworkErrorCode(raw.network_error_code)) diagnostic.network_error_code = raw.network_error_code;
  if (raw.transport_error_kind === 'TYPE_ERROR' || raw.transport_error_kind === 'OTHER') {
    diagnostic.transport_error_kind = raw.transport_error_kind;
  }
  if (typeof raw.response_text === 'string') diagnostic.response_text = raw.response_text.slice(0, 12_000);
  if (raw.usage && typeof raw.usage === 'object' && !Array.isArray(raw.usage)) {
    diagnostic.usage = Object.fromEntries(Object.entries(raw.usage).filter(([key, value]) =>
      /^[a-z_]{1,40}$/.test(key) && Number.isFinite(value) && value >= 0).slice(0, 20));
  }
  return Object.keys(diagnostic).length ? diagnostic : null;
}
function qualityMode(value) {
  if (value == null) return 'STANDARD';
  if (value !== 'STANDARD' && value !== 'CHECKED') throw new Error('REQUIREMENT_QUALITY_MODE_INVALID');
  return value;
}
function requestProfile(client, input) {
  const profile = client.profileFor?.(input) || client.requestProfile;
  return profile ? {
    thinking: profile.thinking, reasoning_effort: profile.reasoning_effort,
    max_output_tokens: profile.max_output_tokens, timeout_ms: profile.timeout_ms,
    max_attempts: profile.max_attempts,
  } : null;
}
function qualityUsage(requests) {
  const known = requests.filter((request) => Number.isFinite(request.usage?.total_tokens) && request.usage.total_tokens >= 0);
  const summed = {};
  for (const request of known) for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'reasoning_tokens']) {
    const value = request.usage[key];
    if (Number.isFinite(value) && value >= 0) summed[key] = (summed[key] || 0) + value;
  }
  const notSent = requests.filter((request) => request.dispatch_state === 'NOT_SENT');
  return { request_count: requests.length, known_requests: known.length,
    unknown_requests: requests.length - known.length - notSent.length,
    not_sent_requests: notSent.length, tokens: summed };
}
function failedStageOutput(stage, result, error) {
  if (!result) return null;
  const encoded = JSON.stringify(result);
  const safeString = (value, max) => typeof value === 'string' ? value.slice(0, max)
    .replace(/(?:Bearer\s+|sk-[A-Za-z0-9_-]{10,}|(?:api[_-]?key|token|password)\s*[:=]\s*)[^\s,;"']+/gi, '[REDACTED]') : null;
  const safeRefs = (refs) => Array.isArray(refs) ? refs.slice(0, 5).map((ref) => ({
    snapshot_id: safeString(ref?.snapshot_id, 120), segment_id: safeString(ref?.segment_id, 120),
    quote_sha256: safeString(ref?.quote_sha256, 120),
  })) : null;
  const safeFinding = (item) => ({ code: safeString(item?.code, 80), message: safeString(item?.message, 500),
    step_order: Number.isInteger(item?.step_order) ? item.step_order : null, source_refs: safeRefs(item?.source_refs) });
  const safe = stage === 'REVIEW' || stage === 'RECHECK' ? {
    reviews: Array.isArray(result.reviews) ? result.reviews.slice(0, 200).map((entry) => ({
      candidate_id: safeString(entry?.candidate_id, 120), verdict: safeString(entry?.verdict, 40),
      findings: Array.isArray(entry?.findings) ? entry.findings.slice(0, 5).map(safeFinding) : null,
    })) : null,
    coverage_findings: Array.isArray(result.coverage_findings) ? result.coverage_findings.slice(0, 20).map(safeFinding) : null,
  } : {
    candidate_ids: Object.fromEntries(['UI', 'BACKEND'].map((type) => [type,
      Array.isArray(result.candidates?.[type]) ? result.candidates[type].slice(0, 100).map((entry) => ({
        candidate_id: typeof entry?.candidate_id === 'string' ? entry.candidate_id.slice(0, 120) : null,
        external_id: typeof entry?.content?.external_id === 'string' ? entry.content.external_id.slice(0, 200) : null,
      })) : null])),
  };
  return { stage, error: errorCode(error, 'REQUIREMENT_QUALITY_STAGE_INVALID'),
    ...(error?.quality_validation ? { validation: structuredClone(error.quality_validation) } : {}),
    output_sha256: sha256(encoded), output_bytes: Buffer.byteLength(encoded), safe };
}
function qualityIssue(finding, fallback = 'QUALITY_CHECK_NEEDS_REVIEW', origin = 'PROGRAM_CHECK') {
  return {
    issue_id: `issue-${randomUUID()}`,
    code: /^[A-Z][A-Z0-9_]{2,60}$/.test(finding?.code) ? finding.code : fallback,
    message: String(finding?.message || '质量检查要求人工核对。').slice(0, 1000),
    severity: finding?.severity === 'INFO' ? 'INFO' : 'CLARIFICATION',
    step_order: Number.isInteger(finding?.step_order) ? finding.step_order : null,
    source_refs: Array.isArray(finding?.source_refs) ? structuredClone(finding.source_refs) : [],
    origin,
    resolved_at: null,
  };
}
function modelIssues(result) {
  return Array.isArray(result.issues) ? result.issues.slice(0, 100).map((entry) => ({
    issue_id: `issue-${randomUUID()}`, code: /^[A-Z][A-Z0-9_]{2,60}$/.test(entry?.code) ? entry.code : 'MODEL_CLARIFICATION',
    severity: ['INFO', 'CLARIFICATION', 'BLOCKING'].includes(entry?.severity) ? entry.severity : 'CLARIFICATION',
    message: String(entry?.message || '待核对问题').slice(0, 1000), resolved_at: null, scope_review: null,
    origin: entry?.severity === 'INFO' ? 'MODEL_TECHNICAL' : 'MODEL_BUSINESS',
  })) : [];
}
function candidateDigest(candidates) {
  return sha256(JSON.stringify(Object.fromEntries(['UI', 'BACKEND'].map((type) => [type,
    candidates[type].map((candidate) => ({ candidate_id: candidate.candidate_id, case_type: candidate.case_type,
      content: candidate.content, issues: candidate.issues, design_check: candidate.design_check,
      quality_check: candidate.quality_check }))]))));
}
function snapshot(stage, candidates) {
  return { stage, at: new Date().toISOString(), sha256: candidateDigest(candidates), candidates: structuredClone(candidates) };
}
function contentChanges(before, after) {
  const steps = new Set();
  const global = ['external_id', 'title', 'module', 'preconditions', 'test_data'].some((key) => before[key] !== after[key]);
  if (global || before.steps.length !== after.steps.length) for (const step of after.steps) steps.add(step.order);
  for (const step of after.steps) {
    const old = before.steps.find((entry) => entry.order === step.order);
    const refs = (entry) => (entry?.source_refs || []).filter((ref) => !ref.decision_id)
      .map((ref) => [ref.snapshot_id, ref.segment_id, ref.quote_sha256]);
    if (!old || step.action !== old.action || step.expected !== old.expected ||
        JSON.stringify(refs(step)) !== JSON.stringify(refs(old))) steps.add(step.order);
  }
  return [...steps].sort((a, b) => a - b);
}
function reviewedStepHash(content, order) {
  const step = content.steps.find((entry) => entry.order === order);
  return sha256(JSON.stringify({
    external_id: content.external_id, title: content.title, module: content.module,
    preconditions: content.preconditions, test_data: content.test_data,
    step: step ? { order: step.order, action: step.action, expected: step.expected,
      source_refs: (step.source_refs || []).filter((ref) => !ref.decision_id) } : null,
  }));
}
function checkedCandidates(result, design, sources, previous = null) {
  if (!result?.candidates || !Array.isArray(result.candidates.UI) || !Array.isArray(result.candidates.BACKEND)) {
    throw new Error('REQUIREMENT_MODEL_OUTPUT_INVALID');
  }
  const candidates = { UI: [], BACKEND: [] };
  for (const type of ['UI', 'BACKEND']) {
    if (result.candidates[type].length > 100) throw new Error('REQUIREMENT_MODEL_OUTPUT_LIMIT_EXCEEDED');
    const old = new Map((previous?.[type] || []).map((candidate) => [candidate.content.external_id, candidate]));
    const seen = new Set();
    for (const raw of result.candidates[type]) {
      const externalId = raw?.content?.external_id;
      if (seen.has(externalId)) throw new Error('REQUIREMENT_QUALITY_REPAIR_IDENTITY_INVALID');
      seen.add(externalId);
      const prior = previous ? old.get(externalId) : null;
      if (prior && raw.candidate_id !== prior.candidate_id) throw new Error('REQUIREMENT_QUALITY_REPAIR_IDENTITY_INVALID');
      const candidate = normalizeCandidate(raw, type, design, sources);
      for (const entry of candidate.issues.slice(0, Array.isArray(raw.issues) ? Math.min(raw.issues.length, 40) : 0)) {
        entry.origin = entry.severity === 'INFO' ? 'MODEL_TECHNICAL' : 'MODEL_BUSINESS';
      }
      if (prior) {
        candidate.candidate_id = prior.candidate_id;
        if (prior.model_proposal && !candidate.model_proposal) candidate.model_proposal = structuredClone(prior.model_proposal);
        const existing = new Set(candidate.issues.map((entry) => `${entry.code}:${entry.step_order}:${entry.message}`));
        for (const entry of prior.issues.filter((item) => item.origin === 'MODEL_BUSINESS' && !item.resolved_at)) {
          const key = `${entry.code}:${entry.step_order}:${entry.message}`;
          if (!existing.has(key)) candidate.issues.push(structuredClone(entry));
        }
      }
      const quality = evaluateDesignCheck(raw?.design_check, candidate.content, design, sources);
      candidate.design_check = quality.normalized;
      candidate.quality_check = { status: quality.status, findings: quality.findings, calculations: quality.calculations };
      candidate.quality_review = { status: 'UNREVIEWED', snapshot_sha256: null, verdict: null, findings: [] };
      for (const finding of quality.findings || []) candidate.issues.push(qualityIssue(finding));
      if (quality.status === 'NOT_CHECKED' && !(quality.findings || []).length) candidate.issues.push(qualityIssue(null));
      candidates[type].push(candidate);
    }
    if (previous && [...old.keys()].some((id) => !seen.has(id))) throw new Error('REQUIREMENT_QUALITY_REPAIR_IDENTITY_INVALID');
  }
  return candidates;
}
const REVISION_FROZEN_FIELDS = ['external_id', 'title', 'module', 'preconditions', 'test_data', 'case_type'];
function assertRevisionOnlyExpectation(design, candidate) {
  if (!candidate.target_case) return;
  const basis = design.revision_basis;
  if (basis?.mode === 'CASE_DESIGN_CORRECTION') {
    if (candidate.content.external_id !== basis.base_content.external_id ||
        candidate.content.module !== basis.base_content.module ||
        candidate.content.case_type !== basis.base_content.case_type ||
        candidate.case_type !== basis.base_content.case_type) throw new Error('CASE_DESIGN_REVISION_IDENTITY_CHANGED');
    return;
  }
  if (!basis || candidate.content.steps.length !== basis.base_steps.length ||
      REVISION_FROZEN_FIELDS.some((field) => candidate.content[field] !== basis.base_inputs?.[field]) ||
      candidate.content.steps.some((step, index) => step.order !== basis.base_steps[index].order ||
        step.action !== basis.base_steps[index].action)) throw new Error('BINDING_REVISION_INPUT_CHANGED');
}

function verifiedCaseSource(candidate, version, design, sources) {
  const fields = ['external_id', 'title', 'module', 'preconditions', 'test_data', 'case_type'];
  if (fields.some((field) => candidate.content?.[field] !== version.content?.[field]) ||
      candidate.content?.steps?.length !== version.content?.steps?.length) return false;
  return candidate.content.steps.every((step, index) => {
    const saved = version.content.steps[index];
    return step.order === saved.order && step.action === saved.action && step.expected === saved.expected &&
      JSON.stringify(step.source_refs) === JSON.stringify(saved.source_refs) &&
      step.source_refs.length > 0 && step.source_refs.every((ref) => ref.quote_sha256 &&
        resolveSourceRef(ref, design, sources, candidate.human_decisions));
  });
}

export class RequirementsManager {
  #active = null;
  #shutdownRequested = false;
  #documentReads = new Map();
  constructor({ root, projectStore, confirmCases = null, modelClient = null, accepting = () => true, otherActive = () => false, nativeOfficeReader = importNativeOfficeDocument } = {}) {
    if (!root || !projectStore?.getProject) throw new Error('REQUIREMENT_MANAGER_CONFIG_INVALID');
    this.store = new RequirementsStore(root);
    this.projectStore = projectStore;
    this.confirmCases = confirmCases;
    this.modelClient = modelClient;
    this.accepting = accepting;
    this.otherActive = otherActive;
    this.nativeOfficeReader = nativeOfficeReader;
  }
  static defaultRoot(paths) { return path.join(paths.caseLibraryRoot, 'requirements'); }
  get active() { return this.#active ? { project_id: this.#active.projectId, design_id: this.#active.designId, task_id: this.#active.taskId } : null; }
  get starting() { return Boolean(this.#active && !this.#active.sent); }
  diagnostics() { return { accepting: !this.#shutdownRequested && this.accepting(), active: this.active, starting: this.starting, model_available: Boolean(this.modelClient?.generate), image_model_available: Boolean(this.modelClient?.generate && this.modelClient?.supportsImages === true), model: this.modelClient?.model || null, confirm_sink_available: typeof this.confirmCases === 'function', quality_modes: ['STANDARD', 'CHECKED'] }; }
  async init() {
    await this.store.init();
    // A process cannot resume an in-flight model request after restart.
    const fs = await import('node:fs/promises');
    const projectDirectories = await fs.readdir(this.store.root, { withFileTypes: true });
    for (const project of projectDirectories) {
      if (!project.isDirectory() || !/^project-[a-z0-9-]{8,80}$/.test(project.name)) continue;
      const { designs } = await this.store.listDesigns(project.name);
      for (const brief of designs) {
        if (brief.status !== 'RUNNING') continue;
        await this.store.updateDesign(project.name, brief.design_id, brief.revision, (current) => {
          const requests = current.model_requests.map((request) => ['RESERVED', 'SENT'].includes(request.status) ?
            { ...request, status: 'INTERRUPTED', finished_at: new Date().toISOString(),
              dispatch_state: request.status === 'RESERVED' ? 'NOT_SENT' : 'UNKNOWN_AFTER_RESTART' } : request);
          const usage = qualityUsage(requests);
          return { ...current, status: 'INTERRUPTED', model_requests: requests,
            generation: { ...current.generation, status: 'INTERRUPTED', finished_at: new Date().toISOString(),
              error: 'REQUIREMENT_MODEL_INTERRUPTED',
              ...(current.quality?.mode === 'CHECKED' ? { usage: Object.keys(usage.tokens).length ? usage.tokens : null,
                usage_summary: usage } : {}),
              ...(current.generation?.image_analysis?.status === 'REQUESTED' ? {
                image_analysis: { ...current.generation.image_analysis, status: 'INTERRUPTED' },
              } : {}) },
            ...(current.quality?.mode === 'CHECKED' ? { quality: { ...current.quality, status: 'FAILED',
              usage_summary: usage } } : {}),
          };
        });
      }
    }
  }
  async #project(projectId) {
    const project = await this.projectStore.getProject(projectId);
    if (!project) throw new Error('REQUIREMENT_PROJECT_NOT_FOUND');
    return project;
  }
  #writable() {
    if (this.#shutdownRequested || !this.accepting()) throw new Error('REQUIREMENT_SERVICE_NOT_ACCEPTING');
  }
  async #sources(projectId, sourceRefs) {
    const sources = [];
    for (const ref of sourceRefs) {
      const source = await this.store.getSource(projectId, ref.snapshot_id);
      if (!source || source.sha256 !== ref.sha256) throw new Error('REQUIREMENT_SOURCE_VERSION_MISMATCH');
      sources.push(source);
    }
    return sources;
  }
  async upload(projectId, { kind, fileName, body, documentVersion = '', documentStatus = 'UNKNOWN', replacesSourceId = '' } = {}) {
    this.#writable();
    await this.#project(projectId);
    documentStatus = { TO_CHECK: 'UNKNOWN', DRAFT: 'REVIEW_DRAFT' }[documentStatus] || documentStatus;
    if (!['CONFIRMED', 'REVIEW_DRAFT', 'UNKNOWN'].includes(documentStatus)) throw new Error('REQUIREMENT_DOCUMENT_STATUS_INVALID');
    let supersedesSourceId;
    if (replacesSourceId) {
      const previous = await this.store.getSource(projectId, replacesSourceId);
      if (!previous) throw new Error('REQUIREMENT_SOURCE_NOT_FOUND');
      const previousBytes = await this.store.getSourceBytes(projectId, replacesSourceId);
      if (sha256(previousBytes) !== sha256(body)) throw new Error('REQUIREMENT_SOURCE_REPLACEMENT_CONTENT_MISMATCH');
      supersedesSourceId = previous.snapshot_id;
    }
    const readController = new AbortController();
    const documentRead = inspectDocumentWithOffice({ kind, fileName, body }, { signal: readController.signal });
    this.#documentReads.set(readController, documentRead);
    let inspected;
    try { inspected = await documentRead; }
    finally { this.#documentReads.delete(readController); }
    this.#writable();
    const source = {
      schema: 'workbench/requirement-source-snapshot-v1',
      snapshot_id: newSourceId(), project_id: projectId, kind, ...inspected,
      document_version: optional(documentVersion, 'REQUIREMENT_DOCUMENT_VERSION_INVALID', 120),
      document_status: documentStatus, created_at: new Date().toISOString(),
      model_analysis_status: 'NOT_RUN',
      ...(supersedesSourceId ? { supersedes_source_id: supersedesSourceId } : {}),
    };
    return this.store.createSource(projectId, source, body);
  }
  async listSources(projectId) { await this.#project(projectId); return this.store.listSources(projectId); }
  async uploadOffice(projectId, { originalPath, provider = 'auto' } = {}) {
    this.#writable();await this.#project(projectId);
    if (!['auto','word','wps'].includes(provider)) throw new Error('REQUIREMENT_OFFICE_OPEN_FAILED');
    const controller = new AbortController();
    const reading = this.nativeOfficeReader({originalPath,provider,signal:controller.signal});
    this.#documentReads.set(controller,reading);
    let loaded;
    try { loaded = await reading; } finally { this.#documentReads.delete(controller); }
    this.#writable();
    const {fileName,body,inspected} = loaded;
    if (!Buffer.isBuffer(body) || inspected.sha256 !== sha256(body) || inspected.bytes !== body.length || inspected.file_name !== fileName || inspected.reading_method !== 'local-office') throw new Error('REQUIREMENT_SOURCE_INTEGRITY_FAILED');
    const source = {schema:'workbench/requirement-source-snapshot-v1',snapshot_id:newSourceId(),project_id:projectId,kind:'PRD',...inspected,
      document_version:'',document_status:'UNKNOWN',created_at:new Date().toISOString(),model_analysis_status:'NOT_RUN'};
    return this.store.createSource(projectId,source,body);
  }
  async getSource(projectId, sourceId) {
    await this.#project(projectId);
    const source = await this.store.getSource(projectId, sourceId);
    if (!source) throw new Error('REQUIREMENT_SOURCE_NOT_FOUND');
    return source;
  }
  async getImage(projectId, sourceId, embeddedId = null) {
    const source = await this.getSource(projectId, sourceId);
    if (embeddedId) {
      if (!/^image-[1-9][0-9]{0,2}$/.test(embeddedId) || source.extension !== '.docx') throw new Error('REQUIREMENT_IMAGE_REQUIRED');
      const body = await this.store.getSourceBytes(projectId, sourceId);
      // Preview a single embedded image without applying the request-wide count
      // limit; generation still applies the combined limit to every selected image.
      const images = extractDocxImages(body);
      const part = images.find(image => image.image_id === embeddedId);
      const saved = source.embedded_images?.find(image => image.image_id === embeddedId);
      if (!part || !saved || saved.sha256 !== part.sha256 || saved.entry_name !== part.entry_name) throw new Error('REQUIREMENT_IMAGE_REQUIRED');
      return { body: part.body, mime_type: part.mime_type, sha256: part.sha256 };
    }
    if (source.kind !== 'IMAGE') throw new Error('REQUIREMENT_IMAGE_REQUIRED');
    const body = await this.store.getSourceBytes(projectId, sourceId);
    const [part] = prepareImageParts([source], new Map([[sourceId, body]]));
    return { body, mime_type: part.mime_type, sha256: source.sha256 };
  }
  async createDesign(projectId, { sourceIds, scope, allowModelText = false, allowModelImages = false, qualityMode: requestedQualityMode = 'STANDARD' } = {}) {
    this.#writable();
    const project = await this.#project(projectId);
    requestedIds(sourceIds, 'REQUIREMENT_DESIGN_SOURCES_REQUIRED', 20);
    if (scope?.mode === 'ALL') scope = { ...scope, mode: 'ALL_CURRENT' };
    if (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
        !['ALL_CURRENT', 'SELECTED'].includes(scope.mode) ||
        (scope.mode === 'SELECTED' && !required(scope.description, 'REQUIREMENT_SCOPE_REQUIRED', 2000))) {
      throw new Error('REQUIREMENT_SCOPE_INVALID');
    }
    if (typeof allowModelText !== 'boolean' || typeof allowModelImages !== 'boolean') throw new Error('REQUIREMENT_MODEL_AUTH_INVALID');
    const selectedQualityMode = qualityMode(requestedQualityMode);
    if (selectedQualityMode === 'CHECKED' && (scope.mode !== 'SELECTED' || allowModelText !== true)) {
      throw new Error('REQUIREMENT_QUALITY_MODE_SCOPE_INVALID');
    }
    const sourceRefs = [];
    for (const sourceId of sourceIds) {
      const source = await this.store.getSource(projectId, sourceId);
      if (!source) throw new Error('REQUIREMENT_SOURCE_NOT_FOUND');
      sourceRefs.push({ snapshot_id: source.snapshot_id, sha256: source.sha256, kind: source.kind, read_status: source.read_status });
    }
    if (!sourceRefs.some((ref) => ref.kind === 'PRD' || ref.kind === 'MRD')) throw new Error('REQUIREMENT_DESIGN_REQUIREMENTS_MISSING');
    const now = new Date().toISOString();
    const design = {
      schema: 'workbench/requirement-design-revision-v1',
      design_id: newDesignId(), project_id: projectId, projectRevision: project.revision,
      revision: 1, status: 'DRAFT', source_refs: sourceRefs, scope: structuredClone(scope),
      allow_model_text: allowModelText, allow_model_images: allowModelImages,
      quality_mode: selectedQualityMode,
      generation_budget: { max_requests: selectedQualityMode === 'CHECKED' ? 4 : scope.mode === 'ALL_CURRENT' ? 2 : 1 },
      ...(selectedQualityMode === 'CHECKED' ? { quality: {
        mode: 'CHECKED', stage: null, status: 'UNREVIEWED', snapshots: [], reviews: [], max_requests: 4,
        usage_summary: { request_count: 0, known_requests: 0, unknown_requests: 0, not_sent_requests: 0, tokens: {} },
      } } : {}),
      candidates: { UI: [], BACKEND: [] }, issues: [],
      model_requests: [], generation: null, confirmations: [],
      created_at: now, updated_at: now,
    };
    return this.store.createDesign(projectId, design);
  }
  async getDesign(projectId, designId) {
    const project = await this.#project(projectId);
    const design = await this.store.getDesign(projectId, designId);
    if (!design) throw new Error('REQUIREMENT_DESIGN_NOT_FOUND');
    return { ...design, sourceProjectRevision: design.projectRevision, projectRevision: project.revision };
  }
  async listDesigns(projectId) { await this.#project(projectId); return this.store.listDesigns(projectId); }
  async startGeneration(projectId, designId, { revision, allowModelText, allowModelImages = false } = {}) {
    this.#writable();
    if (this.#active) {
      const active = this.#active;
      const saved = active.sent ? await this.store.getDesign(active.projectId, active.designId) : null;
      if (!active.sent || saved?.status === 'RUNNING') throw new Error('REQUIREMENT_MODEL_BUSY');
      await active.settled;
    }
    if (this.#active || this.otherActive()) throw new Error('REQUIREMENT_MODEL_BUSY');
    if (!this.modelClient?.generate) throw new Error('REQUIREMENT_MODEL_UNAVAILABLE');
    const taskId = `generation-${designId}`;
    const controller = new AbortController();
    let settle;
    const task = { projectId, designId, taskId, controller, sent: false, settled: new Promise((resolve) => { settle = resolve; }) };
    this.#active = task;
    try {
      const design = await this.getDesign(projectId, designId);
      if (design.revision !== revision) throw new Error('REQUIREMENT_REVISION_CONFLICT');
      if (design.status !== 'DRAFT' && design.status !== 'FAILED') throw new Error('REQUIREMENT_MODEL_STATE_INVALID');
      const checked = qualityMode(design.quality_mode) === 'CHECKED';
      if (design.model_requests.length >= 1) throw new Error('REQUIREMENT_MODEL_BUDGET_EXHAUSTED');
      if (allowModelText !== true || design.allow_model_text !== true) throw new Error('REQUIREMENT_MODEL_AUTH_REQUIRED');
      if (allowModelImages === true && design.allow_model_images !== true) throw new Error('REQUIREMENT_MODEL_IMAGE_AUTH_REQUIRED');
      const sources = await this.#sources(projectId, design.source_refs);
      const selectedImages = sources.filter(source => source.kind === 'IMAGE' || source.embedded_images?.length > 0);
      if (selectedImages.length && design.allow_model_images === true && allowModelImages !== true) throw new Error('REQUIREMENT_MODEL_IMAGE_AUTH_REQUIRED');
      let imageParts = [];
      if (selectedImages.length && allowModelImages === true) {
        if (this.modelClient.supportsImages !== true) throw new Error('REQUIREMENT_MODEL_IMAGE_UNAVAILABLE');
        const bodies = new Map();
        for (const source of selectedImages) bodies.set(source.snapshot_id, await this.store.getSourceBytes(projectId, source.snapshot_id));
        imageParts = prepareImageParts(selectedImages, bodies);
      }
      const input = checked ? enhancedGenerationInput(design, sources, imageParts) :
        requirementsModelInput(design, sources, imageParts);
      const inputs = checked ? [input] : standardGenerationInputs(design, input);
      const profile = requestProfile(this.modelClient, inputs[0]);
      this.#writable();
      if (this.otherActive()) throw new Error('REQUIREMENT_MODEL_BUSY');
      if (controller.signal.aborted) throw new Error('REQUIREMENT_MODEL_CANCELLED');
      const started = new Date().toISOString();
      const running = await this.store.updateDesign(projectId, designId, revision, (current) => ({
        ...current, status: 'RUNNING',
        generation: { task_id: taskId, status: 'RUNNING', started_at: started, finished_at: null, error: null,
          request_profile: profile, max_requests: checked ? 4 : inputs.length, ...(checked ? { stage: 'GENERATE' } : {}),
          image_analysis: imageRequestEvidence(imageParts) },
        model_requests: [...current.model_requests, { request_id: `request-${randomUUID()}`, started_at: started, status: checked ? 'RESERVED' : 'SENT', max_attempts: 1, request_profile: profile,
          ...(checked ? { stage: 'GENERATE', input_sha256: sha256(JSON.stringify(input)) } :
            { input_sha256: sha256(JSON.stringify(inputs[0])), partition: inputs[0].generation_partition || null }) }],
        ...(checked ? { quality: { ...current.quality, stage: 'GENERATE', status: 'UNREVIEWED',
          usage_summary: qualityUsage([...current.model_requests, { status: 'RESERVED' }]) } } : {}),
      }));
      if (this.#shutdownRequested || this.otherActive() || controller.signal.aborted) controller.abort();
      task.sent = true;
      (checked ? this.#completeQualityGeneration(task, running, sources, input) :
        this.#completeGeneration(task, running, sources, inputs)).then(settle, settle);
      return { task_id: taskId, design_id: designId, project_id: projectId, status: 'RUNNING', revision: running.revision };
    } catch (error) {
      if (this.#active === task) this.#active = null;
      settle();
      throw error;
    }
  }
  async #qualityCall(task, stage, input, reserved = false) {
    if (!reserved && task.controller.signal.aborted) throw new Error('REQUIREMENT_MODEL_CANCELLED');
    let current = await this.store.getDesign(task.projectId, task.designId);
    if (!reserved) {
      if (current.model_requests.length >= 4 || current.model_requests.some((request) => request.stage === stage)) {
        throw new Error('REQUIREMENT_MODEL_BUDGET_EXHAUSTED');
      }
      const at = new Date().toISOString();
      current = await this.store.updateDesign(task.projectId, task.designId, current.revision, (design) => {
        design.model_requests.push({ request_id: `request-${randomUUID()}`, stage,
          status: 'RESERVED', started_at: at, finished_at: null, max_attempts: 1,
          request_profile: requestProfile(this.modelClient, input), input_sha256: sha256(JSON.stringify(input)) });
        design.generation = { ...design.generation, stage };
        design.quality = { ...design.quality, stage, usage_summary: qualityUsage(design.model_requests) };
        return design;
      });
    }
    const requestId = current.model_requests.at(-1).request_id;
    let dispatched = false;
    let returnedUsage = null;
    try {
      if (task.controller.signal.aborted || this.#shutdownRequested || this.otherActive()) {
        throw new Error('REQUIREMENT_MODEL_CANCELLED');
      }
      current = await this.store.updateDesign(task.projectId, task.designId, current.revision, (design) => {
        design.model_requests = design.model_requests.map((request) => request.request_id === requestId ?
          { ...request, status: 'SENT', dispatched_at: new Date().toISOString() } : request);
        return design;
      });
      if (task.controller.signal.aborted || this.#shutdownRequested || this.otherActive()) {
        throw new Error('REQUIREMENT_MODEL_CANCELLED');
      }
      dispatched = true;
      const result = await this.modelClient.generate({ input, signal: task.controller.signal });
      returnedUsage = result?.usage || null;
      current = await this.store.updateDesign(task.projectId, task.designId, current.revision, (design) => {
        design.model_requests = design.model_requests.map((request) => request.request_id === requestId ?
          { ...request, status: 'COMPLETED', finished_at: new Date().toISOString(), usage: returnedUsage } : request);
        design.quality.usage_summary = qualityUsage(design.model_requests);
        return design;
      });
      if (task.controller.signal.aborted) throw new Error('REQUIREMENT_MODEL_CANCELLED');
      return { result, current };
    } catch (error) {
      const saved = await this.store.getDesign(task.projectId, task.designId);
      if (saved?.status === 'RUNNING' && saved.model_requests.some((request) => request.request_id === requestId &&
          ['RESERVED', 'SENT'].includes(request.status))) {
        const diagnostic = modelDiagnostic(error);
        await this.store.updateDesign(task.projectId, task.designId, saved.revision, (design) => {
          design.model_requests = design.model_requests.map((request) => request.request_id === requestId ?
            { ...request, status: task.controller.signal.aborted || error.message === 'REQUIREMENT_MODEL_CANCELLED' ? 'CANCELLED' : 'FAILED',
              dispatch_state: dispatched ? 'SENT_TO_CLIENT' : 'NOT_SENT',
              finished_at: new Date().toISOString(), usage: returnedUsage || diagnostic?.usage || null,
              diagnostic, error: errorCode(error, 'REQUIREMENT_MODEL_FAILED') } : request);
          design.quality.usage_summary = qualityUsage(design.model_requests);
          return design;
        });
      }
      throw error;
    }
  }
  async #completeQualityGeneration(task, started, sources, baseInput) {
    let lastStage = 'GENERATE';
    let lastReturned = null;
    try {
      const generated = await this.#qualityCall(task, 'GENERATE', baseInput, true);
      lastReturned = generated.result;
      const imageAnalysis = normalizeImageObservations(generated.result.image_observations, started.generation.image_analysis);
      let candidates = checkedCandidates(generated.result, generated.current, sources);
      let current = await this.store.updateDesign(task.projectId, task.designId, generated.current.revision, (design) => {
        design.candidates = candidates;
        design.issues = modelIssues(generated.result);
        design.generation.image_analysis = imageAnalysis;
        design.quality.snapshots.push(snapshot('GENERATE', candidates));
        design.quality.status = 'UNREVIEWED';
        design.quality.review_completed = false;
        return design;
      });
      const reviewInput = reviewModelInput({ baseInput, candidates: current.candidates });
      lastStage = 'REVIEW';
      lastReturned = null;
      const reviewedCall = await this.#qualityCall(task, 'REVIEW', reviewInput);
      lastReturned = reviewedCall.result;
      const reviewed = validateQualityReview(reviewedCall.result, { candidates: current.candidates, design: reviewedCall.current, sources });
      current = await this.store.updateDesign(task.projectId, task.designId, reviewedCall.current.revision, (design) => {
        const prior = design.quality.snapshots.at(-1);
        design.quality.reviews.push({ stage: 'REVIEW', at: new Date().toISOString(), snapshot_sha256: prior.sha256,
          result: structuredClone(reviewed) });
        this.#attachQualityReview(design, reviewed, prior.sha256);
        design.quality.review_completed = true;
        design.quality.reviewed_snapshot_sha256 = prior.sha256;
        design.quality.status = 'REVIEWED';
        return design;
      });
      const hasProblems = reviewed.reviews.some((entry) => entry.verdict !== 'NO_FINDINGS' || entry.findings.length) ||
        reviewed.coverage_findings.length ||
        [...current.candidates.UI, ...current.candidates.BACKEND].some((candidate) => candidate.quality_check.status !== 'CHECKED' ||
          candidate.quality_check.findings.length);
      if (hasProblems) {
        const repairInput = repairModelInput({ baseInput, candidates: current.candidates, review: reviewed });
        lastStage = 'REPAIR';
        lastReturned = null;
        const repaired = await this.#qualityCall(task, 'REPAIR', repairInput);
        lastReturned = repaired.result;
        candidates = checkedCandidates(repaired.result, repaired.current, sources, current.candidates);
        current = await this.store.updateDesign(task.projectId, task.designId, repaired.current.revision, (design) => {
          design.candidates = candidates;
          design.issues = design.issues.filter((entry) => entry.origin !== 'QUALITY_REVIEW' && entry.origin !== 'PROGRAM_CHECK');
          design.issues.push(...modelIssues(repaired.result));
          design.quality.snapshots.push(snapshot('REPAIR', candidates));
          design.quality.status = 'UNREVIEWED';
          design.quality.review_completed = false;
          design.quality.reviewed_snapshot_sha256 = null;
          return design;
        });
        const recheckInput = reviewModelInput({ baseInput, candidates: current.candidates });
        lastStage = 'RECHECK';
        lastReturned = null;
        const recheckedCall = await this.#qualityCall(task, 'RECHECK', recheckInput);
        lastReturned = recheckedCall.result;
        const rechecked = validateQualityReview(recheckedCall.result, { candidates: current.candidates, design: recheckedCall.current, sources });
        current = await this.store.updateDesign(task.projectId, task.designId, recheckedCall.current.revision, (design) => {
          const prior = design.quality.snapshots.at(-1);
          design.quality.reviews.push({ stage: 'RECHECK', at: new Date().toISOString(), snapshot_sha256: prior.sha256,
            result: structuredClone(rechecked) });
          this.#attachQualityReview(design, rechecked, prior.sha256);
          design.quality.review_completed = true;
          design.quality.reviewed_snapshot_sha256 = prior.sha256;
          design.quality.status = 'REVIEWED';
          return design;
        });
      }
      if (task.controller.signal.aborted) throw new Error('REQUIREMENT_MODEL_CANCELLED');
      await this.store.updateDesign(task.projectId, task.designId, current.revision, (design) => {
        design.status = 'PENDING_REVIEW';
        design.generation = { ...design.generation, status: 'COMPLETED', finished_at: new Date().toISOString(),
          model: generated.result.model || null,
          usage: Object.keys(qualityUsage(design.model_requests).tokens).length ? qualityUsage(design.model_requests).tokens : null,
          usage_summary: qualityUsage(design.model_requests) };
        design.quality.stage = 'COMPLETE';
        design.quality.usage_summary = qualityUsage(design.model_requests);
        return design;
      });
    } catch (error) {
      const cancelled = task.controller.signal.aborted || error.message === 'REQUIREMENT_MODEL_CANCELLED';
      const status = cancelled ? 'CANCELLED' : 'FAILED';
      const code = cancelled ? 'REQUIREMENT_MODEL_CANCELLED' : errorCode(error, 'REQUIREMENT_MODEL_FAILED');
      try {
        const current = await this.store.getDesign(task.projectId, task.designId);
        if (current?.status === 'RUNNING') await this.store.updateDesign(task.projectId, task.designId, current.revision, (design) => {
          design.status = status;
          design.generation = { ...design.generation, status, finished_at: new Date().toISOString(), error: code,
            diagnostic: modelDiagnostic(error),
            usage: Object.keys(qualityUsage(design.model_requests).tokens).length ? qualityUsage(design.model_requests).tokens : null,
            usage_summary: qualityUsage(design.model_requests) };
          design.quality.status = 'FAILED';
          design.quality.usage_summary = qualityUsage(design.model_requests);
          const diagnostic = modelDiagnostic(error);
          design.quality.failed_stage_output = failedStageOutput(lastStage, lastReturned, error) || {
            stage: lastStage, error: code,
            ...(typeof diagnostic?.response_text === 'string' ? {
              output_sha256: sha256(diagnostic.response_text), output_bytes: Buffer.byteLength(diagnostic.response_text),
            } : {}),
          };
          return design;
        });
      } catch { /* Persisted SENT requests are marked interrupted on restart. */ }
    } finally {
      if (this.#active === task) this.#active = null;
    }
  }
  #attachQualityReview(design, review, snapshotSha) {
    const byId = new Map(review.reviews.map((entry) => [entry.candidate_id, entry]));
    for (const candidate of [...design.candidates.UI, ...design.candidates.BACKEND]) {
      const entry = byId.get(candidate.candidate_id);
      candidate.quality_review = { status: 'REVIEWED', snapshot_sha256: snapshotSha,
        verdict: entry.verdict, findings: structuredClone(entry.findings) };
      for (const finding of entry.findings) candidate.issues.push(qualityIssue(finding, 'QUALITY_REVIEW_FINDING', 'QUALITY_REVIEW'));
    }
    for (const finding of review.coverage_findings) design.issues.push(qualityIssue(finding, 'QUALITY_COVERAGE_FINDING', 'QUALITY_REVIEW'));
  }
  async #completeGeneration(task, started, sources, inputs) {
    let returnedUsage = null;
    let requestId = started.model_requests.at(-1).request_id;
    let dispatched = false;
    try {
      let current = started;
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index];
        returnedUsage = null;
        dispatched = false;
        if (task.controller.signal.aborted || this.#shutdownRequested || this.otherActive()) throw new Error('REQUIREMENT_MODEL_CANCELLED');
        if (index > 0) {
          if (current.model_requests.length >= inputs.length) throw new Error('REQUIREMENT_MODEL_BUDGET_EXHAUSTED');
          requestId = `request-${randomUUID()}`;
          current = await this.store.updateDesign(task.projectId, task.designId, current.revision, design => {
            design.model_requests.push({ request_id: requestId, started_at: new Date().toISOString(), status: 'RESERVED', max_attempts: 1,
              request_profile: requestProfile(this.modelClient, input), partition: input.generation_partition || null,
              input_sha256: sha256(JSON.stringify(input)) });
            return design;
          });
        }
        if (task.controller.signal.aborted || this.#shutdownRequested || this.otherActive()) throw new Error('REQUIREMENT_MODEL_CANCELLED');
        current = await this.store.updateDesign(task.projectId, task.designId, current.revision, design => {
          design.model_requests = design.model_requests.map(request => request.request_id === requestId ?
            { ...request, status: 'SENT', dispatched_at: new Date().toISOString() } : request);
          return design;
        });
        if (task.controller.signal.aborted || this.#shutdownRequested || this.otherActive()) throw new Error('REQUIREMENT_MODEL_CANCELLED');
        dispatched = true;
        const result = await this.modelClient.generate({ input, signal: task.controller.signal });
        returnedUsage = result.usage || null;
        const candidates = { UI: [], BACKEND: [] };
        if (!result?.candidates || !Array.isArray(result.candidates.UI) || !Array.isArray(result.candidates.BACKEND)) throw new Error('REQUIREMENT_MODEL_OUTPUT_INVALID');
        for (const type of ['UI', 'BACKEND']) {
          if (result.candidates[type].length > 100) throw new Error('REQUIREMENT_MODEL_OUTPUT_LIMIT_EXCEEDED');
          if (input.generation_partition && type !== input.generation_partition.case_type && result.candidates[type].length)
            throw new Error('REQUIREMENT_MODEL_PARTITION_INVALID');
          candidates[type] = result.candidates[type].map(raw => normalizeCandidate(raw, type, current, sources));
        }
        const imageAnalysis = normalizeImageObservations(result.image_observations, started.generation.image_analysis);
        current = await this.store.updateDesign(task.projectId, task.designId, current.revision, design => {
          for (const type of ['UI', 'BACKEND']) design.candidates[type].push(...candidates[type]);
          for (const issue of modelIssues(result)) {
            if (!design.issues.some(prior => prior.code === issue.code && prior.severity === issue.severity && prior.message === issue.message))
              design.issues.push({ ...issue, ...(input.generation_partition ? { partition: input.generation_partition.case_type } : {}) });
          }
          design.model_requests = design.model_requests.map(request => request.request_id === requestId ?
            { ...request, status: 'COMPLETED', usage: returnedUsage, finished_at: new Date().toISOString() } : request);
          const usage = qualityUsage(design.model_requests);
          design.generation = { ...design.generation, model: result.model || null,
            usage: Object.keys(usage.tokens).length ? usage.tokens : null, usage_summary: usage, image_analysis: imageAnalysis };
          return design;
        });
        if (task.controller.signal.aborted) throw new Error('REQUIREMENT_MODEL_CANCELLED');
      }
      await this.store.updateDesign(task.projectId, task.designId, current.revision, design => ({ ...design, status: 'PENDING_REVIEW',
        generation: { ...design.generation, status: 'COMPLETED', finished_at: new Date().toISOString() } }));
    } catch (error) {
      const status = task.controller.signal.aborted ? 'CANCELLED' : 'FAILED';
      const code = task.controller.signal.aborted ? 'REQUIREMENT_MODEL_CANCELLED' : errorCode(error, 'REQUIREMENT_MODEL_FAILED');
      const diagnostic = modelDiagnostic(error);
      try {
        const current = await this.store.getDesign(task.projectId, task.designId);
        if (current?.status === 'RUNNING') await this.store.updateDesign(task.projectId, task.designId, current.revision, design => {
          design.status = status;
          design.model_requests = design.model_requests.map(request => request.request_id === requestId && ['RESERVED', 'SENT'].includes(request.status) ?
            { ...request, status, usage: returnedUsage || diagnostic?.usage || null, finished_at: new Date().toISOString(),
              dispatch_state: dispatched ? 'SENT_TO_CLIENT' : 'NOT_SENT', diagnostic, error: code } : request);
          const usage = qualityUsage(design.model_requests);
          design.generation = { ...design.generation, status, finished_at: new Date().toISOString(), error: code, diagnostic,
            usage: Object.keys(usage.tokens).length ? usage.tokens : null, usage_summary: usage,
            image_analysis: { ...design.generation.image_analysis,
              status: design.generation.image_analysis?.status === 'REQUESTED' ? status : design.generation.image_analysis?.status || 'NOT_REQUESTED' } };
          return design;
        });
      } catch {
        // A storage fault remains visible as an unfinished persisted task; init() marks it interrupted.
      }
    } finally {
      if (this.#active === task) this.#active = null;
    }
  }
  async getGeneration(projectId, taskId) {
    if (typeof taskId !== 'string' || !taskId.startsWith('generation-')) throw new Error('REQUIREMENT_GENERATION_ID_INVALID');
    const design = await this.getDesign(projectId, taskId.slice('generation-'.length));
    if (!design.generation || design.generation.task_id !== taskId) throw new Error('REQUIREMENT_GENERATION_NOT_FOUND');
    return { ...design.generation, design_id: design.design_id, revision: design.revision,
      ...(design.quality?.mode === 'CHECKED' ? {
        request_count: design.model_requests.length, usage_summary: structuredClone(design.quality.usage_summary),
      } : {}) };
  }
  async cancelGeneration(projectId, taskId) {
    this.#writable();
    if (!this.#active || this.#active.projectId !== projectId || this.#active.taskId !== taskId) throw new Error('REQUIREMENT_GENERATION_NOT_RUNNING');
    this.#active.controller.abort();
    return { task_id: taskId, status: 'CANCEL_REQUESTED' };
  }
  async shutdown() {
    this.#shutdownRequested = true;
    for (const controller of this.#documentReads.keys()) controller.abort();
    await Promise.allSettled(this.#documentReads.values());
    if (this.#active) {
      this.#active.controller.abort();
      await this.#active.settled;
    }
  }
  async editCandidate(projectId, designId, candidateId, { revision, content, decisions = [], coverageDecision = null } = {}) {
    this.#writable();
    const design = await this.getDesign(projectId, designId);
    if (design.revision !== revision) throw new Error('REQUIREMENT_REVISION_CONFLICT');
    if (['RUNNING', 'CONFIRMING'].includes(design.status)) throw new Error('REQUIREMENT_DESIGN_BUSY');
    const sources = await this.#sources(projectId, design.source_refs);
    let found = false;
    await this.store.updateDesign(projectId, designId, revision, (current) => {
      for (const type of ['UI', 'BACKEND']) {
        const index = current.candidates[type].findIndex((entry) => entry.candidate_id === candidateId);
        if (index < 0) continue;
        found = true;
        const previous = current.candidates[type][index];
        if (previous.confirmation_status === 'CONFIRMED') throw new Error('REQUIREMENT_CONFIRMED_CANDIDATE_IMMUTABLE');
        const reviewed = structuredClone(previous);
        if (content && (!Array.isArray(content.steps) || content.steps.some((step) => typeof step?.action !== 'string' || typeof step?.expected !== 'string'))) {
          throw new Error('REQUIREMENT_CANDIDATE_STEPS_INVALID');
        }
        const correction = current.revision_basis?.mode === 'CASE_DESIGN_CORRECTION' && Boolean(previous.target_case);
        reviewed.content = content ? structuredClone(content) : reviewed.content;
        applyHumanDecisions(reviewed, decisions);
        if (correction && content && content.steps.some((step) => !Array.isArray(step.source_refs) ||
            step.source_refs.some((ref) => !ref?.quote_sha256 || !resolveSourceRef(ref, current, sources, reviewed.human_decisions)))) {
          throw new Error('CASE_DESIGN_REVISION_SOURCE_INVALID');
        }
        const amended = normalizeCandidate({ content: reviewed.content }, type, current, sources, {
          ...reviewed, confirmation_status: 'PENDING_CONFIRMATION', confirmed_case: null,
        });
        if (current.quality?.mode === 'CHECKED') {
          amended.design_check = structuredClone(previous.design_check ?? null);
          amended.quality_check = structuredClone(previous.quality_check ?? { status: 'NOT_CHECKED', findings: [], calculations: [] });
          amended.quality_review = structuredClone(previous.quality_review ?? { status: 'UNREVIEWED', findings: [] });
          const changedSteps = content ? contentChanges(previous.content, amended.content) : [];
          if (changedSteps.length) {
            amended.quality_check.status = 'STALE';
            amended.quality_review.status = 'STALE';
            for (const order of changedSteps) amended.issues.push({
              issue_id: `issue-${randomUUID()}`, code: 'QUALITY_CONTENT_CHANGED', severity: 'CLARIFICATION',
              message: '人工修改后的内容未由原模型审查覆盖，须逐步记录核对人和依据。',
              step_order: order, content_sha256: reviewedStepHash(amended.content, order), resolved_at: null,
            });
            current.quality.status = 'STALE';
          }
        }
        assertRevisionOnlyExpectation(current, amended);
        if (correction) {
          amended.issues = amended.issues.filter((issue) => issue.code !== 'QUALITY_CONTENT_CHANGED' ||
            issue.resolved_at || (amended.content.steps.some((step) => step.order === issue.step_order) &&
              issue.content_sha256 === reviewedStepHash(amended.content, issue.step_order)));
          const changed = contentChanges(current.revision_basis.base_content, amended.content);
          for (const order of changed) {
            const hash = reviewedStepHash(amended.content, order);
            const hasCurrentDecision = amended.issues.some((issue) => issue.code === 'QUALITY_CONTENT_CHANGED' &&
              issue.step_order === order && issue.content_sha256 === hash && issue.resolved_at &&
              amended.human_decisions.some((decision) => decision.issue_id === issue.issue_id &&
                decision.step_order === order && decision.created_at >= current.created_at &&
                amended.content.steps.some((step) => step.order === order &&
                  step.source_refs.some((ref) => ref.decision_id === decision.decision_id))));
            if (hasCurrentDecision || amended.issues.some((issue) => issue.code === 'QUALITY_CONTENT_CHANGED' &&
                issue.step_order === order && issue.content_sha256 === hash && !issue.resolved_at)) continue;
            amended.issues.push({ issue_id: `issue-${randomUUID()}`, code: 'QUALITY_CONTENT_CHANGED',
              severity: 'CLARIFICATION', message: '人工修订步骤或全局数据后，须逐步记录当前正文的核对人和依据。',
              step_order: order, content_sha256: hash, resolved_at: null });
          }
        } else if (amended.target_case && current.revision_basis) {
          for (const step of amended.content.steps) {
            const before = current.revision_basis.base_steps.find((entry) => entry.order === step.order);
            if (!before || before.expected === step.expected) continue;
            const hasCurrentDecision = amended.human_decisions.some((decision) =>
              decision.step_order === step.order && decision.created_at >= current.created_at &&
              step.source_refs.some((ref) => ref.decision_id === decision.decision_id));
            if (!hasCurrentDecision) amended.issues.push({
              issue_id: `issue-${randomUUID()}`, code: 'REVISION_EXPECTED_REVIEW_REQUIRED', severity: 'BLOCKING',
              message: '修订后的业务预期须由人工决定核对。', step_order: step.order, resolved_at: null,
            });
          }
        }
        if (coverageDecision) {
          amended.coverage_decision = {
            reviewer: required(coverageDecision.reviewer, 'REQUIREMENT_REVIEWER_REQUIRED', 120),
            adopted_scope: required(coverageDecision.adopted_scope, 'REQUIREMENT_COVERAGE_SCOPE_REQUIRED', 2000),
            note: optional(coverageDecision.note, 'REQUIREMENT_COVERAGE_NOTE_INVALID', 2000),
            at: new Date().toISOString(),
          };
        }
        current.candidates[type][index] = amended;
      }
      if (!found) throw new Error('REQUIREMENT_CANDIDATE_NOT_FOUND');
      current.status = 'PENDING_REVIEW';
      return current;
    });
    return this.getDesign(projectId, designId);
  }
  async reviewDesignIssue(projectId, designId, { revision, issueId, reviewer, decisionText, affectedCandidateIds, noneAffectedConfirmed = false } = {}) {
    this.#writable();
    const design = await this.getDesign(projectId, designId);
    if (design.revision !== revision) throw new Error('REQUIREMENT_REVISION_CONFLICT');
    if (['RUNNING', 'CONFIRMING'].includes(design.status)) throw new Error('REQUIREMENT_DESIGN_BUSY');
    const reviewedBy = required(reviewer, 'REQUIREMENT_REVIEWER_REQUIRED', 120);
    const rationale = required(decisionText, 'REQUIREMENT_SCOPE_DECISION_REQUIRED', 3000);
    if (!Array.isArray(affectedCandidateIds) || affectedCandidateIds.length > 100 ||
        affectedCandidateIds.some((id) => typeof id !== 'string') ||
        new Set(affectedCandidateIds).size !== affectedCandidateIds.length) throw new Error('REQUIREMENT_SCOPE_CANDIDATES_REQUIRED');
    if (!affectedCandidateIds.length && noneAffectedConfirmed !== true) throw new Error('REQUIREMENT_SCOPE_EMPTY_REQUIRES_CONFIRMATION');
    await this.store.updateDesign(projectId, designId, revision, (current) => {
      const issue = current.issues.find((entry) => entry.issue_id === issueId);
      if (!issue || issue.resolved_at || issue.severity === 'INFO') throw new Error('REQUIREMENT_GLOBAL_ISSUE_NOT_FOUND');
      const all = [...current.candidates.UI, ...current.candidates.BACKEND];
      if (affectedCandidateIds.some((id) => !all.some((candidate) => candidate.candidate_id === id))) {
        throw new Error('REQUIREMENT_CANDIDATE_NOT_FOUND');
      }
      const at = new Date().toISOString();
      issue.resolved_at = at;
      issue.scope_review = { reviewer: reviewedBy, decision_text: rationale, affected_candidate_ids: [...affectedCandidateIds], none_affected_confirmed: noneAffectedConfirmed === true, at };
      for (const candidate of all.filter((entry) => affectedCandidateIds.includes(entry.candidate_id))) {
        candidate.issues.push({
          issue_id: `issue-${randomUUID()}`, code: 'GLOBAL_BUSINESS_ISSUE', severity: 'BLOCKING',
          message: issue.message, global_issue_id: issue.issue_id, step_order: null, resolved_at: null,
        });
      }
      return current;
    });
    return this.getDesign(projectId, designId);
  }
  async confirmCandidates(projectId, designId, { revision, projectRevision, candidateIds } = {}) {
    this.#writable();
    if (typeof this.confirmCases !== 'function') throw new Error('REQUIREMENT_CONFIRM_SINK_UNAVAILABLE');
    const design = await this.getDesign(projectId, designId);
    const ids = requestedIds(candidateIds, 'REQUIREMENT_CONFIRM_SELECTION_INVALID', 100);
    const confirmationId = `confirmation-${sha256(`${projectId}:${designId}:${revision}:${ids.slice().sort().join(',')}`).slice(0, 32)}`;
    const previous = design.confirmations.find((item) => item.confirmation_id === confirmationId);
    if (previous) return { ...structuredClone(previous), idempotent: true };
    let pending = design.confirmation_pending;
    if (pending) {
      if (design.status !== 'CONFIRMING' || pending.confirmation_id !== confirmationId) throw new Error('REQUIREMENT_CONFIRM_IN_PROGRESS');
    } else {
      if (design.revision !== revision) throw new Error('REQUIREMENT_REVISION_CONFLICT');
      if (!['PENDING_REVIEW', 'PARTIALLY_CONFIRMED'].includes(design.status)) throw new Error('REQUIREMENT_CONFIRM_STATE_INVALID');
      if (design.quality?.mode === 'CHECKED' &&
          (design.generation?.status !== 'COMPLETED' || !design.quality.review_completed ||
            !design.quality.reviewed_snapshot_sha256 ||
            design.quality.reviewed_snapshot_sha256 !== design.quality.snapshots.at(-1)?.sha256)) {
        throw new Error('REQUIREMENT_QUALITY_REVIEW_REQUIRED');
      }
      if (design.issues.some((issue) => issue.severity !== 'INFO' && !issue.resolved_at)) {
        throw new Error('REQUIREMENT_GLOBAL_ISSUE_UNRESOLVED');
      }
      const project = await this.#project(projectId);
      if (!Number.isInteger(projectRevision) || project.revision !== projectRevision) throw new Error('REQUIREMENT_PROJECT_REVISION_CONFLICT');
      const sources = await this.#sources(projectId, design.source_refs);
      const all = [...design.candidates.UI, ...design.candidates.BACKEND];
      const selected = ids.map((id) => all.find((candidate) => candidate.candidate_id === id));
      if (selected.some((candidate) => !candidate)) throw new Error('REQUIREMENT_CANDIDATE_NOT_FOUND');
      for (const candidate of selected) {
        if (design.quality?.mode === 'CHECKED' && candidate.quality_review?.status === 'STALE') {
          const changes = candidate.issues.filter((entry) => entry.code === 'QUALITY_CONTENT_CHANGED');
          const orders = new Set(changes.map((entry) => entry.step_order));
          if (!orders.size || [...orders].some((order) => !changes.some((entry) =>
            entry.step_order === order && entry.content_sha256 === reviewedStepHash(candidate.content, order) &&
            entry.resolved_at && candidate.human_decisions.some((decision) =>
              decision.issue_id === entry.issue_id && decision.step_order === order &&
              candidate.content.steps.some((step) => step.order === order &&
                step.source_refs.some((ref) => ref.decision_id === decision.decision_id)))))) {
            throw new Error('REQUIREMENT_QUALITY_STALE_DECISION_REQUIRED');
          }
        }
        assertRevisionOnlyExpectation(design, candidate);
        confirmCandidate(candidate, design, sources);
        if (candidate.target_case) {
          const target = candidate.target_case;
          const item = project.cases.find((entry) => entry.case_id === target.case_id);
          const currentVersion = item?.versions.find((entry) => entry.version === target.case_version);
          if (item?.current_version !== target.case_version || currentVersion?.content_sha256 !== target.content_sha256) {
            throw new Error('BINDING_REVISION_TARGET_STALE');
          }
          if (!design.revision_basis || design.revision_basis.case_id !== target.case_id ||
              design.revision_basis.case_version !== target.case_version ||
              design.revision_basis.content_sha256 !== target.content_sha256) throw new Error('BINDING_REVISION_TARGET_INVALID');
          if (design.revision_basis.mode === 'CASE_DESIGN_CORRECTION') {
            const changed = contentChanges(design.revision_basis.base_content, candidate.content);
            if (!changed.length) throw new Error('CASE_DESIGN_REVISION_CONTENT_UNCHANGED');
            for (const step of candidate.content.steps) {
              if (!step.source_refs.some((ref) => !ref.decision_id && ref.quote_sha256 &&
                  resolveSourceRef(ref, design, sources, candidate.human_decisions))) {
                throw new Error('CASE_DESIGN_REVISION_SOURCE_REQUIRED');
              }
            }
            for (const order of changed) {
              const hash = reviewedStepHash(candidate.content, order);
              const issue = candidate.issues.find((entry) => entry.code === 'QUALITY_CONTENT_CHANGED' &&
                entry.step_order === order && entry.content_sha256 === hash && entry.resolved_at);
              const step = candidate.content.steps.find((entry) => entry.order === order);
              if (!issue || !step || !candidate.human_decisions.some((decision) =>
                  decision.issue_id === issue.issue_id && decision.step_order === order &&
                  decision.created_at >= design.created_at &&
                  step.source_refs.some((ref) => ref.decision_id === decision.decision_id))) {
                throw new Error('CASE_DESIGN_REVISION_DECISION_REQUIRED');
              }
            }
          } else {
            const changed = candidate.content.steps.filter((step) =>
              design.revision_basis.base_steps.find((old) => old.order === step.order)?.expected !== step.expected);
            if (!changed.length || candidate.content.steps.length !== design.revision_basis.base_steps.length) {
              throw new Error('BINDING_REVISION_EXPECTED_UNCHANGED');
            }
            for (const step of changed) {
              const decision = candidate.human_decisions.find((entry) => entry.step_order === step.order &&
                entry.created_at >= design.created_at && step.source_refs.some((ref) => ref.decision_id === entry.decision_id));
              if (!decision) throw new Error('BINDING_REVISION_DECISION_REQUIRED');
            }
          }
        }
      }
      const payload = selected.map((candidate) => ({
        candidate_id: candidate.candidate_id, case_type: candidate.case_type,
        target_case: candidate.target_case ? structuredClone(candidate.target_case) : null,
        content: { ...structuredClone(candidate.content), status: 'CONFIRMED', requirements_review: {
          design_revision: design.revision,
          human_decisions: structuredClone(candidate.human_decisions),
          coverage_decision: structuredClone(candidate.coverage_decision),
          candidate_issues: structuredClone(candidate.issues),
          global_issue_reviews: structuredClone(design.issues.filter((issue) => issue.scope_review)),
        } },
        source_refs: structuredClone(candidate.content.steps.flatMap((step) => step.source_refs)),
        root_source: candidateRootSource(design, candidate),
      }));
      pending = {
        confirmation_id: confirmationId, project_revision: projectRevision,
        design_revision: revision, candidate_ids: ids, candidates: payload,
      };
      await this.store.updateDesign(projectId, designId, revision, (current) => ({
        ...current, status: 'CONFIRMING', confirmation_pending: pending,
      }));
    }
    // The sink must deduplicate confirmationId. The persisted intent survives a crash after its project write.
    const result = await this.confirmCases({
      projectId, projectRevision: pending.project_revision, designId,
      designRevision: pending.design_revision, confirmationId, candidates: pending.candidates,
    });
    if (!Array.isArray(result?.cases) || result.cases.length !== ids.length ||
        ids.some((id) => !result.cases.some((item) => item.candidate_id === id && /^case-[a-z0-9-]{8,80}$/.test(item.case_id) && Number.isInteger(item.version)))) {
      throw new Error('REQUIREMENT_CONFIRM_SINK_INVALID_RESULT');
    }
    const receipt = { confirmation_id: confirmationId, project_id: projectId, design_id: designId, cases: structuredClone(result.cases), confirmed_at: new Date().toISOString() };
    const currentBeforeReceipt = await this.store.getDesign(projectId, designId);
    const updated = await this.store.updateDesign(projectId, designId, currentBeforeReceipt.revision, (current) => {
      if (current.confirmation_pending?.confirmation_id !== confirmationId) throw new Error('REQUIREMENT_CONFIRM_IN_PROGRESS');
      for (const type of ['UI', 'BACKEND']) for (const candidate of current.candidates[type]) {
        const actual = result.cases.find((item) => item.candidate_id === candidate.candidate_id);
        if (actual) { candidate.confirmation_status = 'CONFIRMED'; candidate.confirmed_case = { case_id: actual.case_id, version: actual.version }; }
      }
      current.confirmations.push(receipt);
      current.confirmation_pending = null;
      current.status = [...current.candidates.UI, ...current.candidates.BACKEND].every((candidate) => candidate.confirmation_status === 'CONFIRMED') ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED';
      return current;
    });
    return { ...receipt, revision: updated.revision, idempotent: false };
  }
  async createCaseRevision(projectId, { caseId, caseVersion, contentSha256, projectRevision, reason, requestId } = {}) {
    this.#writable();
    if (typeof caseId !== 'string' || !/^case-[a-z0-9-]{8,80}$/.test(caseId) ||
        !Number.isInteger(caseVersion) || caseVersion < 1 ||
        typeof contentSha256 !== 'string' || !contentSha256 ||
        !Number.isInteger(projectRevision) || projectRevision < 1 ||
        typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(requestId)) {
      throw new Error('CASE_DESIGN_REVISION_INPUT_INVALID');
    }
    const rationale = required(reason, 'CASE_DESIGN_REVISION_REASON_REQUIRED', 2000);
    const requestSha = sha256(JSON.stringify({ caseId, caseVersion, contentSha256, projectRevision, reason: rationale, requestId }));
    const designId = caseRevisionDesignId(projectId, requestId);
    const existing = await this.store.getDesign(projectId, designId);
    if (existing) {
      if (existing.revision_basis?.mode !== 'CASE_DESIGN_CORRECTION' ||
          existing.revision_basis?.request_sha256 !== requestSha) throw new Error('CASE_DESIGN_REVISION_REQUEST_CONFLICT');
      return { ...await this.getDesign(projectId, designId), idempotent: true };
    }
    const project = await this.#project(projectId);
    if (project.revision !== projectRevision) throw new Error('REQUIREMENT_PROJECT_REVISION_CONFLICT');
    const item = project.cases.find((entry) => entry.case_id === caseId);
    const version = item?.versions.find((entry) => entry.version === caseVersion);
    if (!version || item.current_version !== caseVersion || version.content_sha256 !== contentSha256 ||
        version.content?.status !== 'CONFIRMED') throw new Error('CASE_DESIGN_REVISION_TARGET_STALE');
    const origin = version.content.requirements_origin;
    const initialOrigin = item.versions.find((entry) => entry.version === 1)?.content?.requirements_origin;
    if (item.root_source?.type !== 'requirements-design' || item.root_source.project_id !== projectId ||
        item.root_source.stable_id !== `requirements:${initialOrigin?.design_id}:${initialOrigin?.candidate_id}` ||
        initialOrigin?.project_id !== projectId || origin?.project_id !== projectId ||
        typeof origin.design_id !== 'string' || typeof origin.candidate_id !== 'string' ||
        (caseVersion > 1 && !item.lineage?.some((entry) => entry.version === caseVersion &&
          entry.design_id === origin.design_id && entry.change === 'REQUIREMENTS_REVISION_CONFIRMED'))) {
      throw new Error('CASE_DESIGN_REVISION_SOURCE_UNVERIFIED');
    }
    const oldDesign = await this.store.getDesign(projectId, origin.design_id);
    const oldCandidate = [...(oldDesign?.candidates?.UI || []), ...(oldDesign?.candidates?.BACKEND || [])]
      .find((candidate) => candidate.candidate_id === origin.candidate_id);
    if (!oldDesign || oldDesign.project_id !== projectId || !oldCandidate ||
        oldCandidate.confirmation_status !== 'CONFIRMED' ||
        oldCandidate.confirmed_case?.case_id !== caseId || oldCandidate.confirmed_case?.version !== caseVersion ||
        oldCandidate.case_type !== version.content.case_type) throw new Error('CASE_DESIGN_REVISION_SOURCE_UNVERIFIED');
    const sources = await this.#sources(projectId, oldDesign.source_refs);
    if (!verifiedCaseSource(oldCandidate, version, oldDesign, sources)) throw new Error('CASE_DESIGN_REVISION_SOURCE_UNVERIFIED');
    const target = { case_id: caseId, case_version: caseVersion, content_sha256: contentSha256 };
    const now = new Date().toISOString();
    const design = {
      schema: 'workbench/requirement-design-revision-v1', design_id: designId,
      project_id: projectId, projectRevision, revision: 1, status: 'PENDING_REVIEW',
      source_refs: structuredClone(oldDesign.source_refs),
      scope: { mode: 'SELECTED', description: `已确认用例人工修订：${rationale}` },
      allow_model_text: false, allow_model_images: false,
      candidates: { UI: [], BACKEND: [] }, issues: [], model_requests: [], generation: null, confirmations: [],
      target_case: target,
      revision_basis: { mode: 'CASE_DESIGN_CORRECTION', request_id: requestId, request_sha256: requestSha,
        reason: rationale, source_design_id: oldDesign.design_id, source_candidate_id: oldCandidate.candidate_id,
        case_id: caseId, case_version: caseVersion, content_sha256: contentSha256,
        base_content: structuredClone(oldCandidate.content) },
      created_at: now, updated_at: now,
    };
    const candidate = normalizeCandidate({ content: structuredClone(version.content) }, oldCandidate.case_type, design, sources, {
      ...oldCandidate, candidate_id: `candidate-${randomUUID()}`, issues: [],
      confirmation_status: 'PENDING_CONFIRMATION', confirmed_case: null, target_case: target,
    });
    design.candidates[oldCandidate.case_type].push(candidate);
    const saved = await this.store.createCaseRevisionDesign(projectId, design);
    return { ...await this.getDesign(projectId, saved.design.design_id), idempotent: saved.idempotent };
  }
  async createBindingRevision(projectId, { caseId, bindingVersion } = {}) {
    this.#writable();
    const project = await this.#project(projectId);
    const item = project.cases.find((entry) => entry.case_id === caseId);
    if (!item || !Number.isInteger(bindingVersion) || bindingVersion < 1) throw new Error('BINDING_REVISION_INPUT_INVALID');
    const { bindings } = await this.store.getBindings(projectId, caseId);
    const binding = bindings.find((entry) => entry.version === bindingVersion);
    if (!binding || binding.status !== 'CONFLICT') throw new Error('BINDING_REVISION_CONFLICT_REQUIRED');
    const version = item.versions.find((entry) => entry.version === binding.case_version);
    if (!version || version.content_sha256 !== binding.case_content_sha256) {
      throw new Error('BINDING_REVISION_TARGET_STALE');
    }
    if (version.content?.status !== 'CONFIRMED') throw new Error('BINDING_CASE_NOT_CONFIRMED');
    const designId = bindingRevisionDesignId(projectId, caseId, binding.binding_id, bindingVersion);
    const existing = await this.store.getDesign(projectId, designId);
    if (existing) return this.getDesign(projectId, designId);
    if (item.current_version !== version.version) throw new Error('BINDING_REVISION_TARGET_STALE');
    const origin = version.content?.requirements_origin;
    if (item.root_source?.type !== 'requirements-design' || origin?.project_id !== projectId ||
        typeof origin.design_id !== 'string' || typeof origin.candidate_id !== 'string') {
      throw new Error('BINDING_REVISION_REQUIREMENTS_SOURCE_REQUIRED');
    }
    const oldDesign = await this.store.getDesign(projectId, origin.design_id);
    const oldCandidate = [...(oldDesign?.candidates?.UI || []), ...(oldDesign?.candidates?.BACKEND || [])]
      .find((candidate) => candidate.candidate_id === origin.candidate_id);
    if (!oldCandidate || oldCandidate.case_type !== 'BACKEND' ||
        oldCandidate.confirmed_case?.case_id !== caseId || oldCandidate.confirmed_case?.version !== version.version ||
        REVISION_FROZEN_FIELDS.some((field) => oldCandidate.content[field] !== version.content[field]) ||
        oldCandidate.content.steps.length !== version.content.steps.length ||
        oldCandidate.content.steps.some((step, index) => step.action !== version.content.steps[index]?.action ||
          step.expected !== version.content.steps[index]?.expected)) {
      throw new Error('BINDING_REVISION_SOURCE_UNVERIFIED');
    }
    const oldSources = await this.#sources(projectId, oldDesign.source_refs);
    const protocol = await this.store.getSource(projectId, binding.protocol_source_id);
    if (!protocol || protocol.kind !== 'PROTOCOL' || protocol.sha256 !== binding.protocol_sha256) {
      throw new Error('BINDING_PROTOCOL_VERSION_MISMATCH');
    }
    const sourceRefs = [...oldDesign.source_refs];
    if (!sourceRefs.some((ref) => ref.snapshot_id === protocol.snapshot_id)) {
      sourceRefs.push({ snapshot_id: protocol.snapshot_id, sha256: protocol.sha256, kind: protocol.kind, read_status: protocol.read_status });
    }
    const target = { case_id: caseId, case_version: version.version, content_sha256: version.content_sha256 };
    const now = new Date().toISOString();
    const design = {
      schema: 'workbench/requirement-design-revision-v1',
      design_id: designId, project_id: projectId, projectRevision: project.revision,
      revision: 1, status: 'PENDING_REVIEW', source_refs: sourceRefs,
      scope: { mode: 'SELECTED', description: `协议绑定 ${binding.binding_id} v${bindingVersion} 的业务冲突修订` },
      allow_model_text: false, allow_model_images: false,
      candidates: { UI: [], BACKEND: [] }, issues: [], model_requests: [], generation: null, confirmations: [],
      target_case: target,
      revision_basis: {
        binding_id: binding.binding_id, binding_version: bindingVersion,
        source_design_id: oldDesign.design_id, source_candidate_id: oldCandidate.candidate_id,
        case_id: caseId, case_version: version.version, content_sha256: version.content_sha256,
        base_inputs: Object.fromEntries(REVISION_FROZEN_FIELDS.map((field) => [field, version.content[field]])),
        base_steps: version.content.steps.map((step) => ({ order: step.order, action: step.action, expected: step.expected })),
      },
      created_at: now, updated_at: now,
    };
    const content = structuredClone(version.content);
    for (const step of content.steps) {
      const refs = binding.mappings.filter((mapping) => mapping.step_order === step.order).flatMap((mapping) => mapping.source_refs);
      const unique = new Map([...(step.source_refs || []), ...refs].map((ref) =>
        [ref.decision_id || `${ref.snapshot_id}:${ref.segment_id}:${ref.quote_sha256}`, ref]));
      step.source_refs = [...unique.values()];
    }
    const candidate = normalizeCandidate({ content }, 'BACKEND', design, [...oldSources, protocol], {
      ...oldCandidate, candidate_id: `candidate-${randomUUID()}`, confirmation_status: 'PENDING_CONFIRMATION',
      confirmed_case: null, target_case: target, coverage_decision: null,
    });
    const conflicts = binding.issues.filter((issue) => issue.code === 'BINDING_BUSINESS_CONFLICT' && Number.isInteger(issue.step_order));
    for (const conflict of conflicts.length ? conflicts : [{ message: binding.conflict_note || '协议绑定与已有业务预期存在冲突。', step_order: null }]) {
      candidate.issues.push({ issue_id: `issue-${randomUUID()}`, code: 'BUSINESS_CONFLICT', severity: 'BLOCKING',
        message: String(conflict.message || binding.conflict_note || '协议绑定与已有业务预期存在冲突；须人工修订预期。').slice(0, 1000),
        step_order: conflict.step_order ?? null, resolved_at: null, binding_id: binding.binding_id, binding_version: bindingVersion });
    }
    design.candidates.BACKEND.push(candidate);
    await this.store.createBindingRevisionDesign(projectId, design, binding.binding_id, bindingVersion);
    return this.getDesign(projectId, designId);
  }
  async createBinding(projectId, { caseId, caseVersion, caseContentSha256, protocolSourceId, mappings = [], expectedRevision = 0, confirmation = 'DRAFT', reviewer = '', proposedCaseRevision = null, conflictNote = '' } = {}) {
    this.#writable();
    const project = await this.#project(projectId);
    const caseItem = project.cases.find((item) => item.case_id === caseId);
    const version = caseItem?.versions.find((entry) => entry.version === caseVersion);
    if (!version || version.content_sha256 !== caseContentSha256) throw new Error('BINDING_CASE_VERSION_MISMATCH');
    if (version.content.case_type !== 'BACKEND') throw new Error('BINDING_CASE_TYPE_INVALID');
    if (version.content.status !== 'CONFIRMED') throw new Error('BINDING_CASE_NOT_CONFIRMED');
    const protocol = await this.store.getSource(projectId, protocolSourceId);
    if (!protocol || protocol.kind !== 'PROTOCOL') throw new Error('BINDING_PROTOCOL_REQUIRED');
    if (!Array.isArray(mappings) || mappings.length > 100 || !['DRAFT', 'CONFIRM'].includes(confirmation)) throw new Error('BINDING_INPUT_INVALID');
    const steps = version.content.steps;
    const issues = [];
    const normalized = [];
    const seen = new Set();
    for (const raw of mappings) {
      const order = raw?.step_order ?? raw?.order;
      if (!Number.isInteger(order) || !steps.some((step) => step.order === order) || seen.has(order)) throw new Error('BINDING_STEP_INVALID');
      seen.add(order);
      const state = ['MAPPED', 'UNMAPPED', 'CONFLICT'].includes(raw.status) ? raw.status :
        raw.conflict_note ? 'CONFLICT' : raw.command && raw.business_observation ? 'MAPPED' : 'UNMAPPED';
      const sourceRefs = [];
      for (const ref of Array.isArray(raw.source_refs) ? raw.source_refs : []) {
        const verified = resolveSourceRef(ref, { project_id: projectId, source_refs: [{ snapshot_id: protocolSourceId }] }, [protocol]);
        if (!verified || verified.snapshot_id !== protocolSourceId) throw new Error('BINDING_SOURCE_REF_INVALID');
        sourceRefs.push(verified);
      }
      const mapping = {
        step_order: order, status: state,
        request: optional(raw.request ?? raw.command, 'BINDING_REQUEST_INVALID', 3000),
        request_fields: raw.request_fields == null ? null : structuredClone(raw.request_fields),
        response: optional(raw.response, 'BINDING_RESPONSE_INVALID', 3000),
        response_fields: raw.response_fields == null ? null : structuredClone(raw.response_fields),
        unit: optional(raw.unit ?? (typeof raw.units === 'string' ? raw.units : ''), 'BINDING_UNIT_INVALID', 120),
        units: raw.units == null ? null : structuredClone(raw.units),
        observation: optional(raw.observation ?? raw.business_observation, 'BINDING_OBSERVATION_INVALID', 3000),
        cleanup: optional(raw.cleanup, 'BINDING_CLEANUP_INVALID', 3000),
        source_refs: sourceRefs,
      };
      if (state === 'MAPPED' && (!sourceRefs.length || !mapping.request || !mapping.observation)) issues.push({ code: 'BINDING_MAPPING_INCOMPLETE', step_order: order });
      if (state === 'CONFLICT') issues.push({ code: 'BINDING_BUSINESS_CONFLICT', step_order: order });
      normalized.push(mapping);
    }
    for (const step of steps) if (!seen.has(step.order)) issues.push({ code: 'BINDING_STEP_UNMAPPED', step_order: step.order });
    const hasConflict = issues.some((entry) => entry.code === 'BINDING_BUSINESS_CONFLICT') || Boolean(proposedCaseRevision) || Boolean(conflictNote);
    if (conflictNote) issues.push({ code: 'BINDING_BUSINESS_CONFLICT', message: required(conflictNote, 'BINDING_CONFLICT_NOTE_INVALID', 3000) });
    const previous = await this.store.getBindings(projectId, caseId);
    const unresolvedConflict = previous.bindings.some((entry) => entry.status === 'CONFLICT'
      && entry.case_version === caseVersion && entry.case_content_sha256 === caseContentSha256
      && entry.protocol_source_id === protocolSourceId && entry.protocol_sha256 === protocol.sha256);
    if (unresolvedConflict && !hasConflict) throw new Error('BINDING_CONFLICT_UNRESOLVED');
    const status = hasConflict ? 'CONFLICT' : issues.length || normalized.some((entry) => entry.status !== 'MAPPED') ? 'PARTIAL' : 'COMPLETE';
    if (confirmation === 'CONFIRM' && (status !== 'COMPLETE' || !required(reviewer, 'BINDING_REVIEWER_REQUIRED', 120))) throw new Error('BINDING_CONFIRM_BLOCKED');
    const binding = {
      schema: 'workbench/requirement-binding-v1',
      binding_id: previous.bindings.at(-1)?.binding_id || newBindingId(),
      project_id: projectId, case_id: caseId, case_version: caseVersion, case_content_sha256: caseContentSha256,
      protocol_source_id: protocolSourceId, protocol_sha256: protocol.sha256,
      mappings: normalized, issues, status, confirmation_status: confirmation === 'CONFIRM' ? 'CONFIRMED' : 'DRAFT',
      reviewer: confirmation === 'CONFIRM' ? reviewer.trim() : null,
      conflict_note: conflictNote || null,
      proposed_case_revision: proposedCaseRevision ? structuredClone(proposedCaseRevision) : null,
      created_at: new Date().toISOString(),
    };
    return this.store.saveBinding(projectId, caseId, binding, expectedRevision);
  }
  async getBindings(projectId, caseId) {
    const project = await this.#project(projectId);
    const item = project.cases.find((entry) => entry.case_id === caseId);
    if (!item) throw new Error('BINDING_CASE_NOT_FOUND');
    const { bindings } = await this.store.getBindings(projectId, caseId);
    return { bindings: bindings.map((binding) => ({
      ...binding,
      applicability: item.current_version === binding.case_version &&
        item.versions.find((version) => version.version === item.current_version)?.content_sha256 === binding.case_content_sha256
        ? 'CURRENT_CASE_VERSION' : 'STALE_CASE_VERSION',
      execution_ready: false,
      execution_readiness_reason: 'RUNNER_ENVIRONMENT_DATA_SCRIPT_NOT_CHECKED',
    })) };
  }
}

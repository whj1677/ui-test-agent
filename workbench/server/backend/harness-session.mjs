import { backendDigest, validateBackendExecution } from './schema.mjs';
import { buildFailureFeedback } from '../failure-feedback.mjs';
import { CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS } from '../quality-review.mjs';
import { BACKEND_VALIDATION_GUIDANCE } from './harness-contract.mjs';

export const BACKEND_HARNESS_LIMITS = Object.freeze({ wall_ms: 15 * 60_000, tool_calls: 80, harness_starts: 1, self_tests: 5, quality_reviews: 3, independent_validations: 2 });
const clone = value => structuredClone(value);
const fail = code => { throw new Error(code); };
const safeError = error => /^[A-Z][A-Z0-9_]{4,100}$/.test(error?.message || '') ? error.message : 'BACKEND_HARNESS_OPERATION_FAILED';
const now = () => new Date().toISOString();
const toolNames = new Set(['read_context','write_draft','self_test','read_evidence','review_candidate','submit_candidate']);
const diagnosticCodes = new Set(['BACKEND_HARNESS_ARGUMENTS_INVALID','BACKEND_HARNESS_TOOL_DENIED',
  'BACKEND_CANDIDATE_COVERAGE_REQUIRED','BACKEND_CANDIDATE_COVERAGE_INVALID','BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST',
  'BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED','BACKEND_SELF_TEST_NOT_READY','BACKEND_SELF_TEST_NOT_SUBMITTABLE',
  'BACKEND_HARNESS_TOOL_BUDGET_EXHAUSTED','BACKEND_HARNESS_WALL_BUDGET_EXHAUSTED','BACKEND_HARNESS_CANCELLED',
  'BACKEND_HARNESS_SESSION_CLOSED','BACKEND_PLAN_IDENTITY_CHANGED','BACKEND_HARNESS_CANDIDATE_FROZEN',
  'BACKEND_EXECUTION_INVALID','BACKEND_STEP_INVALID','BACKEND_REQUEST_INVALID','BACKEND_ASSERTION_INVALID',
  'BACKEND_ASSERTIONS_REQUIRED','BACKEND_REFERENCE_INVALID','BACKEND_JSON_POINTER_INVALID','BACKEND_JSON_KEY_INVALID',
  'BACKEND_JSON_VALUE_INVALID','BACKEND_PATH_INVALID','BACKEND_TIMEOUT_INVALID','BACKEND_CLEANUP_REQUIRED',
  'BACKEND_NAMESPACE_REQUIRED','BACKEND_HEADERS_INVALID','BACKEND_PATH_OUTSIDE_ENVIRONMENT',
  'BACKEND_METHOD_OUTSIDE_ENVIRONMENT', ...Object.keys(BACKEND_VALIDATION_GUIDANCE)]);
const businessFailure = result => result?.status === 'FAILED' && result.technical_error == null && result.cleanup_error == null &&
  !(result.setup || []).some(item => item.status !== 'PASSED') && !(result.cleanup || []).some(item => item.status !== 'PASSED') &&
  (result.steps || []).some(step => step.requests?.some(request => request.assertions?.some(assertion => assertion.status === 'FAILED')));
const resultStatus = (result, signal) => signal?.reason === 'wall_timeout' || signal?.reason === 'timeout' ? 'TIMED_OUT'
  : signal?.aborted || result?.status === 'CANCELLED' ? 'CANCELLED'
  : result?.status === 'TIMED_OUT' ? 'TIMED_OUT'
  : result?.status === 'PASSED' && result.complete_pass ? 'PASSED'
  : businessFailure(result) ? 'FAILED' : 'ERROR';
function boundedValidationEvidence(result) {
  const clip = value => typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  const records = (result?.steps || []).flatMap(step => (step.requests || []).map(request => ({ order: step.order,
    request_id: request.request_id, status: request.status,
    assertions: (request.assertions || []).filter(item => item.status !== 'PASSED').map(item => ({
      target: item.target, pointer: item.pointer, op: item.op, field: item.field,
      expected: clip(JSON.stringify(item.expected)), actual: clip(JSON.stringify(item.actual)), status: item.status })) })));
  let truncated = false;
  while (Buffer.byteLength(JSON.stringify(records)) > 20_000 && records.length) { records.pop(); truncated = true; }
  return { status: result?.status || 'UNKNOWN', technical_error: result?.technical_error?.code || null,
    cleanup_error: result?.cleanup_error?.code || null, requests: records, truncated };
}

export class BackendHarnessSession {
  constructor({ plan, context, environment, execute, assertCurrent, persist, signal, qualityReviewer, revisionSourceExecution = null, limits = BACKEND_HARNESS_LIMITS, clock = Date.now, reviewTimeout = AbortSignal.timeout }) {
    limits = { ...BACKEND_HARNESS_LIMITS, ...limits };
    Object.assign(this, { plan, context, environment, execute, assertCurrent, persist, signal, qualityReviewer, revisionSourceExecution, limits, clock, reviewTimeout });
    this.queue = Promise.resolve();
    this.state = Object.assign({
      status: 'RUNNING', started_at: now(), finished_at: null, deadline_ms: clock() + limits.wall_ms,
      limits: clone(limits), tool_calls_used: 0, harness_starts: 0, reviewer_harness_starts: 0, reviewer_tool_calls_used: 0, provider_requests: null, provider_usage: null,
      self_tests: [], quality_reviews: [], independent_validations: [], quality_policy: 'required-v1', candidate: null, error: null,
    }, plan.generation_session || {});
    this.state.limits = { ...limits, ...(this.state.limits || {}) }; this.state.deadline_ms ||= clock() + limits.wall_ms;
    this.state.self_tests ||= []; this.state.tool_calls_used ??= 0; this.state.harness_starts ??= 0;
    this.state.reviewer_harness_starts ??= 0; this.state.reviewer_tool_calls_used ??= 0;
    this.state.quality_reviews ||= []; this.state.independent_validations ||= [];
    this.state.quality_policy = 'required-v1';
    this.state.quality_review_mode ||= this.plan.quality_review_mode ?? 'static-v1';
    if (!['static-v1', 'dsh-tools-v1'].includes(this.state.quality_review_mode) || this.state.quality_review_mode !== (this.plan.quality_review_mode ?? 'static-v1')) fail('QUALITY_REVIEW_MODE_INVALID');
    this.state.provider_requests ??= null; this.state.provider_usage ??= null; this.state.candidate ??= null;
    this.state.tool_diagnostics ||= { calls:0, errors:0, recent:[] };
  }
  async initialize() { await this.save(); }
  async save() { this.state.progress = this.progress(); this.plan.generation_session = clone(this.state); await this.persist(clone(this.plan)); }
  getState() { return { ...clone(this.state), progress:this.progress() }; }
  progress() {
    const sha = this.currentSha(), last = this.state.self_tests.at(-1);
    const review = sha && last ? this.currentReview(sha,last) : null;
    const pendingReview = this.state.quality_reviews.at(-1)?.status === 'RUNNING';
    const pendingValidation = this.state.independent_validations.at(-1)?.status === 'RUNNING';
    const phase = this.state.candidate ? 'FROZEN_FOR_HUMAN_REVIEW'
      : this.state.status !== 'RUNNING' ? 'STOPPED'
      : !sha ? 'WRITE_DRAFT' : pendingReview ? 'QUALITY_REVIEW' : pendingValidation ? 'INDEPENDENT_VALIDATION'
      : !last || last.execution_sha256 !== sha || !last.finished_at ? 'SELF_TEST'
      : review?.status === 'REPAIR_REQUIRED' ? 'REPAIR_DRAFT'
      : review && review.status !== 'NO_FINDINGS' ? 'NEEDS_ANALYSIS'
      : ['PASSED','FAILED'].includes(last.status) ? 'SUBMIT_CURRENT_DRAFT' : 'INSPECT_SELF_TEST';
    return { phase, candidate_sha256:sha, self_test_number:last?.number || null,
      self_test_status:last?.status || null, review_number:review?.number || null,
      seconds_remaining:Math.max(0,Math.floor((this.state.deadline_ms-this.clock())/1000)) };
  }
  submissionContract() {
    return { execution_sha256:this.currentSha(),
      coverage:this.context.caseVersion.content.steps.map((step,index)=>({ order:step.order,
        requirement:step.expected, request_ids:this.plan.execution?.steps[index]?.requests.map(r=>r.id) || [], uncovered:null })),
      instruction:'Copy requirement VERBATIM from this contract. Decide coverage honestly: set uncovered to an empty string only when every original obligation is implemented; otherwise describe the gap. Choose outcome from actual self-test evidence. submit_candidate runs any required current-version review and independent validation; no human approval is granted.' };
  }
  recordTool(name,result,error) {
    const diagnostic = this.state.tool_diagnostics;
    diagnostic.calls += 1;
    if (error) diagnostic.errors += 1;
    const status = ['PASSED','FAILED','REPAIR_REQUIRED','NO_FINDINGS','NEEDS_ANALYSIS','FROZEN_FOR_HUMAN_REVIEW',
      'INDEPENDENT_VALIDATION_FAILED'].includes(result?.status) ? result.status : error ? 'ERROR' : 'OK';
    diagnostic.recent.push({ number:diagnostic.calls, tool:toolNames.has(name)?name:'unknown', status,
      error_code:error ? diagnosticCodes.has(error.message)?error.message:'OTHER_TOOL_FAILURE' : null,
      phase:this.progress().phase, at:now() });
    diagnostic.recent = diagnostic.recent.slice(-80);
  }
  invoke(name, args = {}) {
    const operation = this.queue.then(async () => {
      try { const result = await this.call(name,args); this.recordTool(name,result); await this.save();
        return { ...result, progress:this.progress() }; }
      catch(error) { this.recordTool(name,null,error); await this.save(); throw error; }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  transportFailure(name,code) {
    const operation = this.queue.then(async()=>{
      this.ensureOpen(); this.state.tool_calls_used += 1;
      this.recordTool(name,null,new Error(code)); await this.save();
    });
    this.queue = operation.catch(()=>{}); return operation;
  }
  ensureOpen() {
    if (this.signal?.aborted) fail('BACKEND_HARNESS_CANCELLED');
    if (this.state.status !== 'RUNNING') fail('BACKEND_HARNESS_SESSION_CLOSED');
    if (this.clock() >= this.state.deadline_ms) fail('BACKEND_HARNESS_WALL_BUDGET_EXHAUSTED');
    if (this.state.tool_calls_used >= this.limits.tool_calls) fail('BACKEND_HARNESS_TOOL_BUDGET_EXHAUSTED');
    if (this.state.candidate) fail('BACKEND_HARNESS_CANDIDATE_FROZEN');
  }
  async call(name, args) {
    this.ensureOpen(); this.state.tool_calls_used += 1; await this.save();
    if (name === 'read_context') return this.readContext();
    if (name === 'write_draft') return this.writeDraft(args);
    if (name === 'self_test') return this.selfTest();
    if (name === 'read_evidence') return this.readEvidence(args);
    if (name === 'review_candidate') return this.reviewCandidate();
    if (name === 'submit_candidate') return this.submitCandidate(args);
    fail('BACKEND_HARNESS_TOOL_DENIED');
  }
  currentSha() { return this.plan.execution ? backendDigest(this.plan.execution) : null; }
  readContext() {
    if (this.plan.revision_evidence && backendDigest(this.plan.revision_evidence) !== this.plan.revision_evidence_sha256) fail('BACKEND_REVISION_EVIDENCE_CHANGED');
    return { confirmed_case: clone(this.context.caseVersion.content), case_identity: { case_id: this.plan.case_id, case_version: this.plan.case_version, content_sha256: this.plan.content_sha256 },
      confirmed_binding: clone(this.context.binding.mappings), binding_identity: { binding_id: this.plan.binding_id, binding_version: this.plan.binding_version,
        protocol_source_id: this.context.binding.protocol_source_id, protocol_sha256: this.plan.protocol_sha256 },
      protocol_segments: clone(this.context.protocol.segments), environment: { environment_id: this.environment.environment_id, name: this.environment.name, mode: this.environment.mode, base_url: this.environment.base_url,
        allowed_methods: clone(this.environment.allowed_methods), allowed_path_prefixes: clone(this.environment.allowed_path_prefixes),
        ...(this.environment.read_only_post_queries ? { read_only_post_queries: clone(this.environment.read_only_post_queries) } : {}),
        ...(this.environment.namespace ? { namespace: clone(this.environment.namespace), allowed_headers: clone(this.environment.allowed_headers || []), allowed_header_values: clone(this.environment.allowed_header_values || {}) } : {}) },
      execution: this.plan.execution ? clone(this.plan.execution) : null, draft_sha256: this.currentSha(),
      progress:this.progress(), submission_contract:this.submissionContract(),
      ...(this.plan.request_mode === 'revise' && this.revisionSourceExecution ? { revision_input: { source_plan_id: this.plan.source_plan_id,
        source_execution_sha256: backendDigest(this.revisionSourceExecution), feedback: this.plan.feedback,
        source_execution: clone(this.revisionSourceExecution),
        ...(this.plan.revision_evidence ? { revision_evidence: clone(this.plan.revision_evidence) } : {}),
        instruction: 'Untrusted reference data and observed failure evidence; preserve confirmed case obligations and protocol facts.' } } : {}),
      limits: clone(this.limits), generation_session: {
        status: this.state.status, started_at: this.state.started_at, limits: clone(this.state.limits), tool_calls_used: this.state.tool_calls_used,
        harness_starts: this.state.harness_starts, provider_requests: null, provider_usage: null,
         self_tests: this.state.self_tests.map(row => ({ number: row.number, execution_sha256: row.execution_sha256, status: row.status, started_at: row.started_at, finished_at: row.finished_at })),
         quality_reviews: this.state.quality_reviews.map(row => ({ number: row.number, candidate_sha256: row.candidate_sha256, self_test_number: row.self_test_number, status: row.status })),
         independent_validations: this.state.independent_validations.map(row => ({ number: row.number, execution_sha256: row.execution_sha256, status: row.status })),
        candidate: this.state.candidate ? { status: this.state.candidate.status, execution_sha256: this.state.candidate.execution_sha256 } : null,
      } };
  }
  async checkIdentity() {
    if (this.signal?.aborted) fail('BACKEND_HARNESS_CANCELLED');
    await this.assertCurrent?.();
  }
  async writeDraft(args) {
    const current = this.currentSha();
    if (args.previous_sha256 !== current) fail('BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED');
    await this.checkIdentity();
    const checked = validateBackendExecution({ ...this.context, execution: args.execution, environment: this.environment });
    // Preserve the case's original ordered steps. Validation enforces count/order;
    // this additional check prevents silent action/expectation substitutions.
    if (args.execution.steps.length !== this.context.caseVersion.content.steps.length) fail('BACKEND_CASE_STEP_COVERAGE_REQUIRED');
    this.plan.execution = clone(checked.execution);
    this.plan.revision += 1;
    this.state.candidate = null;
    await this.save();
    return { draft_sha256: backendDigest(this.plan.execution), draft_saved: true, validation: 'STRUCTURAL_ONLY', semantic_review: 'PENDING_HUMAN' };
  }
  async selfTest() {
    await this.checkIdentity();
    if (!this.plan.execution) fail('BACKEND_EXECUTION_MISSING');
    if (this.state.self_tests.length >= this.limits.self_tests) fail('BACKEND_HARNESS_SELF_TEST_BUDGET_EXHAUSTED');
    const execution = clone(this.plan.execution), sha = backendDigest(execution), number = this.state.self_tests.length + 1;
    const feedbackIdentity = { project_id: this.plan.project_id, case_id: this.plan.case_id, executed_case_id: this.plan.case_id,
      case_version: this.plan.case_version, executed_case_version: this.plan.case_version,
      source_build_task_id: this.plan.plan_id, candidate_version: this.plan.version,
      bundle_sha256: sha, execution_sha256: sha, environment_id: this.plan.environment_id };
    const row = { number, execution_sha256: sha, status: 'RUNNING', started_at: now(), finished_at: null, result: null };
    this.state.self_tests.push(row); await this.save();
    try {
      await this.checkIdentity();
      const result = await this.execute({ ...this.context, execution, environment: this.environment, signal: this.signal });
      row.result = clone(result);
      row.status = resultStatus(result, this.signal);
      row.failure_feedback = buildFailureFeedback({ record: { ...result, ...feedbackIdentity }, caseContent: this.context.caseVersion.content });
    } catch (error) {
      row.status = this.signal?.reason === 'wall_timeout' || this.signal?.reason === 'timeout' ? 'TIMED_OUT' : this.signal?.aborted ? 'CANCELLED' : 'ERROR';
      row.error = safeError(error);
      row.failure_feedback = buildFailureFeedback({ record: { ...feedbackIdentity, status: row.status, technical_error: { code: row.error } }, caseContent: this.context.caseVersion.content });
    }
    row.finished_at = now(); await this.save();
    return clone(row);
  }
  async readEvidence(args) {
    const row = this.state.self_tests[args.number - 1];
    if (!row) fail('BACKEND_SELF_TEST_NOT_FOUND');
    const result = row.result;
    if (!result) return { number: row.number, execution_sha256: row.execution_sha256, status: row.status, error: row.error || null, failure_feedback: clone(row.failure_feedback || null) };
    const compactRecord = record => ({ request_id: record.request_id, phase: record.phase, status: record.status,
      ...(record.request?.kind === 'response-reference' ? { kind: 'response-reference', source_request_id: record.request.source_request_id } : {}),
      response_status: record.response?.status ?? null,
      assertions: (record.assertions || []).map(item => ({ target: item.target, pointer: item.pointer, op: item.op, ...(item.field ? { field: item.field } : {}), status: item.status,
        expected: item.expected, actual: item.actual, actual_exists: item.actual_exists })), error_code: record.error?.code || null });
    let records = [...(result.setup || []), ...(result.steps || []).flatMap(step => step.requests || []), ...(result.cleanup || [])].map(compactRecord);
    let encoded = JSON.stringify(records), truncated = false;
    while (Buffer.byteLength(encoded) > 24000 && records.length) { records.pop(); encoded = JSON.stringify(records); truncated = true; }
    return { number: row.number, execution_sha256: row.execution_sha256, status: row.status, result_status: result.status,
      complete_pass: result.complete_pass === true, request_count: result.requests_sent, evidence: records, truncated,
      failure_feedback: clone(row.failure_feedback || null), progress:this.progress(), submission_contract:this.submissionContract() };
  }
  reviewKey(sha, last) {
    return backendDigest({ case_sha256: this.plan.content_sha256, candidate_sha256: sha,
      self_test_number: last.number, evidence_sha256: backendDigest(last.result || { status: last.status, error: last.error || null }),
      context_sha256: backendDigest({ binding: this.context.binding.mappings, protocol: this.context.protocol.segments }) });
  }
  currentReview(sha, last) {
    const key = this.reviewKey(sha, last);
    return this.state.quality_reviews.find(row => row.review_key === key && row.status !== 'RUNNING') || null;
  }
  reviewFeedback(row) {
    return { status: row.status, frozen: false, candidate_sha256: row.candidate_sha256,
      self_test_number: row.self_test_number, findings: clone(row.findings || []), steps: clone(row.steps || []), error_code: row.error_code || null,
      review_number: row.number, quality_reviews_used: this.state.quality_reviews.length,
      quality_reviews_limit: this.limits.quality_reviews,
      next_steps: row.status === 'NO_FINDINGS' ? 'Call submit_candidate on the same tested draft; independent validation and human review are still required.'
        : row.status === 'REPAIR_REQUIRED' ? 'Revise the current draft without changing confirmed expectations, then self_test and review_candidate again; if repair is impossible, preserve the gaps as NEEDS_ANALYSIS.'
        : 'Preserve the draft and evidence; investigate the uncertain review or submit NEEDS_ANALYSIS.' };
  }
  async reviewCandidate() {
    await this.checkIdentity();
    const sha = this.currentSha(), last = this.state.self_tests.at(-1);
    if (!sha || last?.execution_sha256 !== sha || !last.finished_at) fail('BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST');
    const cached = this.currentReview(sha, last);
    if (cached) return { ...this.reviewFeedback(cached), cached: true };
    if (this.state.quality_reviews.length >= this.limits.quality_reviews) return {
      status: 'NEEDS_ANALYSIS', frozen: false, error_code: 'BACKEND_QUALITY_REVIEW_BUDGET_EXHAUSTED',
      quality_reviews_used: this.state.quality_reviews.length, quality_reviews_limit: this.limits.quality_reviews,
      next_steps: 'Preserve the current draft and submit NEEDS_ANALYSIS with uncovered obligations.' };
    const mode = this.plan.quality_review_mode ?? 'static-v1';
    if (!['static-v1', 'dsh-tools-v1'].includes(mode)) fail('QUALITY_REVIEW_MODE_INVALID');
    const row = { number: this.state.quality_reviews.length + 1, review_key: this.reviewKey(sha, last), mode,
      candidate_sha256: sha, self_test_number: last.number, status: 'RUNNING', started_at: now(), finished_at: null,
      input_sha256: null, findings: [], model: null, usage: null, model_calls: null, error_code: null, reviewer_harness_starts: 0, reviewer_tool_calls_used: 0 };
    this.state.quality_reviews.push(row); await this.save();
    let timeout;
    try {
      if (typeof this.qualityReviewer !== 'function') fail('BACKEND_QUALITY_REVIEW_UNAVAILABLE');
      timeout = this.reviewTimeout(Math.min(CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS, Math.max(1, this.state.deadline_ms - this.clock())));
      const signal = this.signal ? AbortSignal.any([this.signal, timeout]) : timeout;
      const review = await this.qualityReviewer({ kind: 'backend', frozenCase: clone(this.context.caseVersion.content),
        caseSha256: this.plan.content_sha256, candidateSha256: sha, execution: clone(this.plan.execution),
        context: { confirmed_binding: clone(this.context.binding.mappings), protocol_segments: clone(this.context.protocol.segments) },
        evidence: clone(last.result || { status: last.status, error: last.error || null }), signal,
        ...(mode === 'dsh-tools-v1' ? {
          reserveStartup: async () => { if (signal.aborted || row.reviewer_harness_starts >= 1 || this.state.reviewer_harness_starts >= this.limits.quality_reviews) fail('BACKEND_QUALITY_REVIEW_START_BUDGET_EXHAUSTED'); row.reviewer_harness_starts++; this.state.reviewer_harness_starts++; await this.save(); },
          onTool: async () => { if (signal.aborted || row.reviewer_tool_calls_used >= 12 || this.state.tool_calls_used >= this.limits.tool_calls) fail('BACKEND_QUALITY_REVIEW_TOOL_BUDGET_EXHAUSTED'); row.reviewer_tool_calls_used++; this.state.reviewer_tool_calls_used++; this.state.tool_calls_used++; await this.save(); },
          replay: async ({ signal: replaySignal }) => { if (replaySignal?.aborted || this.currentSha() !== sha || this.state.self_tests.at(-1)?.number !== last.number) fail('BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED'); const record = await this.independentValidate(sha, last, replaySignal); if (!record) fail('BACKEND_INDEPENDENT_VALIDATION_BUDGET_EXHAUSTED'); return clone(record); },
        } : {}) });
      row.input_sha256 = /^[a-fA-F0-9]{64}$/.test(review?.input_sha256 || '') ? review.input_sha256 : null;
      row.model = typeof review?.model === 'string' ? review.model.slice(0, 100) : null;
      row.usage = clone(review?.usage || null); row.model_calls = Number.isInteger(review?.model_calls) ? review.model_calls : null;
      row.error_code = typeof review?.error_code === 'string' ? review.error_code.slice(0, 100) : null;
      // Created by the trusted reviewer validator from fixed rules and counts;
      // never contains the rejected model answer or its arbitrary field names.
      if (review?.structure_diagnostic) row.structure_diagnostic = clone(review.structure_diagnostic);
      if (review?.location_diagnostic) row.location_diagnostic = clone(review.location_diagnostic);
      row.investigation = clone(review?.investigation || null);
      row.process_diagnostic = clone(review?.process_diagnostic || null);
      row.harness_starts = Number.isInteger(review?.harness_starts) ? review.harness_starts : null;
      row.tool_calls = Number.isInteger(review?.tool_calls) ? review.tool_calls : null;
      row.replays = Number.isInteger(review?.replays) ? review.replays : null;
      row.elapsed_ms = Number.isInteger(review?.elapsed_ms) ? review.elapsed_ms : null;
      if (this.signal?.aborted) fail('BACKEND_HARNESS_CANCELLED');
      if (this.clock() >= this.state.deadline_ms) fail('BACKEND_HARNESS_WALL_BUDGET_EXHAUSTED');
      if (timeout.aborted) fail('BACKEND_QUALITY_REVIEW_TIMEOUT');
      await this.checkIdentity();
      if (this.currentSha() !== sha || this.state.self_tests.at(-1)?.number !== last.number) fail('BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED');
      if (review?.schema !== 'workbench/candidate-quality-review-v1' || !['NO_FINDINGS', 'REPAIR_REQUIRED', 'NEEDS_ANALYSIS'].includes(review.status) ||
        review.case_sha256 !== this.plan.content_sha256 || review.candidate_sha256 !== sha ||
        (review.status !== 'NEEDS_ANALYSIS' && !row.input_sha256) || !Array.isArray(review.findings) ||
        JSON.stringify(review).length > 64_000 || review.semantic_approval !== false) fail('BACKEND_QUALITY_REVIEW_INVALID');
      row.status = review.status;
      row.findings = clone(review.findings); row.steps = clone(review.steps || []);
    } catch (error) {
      row.status = 'NEEDS_ANALYSIS';
      row.error_code = this.signal?.aborted ? 'BACKEND_HARNESS_CANCELLED'
        : this.clock() >= this.state.deadline_ms ? 'BACKEND_HARNESS_WALL_BUDGET_EXHAUSTED'
          : timeout?.aborted ? 'BACKEND_QUALITY_REVIEW_TIMEOUT' : safeError(error);
    }
    row.finished_at = now(); await this.save();
    return this.reviewFeedback(row);
  }
  currentValidation(sha, last) {
    return this.state.independent_validations.find(row => row.execution_sha256 === sha) || null;
  }
  async independentValidate(sha, last, replaySignal = null) {
    const cached = this.currentValidation(sha, last);
    if (cached) return cached;
    if (this.state.independent_validations.length >= this.limits.independent_validations) return null;
    const row = { number: this.state.independent_validations.length + 1, execution_sha256: sha,
      self_test_number: last.number, status: 'RUNNING', started_at: now(), finished_at: null, result: null, error: null };
    this.state.independent_validations.push(row); await this.save();
    const timeout = AbortSignal.timeout(Math.min(70_000, Math.max(1, this.state.deadline_ms - this.clock())));
    const signal = AbortSignal.any([timeout, ...(this.signal ? [this.signal] : []), ...(replaySignal ? [replaySignal] : [])]);
    try {
      await this.checkIdentity();
      const result = await this.execute({ ...this.context, execution: clone(this.plan.execution), environment: this.environment, signal });
      row.result = clone(result); row.status = resultStatus(result, signal);
      await this.checkIdentity();
      if (this.currentSha() !== sha || this.state.self_tests.at(-1)?.number !== last.number) fail('BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED');
    } catch (error) {
      row.status = signal.aborted ? 'TIMED_OUT' : 'ERROR'; row.error = safeError(error);
    }
    row.finished_at = now(); await this.save();
    return row;
  }
  async submitCandidate(args) {
    await this.checkIdentity();
    const sha = this.currentSha(), last = this.state.self_tests.at(-1);
    if (!sha || args.execution_sha256 !== sha || last?.execution_sha256 !== sha) fail('BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST');
    const steps = this.context.caseVersion.content.steps;
    if (!Array.isArray(args.coverage) || args.coverage.length !== steps.length) fail('BACKEND_CANDIDATE_COVERAGE_REQUIRED');
    for (const [index, step] of steps.entries()) {
      const coverage = args.coverage[index];
      if (coverage.order !== step.order || coverage.requirement !== step.expected || !Array.isArray(coverage.request_ids) || typeof coverage.uncovered !== 'string') fail('BACKEND_CANDIDATE_COVERAGE_INVALID');
      const actualIds = this.plan.execution.steps[index].requests.map(request => request.id);
      if (coverage.request_ids.some(id => !actualIds.includes(id)) || ['READY', 'BUSINESS_DIFFERENCE'].includes(args.outcome) && (coverage.uncovered || !coverage.request_ids.length)) fail('BACKEND_CANDIDATE_COVERAGE_INVALID');
    }
    if (args.outcome === 'READY' && last.status !== 'PASSED') fail('BACKEND_SELF_TEST_NOT_READY');
    if (args.outcome === 'BUSINESS_DIFFERENCE' && (last.status !== 'FAILED' || last.result?.technical_error || last.result?.cleanup_error || last.result?.cleanup?.some(item => item.status !== 'PASSED'))) fail('BACKEND_SELF_TEST_NOT_SUBMITTABLE');
    let review = this.currentReview(sha, last);
    if (['READY', 'BUSINESS_DIFFERENCE'].includes(args.outcome)) {
      if (!review) {
        const feedback = await this.reviewCandidate();
        review = this.currentReview(sha,last);
        if (!review) return feedback;
      }
      if (review.status !== 'NO_FINDINGS') return this.reviewFeedback(review);
      const validation = await this.independentValidate(sha, last);
      if (!validation) return { status: 'NEEDS_ANALYSIS', frozen: false, error_code: 'BACKEND_INDEPENDENT_VALIDATION_BUDGET_EXHAUSTED',
        next_steps: 'Preserve the draft and submit NEEDS_ANALYSIS.' };
      const expectedStatus = args.outcome === 'READY' ? 'PASSED' : 'FAILED';
      if (validation.status !== expectedStatus || validation.self_test_number !== last.number) return { status: 'INDEPENDENT_VALIDATION_FAILED', frozen: false,
        candidate_sha256: sha, validation_number: validation.number, validation_status: validation.status,
        evidence: validation.result ? boundedValidationEvidence(validation.result)
          : { error_code: validation.error || 'BACKEND_INDEPENDENT_VALIDATION_INCOMPLETE' },
        next_steps: 'Inspect this independent result, revise only against confirmed facts, then self_test the current draft again.' };
    } else if (args.outcome === 'NEEDS_ANALYSIS') {
      if (!['FAILED', 'ERROR', 'TIMED_OUT', 'CANCELLED'].includes(last.status) && !review &&
        this.state.quality_reviews.length < this.limits.quality_reviews && this.state.independent_validations.length < this.limits.independent_validations) fail('BACKEND_SELF_TEST_NOT_SUBMITTABLE');
    } else if (args.outcome === 'ENVIRONMENT_BLOCKED' && !['FAILED', 'ERROR', 'TIMED_OUT', 'CANCELLED'].includes(last.status)) fail('BACKEND_SELF_TEST_NOT_SUBMITTABLE');
    this.state.candidate = { status: args.outcome, execution_sha256: sha, submitted_at: now(), self_test_number: last.number,
      coverage: clone(args.coverage), quality_policy: this.state.quality_policy,
      quality_review_number: review?.number || null, independent_validation_number: this.currentValidation(sha, last)?.number || null };
    this.state.status = 'COMPLETED'; this.state.finished_at = now();
    this.plan.execution_sha256 = sha;
    // BackendManager keeps the plan GENERATING until DSH exits and this queue drains.
    this.plan.revision += 1;
    await this.save();
    return { status: 'FROZEN_FOR_HUMAN_REVIEW', frozen: true, candidate: clone(this.state.candidate), semantic_approval: false };
  }
}

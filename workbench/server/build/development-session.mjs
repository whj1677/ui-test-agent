import { runOwnedProcess } from '../../../harness-probe/src/process-control.mjs';
import { allowedEnvironment } from '../../../harness-probe/src/harness-runner.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyDevelopmentRun } from './development-evidence.mjs';
import { checkDevelopmentCandidate } from './development-policy.mjs';
import { developmentError, safeFeedback, DEVELOPMENT_CONTRACT } from './development-feedback.mjs';
import { developmentBundle, saveBundle, verifyBundle, assertBundleTiming } from './development-bundle.mjs';
import { checkFidelity } from './development-fidelity.mjs';
import { checkCandidateTiming, extractTimingObligations } from './timing-obligations.mjs';
import { buildFailureFeedback } from '../failure-feedback.mjs';
import { CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS } from '../quality-review.mjs';
import { selfTestOnly, prerequisiteBlocker } from './development-fast-path.mjs';
import { beforeBrowserObservation, recordExplorationDraftAdmission } from './development-exploration.mjs';
import { developmentRepairFocus } from './development-repair-focus.mjs';

export const DEVELOPMENT_LIMITS = Object.freeze({ self_tests: 3, revisions: 2, tool_calls: 120, harness_starts: 3, quality_reviews: 3, independent_validations: 2, wall_ms: 20 * 60_000 });
export const digest = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const businessMismatch = run => run?.status === 'EXECUTED' && run.result?.report_status === 'COMPLETE' && run.result.test_status === 'FAILED' && run.result.test_count === 1 && run.result.error?.type === 'ASSERTION_MISMATCH' &&
  run.coverage?.unattributed_errors?.length === 0 && run.coverage?.duplicates?.length === 0 && run.coverage?.malformed_titles?.length === 0 &&
  run.coverage?.items?.some(item => item.attributed_errors?.some(error => error.error?.type === 'ASSERTION_MISMATCH'));

export class DevelopmentSession {
  constructor({ directory, frozenCase, normalUrl, verify, persist, signal, limits = DEVELOPMENT_LIMITS, now = Date.now, reviewTimeout = AbortSignal.timeout, evidenceIdentity = null, browserExecutable, authStateForExecution = null, sessionTerminationEndpoints = [], networkPolicy = null, qualityPolicy = null, qualityReviewer = null, pageObservationRequired = false }) {
    Object.assign(this, { directory, frozenCase, normalUrl, verify, persist, signal, limits, now, reviewTimeout, evidenceIdentity, browserExecutable, authStateForExecution, sessionTerminationEndpoints, networkPolicy, qualityPolicy, qualityReviewer, pageObservationRequired });
    this.draftPath = path.join(directory, 'draft', 'candidate.spec.mjs');
    this.contract = { required_step_markers: frozenCase.steps.map(step => `CASE_STEP_${step.order}`) };
    this.state = { started_at: now(), deadline_at: now() + limits.wall_ms, limits, draft_sha256: null, self_tests: [], quality_reviews: [], independent_validations: [], submission: null, tool_calls: 0, harness_starts: 0, reviewer_harness_starts: 0, reviewer_tool_calls_used: 0 };
    this.queue = Promise.resolve();
  }
  async init(seed = null) {
    await fs.mkdir(path.dirname(this.draftPath), { recursive: true });
    this.state.recovery = seed !== null;
    if (seed !== null) {
      if (typeof seed === 'string') await fs.writeFile(this.draftPath, seed, { flag: 'wx' });
      else await saveBundle(seed, path.dirname(this.draftPath));
      // Keep the authorized complete package outside the native tool's writable root.
      this.recoverySeed = await developmentBundle(path.dirname(this.draftPath));
      this.state.recovery_seed_bundle_sha256 = this.recoverySeed.sha256;
      this.state.draft_sha256 = this.recoverySeed.files.find(file => file.path === 'candidate.spec.mjs').sha256;
    }
    await this.save();
  }
  async save() { await this.persist(structuredClone(this.state)); }
  beforeBrowserTool(tool, args) {
    const operation = this.queue.then(async () => {
      this.check();
      try { this.state.draft_sha256 = digest(await fs.readFile(this.draftPath)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; this.state.draft_sha256 = null; }
      const decision = beforeBrowserObservation(this.state, { tool, args, enabled: selfTestOnly(this.qualityPolicy) });
      await this.save();
      return decision;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  requireNormalObservation() {
    // Match the existing final harness prerequisite, but return actionable
    // feedback before spending a review/independent run or freezing the draft.
    if (this.pageObservationRequired && !(this.state.browser_tool_calls > 0)) throw developmentError('NORMAL_PAGE_OBSERVATION_REQUIRED', {
      message: 'Use an authorized browser tool to inspect the normal page in this task, then retry review_candidate or submit_candidate. A self-test does not replace this prerequisite; the draft remains editable.',
      allowed_next_steps: ['observe the normal page using authorized browser tools', 'review_candidate', 'submit_candidate'],
    });
  }
  check() {
    if (this.signal.aborted) throw new Error('DEVELOPMENT_CANCELLED');
    if (this.now() >= this.state.deadline_at) throw new Error('DEVELOPMENT_TIME_EXHAUSTED');
    if (this.state.submission) throw new Error('CANDIDATE_ALREADY_FROZEN');
    if (this.state.blocker) throw new Error('DEVELOPMENT_BLOCKER_RECORDED');
    if (this.state.tool_calls > this.limits.tool_calls) throw new Error('DEVELOPMENT_TOOL_BUDGET_EXHAUSTED');
  }
  invoke(name, args = {}) {
    const run = this.queue.then(() => this.call(name, args)).catch(async error => {
      error.detail = safeFeedback(error, this.state);
      this.state.rejections ||= [];
      this.state.rejections.push({ tool: name, at: this.now(), ...error.detail });
      await this.save(); throw error;
    });
    this.queue = run.catch(() => {}); return run;
  }
  async call(name, args) {
    this.check();
    if (name === 'read_draft' || name === 'write_draft') { try { this.state.draft_sha256 = digest(await fs.readFile(this.draftPath)); } catch (e) { if (e.code !== 'ENOENT') throw e; this.state.draft_sha256 = null; } }
    if (name === 'read_draft') return { runtime_contract: DEVELOPMENT_CONTRACT, frozen_case: this.frozenCase, normal_entry: this.normalUrl, code: this.state.draft_sha256 ? await fs.readFile(this.draftPath, 'utf8') : null, sha256: this.state.draft_sha256, executions_used: this.state.self_tests.length, limits: this.limits };
    if (name === 'write_draft') {
      if (this.state.recovery && this.state.self_tests.length === 0) throw new Error('EXECUTE_ORIGINAL_RECOVERY_DRAFT_FIRST');
      if (args.previous_sha256 !== this.state.draft_sha256) throw new Error('DRAFT_CHANGED_RELOAD_REQUIRED');
      checkDevelopmentCandidate(args.code, { importAllowed: value => /^\.\.?\//.test(value) && value.endsWith('.mjs') });
      const timing = checkCandidateTiming(args.code, this.frozenCase);
      if (timing.violations.length) throw developmentError('TIMING_MUST_USE_RUNNER_OBSERVATION', { violations: timing.violations,
        message: 'Do not create candidate clocks or tolerance. Use original UI actions and visibility assertions; the trusted runner measures the frozen interval.' });
      if (this.state.self_tests.length >= this.limits.self_tests) throw new Error('SELF_TEST_BUDGET_EXHAUSTED_NO_UNVERIFIABLE_EDIT');
      await fs.writeFile(this.draftPath, args.code); this.state.draft_sha256 = digest(args.code);
      recordExplorationDraftAdmission(this.state, { sha256: this.state.draft_sha256, enabled: selfTestOnly(this.qualityPolicy) });
      await this.save();
      return { sha256: this.state.draft_sha256, draft_saved: true, static_admission: 'ACCEPTED', runtime_verified: false, status: 'DRAFT_NOT_VALIDATED' };
    }
    if (name === 'check_fidelity') {
      const code = (await this.readDraftBytes()).toString('utf8');
      const bundle = await developmentBundle(path.dirname(this.draftPath));
      const review = { ...checkFidelity(code, this.frozenCase), bundle_sha256: bundle.sha256 };
      this.state.fidelity = review; await this.save(); return review;
    }
    if (name === 'run_diagnostic') {
      const bundle = await developmentBundle(path.dirname(this.draftPath), { validate: false });
      const root = path.join(this.directory, `diagnostic-${this.now()}`); await saveBundle(bundle, root);
      const results = [];
      for (const file of bundle.files.filter(file => /\.(mjs|js)$/.test(file.path))) {
        const result = await runOwnedProcess(process.execPath, ['--check', path.join(root, file.path)], { cwd: root, env: allowedEnvironment({}), signal: this.signal, timeoutMs: 10000 });
        results.push({ file: file.path, exit_code: result.exitCode, diagnostic: (result.stderr || '').replaceAll(root, '<diagnostic>').replaceAll(root.replaceAll('\\','/'), '<diagnostic>') });
      }
      return { command: 'node --check (each task module snapshot)', bundle_sha256: bundle.sha256, files: bundle.files, results, executes_candidate: false };
    }
    if (name === 'self_test') return this.selfTest();
    if (name === 'review_candidate') return this.reviewCandidate();
    if (name === 'report_blocker') {
      if (!selfTestOnly(this.qualityPolicy)) throw new Error('BLOCKER_REPORT_POLICY_REQUIRED');
      this.requireNormalObservation();
      this.state.blocker = prerequisiteBlocker(this.frozenCase, this.state, args, this.now());
      await this.save();
      return { frozen: true, status: 'ENVIRONMENT_BLOCKED', blocker: this.state.blocker, candidate_created: false };
    }
    if (name === 'read_evidence') {
      if (!Number.isInteger(args.execution) || !['report', 'screenshot'].includes(args.kind)) throw new Error('EVIDENCE_REQUEST_INVALID');
      const run = this.state.self_tests[args.execution - 1];
      if (!run || run.status === 'EXECUTING') throw new Error('EXECUTION_NOT_AVAILABLE');
      if (args.kind === 'report') {
        const report = run.media?.find(file => file.relative_path === run.report_path);
        const readJson = async file => {
          const bytes = await fs.readFile(path.join(this.directory, file.relative_path));
          if (digest(bytes) !== file.sha256) throw new Error('EVIDENCE_CHANGED');
          try { return JSON.parse(bytes.toString('utf8')); } catch { return { unavailable: 'REPORT_JSON_INCOMPLETE' }; }
        };
        const breach = run.media?.find(file => file.relative_path.endsWith('/network-policy-breach.json'));
        return { execution: args.execution, ...run, raw_report: report ? await readJson(report) : null,
          network_policy_breach: breach ? await readJson(breach) : null };
      }
      const shot = run.media?.find(file => file.relative_path.endsWith('.png'));
      if (!shot) throw new Error('SCREENSHOT_NOT_AVAILABLE');
      const bytes = await fs.readFile(path.join(this.directory, shot.relative_path));
      if (digest(bytes) !== shot.sha256) throw new Error('EVIDENCE_CHANGED');
      return { content: [{ type: 'text', text: JSON.stringify({ execution: args.execution, ...shot }) }, { type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }] };
    }
    if (name === 'submit_candidate') {
      this.requireNormalObservation();
      const bytes = await this.readDraftBytes(); const sha = digest(bytes);
      const bundle = await developmentBundle(path.dirname(this.draftPath));
      const last = this.state.self_tests.at(-1);
      assertBundleTiming(bundle, this.frozenCase);
      if (args.sha256 !== sha || last?.sha256 !== sha || last?.bundle_sha256 !== bundle.sha256 || !last.result) throw new Error('CURRENT_BYTES_REQUIRE_SELF_TEST');
      const reviewRequired = this.qualityPolicy && !selfTestOnly(this.qualityPolicy);
      const quality = reviewRequired ? this.currentQuality(last, bundle, { includeErrors: !['ready', 'business_difference'].includes(args.outcome) }) : null;
      if (reviewRequired && !quality) return { frozen: false, status: 'QUALITY_REVIEW_REQUIRED', next_steps: ['review_candidate', 'submit_candidate'], remaining: this.remainingQuality() };
      if (reviewRequired && quality.status !== 'NO_FINDINGS' && ['ready', 'business_difference'].includes(args.outcome)) return {
        frozen: false, status: quality.status, findings: quality.findings || [], next_steps: ['read_draft', 'write_draft', 'self_test', 'review_candidate'], remaining: this.remainingQuality(), semantic_approval: false };
      if (!['ready', 'business_difference', 'needs_analysis', 'environment_blocked', 'budget_exhausted'].includes(args.outcome)) throw new Error('SUBMISSION_OUTCOME_INVALID');
      if (!Array.isArray(args.coverage) || args.coverage.length !== this.frozenCase.steps.length) throw new Error('COVERAGE_REQUIRED');
      const lines = bytes.toString('utf8').split(/\r?\n/);
      for (const [i, step] of this.frozenCase.steps.entries()) {
        const item = args.coverage[i];
        if (item.order !== step.order || item.requirement !== step.expected || item.execution !== last.number || typeof item.uncovered !== 'string' || !Array.isArray(item.check_lines)) throw new Error('COVERAGE_BINDING_INVALID');
        if (item.check_lines.some(line => !Number.isInteger(line) || line < 1 || line > lines.length)) throw new Error('COVERAGE_LINE_INVALID');
        if (args.outcome === 'ready' && (item.uncovered || !item.check_lines.length)) throw new Error('READY_WITH_UNCOVERED_REQUIREMENT');
      }
      if (args.outcome === 'ready' && (!last.result.complete_pass || !last.coverage.complete || last.changed_after_execution)) throw new Error('READY_REQUIRES_CURRENT_COMPLETE_SELF_TEST');
      const timingRequirements = extractTimingObligations(this.frozenCase);
      if (args.outcome === 'ready' && timingRequirements.length &&
          (timingRequirements.some(item => item.status !== 'RUNTIME_REQUIRED') || !last.timing_validation?.required || !last.timing_validation.complete))
        throw developmentError('READY_REQUIRES_FROZEN_TIMING_EVIDENCE', { timing_requirements: timingRequirements });
      // The finite checker can disqualify known gaps, but cannot approve semantics.
      const fidelity = { ...checkFidelity(bytes.toString('utf8'), this.frozenCase), bundle_sha256: bundle.sha256 };
      if (args.outcome === 'ready' && fidelity.assertion_sources.blocking.length) throw developmentError('READY_WITH_UNBOUND_BUSINESS_ASSERTION', {
        assertions: fidelity.assertion_sources.blocking.map(item => ({ step: item.step, line: item.line, assertion: item.source })),
        message: 'Do not promote observed state or message copy into a business expectation. A frozen nonempty reason requires non-whitespace text, not an invented exact message. Preserve the frozen result and report actual observations separately.',
      });
      if (args.outcome === 'ready' && fidelity.failure_cleanup.blocking.length) throw developmentError('READY_WITH_FAILURE_CLEANUP_GAP', {
        gaps: fidelity.failure_cleanup.blocking,
        message: 'Keep the original cleanup step, and arrange awaited failure-safe teardown for this execution\'s owned data. A last happy-path step alone is insufficient. Do not clean unrelated or pre-existing data.',
      });
      if (args.outcome === 'ready' && fidelity.obligations.some(item => item.status === 'INSUFFICIENT')) throw developmentError('READY_WITH_FINITE_FIDELITY_GAP', { gaps: fidelity.obligations.filter(item => item.status === 'INSUFFICIENT').map(item => ({ step: item.step, kind: item.kind, target: item.target })) });
      if (args.outcome === 'ready' && fidelity.pre_step_state_changes.some(item => item.status === 'BLOCKING_UNREQUESTED_PRE_STEP_STATE_CHANGE')) throw developmentError('READY_WITH_PRECONDITION_CHANGE', { lines: fidelity.pre_step_state_changes.filter(item => item.status === 'BLOCKING_UNREQUESTED_PRE_STEP_STATE_CHANGE').map(item => item.line) });
      let independent = null;
      if (reviewRequired && (this.qualityPolicy.validation_mode === 'normal-only' && args.outcome === 'ready' || args.outcome === 'business_difference')) {
        independent = await this.validateBeforeFreeze(last, bundle);
        if (!independent.result || independent.status !== 'EXECUTED' || independent.changed_after_execution) return {
          frozen: false, status: 'INDEPENDENT_VALIDATION_FAILED', evidence: independent, next_steps: ['read_evidence', 'read_draft', 'write_draft', 'self_test', 'review_candidate'], remaining: this.remainingQuality() };
        if (args.outcome === 'ready' && (!independent.result.complete_pass || !independent.coverage?.complete)) return {
          frozen: false, status: 'INDEPENDENT_VALIDATION_FAILED', evidence: independent, next_steps: ['read_draft', 'write_draft', 'self_test', 'review_candidate'], remaining: this.remainingQuality() };
        if (args.outcome === 'business_difference' && (!businessMismatch(last) || !businessMismatch(independent) || independent.result.complete_pass && independent.coverage?.complete)) return {
          frozen: false, status: 'BUSINESS_DIFFERENCE_NOT_REPRODUCED', evidence: independent, next_steps: ['read_draft', 'review_candidate', 'submit_candidate'], remaining: this.remainingQuality() };
      }
      const review = {
        schema: 'workbench/development-fidelity-review-v1', bundle_sha256: bundle.sha256,
        candidate_sha256: sha, frozen_case_sha256: digest(JSON.stringify(this.frozenCase)),
        case_preconditions: this.frozenCase.preconditions ?? null,
        semantic_approval: false, human_review_required: !selfTestOnly(this.qualityPolicy), finite_checks: fidelity,
        timing_validation: last.timing_validation || null,
        steps: this.frozenCase.steps.map((step, i) => ({ order: step.order,
          precondition: step.precondition ?? step.preconditions ?? this.frozenCase.preconditions ?? null, action: step.action,
          expected: step.expected, claimed_check_lines: args.coverage[i].check_lines,
          claimed_check_source: args.coverage[i].check_lines.map(line => ({ line, code: lines[line - 1] })),
          self_test: { execution: last.number, status: last.status, result: last.result, observed_step: last.coverage?.items?.find(item => item.marker === `CASE_STEP_${step.order}`) ?? null },
          action_precondition_review: selfTestOnly(this.qualityPolicy) ? 'SKIPPED_BY_USER_POLICY' : 'PENDING_INDEPENDENT_REVIEW', uncovered: args.coverage[i].uncovered })),
      };
      this.check();
      if ((await developmentBundle(path.dirname(this.draftPath))).sha256 !== bundle.sha256) return {
        frozen: false, status: 'CURRENT_BYTES_REQUIRE_SELF_TEST', next_steps: ['self_test', 'review_candidate', 'submit_candidate'], remaining: this.remainingQuality() };
      const finalPath = path.join(this.directory, 'final', 'candidate.spec.mjs'); await fs.mkdir(path.dirname(finalPath), { recursive: true });
      await saveBundle(bundle, path.dirname(finalPath));
      await fs.writeFile(path.join(this.directory, 'fidelity-review.json'), JSON.stringify(review, null, 2));
      this.state.fidelity_review = review;
      this.state.submission = { ...args, submitted_at: this.now(), file: 'final/candidate.spec.mjs', bundle: { files: bundle.files, sha256: bundle.sha256 }, fidelity_review: 'fidelity-review.json', quality_review: quality || null, independent_validation: independent || null, semantic_approval: false, requirements_review: selfTestOnly(this.qualityPolicy) ? 'SKIPPED_BY_USER_POLICY' : 'PENDING_INDEPENDENT_REVIEW', validation_source: selfTestOnly(this.qualityPolicy) ? 'SELF_TEST' : 'INDEPENDENT_VALIDATION' };
      await this.save(); return { frozen: true, status: selfTestOnly(this.qualityPolicy) ? 'SELF_TEST_VALIDATED' : 'FROZEN_FOR_INDEPENDENT_VALIDATION', sha256: sha, approval: selfTestOnly(this.qualityPolicy) ? 'NOT_REQUIRED' : 'NOT_APPROVED' };
    }
    throw new Error('TOOL_NOT_ALLOWED');
  }
  async readDraftBytes() {
    try { const bytes = await fs.readFile(this.draftPath); this.state.draft_sha256 = digest(bytes); return bytes; } catch (error) { if (error.code === 'ENOENT') throw developmentError('DRAFT_NOT_CREATED'); throw error; }
  }
  remainingQuality() { return { quality_reviews: Math.max(0, (this.limits.quality_reviews || 0) - this.state.quality_reviews.length), independent_validations: Math.max(0, (this.limits.independent_validations || 0) - this.state.independent_validations.length) }; }
  qualityKey(last, bundle) { return digest(JSON.stringify({ case_sha256: this.evidenceIdentity?.executed_content_sha256 || digest(JSON.stringify(this.frozenCase)), bundle_sha256: bundle.sha256, execution: last.number, report_path: last.report_path, result: last.result, coverage: last.coverage })); }
  currentQuality(last, bundle, { includeErrors = false } = {}) {
    const key = this.qualityKey(last, bundle);
    return this.state.quality_reviews.findLast(item => item.key === key && item.status !== 'REVIEWING' && item.review && (includeErrors || !item.review.error_code))?.review || null;
  }
  async reviewCandidate() {
    this.check();
    this.requireNormalObservation();
    if (selfTestOnly(this.qualityPolicy)) return { status: 'SKIPPED_BY_USER_POLICY', semantic_approval: false, next_steps: ['self_test', 'submit_candidate'] };
    if (!this.qualityPolicy) return { status: 'LEGACY_NO_QUALITY_POLICY', semantic_approval: false };
    const last = this.state.self_tests.at(-1);
    const bundle = await developmentBundle(path.dirname(this.draftPath));
    if (!last?.result || last.bundle_sha256 !== bundle.sha256 || last.sha256 !== digest(bundle.entries.find(item => item.path === 'candidate.spec.mjs').content)) throw new Error('CURRENT_BYTES_REQUIRE_SELF_TEST');
    const key = this.qualityKey(last, bundle);
    const cached = this.state.quality_reviews.findLast(item => item.key === key && item.status !== 'REVIEWING' && item.review && !item.review.error_code);
    if (cached) return { ...cached.review, cached: true, remaining: this.remainingQuality() };
    if (this.state.quality_reviews.length >= this.limits.quality_reviews) return { status: 'QUALITY_REVIEW_BUDGET_EXHAUSTED', semantic_approval: false, remaining: this.remainingQuality() };
    const mode = this.qualityPolicy.quality_review_mode ?? 'static-v1';
    if (!['static-v1', 'dsh-tools-v1'].includes(mode)) throw new Error('QUALITY_REVIEW_MODE_INVALID');
    const attempt = { number: this.state.quality_reviews.length + 1, key, bundle_sha256: bundle.sha256, self_test: last.number, mode, status: 'REVIEWING', started_at: this.now(), reviewer_harness_starts: 0, reviewer_tool_calls_used: 0 };
    this.state.quality_reviews.push(attempt); await this.save();
    const caseSha = this.evidenceIdentity?.executed_content_sha256 || digest(JSON.stringify(this.frozenCase));
    const fallback = (errorCode, original = null) => ({ schema: 'workbench/candidate-quality-review-v1', status: 'NEEDS_ANALYSIS', case_sha256: caseSha, candidate_sha256: bundle.sha256,
      input_sha256: original?.input_sha256 || key, findings: [], steps: [], model: original?.model || null, usage: original?.usage || null,
      model_calls: original?.model_calls ?? null, semantic_approval: false, error_code: errorCode,
      model_diagnostic: original?.model_diagnostic ?? null,
      investigation: mode === 'dsh-tools-v1' && original?.investigation && JSON.stringify(original.investigation).length <= 16_000 ? structuredClone(original.investigation) : null,
      harness_starts: Number.isInteger(original?.harness_starts) ? original.harness_starts : null,
      tool_calls: Number.isInteger(original?.tool_calls) ? original.tool_calls : null, replays: Number.isInteger(original?.replays) ? original.replays : null,
      elapsed_ms: Number.isInteger(original?.elapsed_ms) ? original.elapsed_ms : null, provider_requests: original?.provider_requests ?? null,
      process_diagnostic: mode === 'dsh-tools-v1' && original?.process_diagnostic && JSON.stringify(original.process_diagnostic).length <= 2_000 ? structuredClone(original.process_diagnostic) : null });
    let timeout;
    try {
      if (!this.qualityReviewer) throw new Error('QUALITY_REVIEWER_UNAVAILABLE');
      timeout = this.reviewTimeout(Math.min(CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS, Math.max(1, this.state.deadline_at - this.now())));
      const reviewSignal = AbortSignal.any([this.signal, timeout]);
      const review = await this.qualityReviewer({ kind: 'ui', frozenCase: structuredClone(this.frozenCase), caseSha256: caseSha, candidateSha256: bundle.sha256,
        files: bundle.entries.map(item => ({ path: item.path, content: item.content.toString('utf8') })),
        evidence: { execution: last.number, bundle_sha256: last.bundle_sha256, status: last.status, result: last.result, coverage: last.coverage, timing_validation: last.timing_validation || null, browser_assertions: last.browser_assertions || { status: 'NOT_USED', records: [], semantic_approval: false } }, context: null,
        signal: reviewSignal,
        ...(mode === 'dsh-tools-v1' ? {
          reserveStartup: async () => { if (reviewSignal.aborted || attempt.reviewer_harness_starts >= 1 || this.state.reviewer_harness_starts >= this.limits.quality_reviews) throw Error('QUALITY_REVIEW_START_BUDGET_EXHAUSTED'); attempt.reviewer_harness_starts++; this.state.reviewer_harness_starts++; await this.save(); },
          onTool: async () => { if (reviewSignal.aborted || attempt.reviewer_tool_calls_used >= 12 || this.state.tool_calls >= this.limits.tool_calls) throw Error('QUALITY_REVIEW_TOOL_BUDGET_EXHAUSTED'); attempt.reviewer_tool_calls_used++; this.state.reviewer_tool_calls_used++; this.state.tool_calls++; await this.save(); },
          replay: async ({ signal }) => { if (signal?.aborted || (await developmentBundle(path.dirname(this.draftPath))).sha256 !== bundle.sha256 || this.state.self_tests.at(-1) !== last) throw Error('QUALITY_DRAFT_CHANGED_DURING_REVIEW'); return this.validateBeforeFreeze(last, bundle, signal); },
        } : {}) });
      attempt.review = review;
      if (!review || review.schema !== 'workbench/candidate-quality-review-v1' || !['NO_FINDINGS', 'REPAIR_REQUIRED', 'NEEDS_ANALYSIS'].includes(review.status) || review.case_sha256 !== caseSha || review.candidate_sha256 !== bundle.sha256 || !/^[a-f\d]{64}$/i.test(review.input_sha256) || review.semantic_approval !== false || !Array.isArray(review.findings)) attempt.review = fallback('QUALITY_REVIEW_IDENTITY_INVALID', review);
    } catch (error) { attempt.review = fallback(this.signal.aborted ? 'DEVELOPMENT_CANCELLED' : this.now() >= this.state.deadline_at ? 'DEVELOPMENT_TIME_EXHAUSTED' : timeout?.aborted ? 'QUALITY_REVIEW_TIMEOUT' : error.message === 'QUALITY_REVIEWER_UNAVAILABLE' ? error.message : 'QUALITY_REVIEW_UNAVAILABLE'); }
    const current = await developmentBundle(path.dirname(this.draftPath));
    if (current.sha256 !== bundle.sha256 || this.state.self_tests.at(-1) !== last) attempt.review = fallback('QUALITY_DRAFT_CHANGED_DURING_REVIEW', attempt.review);
    if (this.signal.aborted || this.now() >= this.state.deadline_at) attempt.review = fallback(this.signal.aborted ? 'DEVELOPMENT_CANCELLED' : 'DEVELOPMENT_TIME_EXHAUSTED', attempt.review);
    else if (timeout?.aborted) attempt.review = fallback('QUALITY_REVIEW_TIMEOUT', attempt.review);
    attempt.status = attempt.review.status; attempt.finished_at = this.now(); await this.save();
    this.check();
    return { ...attempt.review, frozen: false, remaining: this.remainingQuality(), next_steps: attempt.review.status === 'NO_FINDINGS' ? ['submit_candidate'] : ['read_draft', 'write_draft', 'self_test', 'review_candidate'] };
  }
  async validateBeforeFreeze(last, bundle, replaySignal = null) {
    // A failed independent run cannot be retried on identical executable bytes by spending another self-test.
    const cached = this.state.independent_validations.findLast(item => item.bundle_sha256 === bundle.sha256 && item.status !== 'EXECUTING');
    if (cached) return cached;
    if (this.state.independent_validations.length >= this.limits.independent_validations) return { status: 'INDEPENDENT_VALIDATION_BUDGET_EXHAUSTED', result: null };
    const number = this.state.independent_validations.length + 1;
    const root = path.join(this.directory, `independent-${number}`);
    await fs.mkdir(root, { recursive: true }); await saveBundle(bundle, root);
    const run = { number, self_test: last.number, bundle_sha256: bundle.sha256, status: 'EXECUTING', started_at: this.now(), candidate_path: `independent-${number}/candidate.spec.mjs` };
    this.state.independent_validations.push(run); await this.save();
    try {
      const timeout = AbortSignal.timeout(Math.min(70_000, Math.max(1, this.state.deadline_at - this.now())));
      const signal = AbortSignal.any([this.signal, timeout, ...(replaySignal ? [replaySignal] : [])]);
      const authStorageState = this.authStateForExecution ? await this.authStateForExecution() : null;
      const identity = this.evidenceIdentity && { ...this.evidenceIdentity, run_id: `${this.evidenceIdentity.task_id}-independent-${number}`, candidate_sha256: last.sha256, candidate_bundle_sha256: bundle.sha256 };
      const { raw, result, coverage, evidence } = await verifyDevelopmentRun({ verify: this.verify,
        options: { candidatePath: path.join(root, 'candidate.spec.mjs'), fixtureUrl: this.normalUrl, runDirectory: path.join(root, 'evidence'), signal, authStorageState,
          networkPolicy: this.networkPolicy, sessionTerminationEndpoints: this.sessionTerminationEndpoints },
        identity, caseContent: this.frozenCase, contract: this.contract, browserExecutable: this.browserExecutable });
      run.result = result; run.coverage = coverage; Object.assign(run, evidence);
      run.report_path = path.relative(this.directory, raw.reportPath).replaceAll('\\', '/');
      run.changed_after_execution = !(await verifyBundle(root, bundle)) || (await developmentBundle(path.dirname(this.draftPath))).sha256 !== bundle.sha256 || this.state.self_tests.at(-1) !== last;
      run.status = signal.aborted ? 'CANCELLED' : 'EXECUTED';
    } catch (error) { run.status = this.signal.aborted ? 'CANCELLED' : 'EXECUTOR_ERROR'; run.error = error.message; }
    await this.indexRunEvidence(run, root);
    run.finished_at = this.now(); await this.save(); return run;
  }
  async indexRunEvidence(run, root) {
    try {
      run.media = await evidenceFiles(path.join(root, 'evidence'), this.directory);
      const reportPath = path.relative(this.directory, path.join(root, 'evidence', 'playwright-report.json')).replaceAll('\\', '/');
      if (run.media.some(file => file.relative_path === reportPath)) run.report_path = reportPath;
      const warnings = run.media.find(file => file.relative_path.endsWith('/network-blocked-dependencies.ndjson'));
      if (warnings) run.network_warnings = (await fs.readFile(path.join(this.directory, warnings.relative_path), 'utf8'))
        .trim().split('\n').filter(Boolean).slice(0, 50).map(line => JSON.parse(line));
    } catch (error) {
      run.media = [];
      if (error.code !== 'ENOENT') run.evidence_error = error.message;
    }
  }
  async selfTest() {
    this.check();
    if (this.state.self_tests.length >= this.limits.self_tests) throw new Error('SELF_TEST_BUDGET_EXHAUSTED');
    const firstRecovery = this.state.recovery && this.state.self_tests.length === 0;
    const bundle = firstRecovery ? this.recoverySeed : await developmentBundle(path.dirname(this.draftPath));
    if (!bundle) throw new Error('RECOVERY_SEED_PACKAGE_MISSING');
    // Recovery must retain the original bytes and receive the actual admission
    // failure; do not silently edit its seed to make the new policy pass.
    const bytes = bundle.entries.find(file => file.path === 'candidate.spec.mjs')?.content;
    if (!bytes) throw new Error('DRAFT_NOT_CREATED');
    const last = this.state.self_tests.at(-1);
    if (selfTestOnly(this.qualityPolicy) && last?.bundle_sha256 === bundle.sha256 && last.status === 'EXECUTED' && last.result?.complete_pass && last.coverage?.complete && !last.changed_after_execution) return { ...last, cached: true, executions_used: this.state.self_tests.length, executions_remaining: this.limits.self_tests - this.state.self_tests.length };
    if (last?.bundle_sha256 === bundle.sha256 && last.observation_epoch === (this.state.observation_epoch || 0) && (last.status === 'EXECUTOR_ERROR' || !last.result?.complete_pass)) throw developmentError('UNCHANGED_FAILURE_REQUIRES_NEW_EVIDENCE', { executions_remaining: this.limits.self_tests - this.state.self_tests.length });
    const number = this.state.self_tests.length + 1;
    const root = path.join(this.directory, `run-${number}`); await fs.mkdir(root, { recursive: true });
    const candidatePath = path.join(root, 'candidate.spec.mjs'); await saveBundle(bundle, root);
    const run = { number, bundle_sha256: bundle.sha256, files: bundle.files, sha256: digest(bytes), candidate_path: `run-${number}/candidate.spec.mjs`, status: 'EXECUTING', started_at: this.now(), observation_epoch: this.state.observation_epoch || 0, recovery_original: firstRecovery };
    this.state.self_tests.push(run); await this.save();
    try {
      assertBundleTiming(bundle, this.frozenCase);
      const identity = this.evidenceIdentity && { ...this.evidenceIdentity, run_id: `${this.evidenceIdentity.task_id}-dev-${number}`, candidate_sha256: run.sha256, candidate_bundle_sha256: bundle.sha256 };
      const authStorageState = this.authStateForExecution ? await this.authStateForExecution() : null;
      const { raw, result, coverage, evidence } = await verifyDevelopmentRun({ verify: this.verify,
        options: { candidatePath, fixtureUrl: this.normalUrl, runDirectory: path.join(root, 'evidence'), signal: this.signal, authStorageState, networkPolicy: this.networkPolicy,
          sessionTerminationEndpoints: this.sessionTerminationEndpoints },
        identity, caseContent: this.frozenCase, contract: this.contract, browserExecutable: this.browserExecutable });
      run.result = result; run.coverage = coverage; Object.assign(run, evidence);
      run.changed_after_execution = !(await verifyBundle(root, bundle));
      run.report_path = path.relative(this.directory, raw.reportPath).replaceAll('\\', '/');
      run.media = await evidenceFiles(path.join(root, 'evidence'), this.directory);
      run.status = this.signal.aborted ? 'CANCELLED' : 'EXECUTED';
      run.trace_summary = { interpretation: 'metadata and reporter steps; no synthetic trace verdict', archives: run.media.filter(file => file.relative_path.endsWith('.zip')), observed_steps: run.coverage.items };
    } catch (error) { run.status = this.signal.aborted ? 'CANCELLED' : 'EXECUTOR_ERROR'; run.error = error.message; }
    // Executors may fail after producing a report or screenshots. Preserve and
    // hash those files without turning an executor error into a passing test.
    await this.indexRunEvidence(run, root);
    run.finished_at = this.now();
    run.failure_feedback = buildFailureFeedback({ record: { ...this.evidenceIdentity, ...run }, caseContent: this.frozenCase });
    run.repair_focus = developmentRepairFocus(run, this.frozenCase);
    await this.save();
    return { ...run, executions_used: this.state.self_tests.length, executions_remaining: this.limits.self_tests - this.state.self_tests.length };
  }
}

export async function evidenceFiles(root, relativeTo = root) {
  const files = [];
  async function visit(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isSymbolicLink()) throw new Error('EVIDENCE_SYMLINK_NOT_ALLOWED');
      if (item.isDirectory()) await visit(file);
      else { const bytes = await fs.readFile(file); files.push({ relative_path: path.relative(relativeTo, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: digest(bytes) }); }
    }
  }
  await visit(root); return files;
}

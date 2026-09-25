import { runOwnedProcess } from '../../../harness-probe/src/process-control.mjs';
import { allowedEnvironment } from '../../../harness-probe/src/harness-runner.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyDevelopmentRun } from './development-evidence.mjs';
import { checkDevelopmentCandidate } from './development-policy.mjs';
import { developmentError, safeFeedback, DEVELOPMENT_CONTRACT } from './development-feedback.mjs';
import { developmentBundle, saveBundle, verifyBundle } from './development-bundle.mjs';
import { checkFidelity } from './development-fidelity.mjs';

export const DEVELOPMENT_LIMITS = Object.freeze({ self_tests: 3, revisions: 2, tool_calls: 120, harness_starts: 3, wall_ms: 20 * 60_000 });
export const digest = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

export class DevelopmentSession {
  constructor({ directory, frozenCase, normalUrl, verify, persist, signal, limits = DEVELOPMENT_LIMITS, now = Date.now, evidenceIdentity = null, browserExecutable }) {
    Object.assign(this, { directory, frozenCase, normalUrl, verify, persist, signal, limits, now, evidenceIdentity, browserExecutable });
    this.draftPath = path.join(directory, 'draft', 'candidate.spec.mjs');
    this.contract = { required_step_markers: frozenCase.steps.map(step => `CASE_STEP_${step.order}`) };
    this.state = { started_at: now(), deadline_at: now() + limits.wall_ms, draft_sha256: null, self_tests: [], submission: null, tool_calls: 0, harness_starts: 0 };
    this.queue = Promise.resolve();
  }
  async init(seed = null) {
    await fs.mkdir(path.dirname(this.draftPath), { recursive: true });
    this.state.recovery = seed !== null;
    if (seed !== null) { await fs.writeFile(this.draftPath, seed, { flag: 'wx' }); this.state.draft_sha256 = digest(seed); }
    await this.save();
  }
  async save() { await this.persist(structuredClone(this.state)); }
  check() {
    if (this.signal.aborted) throw new Error('DEVELOPMENT_CANCELLED');
    if (this.now() >= this.state.deadline_at) throw new Error('DEVELOPMENT_TIME_EXHAUSTED');
    if (this.state.submission) throw new Error('CANDIDATE_ALREADY_FROZEN');
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
      if (this.state.self_tests.length >= this.limits.self_tests) throw new Error('SELF_TEST_BUDGET_EXHAUSTED_NO_UNVERIFIABLE_EDIT');
      await fs.writeFile(this.draftPath, args.code); this.state.draft_sha256 = digest(args.code); await this.save();
      return { sha256: this.state.draft_sha256, draft_saved: true, static_admission: 'ACCEPTED', runtime_verified: false, status: 'DRAFT_NOT_VALIDATED' };
    }
    if (name === 'check_fidelity') {
      const code = (await this.readDraftBytes()).toString('utf8');
      const review = checkFidelity(code, this.frozenCase); this.state.fidelity = review; await this.save(); return review;
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
    if (name === 'read_evidence') {
      if (!Number.isInteger(args.execution) || !['report', 'screenshot'].includes(args.kind)) throw new Error('EVIDENCE_REQUEST_INVALID');
      const run = this.state.self_tests[args.execution - 1];
      if (!run?.result) throw new Error('EXECUTION_NOT_AVAILABLE');
      if (args.kind === 'report') return { execution: args.execution, ...run, raw_report: JSON.parse(await fs.readFile(path.join(this.directory, run.report_path), 'utf8')) };
      const shot = run.media.find(file => file.relative_path.endsWith('.png'));
      if (!shot) throw new Error('SCREENSHOT_NOT_AVAILABLE');
      const bytes = await fs.readFile(path.join(this.directory, shot.relative_path));
      if (digest(bytes) !== shot.sha256) throw new Error('EVIDENCE_CHANGED');
      return { content: [{ type: 'text', text: JSON.stringify({ execution: args.execution, ...shot }) }, { type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }] };
    }
    if (name === 'submit_candidate') {
      const bytes = await this.readDraftBytes(); const sha = digest(bytes);
      const bundle = await developmentBundle(path.dirname(this.draftPath));
      const last = this.state.self_tests.at(-1);
      if (args.sha256 !== sha || last?.sha256 !== sha || last?.bundle_sha256 !== bundle.sha256 || !last.result) throw new Error('CURRENT_BYTES_REQUIRE_SELF_TEST');
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
      // Coverage is a review artifact, not an AST semantic proof or approval.
      const finalPath = path.join(this.directory, 'final', 'candidate.spec.mjs'); await fs.mkdir(path.dirname(finalPath), { recursive: true });
      await saveBundle(bundle, path.dirname(finalPath));
      this.state.submission = { ...args, submitted_at: this.now(), file: 'final/candidate.spec.mjs', bundle: { files: bundle.files, sha256: bundle.sha256 }, semantic_approval: false, requirements_review: 'PENDING_INDEPENDENT_REVIEW' };
      await this.save(); return { status: 'FROZEN_FOR_INDEPENDENT_VALIDATION', sha256: sha, approval: 'NOT_APPROVED' };
    }
    throw new Error('TOOL_NOT_ALLOWED');
  }
  async readDraftBytes() {
    try { const bytes = await fs.readFile(this.draftPath); this.state.draft_sha256 = digest(bytes); return bytes; } catch (error) { if (error.code === 'ENOENT') throw developmentError('DRAFT_NOT_CREATED'); throw error; }
  }
  async selfTest() {
    this.check();
    if (this.state.self_tests.length >= this.limits.self_tests) throw new Error('SELF_TEST_BUDGET_EXHAUSTED');
    const bytes = await this.readDraftBytes(); const bundle = await developmentBundle(path.dirname(this.draftPath));
    const number = this.state.self_tests.length + 1;
    const root = path.join(this.directory, `run-${number}`); await fs.mkdir(root, { recursive: true });
    const candidatePath = path.join(root, 'candidate.spec.mjs'); await saveBundle(bundle, root);
    const run = { number, bundle_sha256: bundle.sha256, files: bundle.files, sha256: digest(bytes), candidate_path: `run-${number}/candidate.spec.mjs`, status: 'EXECUTING', started_at: this.now() };
    this.state.self_tests.push(run); await this.save();
    try {
      const identity = this.evidenceIdentity && { ...this.evidenceIdentity, run_id: `${this.evidenceIdentity.task_id}-dev-${number}`, candidate_sha256: run.sha256 };
      const { raw, result, coverage, evidence } = await verifyDevelopmentRun({ verify: this.verify,
        options: { candidatePath, fixtureUrl: this.normalUrl, runDirectory: path.join(root, 'evidence'), signal: this.signal },
        identity, caseContent: this.frozenCase, contract: this.contract, browserExecutable: this.browserExecutable });
      run.result = result; run.coverage = coverage; Object.assign(run, evidence);
      run.changed_after_execution = !(await verifyBundle(root, bundle));
      run.report_path = path.relative(this.directory, raw.reportPath).replaceAll('\\', '/');
      run.media = await evidenceFiles(path.join(root, 'evidence'), this.directory);
      run.status = this.signal.aborted ? 'CANCELLED' : 'EXECUTED';
      run.trace_summary = { interpretation: 'metadata and reporter steps; no synthetic trace verdict', archives: run.media.filter(file => file.relative_path.endsWith('.zip')), observed_steps: run.coverage.items };
    } catch (error) { run.status = this.signal.aborted ? 'CANCELLED' : 'EXECUTOR_ERROR'; run.error = error.message; }
    run.finished_at = this.now(); await this.save();
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

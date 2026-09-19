import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runtimeLocator as handoffLocator, assertRowIdentity } from './row-locator.mjs';
import { captureWithinGuard, releaseWithinGuard } from './within-locator.mjs';
import { isIntentPlan, INTENT_PLAN_VERSION } from './intent-plan.mjs';
import { isAdaptivePlan, ADAPTIVE_PLAN_VERSION } from './adaptive-plan.mjs';
import { executeAdaptiveStep, assertAdaptiveActionTarget } from './adaptive-execution.mjs';
import { captureRuntimeGuard, bindingReceipt } from './runtime-binding.mjs';
import { observeWizard, captureCaseNamedGuard } from './wizard-binding.mjs';
import { rejectionLog, recordRejection } from './observation-diagnostics.mjs';
import {
  validateLocator,
  validatePlan,
  planHash,
  caseHash,
  CHECKPOINT_PLAN_VERSION,
} from './plans.mjs';
import { fail, relativeURL, redact, poll, now, uid, hash, semanticHash } from './common.mjs';
import { RecordingEvidence } from './recording-evidence.mjs';
import { stepActions, stepAssertions, stepCheckpoints } from './plan-steps.mjs';
import { StepBudget } from './step-budget.mjs';
import { compareTableCells, displayNumber } from './table-assertion.mjs';
import { compareTableOrder } from './table-order.mjs';
import {
  needsTableBaseline,
  assertTableBaselineScope,
  requireTableBaseline,
  compareTableBaseline,
  installTableInvariantSampler,
} from './table-invariant.mjs';
import { canObserveAgain, validateObserveDecision } from './controlled-react.mjs';
import { DEFAULT_ADAPTER_SOURCE } from './adapter-program.mjs';
import { runAdapter } from './adapter-runtime.mjs';
import {
  resolveOptionalDialog,
  recheckOptionalDialog,
  dispatchOptionalDialog,
} from './optional-dialog.mjs';

const actionScopeGuards = new WeakMap();
function frozenTableAssertions(run) {
  assertTableBaselineScope(run.tableBaselines, run.page, {
    run_id: run.result.id,
    step_id: run.step.step_id,
  });
  const original = (run.c ?? run.result.executed_case)?.steps.find(
    (step) => step.step_id === run.step.step_id,
  );
  const obligations = original?.obligations.filter((o) => needsTableBaseline(o.text)) ?? [];
  if (!needsTableBaseline(original?.expected) || !obligations.length)
    fail('TABLE_INVARIANT_SOURCE_REQUIRED');
  return run.tableBaselines.tables.flatMap(({ target }) =>
    obligations.map((o) => ({
      target,
      check: 'table_unchanged',
      expected: true,
      oracle_quote: o.text,
      obligation_ids: [o.id],
    })),
  );
}

async function disposeActionTarget(target) {
  if (!target) return;
  await releaseWithinGuard(actionScopeGuards.get(target));
  actionScopeGuards.delete(target);
  await target.dispose();
}

export class BrowserSession {
  constructor({ headless = false } = {}) {
    this.headless = headless;
    this.browser = null;
    this.taskId = null;
    this.authenticated = false;
    this.storage = null;
    this.adapterSource = DEFAULT_ADAPTER_SOURCE;
  }
  async open(task) {
    if (this.browser && this.taskId === task.id && this.browser.isConnected()) {
      if (this.active(task.id)) {
        await this.loginPage.bringToFront();
        return;
      }
      this.invalidateAuthentication();
      if (!this.browser.contexts().includes(this.loginContext))
        this.loginContext = await this.browser.newContext({
          viewport: { width: 1360, height: 900 },
          serviceWorkers: 'block',
        });
      await this.openLoginPage(task);
      return;
    }
    await this.close();
    this.taskId = task.id;
    this.adapterSource = task.adapter_program?.source ?? DEFAULT_ADAPTER_SOURCE;
    if (task.adapter_program) {
      const checked = await runAdapter([], { source: this.adapterSource, regression: true });
      if (checked.hash !== task.adapter_program.hash) fail('ADAPTER_HASH_MISMATCH');
    }
    this.target = task.target;
    this.browser = await chromium.launch({ headless: this.headless });
    this.browser.on('disconnected', () => {
      this.invalidateAuthentication();
    });
    this.loginContext = await this.browser.newContext({
      viewport: { width: 1360, height: 900 },
      serviceWorkers: 'block',
    });
    await this.openLoginPage(task);
  }
  invalidateAuthentication() {
    this.authenticated = false;
    this.storage = null;
    this.sessionStorage = null;
    this.marker = null;
    this.authEvidence = null;
    this.loginTicket = null;
    this.loginWaitReason = null;
  }
  async openLoginPage(task) {
    const page = await this.loginContext.newPage();
    this.loginPage = page;
    page.on('close', () => {
      if (this.loginPage === page) this.invalidateAuthentication();
    });
    await page.goto(task.target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.taskId = null;
    this.loginPage = null;
    this.loginContext = null;
    this.invalidateAuthentication();
  }
  active(id) {
    return !!(
      this.browser?.isConnected() &&
      this.taskId === id &&
      this.loginPage &&
      !this.loginPage.isClosed()
    );
  }
  loginStatus(id) {
    if (this.taskId !== id || !this.browser?.isConnected()) return 'BROWSER_CLOSED';
    if (!this.active(id)) return 'PAGE_CLOSED';
    if (this.authenticated) return 'VERIFIED';
    return this.loginWaitReason || 'CHECKING';
  }
  async requireLoginSurface(task) {
    if (!this.active(task.id)) fail('BROWSER_REQUIRED', 409);
    if (new URL(this.loginPage.url()).origin !== new URL(task.target).origin)
      fail('OUTSIDE_TARGET_ORIGIN');
    if (await hasLoginChallenge(this.loginPage)) fail('LOGIN_NOT_FINISHED', 409);
  }
  async loginEvidence(task) {
    await this.requireLoginSurface(task);
    const page = this.loginPage,
      url = page.url();
    const shot = await snapshot(page, { adapterSource: this.adapterSource });
    const markers = [];
    for (const control of shot.controls) {
      if (markers.length >= 40) break;
      if (await eligibleLoginMarker(page, control.locator))
        markers.push({ name: control.name, role: control.role, locator: control.locator });
    }
    await this.requireLoginSurface(task);
    if (this.loginPage !== page || page.url() !== url) fail('LOGIN_CONFIRMATION_STALE', 409);
    if (!markers.length) fail('LOGIN_EVIDENCE_REQUIRED', 409);
    const token = uid();
    this.loginTicket = { token, page, url, taskId: task.id, expires: Date.now() + 120000, markers };
    return { token, markers: markers.map(({ name, role }) => ({ name, role })) };
  }
  async confirmLoginEvidence(task, token, index) {
    const ticket = this.loginTicket;
    this.loginTicket = null;
    if (
      !ticket ||
      ticket.token !== token ||
      ticket.taskId !== task.id ||
      ticket.page !== this.loginPage ||
      ticket.url !== this.loginPage?.url() ||
      ticket.expires < Date.now() ||
      !Number.isInteger(index) ||
      !ticket.markers[index]
    )
      fail('LOGIN_CONFIRMATION_STALE', 409);
    const marker = ticket.markers[index].locator;
    await this.authenticate(task, marker);
    return marker;
  }
  async snapshot() {
    if (!this.loginPage || this.loginPage.isClosed()) fail('BROWSER_REQUIRED', 409);
    return snapshot(this.loginPage, { marker: this.marker, adapterSource: this.adapterSource });
  }
  async authenticate(task, marker) {
    if (!this.active(task.id)) fail('BROWSER_REQUIRED', 409);
    validateLocator(marker);
    if (marker.kind === 'case_named') fail('CASE_NAMED_ACTION_FORBIDDEN');
    const page = this.loginPage,
      context = this.loginContext,
      url = page.url();
    await this.requireLoginSurface(task);
    await assertUnique(page, marker);
    if (!(await eligibleLoginMarker(page, marker))) fail('LOGIN_EVIDENCE_REQUIRED', 409);
    const storage = await context.storageState();
    const sessionStorageValues = await page.evaluate(() =>
      Object.fromEntries(Object.entries(sessionStorage)),
    );
    // Do not publish a verified session if the page changed during asynchronous capture.
    await this.requireLoginSurface(task);
    if (!(await eligibleLoginMarker(page, marker))) fail('LOGIN_CONFIRMATION_STALE', 409);
    if (this.loginPage !== page || this.loginContext !== context || page.url() !== url)
      fail('LOGIN_CONFIRMATION_STALE', 409);
    this.marker = marker;
    this.storage = storage;
    this.sessionStorage = sessionStorageValues;
    this.authenticated = true;
    this.authEvidence = {
      source: 'OPERATOR_CONFIRMED_MARKER',
      same_origin: true,
      login_challenge_absent: true,
    };
  }
  async waitForAuthentication(task, { signal, timeoutMs = 600000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let stable = null,
      repeats = 0,
      recoveries = 0;
    while (Date.now() < deadline) {
      if (signal?.aborted) fail('STOPPED');
      if (!this.active(task.id)) {
        if (this.taskId !== task.id || !this.browser?.isConnected() || recoveries >= 1)
          fail('BROWSER_REQUIRED');
        recoveries++;
        await this.open(task);
        if (signal?.aborted) fail('STOPPED');
        stable = null;
        repeats = 0;
      }
      if (this.loginConfirmationPending) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      if (new URL(this.loginPage.url()).origin !== new URL(task.target).origin) {
        this.loginWaitReason = 'OUTSIDE_TARGET_ORIGIN';
        stable = null;
        repeats = 0;
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      try {
        const login = await hasLoginChallenge(this.loginPage);
        this.loginWaitReason = login ? 'LOGIN_CHALLENGE' : 'EVIDENCE_REQUIRED';
        if (!login) {
          // An explicit operator confirmation continues this preparation, never a second job.
          if (
            this.authenticated &&
            this.marker &&
            (await eligibleLoginMarker(this.loginPage, this.marker))
          )
            return this.marker;
          // Inspect visible labels only, never credentials or storage.
          const candidates = await this.loginPage.evaluate(() => {
            const visible = (e) =>
              !!e.getClientRects().length &&
              getComputedStyle(e).visibility !== 'hidden' &&
              !e.closest('[aria-hidden="true"],[inert]');
            const name = (e) => {
              const labelled = (e.getAttribute('aria-labelledby') || '')
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent || '')
                .join(' ')
                .trim();
              const clone = e.cloneNode(true);
              clone
                .querySelectorAll('[aria-hidden="true"],[hidden],[inert]')
                .forEach((n) => n.remove());
              return (labelled || e.getAttribute('aria-label') || clone.textContent || '')
                .replace(/\s+/g, ' ')
                .trim();
            };
            const logout = [...document.querySelectorAll('a,button,[role="menuitem"]')].some(
              (e) =>
                visible(e) && /^(?:退出登录|注销登录|登出|log\s?out|sign\s?out)$/i.test(name(e)),
            );
            const labels = [
              ...document.querySelectorAll(
                'nav a,aside a,nav button,aside button,[role="menuitem"],nav span,aside span',
              ),
            ]
              .filter(
                (e) =>
                  visible(e) &&
                  (e.tagName !== 'SPAN' ||
                    (!e.children.length && !e.closest('a,button,[role="menuitem"]'))),
              )
              .map((e) => ({
                name: name(e),
                role: e.getAttribute('role') || { A: 'link', BUTTON: 'button' }[e.tagName],
              }))
              .filter(
                (v) =>
                  v.name &&
                  v.name.length < 100 &&
                  /[\p{L}\p{N}]/u.test(v.name) &&
                  !/登录|注册|login|sign.?in|logout|登出/i.test(v.name),
              );
            return { logout, labels: labels.slice(0, 20) };
          });
          let marker = null;
          if (task.auth_marker && (await visibleUnique(this.loginPage, task.auth_marker))) {
            const anchor = handoffLocator(this.loginPage, task.auth_marker);
            if (
              await anchor.evaluate(
                (e) =>
                  !['HTML', 'BODY', 'INPUT', 'FORM', 'MAIN', 'NAV', 'ASIDE'].includes(e.tagName) &&
                  !e.matches('#root,#app,#htmlRoot,[role="main"],[role="navigation"]') &&
                  !!(e.innerText || '').trim() &&
                  (e.innerText || '').length < 150 &&
                  e.children.length < 10,
              )
            )
              marker = task.auth_marker;
          }
          if (!marker && candidates.logout && candidates.labels.length >= 2) {
            for (const label of candidates.labels) {
              const candidate = label.role
                ? { kind: 'role', role: label.role, name: label.name, exact: true }
                : { kind: 'text', value: label.name, exact: true };
              if (await visibleUnique(this.loginPage, candidate)) {
                marker = candidate;
                break;
              }
            }
          }
          const next = marker ? JSON.stringify({ url: this.loginPage.url(), marker }) : null;
          repeats = next && next === stable ? repeats + 1 : 0;
          stable = next;
          if (marker && repeats >= 2) {
            if (signal?.aborted) fail('STOPPED');
            if (await hasLoginChallenge(this.loginPage)) {
              stable = null;
              repeats = 0;
              continue;
            }
            await this.authenticate(task, marker);
            this.authEvidence = {
              source:
                task.auth_marker && JSON.stringify(marker) === JSON.stringify(task.auth_marker)
                  ? 'REVALIDATED_OPERATOR_MARKER'
                  : 'VISIBLE_LOGOUT_AND_NAVIGATION',
              stable_samples: repeats + 1,
              same_origin: true,
              login_challenge_absent: true,
            };
            return marker;
          }
        } else {
          stable = null;
          repeats = 0;
        }
      } catch (error) {
        if (error.code === 'STOPPED') throw error;
        stable = null;
        repeats = 0;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    fail('LOGIN_EVIDENCE_REQUIRED', 409);
  }
  async context(task, { recordVideo, guard } = {}) {
    const context = await this.browser.newContext({
      viewport: { width: 1360, height: 900 },
      storageState: this.storage ?? undefined,
      recordVideo,
      serviceWorkers: 'block',
    });
    if (this.sessionStorage)
      await context.addInitScript(
        ({ origin, values }) => {
          if (location.origin === origin)
            for (const [k, v] of Object.entries(values)) sessionStorage.setItem(k, v);
        },
        { origin: new URL(task.target).origin, values: this.sessionStorage },
      );
    const origin = new URL(task.target).origin;
    await context.route('**/*', async (route) => {
      const req = route.request();
      let url;
      try {
        url = new URL(req.url());
      } catch {
        return route.abort();
      }
      if (req.isNavigationRequest() && url.origin !== origin) {
        guard && (guard.blocked = 'OUTSIDE_TARGET_ORIGIN');
        return route.abort();
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
        const readOnly = task.authorization.readOnlyEndpoints.some(
          (e) => e.method === req.method() && e.path === url.pathname && url.origin === origin,
        );
        if (!readOnly) {
          if (!guard?.allowWrites || url.origin !== origin) {
            guard && (guard.blocked = 'WRITE_NOT_AUTHORIZED');
            return route.abort();
          }
          guard.dirty = true;
        }
      }
      return route.continue();
    });
    if (typeof context.routeWebSocket === 'function')
      await context.routeWebSocket('**/*', (socket) => socket.close());
    return context;
  }
  async execute(
    task,
    c,
    plan,
    runDirectory,
    {
      signal,
      onEvent = () => {},
      onRepair,
      onAdaptive,
      run_scope_id,
      approved_plan_hash,
      runtimeBinding = false,
    } = {},
  ) {
    const result = {
      schema_version: 'ui-agent-facts/v2',
      id: path.basename(runDirectory),
      case_id: c.case_id,
      case_hash: caseHash(c),
      plan_hash: planHash(plan),
      approved_plan_hash: approved_plan_hash ?? planHash(plan),
      run_scope_id,
      executed_case: structuredClone(c),
      executed_plan: structuredClone(plan),
      started_at: now(),
      finished_at: null,
      status: 'RUNNING',
      business_status: 'NOT_EXECUTED',
      cleanup_status: 'NOT_REQUIRED',
      evidence_status: 'COMPLETE',
      preconditions: [],
      actions: [],
      assertions: [],
      repairs: [],
      ...(isAdaptivePlan(plan)
        ? {
            adaptive_segments: [],
            adaptive_steps: [],
            regression_ready: false,
            approved_contract: structuredClone(plan),
            checkpoints: [],
          }
        : {}),
      ...(isIntentPlan(plan) ? { bindings: [], regression_ready: false } : {}),
      ...(plan.schema_version === CHECKPOINT_PLAN_VERSION || isIntentPlan(plan)
        ? {
            checkpoints: plan.steps.flatMap((step) =>
              step.checkpoints.map((point) => ({
                step_id: step.step_id,
                checkpoint_id: point.checkpoint_id,
                status: 'NOT_EXECUTED',
                assertion_count: point.assertions.length,
              })),
            ),
          }
        : {}),
      cleanup_actions: [],
      media: [],
      baseline_sha256: task.baseline_sha256,
      fixture: task.fixture === true,
    };
    await fs.mkdir(runDirectory, { recursive: true });
    let context,
      page,
      recording,
      guard = { allowWrites: false, dirty: false, blocked: null };
    let phase = 'PREFLIGHT';
    const emit = async (type, detail) => {
      try {
        return await onEvent({ type, case_id: c.case_id, ...detail });
      } catch (error) {
        error.execution_phase = 'EVIDENCE';
        throw error;
      }
    };
    try {
      if (isIntentPlan(plan) || isAdaptivePlan(plan)) {
        validatePlan(plan, c, task.target, { runtimeBinding });
        if (approved_plan_hash !== planHash(plan)) fail('PLAN_APPROVAL_REQUIRED');
      }
      if (
        plan.schema_version === CHECKPOINT_PLAN_VERSION ||
        plan.steps?.some((s) =>
          [...stepActions(s), ...stepAssertions(s)].some(
            (a) =>
              a?.op === 'dismiss_optional' ||
              ['case_named', 'runtime_intent'].includes(a?.target?.kind),
          ),
        )
      )
        validatePlan(plan, c, task.target, { runtimeBinding });
      if (
        ![
          'ui-agent-plan/v2',
          CHECKPOINT_PLAN_VERSION,
          INTENT_PLAN_VERSION,
          ADAPTIVE_PLAN_VERSION,
        ].includes(plan.schema_version)
      )
        fail('PLAN_BASELINE_MISMATCH');
      if (!this.active(task.id) || !this.authenticated) fail('AUTH_REQUIRED', 409);
      const check = await this.context(task, { guard });
      try {
        const pre = await check.newPage();
        await pre.goto(task.target, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (!(await poll(() => visibleUnique(pre, this.marker), 8000))) {
          if (await isLoginPage(pre, this.marker)) {
            this.authenticated = false;
            fail('AUTH_REQUIRED');
          }
          fail('SESSION_UNVERIFIED');
        }
        if (signal?.aborted) fail('STOPPED');
        await pre.goto(relativeURL(plan.entry_path, task.target), {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        for (const condition of plan.preconditions) {
          const observation = await checkAssertion(pre, condition);
          result.preconditions.push({ stage: 'PREFLIGHT', ...observation });
          if (!observation.passed) {
            result.precondition = observation;
            fail('PRECONDITION_FAILED');
          }
        }
        if (guard.blocked) fail(guard.blocked);
        this.storage = await check.storageState();
        this.sessionStorage = await pre.evaluate(() =>
          Object.fromEntries(Object.entries(sessionStorage)),
        );
      } finally {
        await check.close();
      }
      guard = {
        allowWrites: plan.data_effect === 'mutation' && task.authorization.writes,
        dirty: false,
        blocked: null,
      };
      context = await this.context(task, {
        recordVideo: { dir: runDirectory, size: { width: 1360, height: 900 } },
        guard,
      });
      page = await context.newPage();
      recording = new RecordingEvidence(page, c, result);
      await recording.install();
      page.setDefaultTimeout(8000);
      page.on('dialog', (dialog) => {
        guard.blocked = 'NATIVE_DIALOG_UNSUPPORTED';
        dialog.dismiss().catch(() => {});
      });
      await page.goto(relativeURL(plan.entry_path, task.target), {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      for (const condition of plan.preconditions) {
        const observation = await checkAssertion(page, condition);
        result.preconditions.push({ stage: 'BEFORE_ACTIONS', ...observation });
        if (!observation.passed) {
          result.precondition = observation;
          fail('PRECONDITION_FAILED');
        }
      }
      for (const [stepIndex, step] of plan.steps.entries()) {
        const execute = isAdaptivePlan(plan)
          ? (run) => executeAdaptiveStep(this, run)
          : (run) => this.executeStep(run);
        await execute({
          task,
          c,
          plan,
          step,
          stepIndex,
          result,
          page,
          recording,
          guard,
          signal,
          emit,
          onRepair,
          onAdaptive,
          runDirectory,
          setPhase: (value) => {
            phase = value;
          },
        });
      }
      if (isAdaptivePlan(plan) && result.adaptive_steps.length !== c.steps.length)
        fail('ADAPTIVE_COVERAGE_INCOMPLETE');
      result.status = 'PASS_ASSERTIONS';
      result.business_status = 'ASSERTIONS_PASSED';
    } catch (error) {
      const code =
        guard.blocked ??
        error.code ??
        (error.name === 'TimeoutError' ? 'LOCATOR_TIMEOUT' : 'BROWSER_OPERATION_FAILED');
      result.error = code;
      result.error_phase = error.execution_phase ?? phase;
      if (result.error_phase === 'EVIDENCE') result.evidence_status = 'PARTIAL';
      result.status =
        code === 'BUSINESS_ASSERTION_FAILED'
          ? 'FAIL_ASSERTION'
          : code === 'AUTH_REQUIRED'
            ? 'AUTH_REQUIRED'
            : code === 'SESSION_UNVERIFIED'
              ? 'SESSION_UNVERIFIED'
              : code === 'PRECONDITION_FAILED'
                ? 'BLOCKED_DATA'
                : code === 'STOPPED'
                  ? 'STOPPED'
                  : code === 'WRITE_NOT_AUTHORIZED'
                    ? 'BLOCKED_WRITE'
                    : 'TECHNICAL_FAILED';
      result.business_status =
        code === 'BUSINESS_ASSERTION_FAILED'
          ? 'ASSERTION_MISMATCH'
          : (
                plan.schema_version === CHECKPOINT_PLAN_VERSION
                  ? result.actions.some((action) => action.dispatched)
                  : result.actions.length
              )
            ? 'PARTIAL'
            : 'NOT_EXECUTED';
      if (page && !page.isClosed() && !(await hasPassword(page).catch(() => true))) {
        if (code !== 'BUSINESS_ASSERTION_FAILED')
          await recording?.failure(code, result.error_phase);
        try {
          result.failure_snapshot = await snapshot(page, { marker: this.marker });
        } catch {}
        try {
          await recording.screenshot({
            path: path.join(runDirectory, 'failure.png'),
            mask: [page.locator('input[type=password]')],
          });
          result.media.push({
            file: 'failure.png',
            sha256: hash(await fs.readFile(path.join(runDirectory, 'failure.png'))),
          });
        } catch {}
      }
    } finally {
      result.dirty = guard.dirty;
      if (guard.dirty) {
        result.cleanup_status = 'PENDING';
        if (plan.cleanup && context && page && !page.isClosed())
          try {
            await emit('CLEANUP_STARTED', {});
            await recording?.beginCleanup();
            guard.blocked = null;
            guard.allowWrites = false;
            if (plan.cleanup.observation_path !== undefined) {
              await recoverCleanupObservation({
                page,
                plan,
                task,
                guard,
                result,
                emit,
                marker: this.marker,
              });
            }
            guard.allowWrites = task.authorization.writes;
            const alreadyClean = await checkAssertionGroup(page, plan.cleanup.assertions, {
              timeout: 100,
            });
            result.cleanup_initial_observations = alreadyClean;
            if (alreadyClean.some((o) => !o.passed)) {
              if (!plan.cleanup.ownership?.length) fail('CLEANUP_OWNERSHIP_REQUIRED');
              result.cleanup_ownership = await checkAssertionGroup(page, plan.cleanup.ownership, {
                timeout: 2000,
              });
              await emit('CLEANUP_OWNERSHIP_OBSERVED', { observations: result.cleanup_ownership });
              if (result.cleanup_ownership.some((o) => !o.passed))
                fail('CLEANUP_OWNERSHIP_UNVERIFIED');
              for (const a of plan.cleanup.actions) {
                const target = await resolveAction(page, a),
                  event = {
                    at: now(),
                    action_id: a.action_id,
                    operation: a.op,
                    target: a.target ?? null,
                  };
                try {
                  await recording?.beforeAction(a, target);
                  await emit('CLEANUP_ACTION_STARTED', event);
                  const receipt = { ...event, status: 'UNKNOWN', dispatched: true };
                  result.cleanup_actions.push(receipt);
                  await dispatchAction(page, a, task.target, target);
                  receipt.status = 'EXECUTED';
                } finally {
                  await disposeActionTarget(target);
                }
                await emit('CLEANUP_ACTION_EXECUTED', event);
              }
            }
            if (guard.blocked) fail(guard.blocked);
            result.cleanup_observations = await checkAssertionGroup(page, plan.cleanup.assertions);
            await recording?.observed(result.cleanup_observations, { cleanup: true });
            if (result.cleanup_observations.some((o) => !o.passed))
              fail('CLEANUP_ASSERTION_FAILED');
            result.cleanup_status = 'CLEAN';
            await emit('CLEANUP_FINISHED', {});
          } catch (e) {
            result.cleanup_status = 'FAILED';
            result.cleanup_error = e.code ?? 'CLEANUP_OPERATION_FAILED';
            await recording?.failure(result.cleanup_error, 'CLEANUP');
            if (e.execution_phase === 'EVIDENCE') result.evidence_status = 'PARTIAL';
          }
        else result.cleanup_status = 'FAILED';
        if (result.cleanup_status !== 'CLEAN') result.status = 'CLEANUP_REQUIRED';
      }
      if (context) {
        try {
          this.storage = await context.storageState();
          if (
            page &&
            !page.isClosed() &&
            new URL(page.url()).origin === new URL(task.target).origin
          )
            this.sessionStorage = await page.evaluate(() =>
              Object.fromEntries(Object.entries(sessionStorage)),
            );
        } catch {}
        const video = page?.video();
        await context.close().catch(() => {});
        if (video) {
          try {
            const videoPath = await video.path();
            const bytes = await fs.readFile(videoPath);
            if (bytes.length)
              result.media.push({
                file: path.basename(videoPath),
                sha256: hash(bytes),
                type: 'video',
              });
          } catch {
            result.media_warning = 'VIDEO_UNAVAILABLE';
            result.evidence_status = 'PARTIAL';
          }
        }
      }
      result.finished_at = now();
      result.semantic_acceptance = 'PENDING_REVIEW';
    }
    return result;
  }
  async executeStep(run) {
    const { step, stepIndex, result, recording, page, emit, setPhase, signal, runDirectory } = run;
    if (!run.segment) await recording.beginStep(step, stepIndex);
    const budget = run.budget ?? new StepBudget(step.timeout_ms);
    if (
      run.tableBaselines ||
      stepCheckpoints(step).some((point) =>
        point.assertions?.some((a) => a.check === 'table_unchanged'),
      )
    )
      frozenTableAssertions(run);
    if (!run.segment)
      await emit('STEP_STARTED', { step_id: step.step_id, action: step.source_action });
    for (const [pointIndex, point] of stepCheckpoints(step).entries()) {
      const detail = {
        step_id: step.step_id,
        ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
      };
      const receipt = result.checkpoints?.find(
        (item) => item.checkpoint_id === point.checkpoint_id,
      );
      // Measurements stay immediately after each action. Their human-readable
      // captions must not consume the final action-to-assertion window.
      const invariantPresentations = [];
      const presentInvariants = async () => {
        for (const observations of invariantPresentations.splice(0)) {
          try {
            await recording.observed(observations);
          } catch {
            result.evidence_status = 'PARTIAL';
            result.media_warning = 'RECORDING_CUE_UNAVAILABLE';
          }
        }
      };
      try {
        setPhase('STEP_BUDGET');
        budget.remaining();
        if (receipt) {
          Object.assign(receipt, { status: 'RUNNING', started_at: now() });
          await recording.beginCheckpoint(point, pointIndex, step.checkpoints.length);
          await emit('CHECKPOINT_STARTED', detail);
        }
        const lastActionAt = await this.executeActions({
          ...run,
          point,
          budget,
          invariantPresentations,
        });
        setPhase('ASSERTION');
        if (signal?.aborted) fail('STOPPED');
        budget.remaining();
        const deadline = budget.observationDeadline(lastActionAt, point.within_ms);
        if (isIntentPlan(run.plan))
          for (const [index, assertion] of point.assertions.entries())
            await this.recordBinding(
              run,
              assertion.target,
              { ...detail, assertion_index: index },
              deadline,
            );
        const observations = await checkAssertionGroup(page, point.assertions, {
          timeout: point.within_ms,
          deadline,
          signal,
          tableBaselines: run.tableBaselines,
          tableContext: { run_id: result.id, step_id: step.step_id },
        });
        const observedURL = page.url();
        if (receipt)
          Object.assign(receipt, {
            url: observedURL,
            observed_at: observations[0]?.at,
            status: observations.every((item) => item.passed && item.window_observed)
              ? 'ASSERTIONS_PASSED'
              : 'FAIL_ASSERTION',
          });
        for (const observation of observations) {
          result.assertions.push({
            ...detail,
            ...(receipt ? { url: observedURL } : {}),
            ...observation,
          });
          await emit('ASSERTION_OBSERVED', { ...detail, ...observation });
        }
        // Observe before holding a video caption. Evidence cannot extend a deadline.
        await presentInvariants();
        await recording.observed(observations);
        if (observations.some((item) => !item.window_observed)) fail('ASSERTION_OBSERVATION_LATE');
        if (observations.some((item) => !item.passed)) fail('BUSINESS_ASSERTION_FAILED');
        setPhase('EVIDENCE');
        const filename = `step-${result.media.length + 1}.png`;
        await recording.screenshot({
          path: path.join(runDirectory, filename),
          mask: [page.locator('input[type=password]')],
        });
        result.media.push({
          file: filename,
          sha256: hash(await fs.readFile(path.join(runDirectory, filename))),
          ...detail,
        });
        if (receipt) {
          receipt.finished_at = now();
          await emit('CHECKPOINT_FINISHED', { ...detail, status: receipt.status });
        }
      } catch (error) {
        // A failed guard stops actions immediately; its already persisted
        // measurement is still shown, without replacing the original error.
        await presentInvariants();
        if (receipt) {
          receipt.status =
            error.code === 'BUSINESS_ASSERTION_FAILED' ? 'FAIL_ASSERTION' : 'TECHNICAL_FAILED';
          receipt.error = error.code ?? error.name;
          receipt.finished_at = now();
        }
        throw error;
      }
    }
    if (!run.segment) await emit('STEP_FINISHED', { step_id: step.step_id });
  }

  async recordBinding(run, intent, detail, deadline) {
    const { result, page, emit, signal } = run;
    await emit('RUNTIME_BINDING_STARTED', detail);
    const receipt = await bindingReceipt(
      page,
      intent,
      {
        ...detail,
        run_id: result.id,
        approved_plan_hash: result.approved_plan_hash,
        case_hash: result.case_hash,
      },
      { deadline, signal },
    );
    result.bindings.push(receipt);
    await emit(
      receipt.status === 'VERIFIED' ? 'RUNTIME_BINDING_VERIFIED' : 'RUNTIME_BINDING_REJECTED',
      receipt,
    );
    if (receipt.status !== 'VERIFIED') fail(receipt.code);
  }

  async executeActions(run) {
    const {
      task,
      plan,
      step,
      point,
      budget,
      result,
      page,
      recording,
      guard,
      signal,
      emit,
      onRepair,
      setPhase,
    } = run;
    let lastActionCompletedAt = Date.now();
    if (run.tableBaselines || point.assertions?.some((a) => a.check === 'table_unchanged'))
      frozenTableAssertions(run);
    let repairCalls = result.repair_requests ?? 0;
    for (const approvedAction of point.actions) {
      if (approvedAction.op === 'dismiss_optional') {
        lastActionCompletedAt = await this.executeOptionalDialog(run, approvedAction);
        if (run.tableBaselines && result.actions.at(-1)?.dispatched)
          await this.checkFrozenTables(run, approvedAction.action_id);
        continue;
      }
      let a = structuredClone(approvedAction),
        target;
      let lastObservationHash;
      while (true) {
        if (signal?.aborted) fail('STOPPED');
        if (guard.blocked) fail(guard.blocked);
        if (await isLoginPage(page, this.marker)) {
          this.authenticated = false;
          fail('AUTH_REQUIRED');
        }
        setPhase('RESOLVE');
        await emit('ACTION_RESOLVING', {
          step_id: step.step_id,
          ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
          action_id: a.action_id,
          operation: a.op,
          target: a.target ?? null,
        });
        try {
          if (isIntentPlan(plan))
            await this.recordBinding(
              run,
              a.target,
              { step_id: step.step_id, checkpoint_id: point.checkpoint_id, action_id: a.action_id },
              Math.min(budget.deadline, Date.now() + 8000),
            );
          target = await resolveAction(
            page,
            a,
            plan.execution_policy ? Math.min(8000, budget.remaining()) : budget.remaining(),
            {
              runtimeBinding: isIntentPlan(plan),
            },
          );
          break;
        } catch (error) {
          const failure = {
            action_id: a.action_id,
            code: error.code,
            phase: 'RESOLVE',
            dispatched: false,
            current_target: a.target,
          };
          const mayObserve = canObserveAgain(plan, failure, repairCalls, guard.dirty);
          const eligible =
            ['LOCATOR_NOT_VISIBLE', 'LOCATOR_NOT_UNIQUE'].includes(error.code) &&
            (a.repair_anchor || mayObserve) &&
            plan.data_effect === 'read_only' &&
            !guard.dirty &&
            repairCalls < 2 &&
            onRepair &&
            !signal?.aborted;
          if (!eligible) {
            result.actions.push({
              at: now(),
              step_id: step.step_id,
              ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
              action_id: a.action_id,
              operation: a.op,
              target: a.target,
              status: 'FAILED',
              phase: 'RESOLVE',
              dispatched: false,
              error: error.code,
            });
            throw error;
          }
          repairCalls++;
          result.repair_requests = repairCalls;
          await emit('LOCATOR_REPAIR_REQUESTED', {
            step_id: step.step_id,
            ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
            action_id: a.action_id,
            code: error.code,
            repair_number: repairCalls,
          });
          setPhase('REPAIR');
          budget.remaining();
          const observation = await snapshot(page, { marker: this.marker });
          const observationHash = semanticHash({
            url: observation.url,
            controls: observation.controls,
            text: observation.text,
          });
          if (plan.execution_policy && observationHash === lastObservationHash) {
            await emit('REACT_STOPPED', {
              action_id: a.action_id,
              code: 'REACT_NO_PROGRESS',
              message: '同一目标再次定位失败且观察没有变化，停止重复请求。',
            });
            fail('REACT_NO_PROGRESS');
          }
          lastObservationHash = observationHash;
          if (plan.execution_policy)
            await emit('REACT_OBSERVED', {
              action_id: a.action_id,
              step_id: step.step_id,
              observation_hash: observationHash,
              message: '已重新观察当前页面；只处理当前已批准动作，尚未派发。',
            });
          const proposal = await onRepair({
            ...failure,
            page: observation,
            repair_number: repairCalls,
            ...(plan.execution_policy
              ? {
                  allowed_tools: [
                    ...(mayObserve ? ['observe'] : []),
                    ...(a.repair_anchor ? ['patch'] : []),
                    'stop',
                  ],
                }
              : {}),
          });
          if (signal?.aborted) fail('STOPPED');
          if (guard.blocked) fail(guard.blocked);
          budget.remaining();
          if (proposal?.observe !== undefined) {
            validateObserveDecision(proposal, { allowed_tools: mayObserve ? ['observe'] : [] });
            (result.react_observations ??= []).push({
              action_id: a.action_id,
              observation_hash: observationHash,
              at: now(),
              decision: 'observe',
            });
            await emit('REACT_REOBSERVING', {
              action_id: a.action_id,
              message: '重新核验原目标；不点击其他控件，不修改原计划或预期。',
            });
            continue;
          }
          if (!proposal) {
            result.actions.push({
              at: now(),
              step_id: step.step_id,
              ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
              action_id: a.action_id,
              operation: a.op,
              target: a.target,
              status: 'FAILED',
              phase: 'RESOLVE',
              dispatched: false,
              error: error.code,
            });
            throw error;
          }
          // A validated patch must also refer to the same unique approved DOM anchor.
          const repairedTarget = await assertUnique(page, proposal.target, budget.remaining()),
            anchor = await assertUnique(page, approvedAction.repair_anchor, budget.remaining());
          if (!(await sameElement(repairedTarget, anchor))) fail('REPAIR_TARGET_IDENTITY_MISMATCH');
          result.repairs.push({
            at: now(),
            action_id: a.action_id,
            previous_target: a.target,
            target: proposal.target,
            repair_number: repairCalls,
          });
          a = proposal;
          Object.assign(
            stepActions(result.executed_plan.steps.find((s) => s.step_id === step.step_id)).find(
              (action) => action.action_id === a.action_id,
            ),
            structuredClone(a),
          );
          result.plan_hash = planHash(result.executed_plan);
          await emit('LOCATOR_REPAIR_ACCEPTED', {
            step_id: step.step_id,
            ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
            action_id: a.action_id,
            target: a.target,
            repair_number: repairCalls,
          });
        }
      }
      try {
        if (signal?.aborted) fail('STOPPED');
        budget.remaining();
        await recording.beforeAction(a, target);
        // One pre-dispatch refresh only. Once intent is persisted, a changed target
        // fails closed and is not replayed, including an unknown dispatch result.
        if (isIntentPlan(plan)) {
          try {
            await assertRowIdentity(page, a.target, target);
          } catch (error) {
            if (error.code !== 'BINDING_STALE') throw error;
            await disposeActionTarget(target);
            await this.recordBinding(
              run,
              a.target,
              {
                step_id: step.step_id,
                checkpoint_id: point.checkpoint_id,
                action_id: a.action_id,
                refresh: 1,
              },
              Math.min(budget.deadline, Date.now() + 8000),
            );
            target = await resolveAction(page, a, budget.remaining(), { runtimeBinding: true });
          }
        }
        if (signal?.aborted) fail('STOPPED');
        budget.remaining();
        setPhase('INTENT');
        const event = {
          at: now(),
          step_id: step.step_id,
          ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
          action_id: a.action_id,
          operation: a.op,
          target: a.target ?? null,
          value: a.value === undefined ? null : redact(a.value),
        };
        // Persist the intent before dispatch. Failure here never authorizes a browser retry.
        await emit('ACTION_STARTED', event);
        if (isIntentPlan(plan)) {
          try {
            await assertRowIdentity(page, a.target, target);
          } catch (error) {
            result.actions.push({
              ...event,
              status: 'FAILED',
              phase: 'RESOLVE',
              dispatched: false,
              error: error.code,
            });
            throw error;
          }
        }
        if (isAdaptivePlan(plan)) {
          try {
            // Audit/persistence can yield while DOM changes. Validate the exact handle
            // that is about to be dispatched, not the earlier locator observation.
            await assertAdaptiveActionTarget(target, a, step.source_action, step.source_expected);
          } catch (error) {
            result.actions.push({
              ...event,
              status: 'FAILED',
              phase: 'RESOLVE',
              dispatched: false,
              error: error.code,
            });
            throw error;
          }
        }
        const receipt = { ...event, status: 'UNKNOWN', phase: 'DISPATCH', dispatched: true };
        result.actions.push(receipt);
        if (plan.data_effect === 'mutation' && !['wait', 'hover', 'navigate'].includes(a.op))
          guard.dirty = true;
        setPhase('DISPATCH');
        try {
          await dispatchAction(page, a, task.target, target, budget.remaining(20000));
          lastActionCompletedAt = Date.now();
          receipt.completed_at = new Date(lastActionCompletedAt).toISOString();
          receipt.status = 'EXECUTED';
        } catch (error) {
          receipt.error = error.code ?? error.name;
          throw error;
        }
        if (guard.blocked) fail(guard.blocked);
        if (new URL(page.url()).origin !== new URL(task.target).origin)
          fail('OUTSIDE_TARGET_ORIGIN');
        if (run.tableBaselines) await this.checkFrozenTables(run, a.action_id);
        await emit('ACTION_EXECUTED', event);
      } finally {
        await disposeActionTarget(target);
      }
    }

    return lastActionCompletedAt;
  }

  async checkFrozenTables(run, action_id) {
    const { page, result, step, point, budget, signal, emit, recording } = run;
    const assertions = frozenTableAssertions(run);
    const timeout = budget.remaining();
    const observations = await checkAssertionGroup(page, assertions, {
      timeout,
      deadline: Math.min(budget.deadline, Date.now() + timeout),
      signal,
      tableBaselines: run.tableBaselines,
      tableContext: { run_id: result.id, step_id: step.step_id },
    });
    for (const observation of observations) {
      const evidence = {
        ...observation,
        step_id: step.step_id,
        checkpoint_id: point.checkpoint_id,
        action_id,
        scope: 'sampled_after_each_action',
        message: observation.passed
          ? '表格与本步骤操作前一致。'
          : '表格与本步骤操作前不一致；已停止后续动作。',
      };
      (result.relational_observations ??= []).push(evidence);
      await emit('TABLE_INVARIANT_OBSERVED', evidence);
    }
    if (Array.isArray(run.invariantPresentations)) run.invariantPresentations.push(observations);
    else await recording.observed(observations);
    if (observations.some((item) => !item.window_observed)) fail('ASSERTION_OBSERVATION_LATE');
    if (observations.some((item) => !item.passed)) fail('BUSINESS_ASSERTION_FAILED');
  }

  async executeOptionalDialog(run, action) {
    const { page, step, point, result, budget, recording, signal, guard, emit, setPhase } = run;
    const receipt = {
      at: now(),
      step_id: step.step_id,
      ...(point.checkpoint_id ? { checkpoint_id: point.checkpoint_id } : {}),
      action_id: action.action_id,
      operation: action.op,
      target: action.target,
      value: action.value,
      status: 'FAILED',
      phase: 'CONDITION',
      dispatched: false,
    };
    result.actions.push(receipt);
    let binding;
    try {
      if (signal?.aborted) fail('STOPPED');
      if (await isLoginPage(page, this.marker)) fail('AUTH_REQUIRED');
      setPhase('RESOLVE');
      binding = await resolveOptionalDialog(page, action, {
        timeout: budget.remaining(800),
        signal,
      });
      budget.remaining();
      receipt.condition = {
        branch: binding.absent ? 'ABSENT' : 'PRESENT',
        samples: binding.observed,
        observed_at: now(),
        scope: 'current_named_dialog_only',
      };
      await emit('OPTIONAL_DIALOG_OBSERVED', { ...receipt });
      if (binding.absent) {
        receipt.status = 'SKIPPED_NOT_PRESENT';
        receipt.completed_at = now();
        await emit('ACTION_SKIPPED', { ...receipt });
        return Date.now();
      }
      await recording.beforeAction(action, binding.target);
      if (signal?.aborted) fail('STOPPED');
      budget.remaining();
      await recheckOptionalDialog(page, binding);
      setPhase('INTENT');
      await emit('ACTION_STARTED', { ...receipt, status: 'STARTING' });
      if (signal?.aborted) fail('STOPPED');
      await recheckOptionalDialog(page, binding);
      Object.assign(receipt, { status: 'UNKNOWN', phase: 'DISPATCH', dispatched: true });
      setPhase('DISPATCH');
      await dispatchOptionalDialog(page, binding, budget.remaining(5000));
      if (guard.blocked) fail(guard.blocked);
      receipt.status = 'EXECUTED';
      receipt.completed_at = now();
      await emit('ACTION_EXECUTED', { ...receipt });
      return Date.now();
    } catch (error) {
      receipt.error = error.code ?? error.name;
      if (!receipt.dispatched) receipt.status = 'FAILED';
      throw error;
    } finally {
      await binding?.target?.dispose();
      await binding?.dialog?.dispose();
    }
  }
}

// The approved recovery route only prepares observation. It never grants writes.
async function recoverCleanupObservation({ page, plan, task, guard, result, emit, marker }) {
  const recovery = (result.cleanup_recovery = {
    path: plan.cleanup.observation_path,
    started_at: now(),
    status: 'RUNNING',
  });
  try {
    await emit('CLEANUP_OBSERVATION_STARTED', { path: recovery.path });
    await page.goto(relativeURL(recovery.path, task.target), {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    if (guard.blocked) fail(guard.blocked);
    if (new URL(page.url()).origin !== new URL(task.target).origin) fail('OUTSIDE_TARGET_ORIGIN');
    if (await isLoginPage(page, marker)) fail('AUTH_REQUIRED');
    recovery.status = 'OBSERVED';
    recovery.url = page.url();
    await emit('CLEANUP_OBSERVATION_FINISHED', { path: recovery.path, url: recovery.url });
  } catch (error) {
    recovery.status = 'FAILED';
    recovery.error = error.code ?? error.name;
    throw error;
  } finally {
    recovery.finished_at = now();
  }
}

async function hasPassword(page) {
  return (await page.locator('input[type=password]:visible').count()) > 0;
}
async function hasLoginChallenge(page) {
  return (
    (await isLoginPage(page)) ||
    (await page
      .locator(
        'input[autocomplete="one-time-code"]:visible,input[name*="otp" i]:visible,input[name*="captcha" i]:visible',
      )
      .count()) > 0
  );
}
async function eligibleLoginMarker(page, marker) {
  if (!marker || marker.kind === 'case_named' || !(await visibleUnique(page, marker))) return false;
  return handoffLocator(page, marker)
    .evaluate(
      (e) =>
        !['HTML', 'BODY', 'INPUT', 'TEXTAREA', 'SELECT', 'FORM', 'MAIN', 'NAV', 'ASIDE'].includes(
          e.tagName,
        ) &&
        !e.matches('#root,#app,#htmlRoot,[role="main"],[role="navigation"],[role="textbox"]') &&
        !e.closest('[aria-hidden="true"],[inert]') &&
        !!(e.innerText || '').trim() &&
        (e.innerText || '').length < 150 &&
        e.children.length < 10,
    )
    .catch(() => false);
}
async function isLoginPage(page, marker) {
  if (marker && (await visibleUnique(page, marker))) return false;
  return (
    (await hasPassword(page)) ||
    (await page.locator('form[action*="login"]:visible,form[action*="signin"]:visible').count()) > 0
  );
}
async function visibleUnique(page, l) {
  try {
    const x = handoffLocator(page, l);
    return (await x.count()) === 1 && (await x.isVisible());
  } catch {
    return false;
  }
}
export async function assertUnique(page, l, timeout = 8000, options) {
  validateLocator(l, options);
  const x = handoffLocator(page, l);
  if ((await x.count()) > 1) fail('LOCATOR_NOT_UNIQUE');
  try {
    await x.waitFor({ state: 'visible', timeout });
  } catch {
    fail('LOCATOR_NOT_VISIBLE');
  }
  if ((await x.count()) !== 1) fail('LOCATOR_NOT_UNIQUE');
  return x;
}
async function sameElement(first, second) {
  const handle = await second.elementHandle();
  try {
    return !!handle && (await first.evaluate((element, anchor) => element === anchor, handle));
  } finally {
    await handle?.dispose();
  }
}
async function resolveAction(page, a, timeout = 8000, options) {
  if (['navigate', 'reload', 'wait'].includes(a.op)) return null;
  const target = await assertUnique(page, a.target, timeout, options);
  // Dispatch this exact node. A live Locator could silently resolve to a replacement
  // object while the intent is being persisted.
  const handle = await target.elementHandle();
  if (!handle) fail('LOCATOR_NOT_VISIBLE');
  try {
    if (a.repair_anchor) {
      const anchor = await assertUnique(page, a.repair_anchor, timeout);
      if (!(await anchor.evaluate((element, expected) => element === expected, handle)))
        fail('ACTION_TARGET_IDENTITY_MISMATCH');
    }
    if (['fill', 'press'].includes(a.op) && (await handle.getAttribute('type')) === 'password')
      fail('SENSITIVE_CONTROL_FORBIDDEN');
    const guard =
      a.target?.kind === 'runtime_intent'
        ? await captureRuntimeGuard(page, a.target, handle)
        : a.target?.kind === 'case_named'
          ? await captureCaseNamedGuard(page, a.target, handle)
          : await captureWithinGuard(page, a.target, handle);
    if (guard) actionScopeGuards.set(handle, guard);
    return handle;
  } catch (error) {
    await handle.dispose();
    throw error;
  }
}
export async function perform(page, a, base) {
  const target = await resolveAction(page, a);
  try {
    return await dispatchAction(page, a, base, target);
  } finally {
    await disposeActionTarget(target);
  }
}
async function dispatchAction(page, a, base, target, timeout = 20000) {
  const guard = target && actionScopeGuards.get(target);
  const changed =
    a.target?.kind === 'runtime_intent'
      ? 'BINDING_STALE'
      : a.target?.kind === 'case_named'
        ? 'CASE_NAMED_CONTEXT_CHANGED'
        : 'WITHIN_SCOPE_CHANGED';
  try {
    if (guard && !(await guard.evaluate((state) => state.arm()))) fail(changed);
    await dispatchVerifiedAction(page, a, base, target, timeout);
    if (guard && (await guard.evaluate((state) => state.blocked()).catch(() => false)))
      fail(changed);
  } catch (error) {
    if (guard && (await guard.evaluate((state) => state.blocked()).catch(() => false)))
      fail(changed);
    throw error;
  } finally {
    if (guard) await guard.evaluate((state) => state.disarm()).catch(() => {});
  }
}
async function dispatchVerifiedAction(page, a, base, target, timeout = 20000) {
  const actionTimeout = Math.min(timeout, 8000);
  if (target) await assertRowIdentity(page, a.target, target);
  if (a.op === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded', timeout });
    return;
  }
  if (a.op === 'navigate') {
    await page.goto(relativeURL(a.value, base), { waitUntil: 'domcontentloaded', timeout });
    return;
  }
  if (a.op === 'wait') {
    const x = handoffLocator(page, a.target);
    // Scoped visible/hidden waits resolve repeatedly inside their one deadline;
    // an eager count could reject a brief loading-dialog replacement before waiting.
    if (
      (a.state === 'enabled' || !['within', 'row', 'cell'].includes(a.target?.kind)) &&
      (await x.count()) > 1
    )
      fail('LOCATOR_NOT_UNIQUE');
    if (a.state === 'enabled') {
      if (
        !(await poll(
          async () => (await x.count()) === 1 && (await x.isVisible()) && (await x.isEnabled()),
          actionTimeout,
        ))
      )
        fail('WAIT_FAILED');
    } else
      try {
        await x.waitFor({ state: a.state, timeout: actionTimeout });
      } catch {
        fail('WAIT_FAILED');
      }
    return;
  }
  switch (a.op) {
    case 'click':
      await target.click({ timeout: actionTimeout });
      break;
    case 'fill':
      await target.fill(a.value, { timeout: actionTimeout });
      break;
    case 'select':
      await target.selectOption({ label: a.value }, { timeout: actionTimeout });
      break;
    case 'press':
      await target.press(a.value, { timeout: actionTimeout });
      break;
    case 'check':
      await target.check({ timeout: actionTimeout });
      break;
    case 'uncheck':
      await target.uncheck({ timeout: actionTimeout });
      break;
    case 'hover':
      await target.hover({ timeout: actionTimeout });
      break;
    default:
      fail('ACTION_NOT_ALLOWED');
  }
}
export async function checkAssertion(page, a, options) {
  return (await checkAssertionGroup(page, [a], options))[0];
}
function redactMatrixEvidence(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactMatrixEvidence);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactMatrixEvidence(item)]),
    );
  return value;
}
export async function checkAssertionGroup(
  page,
  assertions,
  { timeout = 8000, deadline = Date.now() + timeout, signal, tableBaselines, tableContext } = {},
) {
  const hasInvariant = assertions.some((a) => a.check === 'table_unchanged');
  const oneShotOrder = assertions.some((a) => a.check === 'table_order');
  for (const a of assertions)
    if (a.check === 'table_unchanged')
      requireTableBaseline(tableBaselines, page, tableContext, a.target);
  const observerKey = '__ui_agent_observer_' + uid().replaceAll('-', '');
  const sample_id = uid();
  let sampled = null,
    last = null,
    timedOut = false,
    windowObserved = false;
  // A mutation epoch covers locator collection too, so count and node identities
  // cannot come from different DOM revisions. Predicate values are read in one JS turn.
  await page.evaluate((key) => {
    const state = { revision: 0 };
    state.observer = new MutationObserver(() => state.revision++);
    state.observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    window[key] = state;
  }, observerKey);
  try {
    if (hasInvariant) await installTableInvariantSampler(page, observerKey);
    do {
      if (signal?.aborted) fail('STOPPED');
      const revision = await page.evaluate((key) => window[key].revision, observerKey);
      const handles = [];
      try {
        for (const a of assertions)
          handles.push(await handoffLocator(page, a.target).elementHandles());
        sampled = await page.evaluate(
          ({ key, revision, assertions, handles }) => {
            if (
              !window[key] ||
              window[key].revision !== revision ||
              handles.some((rows) => rows.some((e) => !e.isConnected))
            )
              return null;
            const visible = (e) => {
              const style = getComputedStyle(e),
                rect = e.getBoundingClientRect();
              return (
                style.visibility !== 'hidden' &&
                style.visibility !== 'collapse' &&
                rect.width > 0 &&
                rect.height > 0
              );
            };
            return {
              at: new Date().toISOString(),
              fullURL: location.href,
              observations: assertions.map((a, i) => {
                const rows = handles[i],
                  count = rows.length,
                  e = rows[0];
                let actual = null,
                  passed = false,
                  error,
                  obstruction;
                if (a.check === 'table_unchanged') {
                  if (count !== 1) error = 'TABLE_BASELINE_TABLE_NOT_UNIQUE';
                  else {
                    const matrix = window[key].sampleTable(e);
                    if (matrix.error) error = matrix.error;
                    else actual = matrix;
                  }
                } else if (a.check === 'count') {
                  actual = count;
                  passed = count === a.expected;
                } else if (count > 1) error = 'LOCATOR_NOT_UNIQUE';
                else if (a.check === 'hidden') {
                  actual = count === 0 || !visible(e);
                  passed = actual;
                } else if (count === 0) actual = 'MISSING';
                else if (a.check === 'visible') {
                  actual = visible(e);
                  passed = actual;
                } else if (a.check === 'unobstructed') {
                  const r = e.getBoundingClientRect();
                  const left = Math.max(0, r.left),
                    right = Math.min(innerWidth, r.right),
                    top = Math.max(0, r.top),
                    bottom = Math.min(innerHeight, r.bottom);
                  const onscreen = visible(e) && right > left && bottom > top;
                  const modals = [
                    ...document.querySelectorAll('dialog[open],[aria-modal="true"]'),
                  ].filter(visible);
                  const modalBlocked = modals.some((m) => !m.contains(e));
                  const inert =
                    !!e.closest('[inert],[aria-disabled="true"]') || e.matches(':disabled');
                  let transparent = false;
                  for (let p = e; p; p = p.parentElement)
                    if (Number(getComputedStyle(p).opacity) === 0) transparent = true;
                  const positions = onscreen
                    ? [
                        [0.5, 0.5],
                        [0.2, 0.2],
                        [0.8, 0.2],
                        [0.2, 0.8],
                        [0.8, 0.8],
                      ]
                    : [];
                  const points = positions.map(([x, y]) => {
                    x = left + (right - left) * x;
                    y = top + (bottom - top) * y;
                    const hit = document.elementFromPoint(x, y);
                    return {
                      x: Math.round(x * 10) / 10,
                      y: Math.round(y * 10) / 10,
                      receives_events: !!hit && e.contains(hit),
                      hit_tag: hit?.tagName ?? null,
                    };
                  });
                  actual =
                    onscreen &&
                    !modalBlocked &&
                    !inert &&
                    !transparent &&
                    points.every((p) => p.receives_events);
                  passed = actual;
                  obstruction = {
                    scope: 'target_visible_viewport_five_points',
                    onscreen,
                    modal_blocked: modalBlocked,
                    inert_or_disabled: inert,
                    transparent,
                    points,
                  };
                } else if (!visible(e)) actual = 'HIDDEN';
                else if (a.check.startsWith('url_')) {
                  const url = location.href;
                  passed =
                    a.check === 'url_equals'
                      ? url === a.expected
                      : a.check === 'url_contains'
                        ? url.includes(a.expected)
                        : a.check === 'url_not_contains' && !url.includes(a.expected);
                  // Compare the actual address but never persist query/hash
                  // tokens. The visible target anchors this document sample.
                  actual = {
                    origin_path: location.origin + location.pathname,
                    scope: 'full_current_url',
                    matches: passed,
                    query_fragment_redacted: true,
                  };
                } else if (a.check === 'focused') {
                  actual = document.activeElement === e;
                  passed = actual === a.expected;
                } else if (a.check === 'has_class') {
                  actual = e.classList.contains(a.expected);
                  passed = actual;
                } else if (a.check === 'table_cells' || a.check === 'table_order') {
                  if (e.tagName !== 'TABLE') error = 'ASSERTION_TARGET_TYPE';
                  else {
                    const measurable = (node) =>
                      visible(node) && !node.closest('[hidden],[inert],[aria-hidden="true"]');
                    const headerRows = e.tHead
                      ? [...e.tHead.rows]
                      : [...e.rows].filter(
                          (r) => r.cells.length && [...r.cells].every((c) => c.tagName === 'TH'),
                        );
                    const bodyRows = [...e.tBodies]
                      .flatMap((b) => [...b.rows])
                      .filter((r) => !headerRows.includes(r) && visible(r));
                    if (
                      headerRows.length !== 1 ||
                      e.querySelector('table,[aria-rowindex],[aria-colindex]') ||
                      e.hasAttribute('aria-rowcount') ||
                      e.hasAttribute('aria-colcount') ||
                      [...e.rows].some((r) =>
                        [...r.cells].some((c) => c.colSpan !== 1 || c.rowSpan !== 1),
                      )
                    )
                      error = 'TABLE_STRUCTURE_UNSUPPORTED';
                    else if (
                      bodyRows.length > 1000 ||
                      headerRows[0].cells.length > 128 ||
                      bodyRows.length * headerRows[0].cells.length > 20000
                    )
                      error = 'TABLE_SAMPLE_LIMIT';
                    else if (
                      !measurable(e) ||
                      !measurable(headerRows[0]) ||
                      [...headerRows[0].cells].some((c) => !measurable(c)) ||
                      bodyRows.some((r) => [...r.cells].some((c) => !measurable(c)))
                    )
                      error = 'TABLE_STRUCTURE_UNSUPPORTED';
                    else
                      actual = {
                        headers: [...headerRows[0].cells].map((c) => c.innerText.trim()),
                        rows: bodyRows.map((r) => [...r.cells].map((c) => c.innerText.trim())),
                      };
                  }
                } else if (a.check === 'row_sequence') {
                  if (e.tagName !== 'TABLE') error = 'ASSERTION_TARGET_TYPE';
                  else {
                    const rows = Array.from(e.tBodies).flatMap((b) => Array.from(b.rows));
                    const texts = rows.map((r) => (r.innerText ?? r.textContent ?? '').trim());
                    passed =
                      texts.length === a.expected.length &&
                      texts.every((text, i) => text.includes(a.expected[i]));
                    actual = texts.slice(0, 101).map((text) => text.slice(0, 3000));
                  }
                } else if (a.check === 'checked') {
                  actual = !!e.checked;
                  passed = actual === a.expected;
                } else if (a.check === 'enabled') {
                  actual = !e.matches(':disabled') && !e.closest('[aria-disabled="true"]');
                  passed = actual === a.expected;
                } else if (a.check === 'aria_selected') {
                  if (e.getAttribute('role') !== 'tab') error = 'ASSERTION_TARGET_TYPE';
                  else {
                    const selected = e.getAttribute('aria-selected');
                    if (selected !== 'true' && selected !== 'false')
                      error = 'ASSERTION_SELECTION_STATE_UNSUPPORTED';
                    else {
                      actual = selected === 'true';
                      passed = actual === a.expected;
                    }
                  }
                } else if (a.check === 'selected_label') {
                  if (e.tagName !== 'SELECT') error = 'ASSERTION_TARGET_TYPE';
                  else {
                    actual = Array.from(e.selectedOptions)
                      .map((o) => o.label)
                      .join(',');
                    passed = actual === a.expected;
                  }
                } else if (a.check === 'row_count') {
                  if (e.tagName !== 'TABLE') error = 'ASSERTION_TARGET_TYPE';
                  else {
                    actual = Array.from(e.tBodies).reduce((n, b) => n + b.rows.length, 0);
                    passed = actual === a.expected;
                  }
                } else if (a.check === 'value') {
                  if (e.type === 'password') error = 'SENSITIVE_CONTROL_FORBIDDEN';
                  else {
                    actual = e.value;
                    passed = actual === a.expected;
                  }
                } else {
                  actual = (e.innerText ?? e.textContent ?? '').trim();
                  if (a.check === 'text') passed = actual === a.expected;
                  if (a.check === 'contains') passed = actual.includes(a.expected);
                  if (a.check === 'number') {
                    const number = actual.replaceAll(',', '');
                    passed =
                      number !== '' &&
                      Number.isFinite(Number(number)) &&
                      Number(number) === a.expected;
                  }
                }
                return { actual, passed, error, ...(obstruction ? { obstruction } : {}) };
              }),
            };
          },
          { key: observerKey, revision, assertions, handles },
        );
        if (sampled)
          sampled.observations.forEach((o, i) => {
            if (assertions[i].check === 'display_number' && !o.error) {
              if (
                assertions[i].target.kind !== 'within' ||
                assertions[i].target.target?.kind !== 'definition'
              ) {
                o.error = 'ASSERTION_DISPLAY_NUMBER_SCOPE';
                return;
              }
              const parsed = typeof o.actual === 'string' ? displayNumber(o.actual) : null;
              o.numeric_projection = { value: parsed, unit_verified: false, conversion: false };
              if (parsed === null) o.error = 'ASSERTION_DISPLAY_NUMBER_UNPARSEABLE';
              o.passed = parsed !== null && parsed === assertions[i].expected;
              return;
            }
            if (assertions[i].check === 'table_unchanged' && !o.error) {
              const comparison = compareTableBaseline(
                tableBaselines,
                page,
                tableContext,
                assertions[i].target,
                o.actual,
                sampled.fullURL,
              );
              o.passed = comparison.passed;
              o.table_comparison = comparison;
              return;
            }
            if (
              !['table_cells', 'table_order'].includes(assertions[i].check) ||
              o.error ||
              !o.actual ||
              typeof o.actual !== 'object'
            )
              return;
            // Compare captured values, never reread individual cells across revisions.
            const compare =
              assertions[i].check === 'table_order' ? compareTableOrder : compareTableCells;
            const comparison = compare(o.actual, assertions[i].expected);
            o.passed = comparison.passed;
            o.table_comparison = comparison;
            if (comparison.invalid) o.error = comparison.error;
          });
        if (sampled && Date.now() > deadline) {
          timedOut = true;
          if (last) sampled = null;
          else
            sampled.observations = sampled.observations.map((o) => ({
              ...o,
              condition_matches: o.passed,
              passed: false,
            }));
        } else if (sampled) windowObserved = true;
      } finally {
        await Promise.allSettled(handles.flat().map((h) => h.dispose()));
      }
      if (sampled) {
        last = sampled;
        const error = sampled.observations.find((o) => o.error)?.error;
        if (error) fail(error);
        // Invariance is a one-shot comparison, never an eventual-match poll.
        if (hasInvariant || oneShotOrder || sampled.observations.every((o) => o.passed)) break;
      }
      if (hasInvariant) fail('ASSERTION_SNAPSHOT_UNSTABLE');
      const remaining = deadline - Date.now();
      if (remaining > 0)
        await new Promise((resolve) => setTimeout(resolve, Math.min(100, remaining)));
    } while (Date.now() < deadline);
  } finally {
    await page
      .evaluate((key) => {
        window[key]?.observer.disconnect();
        delete window[key];
      }, observerKey)
      .catch(() => {});
  }
  if (!last) fail('ASSERTION_SNAPSHOT_UNSTABLE');
  const groupPassed = last.observations.every((o) => o.passed);
  return assertions.map((a, i) => ({
    check: a.check,
    target: a.target,
    expected: a.expected ?? null,
    oracle_quote: a.oracle_quote ?? null,
    obligation_ids: a.obligation_ids ?? [],
    actual:
      typeof last.observations[i].actual === 'string'
        ? redact(last.observations[i].actual).slice(0, 3000)
        : Array.isArray(last.observations[i].actual)
          ? last.observations[i].actual.map((v) => redact(v).slice(0, 3000))
          : ['table_cells', 'table_unchanged', 'table_order'].includes(a.check)
            ? redactMatrixEvidence(last.observations[i].actual)
            : last.observations[i].actual,
    passed: last.observations[i].passed,
    ...(last.observations[i].numeric_projection
      ? { numeric_projection: last.observations[i].numeric_projection }
      : {}),
    ...(last.observations[i].obstruction ? { obstruction: last.observations[i].obstruction } : {}),
    ...(last.observations[i].table_comparison
      ? { table_comparison: redactMatrixEvidence(last.observations[i].table_comparison) }
      : {}),
    group_passed: groupPassed,
    window_observed: windowObserved,
    timed_out: timedOut || (!groupPassed && Date.now() >= deadline),
    sample_id,
    at: last.at,
    deadline_at: new Date(deadline).toISOString(),
    mode: 'simultaneous',
    within_ms: timeout,
  }));
}
export async function snapshot(
  page,
  { marker, adapterSource = DEFAULT_ADAPTER_SOURCE, signal, focusText = [] } = {},
) {
  if (await isLoginPage(page, marker))
    return {
      url: page.url().split('?')[0],
      login_page: true,
      controls: [],
      text: '请在可见浏览器中完成登录，再读取页面。',
    };
  const selector =
    'button,a,input,textarea,select,[role],h1,h2,h3,article,li,dialog,table,tr,td,th,dt,dd,[data-testid],[data-test],[id],nav span,aside span,[role="menu"] span';
  const captured = await page.evaluateHandle(
    ({ selector, focusText }) => {
      const visible = (e) =>
        !!e.getClientRects().length &&
        getComputedStyle(e).visibility !== 'hidden' &&
        !e.closest('[aria-hidden="true"],[inert]');
      // A bounded name hint, not an implementation of the accessibility spec.
      // Every proposed role/name is still checked by Playwright and against the
      // original DOM handle below. Hidden decoration must not become a menu name.
      const nameText = (node, excluded = null) => {
        // A native control nested in its label does not contribute its options
        // or current value to its own field-name hint.
        if (node === excluded) return '';
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType !== Node.ELEMENT_NODE || !visible(node)) return '';
        if (node.getAttribute('aria-label')) return node.getAttribute('aria-label');
        if (node.tagName === 'IMG') return node.getAttribute('alt') || '';
        const text = [...node.childNodes].map((child) => nameText(child, excluded)).join('');
        return getComputedStyle(node).display.startsWith('inline') ? text : ` ${text} `;
      };
      const rowHint = (e) => {
        const row = e.closest('tbody > tr'),
          table = row?.closest('table');
        if (!row || !table || e.tagName === 'TABLE') return null;
        const header =
          table.tHead?.rows[0] ??
          [...table.rows].find((r) => [...r.cells].every((c) => c.tagName === 'TH'));
        if (!header || !header.cells.length) return null;
        const names = [...header.cells].map((c) => c.innerText.trim());
        const preferred = names.findIndex((n) => /名称|编号|name|code|^id$/iu.test(n));
        const keyIndex = preferred < 0 ? 0 : preferred;
        const value = row.cells[keyIndex]?.innerText.trim();
        if (!value || !names[keyIndex]) return null;
        const labelled = (table.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        const tableLocator =
          table.id && /^[A-Za-z][\w-]*$/.test(table.id)
            ? { kind: 'css', value: '#' + table.id }
            : {
                kind: 'role',
                role: 'table',
                name:
                  table.getAttribute('aria-label') ||
                  labelled ||
                  table.caption?.innerText.trim() ||
                  '',
                exact: true,
              };
        const cell = e.closest('td,th');
        return {
          table: tableLocator,
          key: { column: names[keyIndex], value },
          ...(cell && cell.parentElement === row ? { column: names[cell.cellIndex] } : {}),
        };
      };
      const controls = [];
      const scopeRole = (e) =>
        e.getAttribute('role') ||
        { ARTICLE: 'article', LI: 'listitem', DIALOG: 'dialog' }[e.tagName];
      const scopeOwner = (e) => {
        for (let n = e; n; n = n.parentElement)
          if (['article', 'listitem', 'dialog'].includes(scopeRole(n))) return n;
        return null;
      };
      const scopeHint = (e) => {
        const root = scopeOwner(e);
        if (!root) return null;
        const referenced = (root.getAttribute('aria-labelledby') || '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const name = referenced || root.getAttribute('aria-label')?.trim();
        const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(
          (h) => visible(h) && scopeOwner(h) === root,
        );
        const heading =
          headings.length === 1 ? nameText(headings[0]).replace(/\s+/g, ' ').trim() : '';
        if (!name && !heading) return null;
        const identity = name || heading;
        if (identity.length > 150) return null;
        return {
          scope: { role: scopeRole(root), ...(name ? { name } : { heading }), exact: true },
          self: root === e,
        };
      };
      // Include bounded, non-interactive leaf text as observed read-only targets.
      // No expected result is used for selection or for locator construction.
      const staticText = (e) => {
        if (!e.matches('span,p,output') || e.children.length || !visible(e)) return false;
        if (
          e.closest(
            'button,a,input,select,textarea,label,table,nav,aside,[role="button"],[role="link"],[role="textbox"],[role="combobox"],[role="menuitem"],[contenteditable]',
          )
        )
          return false;
        const text = e.innerText?.trim() ?? '';
        return (
          text.length > 0 &&
          text.length <= 150 &&
          !/密码|口令|密钥|验证码|账号|账户|邮箱|手机号|password|credential|api.?key|token|secret|cookie|session|email|phone/iu.test(
            text,
          )
        );
      };
      const elements = [...document.querySelectorAll(selector + ',span,p,output')].filter(
        (e) => e.matches(selector) || staticText(e),
      );
      const eligible = elements
        .map((e, dom_index) => ({ e, dom_index }))
        .filter(({ e }) => visible(e) && e.type !== 'password');
      const limit = 300;
      const large = eligible.length > limit;
      const cleanText = (s) =>
        String(s ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      // These are sampling hints, NOT wizard identity or permission evidence.
      const currentSteps = [...document.querySelectorAll('[aria-current="step"]')].filter(visible);
      const stepNames = new Set(currentSteps.map((e) => cleanText(e.textContent)));
      const stepRoots = new Set(
        currentSteps.map((e) => e.closest('section,[role="tabpanel"]')).filter(Boolean),
      );
      for (const heading of document.querySelectorAll('h1,h2,h3,[role="heading"]')) {
        if (visible(heading) && stepNames.has(cleanText(heading.textContent))) {
          const region = heading.closest('section,[role="tabpanel"]');
          if (region) stepRoots.add(region);
        }
      }
      const regions = new Map();
      const interactive = (e) =>
        e.matches(
          'button,a,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="treeitem"],[role="checkbox"],[role="radio"],[role="combobox"],[role="textbox"]',
        );
      for (const entry of eligible) {
        const e = entry.e;
        let root = e.closest('dialog,[role="dialog"],[aria-modal="true"]'),
          kind = 'dialog';
        if (!root) {
          root = [...stepRoots].find((r) => r.contains(e));
          kind = 'step';
        }
        if (!root) {
          root = e.closest('nav,aside,[role="navigation"],[role="menu"],[role="tree"]');
          kind = 'navigation';
        }
        if (!root) {
          root = e.closest('form,table,section,article,main,[role="region"],[role="tabpanel"]');
          kind = root?.matches('table') ? 'table' : root?.matches('form') ? 'form' : 'region';
        }
        if (!root) {
          root = document.body;
          kind = 'page';
        }
        if (!regions.has(root))
          regions.set(root, { id: 'region-' + regions.size, kind, root, entries: [] });
        entry.region = regions.get(root);
        entry.interactive = interactive(e);
        // Only original action literals are hints. No expected result, runtime value,
        // page instruction, new route or generated locator becomes authority here.
        const hint = cleanText(
          e.getAttribute('aria-label') ||
            [...(e.labels ?? [])].map((l) => l.textContent).join(' ') ||
            (entry.interactive ? e.textContent : ''),
        );
        entry.relevant =
          large &&
          hint.length >= 2 &&
          hint.length <= 100 &&
          focusText.some((text) => text.includes(hint));
        entry.region.entries.push(entry);
      }
      let selected = eligible;
      if (large) {
        selected = [];
        const seen = new Set();
        const append = (entry) => {
          if (seen.has(entry) || selected.length >= limit) return;
          selected.push(entry);
          seen.add(entry);
        };
        // Reserve a small overview before allocating detail, so dialog/table floods
        // cannot erase every background region. Unlisted regions remain counted.
        for (const region of [...regions.values()].slice(0, 24)) {
          append(
            region.entries.find(
              ({ e }) => e === region.root || e.matches('h1,h2,h3,[role="heading"]'),
            ) || region.entries[0],
          );
        }
        const allocate = (filter, quota) => {
          const buckets = [...regions.values()]
            .map((r) =>
              r.entries
                .filter((e) => !seen.has(e) && filter(e))
                .sort(
                  (a, b) =>
                    Number(b.relevant) - Number(a.relevant) ||
                    Number(b.interactive) - Number(a.interactive) ||
                    a.dom_index - b.dom_index,
                ),
            )
            .filter((entries) => entries.length);
          let taken = 0;
          for (let index = 0; taken < quota && selected.length < limit; index++) {
            let found = false;
            for (const bucket of buckets) {
              if (!bucket[index]) continue;
              append(bucket[index]);
              taken++;
              found = true;
              if (taken >= quota || selected.length >= limit) break;
            }
            if (!found) break;
          }
        };
        allocate((e) => e.region.kind === 'dialog', 96);
        allocate((e) => e.region.kind === 'step', 48);
        allocate((e) => e.region.kind === 'navigation', 32);
        allocate((e) => e.relevant, 64);
        allocate(() => true, limit);
      }
      const selectedSet = new Set(selected);
      const regionFacts = [...regions.values()].map((r) => {
        const sampled = r.entries.filter((e) => selectedSet.has(e)).length;
        return {
          id: r.id,
          kind: r.kind,
          eligible_count: r.entries.length,
          sampled_count: sampled,
          omitted_count: r.entries.length - sampled,
        };
      });
      // List priority regions first but retain all-region totals. No DOM text/values
      // in this diagnostic overview; sampled controls retain the existing facts.
      regionFacts.sort(
        (a, b) =>
          ['dialog', 'step', 'navigation'].includes(b.kind) -
          ['dialog', 'step', 'navigation'].includes(a.kind),
      );
      const bodyText = document.body.innerText;
      const coverage = {
        scope: 'visible-light-dom',
        limit,
        mode: large ? 'region-balanced' : 'dom-order',
        eligible_count: eligible.length,
        sampled_count: selected.length,
        omitted_count: eligible.length - selected.length,
        truncated: large,
        text_limit: 16000,
        text_truncated: bodyText.length > 16000,
        regions: regionFacts.slice(0, 24),
        region_count: regionFacts.length,
        omitted_region_count: Math.max(0, regionFacts.length - 24),
        unlisted_eligible_count: regionFacts.slice(24).reduce((n, r) => n + r.eligible_count, 0),
        unlisted_sampled_count: regionFacts.slice(24).reduce((n, r) => n + r.sampled_count, 0),
        iframes: {
          count: document.querySelectorAll('iframe,frame').length,
          contents_captured: false,
        },
        shadow_dom: {
          open_hosts: [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).length,
          contents_captured: false,
          closed_roots: 'unknown',
        },
      };
      for (const { dom_index, e } of selected) {
        const term =
          e.tagName === 'DD' &&
          e.previousElementSibling?.tagName === 'DT' &&
          e.closest('dl') === e.previousElementSibling.closest('dl')
            ? e.previousElementSibling
            : null;
        const fieldLabel = term && visible(term) ? cleanText(nameText(term)).slice(0, 150) : '';
        if (
          fieldLabel &&
          /密码|口令|密钥|验证码|账号|账户|邮箱|手机号|password|credential|api.?key|token|secret|cookie|session|email|phone/iu.test(
            fieldLabel,
          )
        )
          continue;
        const fieldAttribute = e.getAttribute('data-field');
        const labelledBy = (e.getAttribute('aria-labelledby') ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        const label = (
          labelledBy ||
          e.getAttribute('aria-label') ||
          [...(e.labels ?? [])].map((node) => nameText(node, e)).join(' ')
        )
          .replace(/\s+/g, ' ')
          .trim();
        const text = (label || nameText(e)).replace(/\s+/g, ' ').trim().slice(0, 150);
        const role =
          e.getAttribute('role') ||
          {
            BUTTON: 'button',
            A: 'link',
            SELECT: e.multiple || e.size > 1 ? 'listbox' : 'combobox',
            H1: 'heading',
            H2: 'heading',
            H3: 'heading',
            TR: 'row',
            TD: 'cell',
            TH: 'columnheader',
            TEXTAREA: 'textbox',
            ARTICLE: 'article',
            LI: 'listitem',
            DIALOG: 'dialog',
            INPUT:
              e.type === 'checkbox'
                ? 'checkbox'
                : e.type === 'radio'
                  ? 'radio'
                  : ['button', 'submit', 'reset'].includes(e.type)
                    ? 'button'
                    : 'textbox',
          }[e.tagName];
        const adapter_input = {
          testid: (e.dataset.testid ?? '').slice(0, 500),
          label: (label ?? '').slice(0, 500),
          placeholder: (e.getAttribute('placeholder') ?? '').slice(0, 500),
          role: role ?? '',
          text,
          id: e.id && /^[A-Za-z][\w-]*$/.test(e.id) ? e.id.slice(0, 500) : '',
          tag: e.tagName,
          table_name: (
            e.getAttribute('aria-label') ||
            labelledBy ||
            e.caption?.innerText?.trim() ||
            ''
          ).slice(0, 500),
          navigation_text:
            e.tagName === 'SPAN' && !!e.closest('nav,aside,[role="menu"]') && !e.children.length,
        };
        controls.push({
          role: role ?? e.tagName.toLowerCase(),
          name: label || text || e.getAttribute('placeholder') || e.id,
          adapter_input,
          dom_index,
          node: e,
          row_hint: rowHint(e),
          scope_hint: scopeHint(e),
          ...(staticText(e)
            ? { text_context: { kind: 'static_text', value: e.innerText.trim(), read_only: true } }
            : {}),
          ...(fieldLabel
            ? {
                field_context: { label: fieldLabel, value: cleanText(e.innerText).slice(0, 500) },
                field_locator_hint: /^[A-Za-z0-9_:. -]+$/.test(fieldAttribute ?? '')
                  ? { kind: 'css', value: '[data-field="' + fieldAttribute + '"]' }
                  : null,
              }
            : {}),
          in_navigation: !!e.closest('nav,aside,[role="menu"],[role="navigation"],[role="tree"]'),
          ...(['INPUT', 'TEXTAREA'].includes(e.tagName) &&
          !['password', 'file', 'hidden', 'email', 'tel'].includes(e.type) &&
          !/(?:password|passwd|secret|token|credential|api.?key|authorization|cookie|session|one.?time|passcode|credit.?card|email|phone|\botp\b|cc-|密码|口令|密钥|验证码|银行卡|身份证|手机号|账号|账户|邮箱)/iu.test(
            [e.name, e.id, label, e.getAttribute('autocomplete')].join(' '),
          )
            ? { current_value: String(e.value ?? '').slice(0, 500) }
            : {}),
          ...(e.closest('[role="dialog"],[aria-modal="true"],dialog')
            ? {
                dialog_context: (
                  e
                    .closest('[role="dialog"],[aria-modal="true"],dialog')
                    .getAttribute('aria-label') ||
                  e.closest('[role="dialog"],[aria-modal="true"],dialog').id ||
                  'dialog'
                ).slice(0, 150),
              }
            : {}),
          ...(e.closest('tr')
            ? { row_context: e.closest('tr').innerText.trim().slice(0, 400) }
            : {}),
          ...(e.getAttribute('role') === 'tab' &&
          ['true', 'false'].includes(e.getAttribute('aria-selected'))
            ? { aria_selected: e.getAttribute('aria-selected') === 'true' }
            : {}),
          ...(e.tagName === 'SELECT'
            ? {
                options: Array.from(e.options).map((o) => ({ label: o.label, value: o.value })),
                selected_label: e.selectedOptions[0]?.label,
              }
            : {}),
          ...(e.tagName === 'TABLE'
            ? {
                row_count: Array.from(e.tBodies).reduce((n, b) => n + b.rows.length, 0),
                headers: Array.from(e.querySelectorAll('th')).map((h) => h.innerText.trim()),
              }
            : {}),
          ...(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName)
            ? { enabled: !e.matches(':disabled') && e.getAttribute('aria-disabled') !== 'true' }
            : {}),
        });
      }
      return { title: document.title, text: bodyText.slice(0, 16000), controls, coverage };
    },
    {
      selector,
      focusText: Array.isArray(focusText)
        ? focusText
            .filter((v) => typeof v === 'string')
            .slice(0, 100)
            .map((v) => v.slice(0, 2000))
        : [],
    },
  );
  try {
    const raw = await captured.evaluate((data) => ({
      ...data,
      controls: data.controls.map(({ node, ...fact }) => fact),
    }));
    const mapped = await runAdapter(
      raw.controls.map((c) => c.adapter_input),
      { source: adapterSource, signal },
    );
    const controls = [],
      adapter_gaps = [];
    const rejected = rejectionLog();
    for (const [index, c] of raw.controls.entries()) {
      let locator = mapped.locators[index];
      if (adapterSource === DEFAULT_ADAPTER_SOURCE && locator === null && c.text_context)
        locator = { kind: 'text', value: c.text_context.value, exact: true };
      if (adapterSource === DEFAULT_ADAPTER_SOURCE && c.field_locator_hint)
        locator = c.field_locator_hint;
      if (
        adapterSource === DEFAULT_ADAPTER_SOURCE &&
        c.field_context &&
        c.scope_hint &&
        !c.field_locator_hint
      )
        locator = { kind: 'definition', name: c.field_context.label, exact: true };
      if (!c.row_hint && c.scope_hint && adapterSource === DEFAULT_ADAPTER_SOURCE) {
        const { scope, self } = c.scope_hint;
        if (self || locator)
          locator = { kind: 'within', scope, ...(!self ? { target: locator } : {}) };
      }
      if (c.row_hint) {
        const { table, key, column } = c.row_hint;
        if (c.adapter_input.tag === 'TR') locator = { kind: 'row', table, key };
        else if (['TD', 'TH'].includes(c.adapter_input.tag) && column)
          locator = { kind: 'cell', table, key, column };
        else if (locator && !['testid', 'css'].includes(locator.kind))
          locator = { kind: 'row', table, key, target: locator };
      }
      const gap = (code) => {
        recordRejection(rejected, code, c.name, index);
        if (
          c.adapter_input.navigation_text ||
          c.adapter_input.tag === 'TABLE' ||
          ['button', 'link', 'menuitem'].includes(c.adapter_input.role) ||
          Object.hasOwn(c, 'current_value') ||
          (c.adapter_input.tag === 'SELECT' &&
            !/(?:password|passwd|secret|token|credential|api.?key|authorization|cookie|session|one.?time|passcode|credit.?card|email|phone|\botp\b|cc-|密码|口令|密钥|验证码|银行卡|身份证|手机号|账号|账户|邮箱)/iu.test(
              [c.adapter_input.id, c.adapter_input.label, c.adapter_input.placeholder].join(' '),
            ))
        )
          adapter_gaps.push({ code, input: c.adapter_input });
      };
      try {
        if (locator === null) {
          gap('ADAPTER_MAPPING_MISSING');
          continue;
        }
        validateLocator(locator);
        if (locator.kind === 'case_named') fail('CASE_NAMED_ACTION_FORBIDDEN');
        let target = handoffLocator(page, locator);
        // getByLabel and accessible role/name use different native-label
        // semantics (e.g. labels wrapping a select). Only the fixed default
        // adapter gets this semantic fallback; custom programs are still
        // independently rejected if they propose the wrong destination.
        const baseLocator = locator.kind === 'within' ? locator.target : locator;
        let ambiguousRoleFallback = false;
        if (
          adapterSource === DEFAULT_ADAPTER_SOURCE &&
          baseLocator?.kind === 'label' &&
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(c.adapter_input.tag) &&
          (await target.count()) !== 1
        ) {
          const roleBase = {
            kind: 'role',
            role: c.adapter_input.role,
            name: c.adapter_input.label,
            exact: true,
          };
          const roleLocator =
            locator.kind === 'within' ? { ...locator, target: roleBase } : roleBase;
          validateLocator(roleLocator);
          const roleTarget = handoffLocator(page, roleLocator);
          const roleCount = await roleTarget.count();
          ambiguousRoleFallback = roleCount > 1;
          if (roleCount === 1) {
            locator = roleLocator;
            target = roleTarget;
          }
        }
        const targetCount = await target.count();
        if (targetCount !== 1) {
          gap(
            targetCount === 0 && !ambiguousRoleFallback
              ? 'ADAPTER_TARGET_MISSING'
              : 'ADAPTER_TARGET_NOT_UNIQUE',
          );
          continue;
        }
        // Source-produced locators are not authority: independently prove they
        // still address the SAME observed DOM node before exposing them.
        const handle = await target.elementHandle();
        try {
          if (
            !handle ||
            !(await captured.evaluate(
              (data, { index, node }) => data.controls[index].node === node && node.isConnected,
              { index, node: handle },
            ))
          ) {
            gap('ADAPTER_TARGET_IDENTITY_MISMATCH');
            continue;
          }
        } finally {
          await handle?.dispose();
        }
        const { adapter_input, dom_index, row_hint, scope_hint, field_locator_hint, ...fact } = c;
        controls.push({
          ...fact,
          ...(scope_hint ? { scope_context: scope_hint.scope } : {}),
          locator,
        });
      } catch (error) {
        gap(
          /^(?:ROW|WITHIN)_[A-Z_]+$/.test(error.code ?? '')
            ? error.code
            : 'ADAPTER_LOCATOR_REJECTED',
        );
      }
    }
    return {
      url: page.url().split('?')[0],
      title: redact(raw.title),
      text: redact(raw.text),
      controls: JSON.parse(redact(JSON.stringify(controls))),
      wizard_context: JSON.parse(redact(JSON.stringify(await observeWizard(page)))),
      adapter_hash: mapped.hash,
      adapter_gaps: JSON.parse(redact(JSON.stringify(adapter_gaps.slice(0, 12)))),
      observation_diagnostics: {
        raw_count: raw.controls.length,
        mapped_count: controls.length,
        rejected,
      },
      coverage: raw.coverage,
      login_page: false,
    };
  } finally {
    await captured.dispose();
  }
}

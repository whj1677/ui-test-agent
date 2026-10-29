import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { contentHash } from './cases/excel.mjs';
import { writeAtomicJson } from './atomic-json.mjs';
import { openDemonstrationBrowser } from './demonstration-browser.mjs';
import { resolveDemonstrationEnvironment } from './demonstration-environment.mjs';
import { DemonstrationFloatingHost } from './demonstration-floating.mjs';

const SCHEMA = 'workbench/human-demonstration-v1';
const ID = /^demo-[a-f0-9-]{36}$/;
const PROJECT = /^project-[a-z0-9-]{8,80}$/;
const MAX_EVENTS = 300;
const MAX_DURATION_MS = 20 * 60 * 1000;
const MAX_RECORDS = 100;
const AUTH_CHECK_MS = 2000;
const INTERRUPTION_REASONS = new Set(['TARGET_SCOPE_REQUEST_BLOCKED', 'EXTRA_TAB_BLOCKED',
  'BROWSER_CLOSED', 'DEMONSTRATION_TIMEOUT', 'SERVICE_RESTART', 'SERVICE_SHUTDOWN',
  'INTERRUPTION_UNSPECIFIED', 'STORAGE_FAULT',
  'PREPARATION_FAILED', 'DEMONSTRATION_TARGET_LOAD_INCOMPLETE', 'AUTH_ACCOUNT_CHANGED']);
const HASH_FIELDS = ['schema', 'project_id', 'case_id', 'case_version', 'content_sha256',
  'environment_id', 'environment_configuration_sha256', 'steps', 'events'];
const SAFE_TEXT = /^[\p{L}\p{N}_ .:/-]{1,100}$/u;
const SENSITIVE = /password|passwd|secret|token|cookie|auth|credential|api.?key|session|otp|验证码|密码|密钥/i;

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
function recordingHash(item) {
  const fields = Object.fromEntries(HASH_FIELDS.map(key => [key, item[key]]));
  if (item.auth_context !== undefined) fields.auth_context = item.auth_context;
  return hash(fields);
}
const identityHash = (scope, accountId) => hash([scope.project_id, scope.environment_id, scope.role, accountId]);
const sessionIdentity = status => status.verification_mode === 'browser-page' ? status.session_version : status.account_id;
const authReason = status => new Set(['NOT_LOGGED_IN', 'AWAITING_LOGIN', 'EXPIRED', 'ROLE_MISMATCH',
  'PERMISSION_DENIED', 'IDENTITY_CHANGED', 'IDENTITY_UNVERIFIED', 'CHECK_UNAVAILABLE', 'BROWSER_CLOSED'])
  .has(status) ? status : 'AUTH_SESSION_REQUIRED';
const SELECTION_CANCELLATIONS = new Set(['ESCAPE', 'NO_HIT', 'OVERFLOW', 'CROSS_FRAME',
  'UNLOCATABLE_DOM', 'SENSITIVE_TARGET', 'NAVIGATION']);
const selectionCancelReason = reason => SELECTION_CANCELLATIONS.has(reason)
  ? `SELECTION_${reason}` : 'SELECTION_CANCELLED';
function confirmedHash(item) {
  return hash({ recording_sha256: item.recording_sha256, assertion_reviews: item.assertion_reviews,
    case_id: item.case_id, case_version: item.case_version, content_sha256: item.content_sha256,
    environment_id: item.environment_id, environment_configuration_sha256: item.environment_configuration_sha256 });
}
function publicItem(item) { return structuredClone(item); }
function recordPath(root, projectId, id) {
  if (!PROJECT.test(projectId) || !ID.test(id)) throw Error('DEMONSTRATION_ID_INVALID');
  return path.join(root, projectId, `${id}.json`);
}

export class Demonstrations {
  constructor({ root, caseStore, buildManager, browserExecutable, busy = () => false,
    atomicJson = writeAtomicJson, browserFactory = openDemonstrationBrowser, now = () => Date.now(),
    floatingHost = new DemonstrationFloatingHost() }) {
    Object.assign(this, { root: path.resolve(root), caseStore, buildManager, browserExecutable,
      busy, atomicJson, browserFactory, now, floatingHost });
    this.active = null;
    this.starting = false;
    this.queue = Promise.resolve();
    this.timer = null;
    this.authTimer = null;
    this.authWatchPending = false;
    this.shutdownRequested = false;
    this.storageFault = null;
  }

  serial(fn) {
    const result = this.queue.then(fn, fn);
    this.queue = result.catch(() => {});
    return result;
  }

  #markStorageFault(error, operation) {
    this.storageFault ||= { code: 'DEMONSTRATION_STORAGE_FAULT', operation,
      at: new Date(this.now()).toISOString() };
    this.shutdownRequested = true;
    this.buildManager?.reportStorageFault?.(error, `demonstration_${operation}`);
  }
  #eventFailure(error, operation) {
    this.#markStorageFault(error, operation);
    void this.closeAll().catch(() => {
      const active = this.active;
      this.active = null;
      clearTimeout(this.timer); this.timer = null;
      clearInterval(this.authTimer); this.authTimer = null;
      void active?.browser?.close().catch(() => {});
    });
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
    for (const project of await fs.readdir(this.root, { withFileTypes: true })) {
      if (!project.isDirectory() || !PROJECT.test(project.name)) continue;
      for (const file of await fs.readdir(path.join(this.root, project.name))) {
        if (!ID.test(file.replace(/\.json$/, '')) || !file.endsWith('.json')) continue;
        const target = path.join(this.root, project.name, file);
        const item = JSON.parse(await fs.readFile(target, 'utf8'));
        if (item.schema !== SCHEMA || item.project_id !== project.name || `${item.demonstration_id}.json` !== file) throw Error('DEMONSTRATION_STORE_INVALID');
        if (['PREPARING', 'WAITING_LOGIN', 'PAUSED', 'RECORDING'].includes(item.status)) {
          item.status = 'INTERRUPTED'; item.finished_at = new Date(this.now()).toISOString();
          item.interruption_reason = 'SERVICE_RESTART';
          item.recording_sha256 = recordingHash(item);
          await this.atomicJson(target, item);
        }
      }
    }
  }

  async #case(projectId, caseId, caseVersion) {
    const project = await this.caseStore.getProject(projectId);
    if (!project) throw Error('CASE_PROJECT_NOT_FOUND');
    const item = project.cases.find(entry => entry.case_id === caseId);
    const version = item?.versions.find(entry => entry.version === caseVersion);
    if (!version || version.content?.status !== 'CONFIRMED' ||
      ![undefined, 'UI'].includes(version.content?.case_type) ||
      version.content_sha256 !== contentHash(version.content) ||
      !version.content.steps?.length || version.content.steps.some(step => !step.expected?.trim()))
      throw Error('DEMONSTRATION_CONFIRMED_CASE_REQUIRED');
    return version;
  }

  async #environment(projectId, environmentId) {
    return resolveDemonstrationEnvironment(this.buildManager, projectId, environmentId);
  }

  async #read(projectId, id) {
    const item = JSON.parse(await fs.readFile(recordPath(this.root, projectId, id), 'utf8'));
    if (item.schema !== SCHEMA || item.demonstration_id !== id || item.project_id !== projectId) throw Error('DEMONSTRATION_STORE_INVALID');
    return item;
  }
  async #write(item) {
    try { await this.atomicJson(recordPath(this.root, item.project_id, item.demonstration_id), item); }
    catch (error) { this.#markStorageFault(error, 'write'); throw error; }
  }

  async list(projectId) {
    if (!PROJECT.test(projectId)) throw Error('DEMONSTRATION_PROJECT_INVALID');
    const dir = path.join(this.root, projectId);
    let names;
    try { names = await fs.readdir(dir); } catch (error) { if (error.code === 'ENOENT') return { recordings: [] }; throw error; }
    const project = await this.caseStore.getProject(projectId);
    const recordings = [];
    for (const name of names.filter(name => /^demo-[a-f0-9-]{36}\.json$/.test(name))) {
      const item = await this.#read(projectId, name.slice(0, -5));
      const version = project?.cases.find(entry => entry.case_id === item.case_id)?.versions
        .find(entry => entry.version === item.case_version && entry.content_sha256 === item.content_sha256 &&
          contentHash(entry.content) === item.content_sha256);
      recordings.push({ demonstration_id: item.demonstration_id, case_id: item.case_id, case_version: item.case_version,
        environment_id: item.environment_id, status: item.status, created_at: item.created_at,
        case_title: item.case_title || version?.content.title || null,
        case_external_id: item.case_external_id || version?.content.external_id || null,
        step_count: Array.isArray(item.steps) ? item.steps.length : null,
        finished_at: item.finished_at, recording_sha256: item.recording_sha256 });
    }
    return { recordings: recordings.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, MAX_RECORDS) };
  }

  async get(projectId, id) { return publicItem(await this.#read(projectId, id)); }

  async open(projectId, { case_id, case_version, environment_id } = {}) {
    return this.serial(async () => {
      if (this.shutdownRequested) throw Error('DEMONSTRATIONS_CLOSING');
      if (this.active || this.starting || this.busy?.()) throw Error('DEMONSTRATION_BUSY');
      this.starting = true;
      try {
        if (!Number.isInteger(case_version) || case_version < 1) throw Error('DEMONSTRATION_CASE_VERSION_INVALID');
        const version = await this.#case(projectId, case_id, case_version);
        const target = await this.#environment(projectId, environment_id);
        if (this.shutdownRequested) throw Error('DEMONSTRATIONS_CLOSING');
        const item = { schema: SCHEMA, demonstration_id: `demo-${randomUUID()}`, project_id: projectId,
        case_id, case_version, content_sha256: version.content_sha256, environment_id,
        case_external_id: typeof version.content.external_id === 'string' ? version.content.external_id : null,
        case_title: typeof version.content.title === 'string' ? version.content.title : null,
        environment_configuration_sha256: target.configuration_sha256,
        created_at: new Date(this.now()).toISOString(), finished_at: null, status: 'PREPARING',
        current_step_index: 0, steps: structuredClone(version.content.steps), events: [],
          assertion_reviews: [], recording_sha256: null, confirmed_sha256: null,
          interruption_reason: null, selection_mode: null, selection_notice: null,
          ...(target.auth_required ? { auth_context: null, auth_reason: 'LOGIN_REQUIRED' } : {}) };
        await this.#write(item);
        let browser;
        try {
        if (!target.auth_required) browser = await this.#openBrowser(item, target);
        if (this.shutdownRequested) { await browser?.close(); throw Error('DEMONSTRATIONS_CLOSING'); }
        this.active = { demonstration_id: item.demonstration_id, recording: item, item, browser: browser || null,
          target, pick: false, authVersion: null };
        item.status = target.auth_required ? 'WAITING_LOGIN' : 'PAUSED';
        await this.#write(item);
        this.timer = setTimeout(() => { void this.#interrupt(item.demonstration_id, 'DEMONSTRATION_TIMEOUT')
          .catch(error => this.#eventFailure(error, 'timeout')); }, MAX_DURATION_MS);
        return publicItem(item);
        } catch (error) {
          clearTimeout(this.timer); this.timer = null;
          try { await browser?.close(); } catch {}
          finally { if (this.active?.item === item) this.active = null; }
          item.status = 'INTERRUPTED'; item.finished_at = new Date(this.now()).toISOString();
          item.interruption_reason = INTERRUPTION_REASONS.has(error?.message) ? error.message : 'PREPARATION_FAILED';
          item.recording_sha256 = recordingHash(item);
          try { await this.#write(item); } catch { /* #write has already marked the storage fault. */ }
          throw error;
        }
      } finally { this.starting = false; }
    });
  }

  async #openBrowser(item, target, storageState = null) {
    const sessionTerminationEndpoints = target.auth_required
      ? this.buildManager.authSessions.environment(target.auth_scope).session_termination_endpoints || [] : [];
    return this.browserFactory(target, this.browserExecutable,
      event => { void this.#accept(item.demonstration_id, event).catch(error => this.#eventFailure(error, 'event')); },
      reason => { void this.#interrupt(item.demonstration_id, reason).catch(error => this.#eventFailure(error, 'interrupt')); },
      { ...(storageState ? { storageState } : {}), sessionTerminationEndpoints });
  }

  #watchAuth(active) {
    clearInterval(this.authTimer);
    if (!active.target.auth_required) return;
    this.authTimer = setInterval(() => {
      if (this.authWatchPending) return;
      this.authWatchPending = true;
      void this.#checkActiveAuth(active.item.demonstration_id)
        .catch(error => this.#eventFailure(error, 'auth_watch'))
        .finally(() => { this.authWatchPending = false; });
    }, AUTH_CHECK_MS);
  }

  async #waitForLogin(active, reason) {
    clearInterval(this.authTimer); this.authTimer = null;
    active.pick = false;
    active.authVersion = null;
    const browser = active.browser; active.browser = null;
    try { await browser?.setMode('PAUSED', false, active.item.current_step_index); } catch {}
    await browser?.close().catch(() => {});
    active.item.status = 'WAITING_LOGIN';
    active.item.auth_reason = reason;
    active.item.selection_mode = null;
    active.item.selection_notice = null;
    await this.#write(active.item);
  }

  async #verifyAuth(active) {
    if (!active.target.auth_required) return true;
    let status;
    try { status = await this.buildManager.authSessions.check(active.target.auth_scope, { passive: true }); }
    catch { await this.#waitForLogin(active, 'AUTH_SESSION_REQUIRED'); return false; }
    if (status.status !== 'VALID' || !sessionIdentity(status) || status.session_version !== active.authVersion) {
      await this.#waitForLogin(active, status.status === 'VALID' ? 'LOGIN_RECHECK_REQUIRED' : authReason(status.status)); return false;
    }
    if (identityHash(active.target.auth_scope, sessionIdentity(status)) !== active.item.auth_context?.identity_sha256) {
      await this.#finish(active, 'INTERRUPTED', 'AUTH_ACCOUNT_CHANGED'); return false;
    }
    return true;
  }

  async #checkActiveAuth(id) {
    return this.serial(async () => {
      const active = this.active;
      if (!active || active.item.demonstration_id !== id || !active.target.auth_required ||
        !['PAUSED', 'RECORDING'].includes(active.item.status)) return;
      await this.#verifyAuth(active);
    });
  }

  #sanitizeAction(event, stepIndex) {
    if (!event || event.step_index !== stepIndex ||
      !['click', 'fill', 'select', 'check', 'navigation', 'assertion_target'].includes(event.kind)) return null;
    const raw = event.locator_hint;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      ['password', 'hidden', 'file'].includes(String(raw.type || '').toLowerCase()) ||
      ['id', 'testid', 'name', 'aria_label', 'placeholder'].some(key => SENSITIVE.test(String(raw[key] || '')))) return null;
    const locator_hint = {};
    for (const key of ['tag', 'id', 'testid', 'name', 'role', 'type', 'path', 'aria_label', 'visible_name', 'placeholder']) {
      if (typeof raw[key] === 'string' && SAFE_TEXT.test(raw[key]) && !SENSITIVE.test(raw[key])) locator_hint[key] = raw[key];
    }
    for (const key of ['css_path', 'row_path']) {
      if (typeof raw[key] === 'string' && raw[key].length <= 220 &&
        /^(?:body|[a-z][a-z0-9-]*:nth-of-type\([1-9]\d{0,3}\))(?:>[a-z][a-z0-9-]*:nth-of-type\([1-9]\d{0,3}\))*$/.test(raw[key])) locator_hint[key] = raw[key];
    }
    if (!Object.keys(locator_hint).length || event.kind === 'fill' && ['password', 'hidden', 'file'].includes(locator_hint.type)) return null;
    const frame = event.frame_hint;
    if (!frame || !Number.isInteger(frame.index) || frame.index < 0 || frame.index > 20 ||
      typeof frame.path !== 'string' || !SAFE_TEXT.test(frame.path) || SENSITIVE.test(frame.path)) return null;
    return { kind: event.kind, step_index: stepIndex, locator_hint,
      frame_hint: { index: frame.index, path: frame.path } };
  }

  async #endSelection(active, notice) {
    active.pick = false;
    await active.browser?.setMode('PAUSED', false, active.item.current_step_index);
    active.item.status = 'PAUSED';
    active.item.selection_mode = null;
    active.item.selection_notice = notice;
    await this.#write(active.item);
  }

  async #accept(id, event) {
    return this.serial(async () => {
      const active = this.active;
      if (!active || active.item.demonstration_id !== id || active.item.status !== 'RECORDING' ||
        !event || event.step_index !== active.item.current_step_index) return;
      const item = active.item;
      if (active.target.auth_required) {
        const status = this.buildManager.authSessions.status(active.target.auth_scope);
        if (status.status !== 'VALID' || status.session_version !== active.authVersion) {
          await this.#waitForLogin(active, status.status === 'VALID' ? 'LOGIN_RECHECK_REQUIRED' : authReason(status.status));
          return;
        }
      }
      if (event.kind === 'selection_cancelled') {
        if (active.pick) await this.#endSelection(active, selectionCancelReason(event.reason));
        return;
      }
      if (event.kind === 'assertion_targets') {
        if (!active.pick) return;
        const targets = event.targets;
        const valid = Array.isArray(targets) && targets.length > 0 && targets.length <= 20 &&
          item.events.length + targets.length <= MAX_EVENTS;
        const actions = valid ? targets.map(target => this.#sanitizeAction({ ...target,
          kind: 'assertion_target', step_index: target?.step_index ?? event.step_index,
          frame_hint: target?.frame_hint ?? event.frame_hint }, item.current_step_index)) : [];
        if (!valid || actions.some(action => !action)) {
          await this.#endSelection(active, 'SELECTION_INVALID'); return;
        }
        for (const action of actions) item.events.push({ event_id: `event-${item.events.length + 1}`, ...action });
        active.pick = false;
        await active.browser?.setMode('PAUSED', false, item.current_step_index);
        item.status = 'PAUSED'; item.selection_mode = null; item.selection_notice = 'SELECTION_RECORDED';
        await this.#write(item);
        return;
      }
      const action = this.#sanitizeAction(event, item.current_step_index);
      if (!action || active.pick && event.kind !== 'assertion_target' ||
        !active.pick && event.kind === 'assertion_target') return;
      if (item.events.length >= MAX_EVENTS) { await this.#finish(active, 'INTERRUPTED'); return; }
      const previous = item.events.at(-1);
      if (event.kind === 'fill' && previous?.kind === 'fill' && previous.step_index === item.current_step_index &&
        JSON.stringify(previous.locator_hint) === JSON.stringify(action.locator_hint)) return;
      item.events.push({ event_id: `event-${item.events.length + 1}`, ...action });
      if (event.kind === 'assertion_target') {
        active.pick = false;
        await active.browser?.setMode('PAUSED', false, item.current_step_index);
        item.status = 'PAUSED'; item.selection_mode = null; item.selection_notice = 'SELECTION_RECORDED';
      }
      await this.#write(item);
    });
  }

  async #interrupt(id, reason) {
    return this.serial(async () => {
      if (this.active?.item.demonstration_id !== id) return;
      await this.#finish(this.active, 'INTERRUPTED', reason);
    });
  }

  async #finish(active, status, reason = null) {
    clearTimeout(this.timer); this.timer = null;
    clearInterval(this.authTimer); this.authTimer = null;
    const item = active.item;
    item.status = status; item.finished_at = new Date(this.now()).toISOString();
    item.interruption_reason = status === 'INTERRUPTED'
      ? INTERRUPTION_REASONS.has(reason) ? reason : 'INTERRUPTION_UNSPECIFIED' : null;
    item.recording_sha256 = recordingHash(item);
    try { await this.#write(item); }
    finally {
      this.floatingHost.close(item.project_id, item.demonstration_id, { afterResponse: status === 'STOPPED' || status === 'CANCELLED' });
      await active.browser?.close().catch(() => {}); this.active = null;
    }
    return publicItem(item);
  }

  async control(projectId, id, { action, step_index, pick_mode } = {}) {
    return this.serial(async () => {
      const active = this.active;
      if (!active || active.item.demonstration_id !== id || active.item.project_id !== projectId) throw Error('DEMONSTRATION_NOT_ACTIVE');
      try {
      const item = active.item;
      if (action === 'floating-open') {
        if (!['WAITING_LOGIN', 'PAUSED', 'RECORDING'].includes(item.status)) throw Error('DEMONSTRATION_STATE_INVALID');
        await this.floatingHost.open(projectId, id);
        return publicItem(item);
      }
      if (action === 'stop' || action === 'cancel') return this.#finish(active, action === 'stop' ? 'STOPPED' : 'CANCELLED');
      if (action === 'login-open') {
        if (!active.target.auth_required || item.status !== 'WAITING_LOGIN') throw Error('DEMONSTRATION_STATE_INVALID');
        const sessions = this.buildManager.authSessions;
        const status = sessions.status(active.target.auth_scope);
        if (!['VALID', 'AWAITING_LOGIN', 'CHECK_UNAVAILABLE'].includes(status.status)) await sessions.open(active.target.auth_scope);
        item.auth_reason = 'LOGIN_REQUIRED';
        await this.#write(item); return publicItem(item);
      }
      if (action === 'login-check') {
        if (!active.target.auth_required || item.status !== 'WAITING_LOGIN') throw Error('DEMONSTRATION_STATE_INVALID');
        const sessions = this.buildManager.authSessions;
        let status;
        try { status = await sessions.check(active.target.auth_scope, { confirmLogin: true }); }
        catch { status = { status: 'CHECK_UNAVAILABLE' }; }
        if (status.status !== 'VALID' || typeof sessionIdentity(status) !== 'string' || !sessionIdentity(status) ||
          typeof status.session_version !== 'string' || !status.session_version) {
          item.auth_reason = authReason(status.status);
          await this.#write(item); return publicItem(item);
        }
        const digest = identityHash(active.target.auth_scope, sessionIdentity(status));
        if (item.auth_context && item.auth_context.identity_sha256 !== digest)
          return this.#finish(active, 'INTERRUPTED', 'AUTH_ACCOUNT_CHANGED');
        let storageState;
        try { storageState = await sessions.stateForExecution(active.target.auth_scope, status.session_version); }
        catch { item.auth_reason = 'AUTH_SESSION_REQUIRED'; await this.#write(item); return publicItem(item); }
        let browser;
        try {
          browser = await this.#openBrowser(item, active.target, storageState);
          const current = await sessions.check(active.target.auth_scope);
          if (current.status !== 'VALID' || current.session_version !== status.session_version ||
            identityHash(active.target.auth_scope, sessionIdentity(current)) !== digest) {
            await browser.close();
            item.auth_reason = 'AUTH_SESSION_REQUIRED';
            await this.#write(item); return publicItem(item);
          }
        } catch (error) {
          await browser?.close().catch(() => {});
          if (error.message === 'TARGET_SCOPE_REQUEST_BLOCKED')
            return this.#finish(active, 'INTERRUPTED', 'TARGET_SCOPE_REQUEST_BLOCKED');
          return this.#finish(active, 'INTERRUPTED', 'PREPARATION_FAILED');
        }
        active.browser = browser; active.authVersion = status.session_version;
        item.auth_context ||= { role: active.target.role, identity_sha256: digest,
          ...(status.verification_mode === 'browser-page' ? { verification_mode: 'browser-page' } : {}) };
        item.auth_reason = null; item.status = 'PAUSED';
        this.#watchAuth(active);
        await this.#write(item); return publicItem(item);
      }
      if (action === 'step') {
        if (!Number.isInteger(step_index) || step_index < 0 || step_index >= item.steps.length) throw Error('DEMONSTRATION_STEP_INVALID');
        await active.browser?.setMode(item.status, active.pick, step_index, item.selection_mode || 'point');
        item.current_step_index = step_index;
        await this.#write(item); return publicItem(item);
      }
      if (action === 'start') {
        if (item.status !== 'PAUSED') throw Error('DEMONSTRATION_STATE_INVALID');
        if (!await this.#verifyAuth(active)) return publicItem(item);
        active.pick = false; await active.browser.setMode('RECORDING', false, item.current_step_index, 'point'); item.status = 'RECORDING';
        item.selection_mode = null; item.selection_notice = null;
      } else if (action === 'pause') {
        if (item.status !== 'RECORDING') throw Error('DEMONSTRATION_STATE_INVALID');
        active.pick = false; await active.browser.setMode('PAUSED', false, item.current_step_index, 'point'); item.status = 'PAUSED';
        item.selection_mode = null;
      } else if (action === 'pick') {
        if (item.status !== 'PAUSED') throw Error('DEMONSTRATION_STATE_INVALID');
        if (!await this.#verifyAuth(active)) return publicItem(item);
        if (pick_mode !== undefined && !['point', 'box'].includes(pick_mode)) throw Error('DEMONSTRATION_PICK_MODE_INVALID');
        active.pick = true;
        item.selection_mode = pick_mode || 'point'; item.selection_notice = null;
        await active.browser.setMode('RECORDING', true, item.current_step_index, item.selection_mode);
        item.status = 'RECORDING';
      } else throw Error('DEMONSTRATION_ACTION_INVALID');
      await this.#write(item); return publicItem(item);
      } catch (error) {
        if (this.storageFault && this.active === active) {
          clearTimeout(this.timer); this.timer = null;
          clearInterval(this.authTimer); this.authTimer = null;
          this.active = null;
          this.floatingHost.close(active.item.project_id, active.item.demonstration_id);
          await active.browser?.close().catch(() => {});
        }
        throw error;
      }
    });
  }

  async confirm(projectId, id, { recording_sha256, assertion_reviews } = {}) {
    return this.serial(async () => {
      const item = await this.#read(projectId, id);
      if (item.status !== 'STOPPED' || item.recording_sha256 !== recording_sha256 ||
        recordingHash(item) !== recording_sha256 || !item.events.length) throw Error('DEMONSTRATION_RECORDING_CHANGED');
      const version = await this.#case(projectId, item.case_id, item.case_version);
      if (version.content_sha256 !== item.content_sha256 ||
        JSON.stringify(version.content.steps) !== JSON.stringify(item.steps)) throw Error('DEMONSTRATION_SOURCE_CHANGED');
      const target = await this.#environment(projectId, item.environment_id);
      if (target.configuration_sha256 !== item.environment_configuration_sha256) throw Error('DEMONSTRATION_TARGET_CHANGED');
      if (!Array.isArray(assertion_reviews) || assertion_reviews.length !== item.steps.length) throw Error('DEMONSTRATION_REVIEWS_REQUIRED');
      for (let index = 0; index < item.steps.length; index++) {
        const review = assertion_reviews[index];
        const multiple = Object.hasOwn(review || {}, 'locator_event_ids');
        const ids = multiple ? review.locator_event_ids : review.locator_event_id == null ? [] : [review.locator_event_id];
        if (review?.step_index !== index || review.confirmed !== true || review.source !== 'FROZEN_CASE' ||
          multiple && Object.hasOwn(review, 'locator_event_id') || !Array.isArray(ids) || ids.length > 20 ||
          new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' ||
            !item.events.some(event => event.event_id === id && event.kind === 'assertion_target' && event.step_index === index)))
          throw Error('DEMONSTRATION_REVIEW_INVALID');
      }
      item.assertion_reviews = assertion_reviews.map(review => ({ step_index: review.step_index,
        confirmed: true, source: 'FROZEN_CASE', ...(Object.hasOwn(review, 'locator_event_ids')
          ? { locator_event_ids: [...review.locator_event_ids] }
          : { locator_event_id: review.locator_event_id ?? null }) }));
      item.status = 'CONFIRMED';
      item.confirmed_sha256 = confirmedHash(item);
      await this.#write(item);
      return publicItem(item);
    });
  }

  async resolve(projectId, id, { case_id, case_version, content_sha256, environment_id } = {}) {
    const item = await this.#read(projectId, id);
    if (item.status !== 'CONFIRMED' || item.case_id !== case_id || item.case_version !== case_version ||
      item.content_sha256 !== content_sha256 || item.environment_id !== environment_id ||
      item.recording_sha256 !== recordingHash(item) ||
      item.confirmed_sha256 !== confirmedHash(item)) throw Error('DEMONSTRATION_BINDING_MISMATCH');
    const version = await this.#case(projectId, case_id, case_version);
    const target = await this.#environment(projectId, environment_id);
    if (version.content_sha256 !== content_sha256 || target.configuration_sha256 !== item.environment_configuration_sha256 ||
      JSON.stringify(version.content.steps) !== JSON.stringify(item.steps)) throw Error('DEMONSTRATION_SOURCE_CHANGED');
    if (target.auth_required) {
      if (item.auth_context?.role !== target.role || !/^[A-F0-9]{64}$/.test(item.auth_context.identity_sha256))
        throw Error('DEMONSTRATION_AUTH_CONTEXT_INVALID');
      let status;
      try { status = await this.buildManager.authSessions.check(target.auth_scope); }
      catch { throw Error('AUTH_SESSION_REQUIRED'); }
      if (status.status !== 'VALID') throw Error('AUTH_SESSION_REQUIRED');
      if (identityHash(target.auth_scope, sessionIdentity(status)) !== item.auth_context.identity_sha256)
        throw Error('DEMONSTRATION_AUTH_ACCOUNT_CHANGED');
    } else if (item.auth_context != null) throw Error('DEMONSTRATION_AUTH_CONTEXT_INVALID');
    return publicItem(item);
  }

  async closeAll() {
    this.shutdownRequested = true;
    return this.serial(async () => {
      try { if (this.active) await this.#finish(this.active, 'INTERRUPTED',
        this.storageFault ? 'STORAGE_FAULT' : 'SERVICE_SHUTDOWN'); }
      finally { this.floatingHost.closeAll(); }
    });
  }
}

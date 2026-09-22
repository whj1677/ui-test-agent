import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside } from '../integrity.mjs';

const ACTIVE_TASK_STATES = new Set(['STARTING', 'GENERATING', 'VERIFYING', 'CANCELLING']);
const RETRYABLE_WRITE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
export const M2C_REVALIDATION_AUTHORIZATION_ID = 'm2c-diagnostic-revalidation-20260921';
export const M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID = 'm2c-wait-fix-validation-20260921';
export const M3B2_PROJECT_CASE_AUTHORIZATION_ID = 'm3b2-project-case-run-20260921';
export const M4A_QUERY_CASE_AUTHORIZATION_ID = 'm4a-query-case-run-20260922';
export const M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID = 'm4a-query-case-flash-retry-20260922';
const AUTHORIZATION_FILES = new Map([
  [M2C_REVALIDATION_AUTHORIZATION_ID, 'revalidation-authorization.json'],
  [M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID, 'wait-fix-validation-authorization.json'],
  [M3B2_PROJECT_CASE_AUTHORIZATION_ID, 'm3b2-project-case-authorization.json'],
  [M4A_QUERY_CASE_AUTHORIZATION_ID, 'm4a-query-case-authorization.json'],
  [M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID, 'm4a-query-case-flash-retry-authorization.json'],
]);

function projectCaseScopeValid(scope) {
  return scope && typeof scope.project_id === 'string' && typeof scope.case_id === 'string' &&
    Number.isInteger(scope.case_version) && scope.case_version > 0 &&
    /^[A-F0-9]{64}$/.test(scope.content_sha256 || '') && typeof scope.environment_id === 'string' && scope.environment_id;
}

function authorizationValid(record, authorizationId) {
  const isM4 = authorizationId === M4A_QUERY_CASE_AUTHORIZATION_ID;
  const common = record?.authorization_id === authorizationId &&
    record.kind === (isM4 ? 'initial-with-optional-revision' : 'initial') &&
    record.max_starts === (isM4 ? 2 : 1) && Number.isInteger(record.used_starts) &&
    record.used_starts >= 0 && record.used_starts <= record.max_starts && Array.isArray(record.claims);
  if (!common) return false;
  if (authorizationId === M3B2_PROJECT_CASE_AUTHORIZATION_ID) {
    return record.schema === 'workbench/build-project-case-authorization-v1' &&
      record.linked_stage === 'M3-B2' && projectCaseScopeValid(record.scope) &&
      record.limits?.max_tool_calls === 30 && record.limits?.timeout_ms === 600_000;
  }
  if (authorizationId === M4A_QUERY_CASE_AUTHORIZATION_ID) {
    return record.schema === 'workbench/build-project-case-authorization-v1' &&
      record.linked_stage === 'M4-A' && projectCaseScopeValid(record.scope) &&
      record.limits?.max_tool_calls === 30 && record.limits?.timeout_ms === 600_000;
  }
  if (authorizationId === M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID) {
    return record.schema === 'workbench/build-project-case-authorization-v1' &&
      record.linked_stage === 'M4-A-FLASH-RETRY' && projectCaseScopeValid(record.scope) &&
      record.limits?.max_tool_calls === 30 && record.limits?.timeout_ms === 600_000;
  }
  return record.schema === 'workbench/build-revalidation-authorization-v1';
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value, io = fs) {
  await io.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await io.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await io.rename(temporary, file);
        break;
      } catch (error) {
        if (!RETRYABLE_WRITE_CODES.has(error.code) || attempt >= 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
  }
  finally { await io.rm(temporary, { force: true }).catch(() => {}); }
}

export class BuildTaskStore {
  #queue = Promise.resolve();

  constructor(root, options = {}) {
    this.root = path.resolve(root);
    this.budgetFile = path.join(this.root, 'stage-budget.json');
    this.authorizationId = options.authorizationId || M2C_REVALIDATION_AUTHORIZATION_ID;
    const authorizationFile = AUTHORIZATION_FILES.get(this.authorizationId);
    if (!authorizationFile) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
    this.revalidationAuthorizationFile = path.join(this.root, authorizationFile);
    this.io = options.io || fs;
    this.appendFile = options.appendFile || this.io.appendFile.bind(this.io);
  }

  serial(operation) {
    const next = this.#queue.then(operation, operation);
    this.#queue = next.catch(() => {});
    return next;
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
    try { await fs.access(this.budgetFile); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeJsonAtomic(this.budgetFile, {
        schema: 'workbench/build-stage-budget-v1', phase: 'M2-C', max_starts: 2, used_starts: 0, claims: [],
      }, this.io);
    }
  }

  taskDirectory(taskId) {
    if (!/^build-[a-z0-9-]{8,80}$/.test(taskId)) throw new Error('INVALID_BUILD_TASK_ID');
    return resolveInside(this.root, taskId);
  }

  lifecycleFile(taskId, attemptId) {
    if (!/^attempt-\d{2}-(initial|revision)$/.test(attemptId)) throw new Error('INVALID_BUILD_ATTEMPT_ID');
    return resolveInside(this.taskDirectory(taskId), path.join('attempts', attemptId, 'lifecycle.ndjson'));
  }

  async appendLifecycle(taskId, attemptId, event) {
    const file = this.lifecycleFile(taskId, attemptId);
    const line = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(line) > 16 * 1024) throw new Error('BUILD_LIFECYCLE_EVENT_TOO_LARGE');
    return this.serial(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      for (let attempt = 0; ; attempt += 1) {
        try {
          await this.appendFile(file, line, { encoding: 'utf8', flag: 'a' });
          return;
        } catch (error) {
          if (!RETRYABLE_WRITE_CODES.has(error.code) || attempt >= 7) throw error;
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
    });
  }

  async lifecycleSummary(taskId, attemptId) {
    let text;
    try { text = await fs.readFile(this.lifecycleFile(taskId, attemptId), 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return { event_count: 0, last_event: null, terminal_observed: false, output_complete: false };
      throw error;
    }
    const events = text.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    const last = events.at(-1) || null;
    return {
      event_count: events.length,
      last_event: last ? { sequence: last.sequence ?? null, type: last.type ?? null, at: last.at ?? null } : null,
      terminal_observed: events.some((event) => event.type === 'process_close'),
      output_complete: events.some((event) => event.type === 'output_complete' && event.output_complete === true),
    };
  }

  async createTask(task, initialFiles = []) {
    return this.serial(async () => {
      const directory = this.taskDirectory(task.task_id);
      await this.io.mkdir(directory, { recursive: false });
      try {
        for (const item of initialFiles) {
          if (!['input/case-snapshot.json', 'task.md', 'agent-instruction.txt'].includes(item.relative_path) || typeof item.content !== 'string') {
            throw new Error('BUILD_INITIAL_FILE_INVALID');
          }
          const file = resolveInside(directory, item.relative_path);
          await this.io.mkdir(path.dirname(file), { recursive: true });
          await this.io.writeFile(file, item.content, { flag: 'wx' });
        }
        await writeJsonAtomic(path.join(directory, 'task.json'), task, this.io);
        return structuredClone(task);
      } catch (error) {
        await this.io.rm(directory, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
    });
  }

  async getTask(taskId) {
    return readJson(path.join(this.taskDirectory(taskId), 'task.json'), null);
  }

  async updateTask(taskId, updater) {
    return this.serial(async () => {
      const file = path.join(this.taskDirectory(taskId), 'task.json');
      const current = await readJson(file);
      const next = await updater(structuredClone(current));
      if (!next || next.task_id !== taskId) throw new Error('BUILD_TASK_UPDATE_INVALID');
      await writeJsonAtomic(file, next, this.io);
      return structuredClone(next);
    });
  }

  async listTasks() {
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const tasks = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^build-[a-z0-9-]{8,80}$/.test(entry.name)) continue;
      const task = await this.getTask(entry.name);
      if (task) tasks.push(task);
    }
    return tasks.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  }

  async getBudget() {
    const budget = await readJson(this.budgetFile);
    if (budget?.schema !== 'workbench/build-stage-budget-v1' || budget.phase !== 'M2-C') throw new Error('BUILD_BUDGET_INVALID');
    return structuredClone(budget);
  }

  async getRevalidationAuthorization() {
    const record = await readJson(this.revalidationAuthorizationFile, null);
    if (!record) return null;
    if (!authorizationValid(record, this.authorizationId)) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
    return structuredClone(record);
  }

  async registerProjectCaseAuthorization(record) {
    if (![M3B2_PROJECT_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID].includes(this.authorizationId) ||
        !authorizationValid(record, this.authorizationId) || record.used_starts !== 0) {
      throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
    }
    return this.serial(async () => {
      const current = await readJson(this.revalidationAuthorizationFile, null);
      if (current) {
        if (!authorizationValid(current, this.authorizationId) || JSON.stringify(current.scope) !== JSON.stringify(record.scope)) {
          throw new Error('BUILD_REVALIDATION_AUTHORIZATION_CONFLICT');
        }
        return structuredClone(current);
      }
      await writeJsonAtomic(this.revalidationAuthorizationFile, record, this.io);
      return structuredClone(record);
    });
  }

  async registerRevalidationAuthorization(record) {
    return this.serial(async () => {
      const current = await readJson(this.revalidationAuthorizationFile, null);
      if (current) {
        if (current.authorization_id !== record.authorization_id) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_CONFLICT');
        return structuredClone(current);
      }
      const budget = await readJson(this.budgetFile);
      if (budget.phase !== 'M2-C' || budget.used_starts !== 1 || budget.claims.length !== 1) {
        throw new Error('BUILD_REVALIDATION_BASELINE_MISMATCH');
      }
      if (record.authorization_id !== this.authorizationId || record.kind !== 'initial' || record.max_starts !== 1 || record.used_starts !== 0) {
        throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
      }
      await writeJsonAtomic(this.revalidationAuthorizationFile, record, this.io);
      return structuredClone(record);
    });
  }

  async claimRevalidationStart(authorizationId, taskId, attemptId, now) {
    return this.serial(async () => {
      const authorization = await readJson(this.revalidationAuthorizationFile);
      if (authorizationId !== this.authorizationId || !authorizationValid(authorization, authorizationId)) {
        throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
      }
      if (authorization.claims.some((claim) => claim.task_id === taskId && claim.attempt_id === attemptId)) return structuredClone(authorization);
      if (authorization.used_starts >= authorization.max_starts) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_EXHAUSTED');
      authorization.used_starts += 1;
      authorization.claims.push({ task_id: taskId, attempt_id: attemptId, claimed_at: now, trigger: 'harness_process_spawn' });
      await writeJsonAtomic(this.revalidationAuthorizationFile, authorization, this.io);
      return structuredClone(authorization);
    });
  }

  async claimStart(taskId, attemptId, now) {
    return this.serial(async () => {
      const budget = await readJson(this.budgetFile);
      if (budget.claims.some((claim) => claim.task_id === taskId && claim.attempt_id === attemptId)) return structuredClone(budget);
      if (budget.used_starts >= budget.max_starts) throw new Error('BUILD_STAGE_BUDGET_EXHAUSTED');
      budget.used_starts += 1;
      budget.claims.push({ task_id: taskId, attempt_id: attemptId, claimed_at: now });
      await writeJsonAtomic(this.budgetFile, budget, this.io);
      return structuredClone(budget);
    });
  }

  async recoverInterrupted(now = new Date().toISOString(), serviceInstanceId = null) {
    const recovered = [];
    for (const task of await this.listTasks()) {
      const staleAttempt = task.attempts?.some((attempt) => attempt.status === 'RUNNING');
      if (!ACTIVE_TASK_STATES.has(task.task_status) && !staleAttempt) continue;
      const runningAttempt = task.attempts?.find((attempt) => attempt.status === 'RUNNING');
      const observation = runningAttempt ? await this.lifecycleSummary(task.task_id, runningAttempt.attempt_id) : null;
      if (runningAttempt) {
        await this.appendLifecycle(task.task_id, runningAttempt.attempt_id, {
          schema: 'workbench/build-lifecycle-event-v1',
          sequence: (observation?.last_event?.sequence || 0) + 1,
          at: now,
          task_id: task.task_id,
          attempt_id: runningAttempt.attempt_id,
          service_instance_id: serviceInstanceId,
          type: 'recovered_interrupted',
          reason: 'coordinator_restart_without_terminal',
          partial_observation: true,
        });
      }
      await this.updateTask(task.task_id, (current) => ({
        ...current,
        task_status: 'INTERRUPTED',
        generation_status: current.generation_status === 'RUNNING' ? 'INTERRUPTED' : current.generation_status,
        verification_status: current.verification_status === 'RUNNING' ? 'INTERRUPTED' : current.verification_status,
        human_review_status: 'NOT_READY',
        active_attempt_id: null,
        finished_at: now,
        attempts: (current.attempts || []).map((attempt) => attempt.status === 'RUNNING' ? {
          ...attempt,
          status: 'INTERRUPTED',
          finished_at: now,
          observation: { ...(attempt.observation || {}), complete: false, recovery: observation },
          error: { code: 'SERVICE_RESTARTED', message: '工作台重启时该尝试仍未收口；最后事件之后缺少终态，原因未知，未自动恢复模型调用。', cause: 'UNKNOWN' },
        } : attempt),
        error: { code: 'SERVICE_RESTARTED', message: '工作台重启时发现未收口建例任务；历史原因未知，未自动恢复模型调用。', cause: 'UNKNOWN' },
      }));
      recovered.push(task.task_id);
    }
    return recovered;
  }
}

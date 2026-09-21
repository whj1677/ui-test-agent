import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside } from '../integrity.mjs';

const ACTIVE_TASK_STATES = new Set(['STARTING', 'GENERATING', 'VERIFYING', 'CANCELLING']);
const RETRYABLE_WRITE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
export const M2C_REVALIDATION_AUTHORIZATION_ID = 'm2c-diagnostic-revalidation-20260921';

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
    this.revalidationAuthorizationFile = path.join(this.root, 'revalidation-authorization.json');
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

  async createTask(task) {
    return this.serial(async () => {
      const directory = this.taskDirectory(task.task_id);
      await fs.mkdir(directory, { recursive: false });
      await writeJsonAtomic(path.join(directory, 'task.json'), task, this.io);
      return structuredClone(task);
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
    if (record.schema !== 'workbench/build-revalidation-authorization-v1' ||
        record.authorization_id !== M2C_REVALIDATION_AUTHORIZATION_ID ||
        record.kind !== 'initial' || record.max_starts !== 1 ||
        !Number.isInteger(record.used_starts) || record.used_starts < 0 || record.used_starts > 1 ||
        !Array.isArray(record.claims)) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
    return structuredClone(record);
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
      if (record.authorization_id !== M2C_REVALIDATION_AUTHORIZATION_ID || record.kind !== 'initial' || record.max_starts !== 1 || record.used_starts !== 0) {
        throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
      }
      await writeJsonAtomic(this.revalidationAuthorizationFile, record, this.io);
      return structuredClone(record);
    });
  }

  async claimRevalidationStart(authorizationId, taskId, attemptId, now) {
    return this.serial(async () => {
      const authorization = await readJson(this.revalidationAuthorizationFile);
      if (authorization.authorization_id !== authorizationId || authorization.kind !== 'initial' || authorization.max_starts !== 1) {
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

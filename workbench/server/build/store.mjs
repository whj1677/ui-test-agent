import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside } from '../integrity.mjs';

const ACTIVE_TASK_STATES = new Set(['STARTING', 'GENERATING', 'VERIFYING', 'CANCELLING']);

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporary, file);
        break;
      } catch (error) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
  }
  finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}

export class BuildTaskStore {
  #queue = Promise.resolve();

  constructor(root) {
    this.root = path.resolve(root);
    this.budgetFile = path.join(this.root, 'stage-budget.json');
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
      });
    }
  }

  taskDirectory(taskId) {
    if (!/^build-[a-z0-9-]{8,80}$/.test(taskId)) throw new Error('INVALID_BUILD_TASK_ID');
    return resolveInside(this.root, taskId);
  }

  async createTask(task) {
    return this.serial(async () => {
      const directory = this.taskDirectory(task.task_id);
      await fs.mkdir(directory, { recursive: false });
      await writeJsonAtomic(path.join(directory, 'task.json'), task);
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
      await writeJsonAtomic(file, next);
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

  async claimStart(taskId, attemptId, now) {
    return this.serial(async () => {
      const budget = await readJson(this.budgetFile);
      if (budget.claims.some((claim) => claim.task_id === taskId && claim.attempt_id === attemptId)) return structuredClone(budget);
      if (budget.used_starts >= budget.max_starts) throw new Error('BUILD_STAGE_BUDGET_EXHAUSTED');
      budget.used_starts += 1;
      budget.claims.push({ task_id: taskId, attempt_id: attemptId, claimed_at: now });
      await writeJsonAtomic(this.budgetFile, budget);
      return structuredClone(budget);
    });
  }

  async recoverInterrupted(now = new Date().toISOString()) {
    const recovered = [];
    for (const task of await this.listTasks()) {
      const staleAttempt = task.attempts?.some((attempt) => attempt.status === 'RUNNING');
      if (!ACTIVE_TASK_STATES.has(task.task_status) && !staleAttempt) continue;
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
          error: { code: 'SERVICE_RESTARTED', message: '工作台重启时该尝试仍未收口；未自动恢复模型调用。' },
        } : attempt),
        error: { code: 'SERVICE_RESTARTED', message: '工作台重启时发现未收口建例任务；未自动恢复模型调用。' },
      }));
      recovered.push(task.task_id);
    }
    return recovered;
  }
}

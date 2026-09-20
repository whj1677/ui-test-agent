import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside } from './integrity.mjs';

const ACTIVE_STATES = new Set(['QUEUED', 'STARTING', 'RUNNING', 'STOPPING']);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

function comparableAsset(asset) {
  const copy = structuredClone(asset);
  delete copy.registered_at;
  return JSON.stringify(copy);
}

export class WorkbenchStore {
  #queue = Promise.resolve();

  constructor(dataRoot) {
    this.dataRoot = path.resolve(dataRoot);
    this.catalogFile = path.join(this.dataRoot, 'catalog.json');
    this.runsRoot = path.join(this.dataRoot, 'runs');
  }

  async init() {
    await fs.mkdir(this.runsRoot, { recursive: true });
    try {
      await fs.access(this.catalogFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeJsonAtomic(this.catalogFile, { schema: 'approved-workbench/catalog-v1', assets: [] });
    }
  }

  serial(operation) {
    const next = this.#queue.then(operation, operation);
    this.#queue = next.catch(() => {});
    return next;
  }

  async listAssets() {
    const catalog = await readJson(this.catalogFile);
    if (catalog?.schema !== 'approved-workbench/catalog-v1' || !Array.isArray(catalog.assets)) {
      throw new Error('CATALOG_INVALID');
    }
    return structuredClone(catalog.assets);
  }

  async getAsset(assetId) {
    return (await this.listAssets()).find((asset) => asset.asset_id === assetId) || null;
  }

  async registerAsset(asset) {
    return this.serial(async () => {
      const catalog = await readJson(this.catalogFile);
      const current = catalog.assets.find((item) => item.asset_id === asset.asset_id);
      if (current) {
        if (comparableAsset(current) !== comparableAsset(asset)) throw new Error('ASSET_ID_CONFLICT');
        return { asset: current, created: false };
      }
      catalog.assets.push(structuredClone(asset));
      await writeJsonAtomic(this.catalogFile, catalog);
      return { asset, created: true };
    });
  }

  runDirectory(runId) {
    if (!/^[a-z0-9][a-z0-9-]{7,80}$/.test(runId)) throw new Error('INVALID_RUN_ID');
    return resolveInside(this.runsRoot, runId);
  }

  async createRun(run) {
    return this.serial(async () => {
      const directory = this.runDirectory(run.run_id);
      await fs.mkdir(directory, { recursive: false });
      await writeJsonAtomic(path.join(directory, 'run.json'), run);
      return structuredClone(run);
    });
  }

  async getRun(runId) {
    const file = path.join(this.runDirectory(runId), 'run.json');
    return readJson(file, null);
  }

  async updateRun(runId, updater) {
    return this.serial(async () => {
      const file = path.join(this.runDirectory(runId), 'run.json');
      const current = await readJson(file);
      const next = await updater(structuredClone(current));
      if (!next || next.run_id !== runId) throw new Error('RUN_UPDATE_INVALID');
      await writeJsonAtomic(file, next);
      return structuredClone(next);
    });
  }

  async listRuns() {
    const entries = await fs.readdir(this.runsRoot, { withFileTypes: true });
    const runs = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]{7,80}$/.test(entry.name)) continue;
      const run = await this.getRun(entry.name);
      if (run) runs.push(run);
    }
    return runs.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  }

  async recoverInterrupted(now = new Date().toISOString()) {
    const recovered = [];
    for (const run of await this.listRuns()) {
      if (!ACTIVE_STATES.has(run.execution_status)) continue;
      const next = await this.updateRun(run.run_id, (current) => ({
        ...current,
        execution_status: 'INTERRUPTED',
        finished_at: now,
        process: { ...current.process, pid: null, state: 'INTERRUPTED' },
        evidence_status: 'INCOMPLETE',
        error: { code: 'SERVICE_RESTARTED', message: '工作台重启时发现未收口运行；未自动重放。' },
      }));
      recovered.push(next.run_id);
    }
    return recovered;
  }
}

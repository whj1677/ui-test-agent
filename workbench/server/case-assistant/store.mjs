import fs from 'node:fs/promises';
import path from 'node:path';
import { writeAtomicJsonLine } from '../atomic-json.mjs';

const PROJECT = /^project-[a-z0-9-]{8,80}$/;
const CONVERSATION = /^conversation-[a-f0-9-]{36}$/;
const assertId = (value, pattern) => {
  if (typeof value !== 'string' || !pattern.test(value)) throw Error('CASE_ASSISTANT_ID_INVALID');
  return value;
};

export class CaseAssistantStore {
  #queue = Promise.resolve();
  constructor(root) { this.root = path.resolve(root); }
  serial(fn) {
    const next = this.#queue.then(fn, fn);
    this.#queue = next.catch(() => {});
    return next;
  }
  directory(projectId) { return path.join(this.root, assertId(projectId, PROJECT)); }
  file(projectId, id) { return path.join(this.directory(projectId), `${assertId(id, CONVERSATION)}.json`); }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    // Recovery records interruption; starting the service never resends a model request.
    for (const item of await fs.readdir(this.root, { withFileTypes: true })) {
      if (!item.isDirectory() || !PROJECT.test(item.name)) continue;
      for (const conversation of await this.list(item.name)) {
        if (!conversation.turns.some(turn => turn.status === 'RUNNING')) continue;
        for (const turn of conversation.turns) if (turn.status === 'RUNNING') {
          Object.assign(turn, { status: 'INTERRUPTED', stage: '服务已重启，本轮未完成',
            error: 'CASE_ASSISTANT_INTERRUPTED', finished_at: new Date().toISOString() });
        }
        conversation.active_turn_id = null;
        await this.write(conversation);
      }
    }
  }
  async get(projectId, id) {
    let value;
    try { value = JSON.parse(await fs.readFile(this.file(projectId, id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw Error('CASE_ASSISTANT_NOT_FOUND'); throw error; }
    if (value.id !== id || value.project_id !== projectId || !Array.isArray(value.turns) || !Array.isArray(value.messages)) {
      throw Error('CASE_ASSISTANT_RECORD_INVALID');
    }
    return value;
  }
  async list(projectId) {
    let files;
    try { files = await fs.readdir(this.directory(projectId)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const records = [];
    for (const file of files) if (file.endsWith('.json') && CONVERSATION.test(file.slice(0, -5))) {
      records.push(await this.get(projectId, file.slice(0, -5)));
    }
    return records.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async write(value) {
    await writeAtomicJsonLine(this.file(value.project_id, value.id), value);
  }
}

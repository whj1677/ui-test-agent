import { randomUUID, createHash } from 'node:crypto';
import { CaseAssistantStore } from './store.mjs';
import { checkAssistantOutput, exportAssistantWorkbook } from './output.mjs';

const now = () => new Date().toISOString();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function checkedTurn(value, turn) {
  const end = value.messages.findIndex(message => message.id === turn.user_message_id);
  return checkAssistantOutput(turn, { sources: turn.source_snapshots, messages: value.messages.slice(0, end + 1) });
}
const publicConversation = value => ({ ...value, sources: value.sources.map(({ segments, ...source }) => source),
  turns: value.turns.map(turn => {
    const { source_snapshots, ...visible } = turn;
    // Recheck older drafts with today's export rules without overwriting their history.
    if (turn.status === 'COMPLETED') {
      const checked = checkedTurn(value, turn);
      visible.cases = checked.cases;
      visible.checks = checked.checks;
    }
    return visible;
  }) });
const safeError = error => /^CASE_ASSISTANT_[A-Z0-9_]{1,100}$/.test(error?.message || '')
  ? error.message : 'CASE_ASSISTANT_GENERATION_FAILED';

export class CaseAssistantManager {
  constructor({ root, projectStore, sourceStore, client, accepting = () => true, otherActive = () => false }) {
    this.store = new CaseAssistantStore(root);
    Object.assign(this, { projectStore, sourceStore, client, accepting, otherActive });
    this.active = null;
    this.starting = false;
    this.shutdownRequested = false;
  }
  async init() { await this.store.init(); }
  async project(id) { if (!await this.projectStore.getProject(id)) throw Error('CASE_ASSISTANT_PROJECT_NOT_FOUND'); }
  diagnostics() {
    return { available: this.client?.available === true, active_turn_id: this.active?.turnId || null,
      conversation_id: this.active?.conversationId || null, project_id: this.active?.projectId || null,
      starting: this.starting, storage_fault: Boolean(this.storageFault) };
  }
  async list(projectId) {
    await this.project(projectId);
    return { capabilities: this.diagnostics(), conversations: (await this.store.list(projectId)).map(value => ({
      id: value.id, title: value.title, updated_at: value.updated_at, active_turn_id: value.active_turn_id,
    })) };
  }
  async create(projectId, { title = '新用例对话' } = {}) {
    await this.project(projectId);
    if (typeof title !== 'string' || !title.trim() || title.length > 120) throw Error('CASE_ASSISTANT_TITLE_INVALID');
    return this.store.serial(async () => {
      if (this.active?.projectId === projectId) {
        const running = await this.store.get(projectId, this.active.conversationId);
        if (running.active_turn_id) return publicConversation(running);
      }
      const value = { schema: 'case-assistant/v1', id: `conversation-${randomUUID()}`, project_id: projectId,
        title: title.trim(), source_ids: [], sources: [], messages: [], turns: [], active_turn_id: null, created_at: now(), updated_at: now() };
      await this.store.write(value);
      return publicConversation(value);
    });
  }
  async get(projectId, id) {
    await this.project(projectId);
    return publicConversation(await this.store.get(projectId, id));
  }
  async send(projectId, id, input) {
    await this.project(projectId);
    const { request_id: requestId, text = '', source_ids: sourceIds = [] } = input || {};
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(requestId)) throw Error('CASE_ASSISTANT_REQUEST_ID_INVALID');
    if (!Array.isArray(sourceIds) || sourceIds.length > 20 || sourceIds.some(id => typeof id !== 'string' || !/^source-[a-f0-9-]{36}$/.test(id))) throw Error('CASE_ASSISTANT_SOURCES_INVALID');
    if (typeof text !== 'string' || text.length > 12000 || (!text.trim() && !sourceIds.length)) throw Error('CASE_ASSISTANT_MESSAGE_INVALID');
    return this.store.serial(async () => {
      const value = await this.store.get(projectId, id);
      const requestHash = digest({ text, source_ids: [...new Set(sourceIds)].sort() });
      const old = value.turns.find(turn => turn.request_id === requestId);
      if (old) {
        if (old.request_sha256 !== requestHash) throw Error('CASE_ASSISTANT_REQUEST_CONFLICT');
        return publicConversation(value);
      }
      if (!this.accepting() || this.shutdownRequested || this.storageFault) throw Error('CASE_ASSISTANT_SERVICE_STOPPING');
      if (this.active || this.starting || this.otherActive()) throw Error('CASE_ASSISTANT_BUSY');
      if (!this.client?.available) throw Error('CASE_ASSISTANT_MODEL_UNAVAILABLE');
      if (value.turns.length >= 40 || value.messages.reduce((n, m) => n + m.text.length, 0) + text.length > 180000) throw Error('CASE_ASSISTANT_CONVERSATION_LIMIT');
      this.starting = true;
      try {
        const ids = [...new Set([...value.source_ids, ...sourceIds])];
        if (ids.length > 20) throw Error('CASE_ASSISTANT_SOURCE_LIMIT');
        const sources = [];
        let bytes = 0;
        for (const sourceId of ids) {
          const source = await this.sourceStore.getSource(projectId, sourceId);
          if (!source || source.project_id !== projectId) throw Error('CASE_ASSISTANT_SOURCE_NOT_FOUND');
          bytes += source.bytes;
          if (bytes > 60 * 1024 * 1024) throw Error('CASE_ASSISTANT_SOURCE_LIMIT');
          sources.push({ ...source, body: await this.sourceStore.getSourceBytes(projectId, sourceId) });
        }
        if (!this.accepting() || this.shutdownRequested || this.otherActive()) throw Error('CASE_ASSISTANT_BUSY');
        const message = { id: `message-${randomUUID()}`, role: 'user', text: text.trim() || '请结合本轮资料，帮助我设计测试用例。',
          source_ids: [...sourceIds], created_at: now() };
        const turn = { id: `turn-${randomUUID()}`, request_id: requestId, request_sha256: requestHash,
          user_message_id: message.id, status: 'RUNNING', stage: '正在读取资料并准备对话', source_ids: ids,
          source_snapshots: sources.map(({ body, ...source }) => source),
          created_at: now(), reply: '', questions: [], cases: [], checks: { issues: [], ready_count: 0, pending_count: 0 } };
        value.messages.push(message);
        value.source_ids = ids;
        value.sources = sources.map(({ body, ...source }) => source);
        value.turns.push(turn);
        value.active_turn_id = turn.id;
        value.updated_at = now();
        if (value.turns.length === 1 && value.title === '新用例对话') value.title = message.text.slice(0, 45);
        await this.store.write(value);
        const active = { projectId, conversationId: id, turnId: turn.id, controller: new AbortController() };
        this.active = active;
        this.completion = this.process(active, structuredClone(value), sources).finally(() => { if (this.active === active) this.active = null; });
        // The request has been durably accepted; polling never sends it again.
        this.completion.catch(() => {});
        return publicConversation(value);
      } finally { this.starting = false; }
    });
  }
  async process(active, frozen, sources) {
    let lastStage = '';
    try {
      const previousTurn = frozen.turns.slice(0, -1).findLast(turn => turn.status === 'COMPLETED');
      const previous = previousTurn ? checkedTurn(frozen, previousTurn) : null;
      const result = await this.client.generate({ taskId: active.turnId, projectId: active.projectId, turnId: active.turnId,
        messages: frozen.messages, sources, previous, signal: active.controller.signal,
        onProgress: event => {
          const stage = typeof event === 'string' ? event : event?.stage;
          if (typeof stage !== 'string' || stage === lastStage) return;
          lastStage = stage;
          void this.store.serial(async () => {
            const value = await this.store.get(active.projectId, active.conversationId);
            const turn = value.turns.find(turn => turn.id === active.turnId);
            if (turn.status !== 'RUNNING') return;
            turn.stage = stage.slice(0, 160);
            await this.store.write(value);
          }).catch(() => { this.storageFault = true; active.controller.abort(); });
        } });
      const checked = checkAssistantOutput(result, { sources: frozen.sources, messages: frozen.messages });
      await this.store.serial(async () => {
        const value = await this.store.get(active.projectId, active.conversationId);
        const turn = value.turns.find(turn => turn.id === active.turnId);
        if (active.controller.signal.aborted) Object.assign(turn, { status: 'CANCELLED', stage: '本轮已停止' });
        else {
          Object.assign(turn, checked, { status: 'COMPLETED', stage: '本轮已完成', execution: result.execution || null });
          value.messages.push({ id: `message-${randomUUID()}`, role: 'assistant', text: checked.reply || '已整理本轮用例，请查看检查结果。', turn_id: turn.id, created_at: now() });
        }
        turn.finished_at = now();
        value.active_turn_id = null;
        value.updated_at = now();
        await this.store.write(value);
      });
    } catch (error) {
      await this.store.serial(async () => {
        const value = await this.store.get(active.projectId, active.conversationId);
        const turn = value.turns.find(turn => turn.id === active.turnId);
        Object.assign(turn, { status: active.controller.signal.aborted ? 'CANCELLED' : 'FAILED',
          stage: active.controller.signal.aborted ? '本轮已停止' : '本轮未完成，资料和对话已保留',
          error: safeError(error), execution: error.execution || null, finished_at: now() });
        value.active_turn_id = null;
        value.updated_at = now();
        await this.store.write(value);
      }).catch(() => { this.storageFault = true; });
    }
  }
  async cancel(projectId, id) {
    await this.project(projectId);
    const value = await this.store.get(projectId, id);
    if (this.active?.projectId === projectId && this.active.conversationId === id) this.active.controller.abort();
    return publicConversation(value);
  }
  async export(projectId, id, turnId, caseType) {
    await this.project(projectId);
    const conversation = await this.store.get(projectId, id);
    const turn = conversation.turns.find(turn => turn.id === turnId);
    if (!turn) throw Error('CASE_ASSISTANT_TURN_NOT_FOUND');
    if (turn.status !== 'COMPLETED') throw Error('CASE_ASSISTANT_EXPORT_NOT_READY');
    const lastMessage = conversation.messages.findIndex(message => message.id === turn.user_message_id);
    const frozen = { ...conversation, sources: turn.source_snapshots, messages: conversation.messages.slice(0, lastMessage + 1) };
    return exportAssistantWorkbook({ conversation: frozen, turn, caseType });
  }
  async shutdown() {
    this.shutdownRequested = true;
    this.active?.controller.abort();
    await this.completion;
  }
}

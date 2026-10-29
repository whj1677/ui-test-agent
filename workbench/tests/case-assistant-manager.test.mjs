import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { CaseAssistantManager } from '../server/case-assistant/manager.mjs';
import { caseAssistantRoute } from '../server/case-assistant/routes.mjs';
import { CaseAssistantMcpSession } from '../server/case-assistant/mcp-session.mjs';

const projectId = 'project-11111111-1111-1111-1111-111111111111';
const otherProject = 'project-22222222-2222-2222-2222-222222222222';
const sourceId = 'source-33333333-3333-3333-3333-333333333333';
const answer = cases => ({ reply: '请核对本轮用例。', questions: [], cases, image_observations: [] });
const caseFrom = ref => ({ case_id: 'draft-1', case_type: 'UI', external_id: 'UI-01', title: '查询设备', module: '设备', preconditions: '已有设备 A 与 B', test_data: '设备编号 A', pending_questions: [],
  steps: [{ order: 1, action: '输入设备编号 A 并查询', expected: '只显示匹配编号的设备', source_refs: [ref] }] });
const messageCase = input => caseFrom({ message_id: input.messages.find(message => message.role === 'user').id });
const sourceCase = () => caseFrom({ source_id: sourceId, segment_id: 'segment-1', quote: '只显示匹配编号的设备' });

function deferredClient() {
  const calls = [];
  return { available: true, calls, generate(input) {
    return new Promise((resolve, reject) => calls.push({ input, resolve, reject }));
  } };
}

async function setup(t, { client = deferredClient(), accepting, otherActive } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-assistant-manager-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('查询后只显示匹配编号的设备。');
  const sources = new Map([[sourceId, { snapshot_id: sourceId, project_id: projectId, kind: 'PRD', file_name: '需求.md', extension: '.md',
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), read_status: 'READ',
    segments: [{ segment_id: 'segment-1', text: bytes.toString('utf8'), location: { line: 1 } }], body: bytes }]]);
  const projectStore = { async getProject(id) { return [projectId, otherProject].includes(id) ? { project_id: id } : null; } };
  const sourceStore = {
    async getSource(_project, id) { const source = sources.get(id); return source ? structuredClone(Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'body'))) : null; },
    async getSourceBytes(_project, id) { return sources.get(id)?.body; },
  };
  const options = { root, projectStore, sourceStore, client, accepting, otherActive };
  const manager = new CaseAssistantManager(options); await manager.init();
  const conversation = await manager.create(projectId);
  return { root, manager, conversation, client, sources, options };
}

test('empty chat waits for input; text-only dialogue can clarify and reuse prior user evidence', async t => {
  const client = deferredClient(), { manager, conversation } = await setup(t, { client });
  assert.equal(conversation.messages.length, 0);
  assert.equal(conversation.turns.length, 0);
  await assert.rejects(manager.send(projectId, conversation.id, { request_id: 'empty-request', text: '' }), /CASE_ASSISTANT_MESSAGE_INVALID/);
  await manager.send(projectId, conversation.id, { request_id: 'first-request', text: '查询设备 A 只显示匹配编号的设备。' });
  assert.equal(client.calls[0].input.sources.length, 0);
  client.calls[0].resolve({ reply: '是否需要后端用例？', questions: ['是否需要后端用例？'], cases: [], image_observations: [] });
  await manager.completion;
  await manager.send(projectId, conversation.id, { request_id: 'second-request', text: '只生成前端用例。' });
  const second = client.calls[1].input;
  assert.deepEqual(second.previous.cases, []);
  assert.deepEqual(second.previous.questions, ['是否需要后端用例？']);
  assert.deepEqual(Object.keys(second.previous).sort(), ['cases', 'checks', 'image_observations', 'questions', 'reply']);
  assert.equal(Object.hasOwn(second.previous, 'source_snapshots'), false);
  assert.deepEqual(second.messages.map(message => message.role), ['user', 'assistant', 'user']);
  client.calls[1].resolve(answer([messageCase(second)]));
  await manager.completion;
  const saved = await manager.get(projectId, conversation.id);
  assert.equal(saved.turns[1].checks.ready_count, 1);
  assert.equal(saved.turns[1].cases[0].steps[0].source_refs[0].message_id, saved.messages[0].id);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await manager.export(projectId, conversation.id, saved.turns[1].id, 'UI'));
  assert.equal(workbook.worksheets[0].getCell('H2').value, '待确认');
});

test('simultaneous duplicate request is idempotent while conflicting payload and another request are rejected', async t => {
  const { manager, conversation, client } = await setup(t);
  const input = { request_id: 'same-request', text: '查询设备。' };
  const [first, repeated] = await Promise.all([manager.send(projectId, conversation.id, input), manager.send(projectId, conversation.id, input)]);
  assert.equal(client.calls.length, 1);
  assert.equal(first.turns[0].id, repeated.turns[0].id);
  assert.equal(repeated.messages.length, 1);
  await assert.rejects(manager.send(projectId, conversation.id, { ...input, text: '改了文字' }), /CASE_ASSISTANT_REQUEST_CONFLICT/);
  await assert.rejects(manager.send(projectId, conversation.id, { ...input, request_id: 'another-request' }), /CASE_ASSISTANT_BUSY/);
  client.calls[0].resolve(answer([])); await manager.completion;
  await manager.send(projectId, conversation.id, input);
  assert.equal(client.calls.length, 1);
  assert.equal((await manager.get(projectId, conversation.id)).turns.length, 1);
});

test('creating a conversation while the same project generates resumes the existing turn without another call', async t => {
  const {manager,conversation,client}=await setup(t);
  await manager.send(projectId,conversation.id,{request_id:'active-generation',text:'设计设备查询用例。'});
  const before=await manager.get(projectId,conversation.id);
  const [first,second]=await Promise.all([manager.create(projectId),manager.create(projectId)]);
  assert.equal(first.id,conversation.id);assert.equal(second.id,conversation.id);
  assert.equal(first.active_turn_id,before.active_turn_id);assert.equal(client.calls.length,1);
  assert.equal((await manager.list(projectId)).conversations.length,1);
  const other=await manager.create(otherProject);assert.notEqual(other.id,conversation.id);
  client.calls[0].resolve(answer([]));await manager.completion;
  assert.notEqual((await manager.create(projectId)).id,conversation.id,'a completed turn does not permanently prevent a new conversation');
  assert.deepEqual((await manager.get(projectId,conversation.id)).messages.slice(0,1),before.messages);
});

test('two conversations cannot launch concurrent generations and a source-read race observes external activity', async t => {
  const fixture = await setup(t), { manager, conversation, client } = fixture;
  const other = await manager.create(otherProject);
  await manager.send(projectId, conversation.id, { request_id: 'request-one', text: '设计用例。' });
  await assert.rejects(manager.send(otherProject, other.id, { request_id: 'request-two', text: '另一个项目。' }), /CASE_ASSISTANT_BUSY/);
  client.calls[0].resolve(answer([])); await manager.completion;
  let busy = false;
  manager.otherActive = () => busy;
  const originalRead = manager.sourceStore.getSourceBytes;
  manager.sourceStore.getSourceBytes = async (...args) => { busy = true; return originalRead(...args); };
  await assert.rejects(manager.send(projectId, conversation.id, { request_id: 'request-source', source_ids: [sourceId] }), /CASE_ASSISTANT_BUSY/);
  assert.equal(client.calls.length, 1);
  assert.equal((await manager.get(projectId, conversation.id)).turns.length, 1);
  assert.equal(manager.starting, false);
});

test('late model success and progress after cancellation cannot overwrite CANCELLED', async t => {
  const { manager, conversation, client } = await setup(t);
  await manager.send(projectId, conversation.id, { request_id: 'cancel-request', text: '查询设备。' });
  const call = client.calls[0];
  await manager.cancel(projectId, conversation.id);
  assert.equal(call.input.signal.aborted, true);
  call.input.onProgress('模型仍发来进度');
  call.resolve(answer([messageCase(call.input)]));
  await manager.completion;
  call.input.onProgress('迟到的完成进度');
  await manager.store.serial(async () => {});
  const saved = await manager.get(projectId, conversation.id);
  assert.equal(saved.turns[0].status, 'CANCELLED');
  assert.equal(saved.turns[0].stage, '本轮已停止');
  assert.equal(saved.messages.filter(message => message.role === 'assistant').length, 0);
  assert.equal(saved.active_turn_id, null);
  assert.equal(manager.active, null);
  await assert.rejects(manager.export(projectId, conversation.id, saved.turns[0].id, 'UI'), /CASE_ASSISTANT_EXPORT_NOT_READY/);
});

test('shutdown aborts the active request and restart recovery never automatically calls a model', async t => {
  const fixture = await setup(t), { manager, conversation, client, options } = fixture;
  await manager.send(projectId, conversation.id, { request_id: 'shutdown-request', text: '设计前端用例。' });
  const shutdown = manager.shutdown();
  assert.equal(client.calls[0].input.signal.aborted, true);
  client.calls[0].reject(new Error('process aborted with private path'));
  await shutdown;
  const saved = await manager.get(projectId, conversation.id);
  assert.equal(saved.turns[0].status, 'CANCELLED');
  assert.equal(saved.turns[0].error, 'CASE_ASSISTANT_GENERATION_FAILED');
  const crashRecord = await manager.store.get(projectId, conversation.id);
  Object.assign(crashRecord.turns[0], { status: 'RUNNING', stage: '读取资料' });
  crashRecord.active_turn_id = crashRecord.turns[0].id;
  await manager.store.write(crashRecord);
  const recoveredClient = deferredClient(), recovered = new CaseAssistantManager({ ...options, client: recoveredClient });
  await recovered.init();
  const after = await recovered.get(projectId, conversation.id);
  assert.equal(after.turns[0].status, 'INTERRUPTED');
  assert.equal(after.active_turn_id, null);
  assert.equal(recoveredClient.calls.length, 0);
  await recovered.send(projectId, conversation.id, { request_id: 'shutdown-request', text: '设计前端用例。' });
  assert.equal(recoveredClient.calls.length, 0);
});

test('cross-project conversation/source access and path traversal fail without creating a model request', async t => {
  const { manager, conversation, client } = await setup(t);
  await assert.rejects(manager.get(otherProject, conversation.id), /CASE_ASSISTANT_NOT_FOUND/);
  await assert.rejects(manager.get(projectId, '../conversation-escape'), /CASE_ASSISTANT_ID_INVALID/);
  const second = await manager.create(otherProject);
  await assert.rejects(manager.send(otherProject, second.id, { request_id: 'foreign-source', source_ids: [sourceId] }), /CASE_ASSISTANT_SOURCE_NOT_FOUND/);
  assert.equal(client.calls.length, 0);
  assert.equal((await manager.get(otherProject, second.id)).messages.length, 0);
});

test('malformed source_ids returns a controlled validation error even with empty text', async t => {
  const { manager, conversation, client } = await setup(t);
  for (const source_ids of [null, 'source-foo', 1, {}])
    await assert.rejects(manager.send(projectId, conversation.id, { request_id: 'invalid-sources', text: '', source_ids }), /CASE_ASSISTANT_SOURCES_INVALID/);
  assert.equal(client.calls.length, 0);
});

test('historical export keeps its original source snapshot after a later turn reads altered metadata', async t => {
  const { manager, conversation, client, sources } = await setup(t);
  await manager.send(projectId, conversation.id, { request_id: 'source-turn-one', source_ids: [sourceId] });
  client.calls[0].resolve(answer([sourceCase()])); await manager.completion;
  const first = (await manager.get(projectId, conversation.id)).turns[0];
  const original = new ExcelJS.Workbook();
  await original.xlsx.load(await manager.export(projectId, conversation.id, first.id, 'UI'));
  // Simulate an inconsistent underlying store without ever changing the first accepted turn.
  const current = sources.get(sourceId), body = Buffer.from('已改变的文档内容');
  sources.set(sourceId, { ...current, body, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), segments: [{ segment_id: 'segment-1', text: body.toString('utf8') }] });
  try {
    await manager.send(projectId, conversation.id, { request_id: 'source-turn-two', text: '补充讨论。' });
    client.calls[1].resolve(answer([])); await manager.completion;
  } catch (error) {
    // Rejecting source mutation is also acceptable; historical output must remain intact.
    assert.match(error.message, /^CASE_ASSISTANT_SOURCE_/);
  }
  const historical = new ExcelJS.Workbook();
  await historical.xlsx.load(await manager.export(projectId, conversation.id, first.id, 'UI'));
  assert.deepEqual(historical.worksheets.map(sheet => sheet.getSheetValues()), original.worksheets.map(sheet => sheet.getSheetValues()));
});

test('route injection rejects untrusted mutations and serves explicit typed downloads without listening', async () => {
  const sent = [], calls = [], response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
  const manager = { async send(...args) { calls.push(args); return { accepted: true }; }, async export(...args) { calls.push(args); return Buffer.from('xlsx-test'); } };
  const base = { response, manager, sendJson: (_response, status, value) => sent.push({ status, value }), readJsonBody: async () => ({ request_id: 'request-fixture', text: 'hello' }) };
  const conversation = 'conversation-44444444-4444-4444-4444-444444444444';
  const prefix = `http://127.0.0.1:4322/api/case-library/projects/${projectId}/case-assistant/conversations/${conversation}`;
  await caseAssistantRoute({ ...base, request: { method: 'POST' }, url: new URL(`${prefix}/messages`), trustedMutation: () => false });
  assert.equal(sent[0].status, 403); assert.equal(calls.length, 0);
  await caseAssistantRoute({ ...base, request: { method: 'GET' }, url: new URL(`${prefix}/turns/turn-1/export?case_type=BACKEND`), trustedMutation: () => false });
  assert.equal(calls[0][3], 'BACKEND');
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.body.toString(), 'xlsx-test');
  await assert.rejects(caseAssistantRoute({ ...base, request: { method: 'GET' }, url: new URL(`${prefix}/turns/turn-1/export?case_type=anything`), trustedMutation: () => true }), /CASE_ASSISTANT_CASE_TYPE_INVALID/);
});

test('manager and real MCP session share source-reading, submission and workbook checks without a server', async t => {
  const evidence = [];
  const client = { available: true, async generate(input) {
    const session = new CaseAssistantMcpSession(input);
    await session.invoke('read_context');
    // Unread references remain visible warnings, never valid evidence or human approval.
    const staged = await session.invoke('stage_cases', { cases: [sourceCase()] });
    assert.equal(staged.human_approved, false);
    assert(staged.checks.issues.some(issue => issue.code === 'SOURCE_REF_INVALID' && issue.severity === 'WARNING'));
    await session.invoke('read_source', { source_id: sourceId });
    const result = await session.invoke('submit_response', answer([sourceCase()]));
    assert.equal(result.accepted, true);
    assert.equal(result.checks.ready_count, 1);
    evidence.push(session.evidence());
    return { ...session.response, execution: { engine: 'injected-mcp-session' } };
  } };
  const { manager, conversation } = await setup(t, { client });
  await manager.send(projectId, conversation.id, { request_id: 'mcp-cross-check', source_ids: [sourceId] });
  await manager.completion;
  const saved = await manager.get(projectId, conversation.id);
  assert.equal(saved.turns[0].status, 'COMPLETED');
  assert.equal(saved.turns[0].checks.ready_count, 1);
  assert.equal(saved.turns[0].execution.engine, 'injected-mcp-session');
  assert.equal(evidence[0].context_read, true);
  assert.equal(evidence[0].source_segments_read, 1);
  assert((await manager.export(projectId, conversation.id, saved.turns[0].id, 'UI')).length > 1000);
});

test('public historical checks match export without overwriting the accepted original record', async t => {
  const { manager, conversation, client } = await setup(t);
  await manager.send(projectId, conversation.id, { request_id: 'historical-check', text: '查询设备 A 只显示匹配编号的设备。' });
  client.calls[0].resolve(answer([messageCase(client.calls[0].input)]));
  await manager.completion;
  const record = await manager.store.get(projectId, conversation.id), turn = record.turns[0];
  assert.equal(turn.checks.ready_count, 1);
  // Historical content questions remain warnings under today's draft-export rules.
  turn.questions = ['编号大小写是否敏感？'];
  await manager.store.write(record);
  const file = manager.store.file(projectId, conversation.id), before = await fs.readFile(file);
  const visible = await manager.get(projectId, conversation.id);
  assert.equal(visible.turns[0].checks.ready_count, 1);
  assert.equal(visible.turns[0].checks.issues[0].code, 'GLOBAL_QUESTIONS_UNRESOLVED');
  assert.equal(visible.turns[0].checks.issues[0].severity, 'WARNING');
  assert.deepEqual(visible.turns[0].questions, turn.questions);
  assert.equal(Object.hasOwn(visible.turns[0], 'source_snapshots'), false);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await manager.export(projectId, conversation.id, turn.id, 'UI'));
  assert.equal(workbook.worksheets[0].getCell('H2').value, '待确认');
  assert.match(workbook.worksheets[0].getCell('K2').value, /编号大小写是否敏感/);
  assert.deepEqual(await fs.readFile(file), before);
  assert.equal((await manager.store.get(projectId, conversation.id)).turns[0].checks.ready_count, 1);
});

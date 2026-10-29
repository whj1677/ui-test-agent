import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { activeAssistantConversation, assistantLocalWordPath, assistantErrorText, assistantMessagesHtml, assistantProgressHtml, assistantResultHtml, assistantResultContext, assistantSourceFilesHtml, assistantSourcePickerHtml, createAssistantPoller, renderCaseAssistant } from '../web-v2/case-assistant.js';
import { caseAssistantApi } from '../web-v2/case-assistant-api.js';

const goodCase = { case_id: 'c1', external_id: 'UI-01', case_type: 'UI', title: '新增电价', preconditions: '已登录', test_data: '值为 1', steps: [{ order: 1, action: '点击保存', expected: '列表出现新记录' }], checks: { ready: true, issues: [] } };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('JSON format repair progress and exhaustion explain the actual condition', () => {
  const progress = assistantProgressHtml({ status: 'RUNNING', stage: 'REPAIRING_FORMAT', created_at: new Date().toISOString() });
  assert.match(progress, /正在修正数据格式，已暂存用例保留/);
  assert.match(progress, /data-ca-cancel/);
  const message = assistantErrorText('CASE_ASSISTANT_TOOL_JSON_INVALID');
  assert.match(message, /数据格式仍不正确/);
  assert.match(message, /之前已完成的草稿已保留/);
  assert.doesNotMatch(message, /业务规则不足|生成成功/);
});

test('model and source-derived text is escaped in chat, questions, cases, checks and errors', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const chat = assistantMessagesHtml({ messages: [{ id: 'm', role: 'user', text: attack }], turns: [{ user_message_id: 'm', reply: attack, questions: [attack, { message: attack }] }] });
  const result = assistantResultHtml({ id: 't', status: 'FAILED', error: { message: attack }, cases: [{ ...goodCase, title: attack, preconditions: attack, steps: [{ action: attack, expected: attack }], pending_questions: [attack] }], checks: { issues: [{ case_id: attack, message: attack }] } });
  for (const html of [chat, result]) { assert.doesNotMatch(html, /<img|<script/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); }
});

test('download counts use server ready flags and never infer readiness from a complete-looking case', () => {
  const html = assistantResultHtml({ id: 't', status: 'COMPLETED', cases: [goodCase, { ...goodCase, case_id: 'c2', case_type: 'BACKEND', checks: { ready: false } }, { ...goodCase, case_id: 'c3', checks: undefined }] });
  assert.match(html, /可下载草稿 1 条 · 格式待修正 2 条/);
  assert.match(html, /data-ca-export="UI"[^>]*>下载前端 Excel 草稿（1）/);
  assert.match(html, /data-ca-export="BACKEND"[^>]*disabled>下载后端 Excel 草稿（0）/);
  assert.match(html, /格式检查不保证业务内容正确/);
  assert.match(html, /内容待核对/);
  assert.match(html, /格式待修正/);
  assert.doesNotMatch(html, /确认入库|自动导入|审批/);
  assert.match(assistantResultHtml({ id: 't', status: 'FAILED', cases: [goodCase] }), /data-ca-export="UI"[^>]*disabled/);
});

test('content warnings leave format-valid drafts downloadable and keep engineer confirmation explicit', () => {
  const warning = { severity: 'WARNING', message: '请确认零电价规则' };
  const html = assistantResultHtml({ id: 't', status: 'COMPLETED', cases: [
    { ...goodCase, pending_questions: ['零电价是否允许'], checks: { ready: true, content_warning_count: 1, issues: [warning] } },
    { ...goodCase, case_id: 'c2', case_type: 'BACKEND', checks: { ready: true, issues: [warning] } },
  ], checks: { issues: [warning] } });
  assert.match(html, /可下载草稿 2 条 · 含内容提示 2 条/);
  assert.match(html, /data-ca-export="UI"[^>]*>下载前端 Excel 草稿（1）/);
  assert.match(html, /data-ca-export="BACKEND"[^>]*>下载后端 Excel 草稿（1）/);
  assert.doesNotMatch(html, /data-ca-export="(?:UI|BACKEND)"[^>]*disabled|格式待修正/);
  assert.match(html, /待确认、未执行/);
  assert.match(html, /内容待补充，可在 Excel 中修改/);
  assert.match(html, /自行导入用例库/);
  assert.doesNotMatch(html, /请先回答|业务核对通过|已确认/);
  assert.match(assistantErrorText({ code: 'CASE_ASSISTANT_EXPORT_EMPTY' }), /修正格式后再下载/);
  assert.doesNotMatch(assistantErrorText({ code: 'CASE_ASSISTANT_EXPORT_EMPTY' }), /回答|业务/);
});

test('materials retained in conversation are visibly read-only while newly selected materials can be removed', () => {
  const sources = [{ snapshot_id: 'old', file_name: '原需求.docx' }, { snapshot_id: 'new', file_name: '补充.md' }];
  const input = { sources, conversationSourceIds: ['old'], selectedIds: ['new'], files: [{ name: '待上传.png' }] };
  const chips = assistantSourceFilesHtml(input);
  assert.match(chips, /原需求.docx · 已在本对话/);
  assert.doesNotMatch(chips, /data-ca-remove-source="old"/);
  assert.match(chips, /data-ca-remove-source="new"/);
  assert.match(chips, /data-ca-remove-file="0"/);
  const picker = assistantSourcePickerHtml(input);
  assert.match(picker, /data-ca-source="old" checked disabled/);
  assert.match(picker, /data-ca-source="new" checked >/);
  const escaped = assistantSourceFilesHtml({ sources: [{ snapshot_id: 'old', file_name: '<img src=x>' }], conversationSourceIds: ['old'] });
  assert.doesNotMatch(escaped, /<img/);
  assert.match(escaped, /&lt;img src=x&gt;/);
});

test('repeated check details and image observations start folded without hiding pending counts', () => {
  const html = assistantResultHtml({ id: 't', status: 'COMPLETED', cases: [{ ...goodCase, checks: { ready: false } }],
    checks: { issues: [{ message: '请确认重复规则' }] }, image_observations: [{ observations: [{ description: '<script>visible</script>', location: '顶部' }], uncertainties: ['规则待明确'] }] });
  assert.match(html, /可下载草稿 0 条 · 格式待修正 1 条/);
  assert.match(html, /检查提示（1 项）/);
  assert.match(html, /查看截图读取情况（1 张）/);
  assert.doesNotMatch(html, /class="ca-checks" open|<script>/);
  assert.match(html, /&lt;script&gt;visible&lt;\/script&gt;/);
});

test('old clarification questions are historical while only the latest completed turn asks for current answers', () => {
  const conversation = { turns: [
    { id: 't1', status: 'COMPLETED', user_message_id: 'u1', questions: ['旧问题'] },
    { id: 't2', status: 'RUNNING', user_message_id: 'u2', questions: [] },
  ], messages: [{ id: 'u1', role: 'user', text: '设计' }, { id: 'a1', role: 'assistant', turn_id: 't1', text: '旧回复' }, { id: 'u2', role: 'user', text: '已回答' }] };
  const running = assistantMessagesHtml(conversation);
  assert.match(running, /<details class="ca-history-questions"><summary>第 1 轮当时的待补充问题/);
  assert.doesNotMatch(running, /待核对的业务信息|可在下方补充/);
  conversation.turns[1].status = 'COMPLETED'; conversation.turns[1].questions = ['新问题'];
  const completed = assistantMessagesHtml(conversation);
  assert.equal((completed.match(/待核对的业务信息/g) || []).length, 1);
  assert.match(completed, /也可在 Excel 草稿中修改/);
  assert.match(completed, /新问题/);
});

test('result headings distinguish latest saved round, historical selection and previous results while generating', () => {
  const conversation = { turns: [{ id: 't1', status: 'COMPLETED' }, { id: 't2', status: 'RUNNING' }] };
  assert.deepEqual(assistantResultContext(conversation, 't1'), { heading: '第 1 轮用例（上一轮已完成）', notice: '本轮正在处理，以下为第 1 轮已保存结果。' });
  conversation.turns[1].status = 'COMPLETED';
  assert.deepEqual(assistantResultContext(conversation, 't2'), { heading: '第 2 轮用例', notice: '' });
  assert.deepEqual(assistantResultContext(conversation, 't1'), { heading: '第 1 轮用例（历史结果）', notice: '' });
  const html = assistantResultHtml({ id: 't1', status: 'COMPLETED', cases: [goodCase] }, assistantResultContext(conversation, 't1'));
  assert.match(html, /<h2>第 1 轮用例（历史结果）<\/h2>/);
});

test('running progress is indeterminate, elapsed and stoppable; terminal state has no fake progress', () => {
  const html = assistantProgressHtml({ status: 'RUNNING', stage: 'CHECKING', created_at: '2026-10-10T00:00:00Z' }, Date.parse('2026-10-10T00:01:25Z'));
  assert.match(html, /1 分 25 秒/); assert.match(html, /检查步骤/); assert.match(html, /停止本轮/);
  assert.doesNotMatch(html, /<progress[^>]*value=/);
  assert.equal(assistantProgressHtml({ status: 'COMPLETED' }), '');
});

test('poller never paints an old response after disposal and never starts a model request', async () => {
  let callback, finish, reads = 0, paints = 0;
  const stop = createAssistantPoller({ read: () => { reads++; return new Promise(resolve => { finish = resolve; }); }, apply: () => paints++, onError: assert.fail, setTimer: fn => { callback = fn; return 1; }, clearTimer: () => {} });
  const running = callback(); stop(); finish({ active_turn_id: 't' }); await running;
  assert.equal(reads, 1); assert.equal(paints, 0);
});

test('poller retries only reads after connection errors and stops on terminal result', async () => {
  let callback, reads = 0, errors = 0, paints = 0, schedules = 0;
  const stop = createAssistantPoller({ read: async () => { if (++reads === 1) throw new Error('offline'); return { active_turn_id: null, turns: [{ status: 'COMPLETED' }] }; }, apply: () => paints++, onError: () => errors++, setTimer: fn => { callback = fn; schedules++; return schedules; }, clearTimer: () => {} });
  await callback(); await callback(); stop();
  assert.equal(reads, 2); assert.equal(errors, 1); assert.equal(paints, 1); assert.equal(schedules, 2);
});

function fakeRoot() {
  const nodes = new Map();
  for (const name of ['error', 'text', 'files', 'source-list', 'send', 'upload', 'new', 'messages', 'progress', 'results', 'form', 'history']) {
    nodes.set(`[data-ca-${name}]`, { innerHTML: '', value: '', disabled: false, hidden: false, events: {}, addEventListener(type, fn) { this.events[type] = fn; }, focus() {}, dataset: {} });
  }
  return { nodes, querySelector: selector => nodes.get(selector) || null, querySelectorAll: () => [] };
}
const materials = { listSources: async () => ({ sources: [] }) };
const emptyConversation = id => ({ id, messages: [], turns: [], source_ids: [], active_turn_id: null });

test('original Word path stays in the assistant composer and never starts generation',async()=>{
  const root=fakeRoot(),calls=[];let html='';
  const dispose=await renderCaseAssistant({project:{project_id:'native-office-no-model'},showPage:value=>html=value,root,
    assistantApi:{list:async()=>({capabilities:{available:false},conversations:[]}),create:()=>assert.fail('no conversation'),send:()=>assert.fail('no generation')},
    requirementsApi:{...materials,uploadOffice:async(id,originalPath)=>{calls.push([id,originalPath]);return {snapshot_id:'native-source',file_name:'原始.docx',reading_method:'local-office',reading:{provider:'wps'},read_status:'PARTIAL'};}}});
  const input=root.nodes.get('[data-ca-text]');input.value='D:/需求/原始.docx';input.events.input({target:input});
  assert.equal(root.nodes.get('[data-ca-send]').disabled,false);
  await root.nodes.get('[data-ca-form]').events.submit({preventDefault(){}});
  assert.deepEqual(calls,[['native-office-no-model','D:/需求/原始.docx']]);
  assert.match(root.nodes.get('[data-ca-files]').innerHTML,/WPS 部分读取/);assert.equal(input.value,'');
  assert.equal(root.nodes.get('[data-ca-send]').disabled,true);assert.doesNotMatch(html,/data-ca-native|data-ca-office-provider/);dispose();
});

test('only a standalone local Word path is treated as a local read command',()=>{
  assert.equal(assistantLocalWordPath(' "D:/需求/原始.docx" '),'D:/需求/原始.docx');
  for(const text of ['请读取 D:/需求/原始.docx','D:/first.docx\nD:/second.docx','https://host/a.docx','D:/secret.txt'])assert.equal(assistantLocalWordPath(text),null);
});

test('pasted and dropped attachments use the same assistant input and preserve text',async()=>{
  const root=fakeRoot();const dispose=await renderCaseAssistant({project:{project_id:'paste-drop-office'},showPage(){},root,
    assistantApi:{list:async()=>({conversations:[]})},requirementsApi:materials});
  const input=root.nodes.get('[data-ca-text]');input.value='保留测试范围';input.events.input({target:input});
  let prevented=0;
  input.events.paste({clipboardData:{files:[{name:'粘贴.docx'}]},preventDefault(){prevented++;}});
  root.nodes.get('[data-ca-form]').events.drop({dataTransfer:{files:[{name:'拖入.md'}]},preventDefault(){prevented++;}});
  assert.match(root.nodes.get('[data-ca-files]').innerHTML,/粘贴.docx/);assert.match(root.nodes.get('[data-ca-files]').innerHTML,/拖入.md/);
  assert.equal(input.value,'保留测试范围');assert.equal(prevented,2);dispose();
});

test('unavailable model still allows preparing documents without uploading or generating',async()=>{
  const root=fakeRoot();
  const dispose=await renderCaseAssistant({project:{project_id:'model-unavailable-materials'},showPage(){},root,
    assistantApi:{list:async()=>({capabilities:{available:false},conversations:[]}),create:()=>assert.fail('no conversation while disabled'),send:()=>assert.fail('no model request while disabled')},
    requirementsApi:{...materials,upload:()=>assert.fail('choosing a local file does not upload it')}});
  const upload=root.nodes.get('[data-ca-upload]'),send=root.nodes.get('[data-ca-send]');
  assert.equal(upload.disabled,false);assert.equal(send.disabled,true);
  assert.match(root.nodes.get('[data-ca-error]').innerHTML,/启用模型工作台\.cmd/);
  upload.events.change({target:{files:[{name:'需求.docx',size:100}],value:'selected'}});
  const files=root.nodes.get('[data-ca-files]').innerHTML;
  assert.match(files,/需求.docx/);assert.doesNotMatch(files,/data-ca-remove-file[^>]*disabled/);
  assert.match(root.nodes.get('[data-ca-error]').innerHTML,/启用模型工作台\.cmd/);
  await root.nodes.get('[data-ca-form]').events.submit({preventDefault(){}});
  assert.equal(send.disabled,true);dispose();
});

test('a fresh tab and new-dialogue entry restore this project active generation without creating or sending',async()=>{
  const root=fakeRoot(),destinations=[];
  const dispose=await renderCaseAssistant({project:{project_id:'resume-current'},query:new URLSearchParams('new=clicked-again'),showPage(){},go:path=>destinations.push(path),root,
    assistantApi:{list:async()=>({capabilities:{project_id:'resume-current',active_turn_id:'running-turn',conversation_id:'existing-conversation'},conversations:[]}),create:()=>assert.fail('no new conversation'),send:()=>assert.fail('no repeated generation')},requirementsApi:materials});
  assert.deepEqual(destinations,['#/projects/resume-current/requirements?conversation=existing-conversation']);dispose();
  assert.equal(activeAssistantConversation({capabilities:{project_id:'another-project',active_turn_id:'foreign-turn',conversation_id:'foreign-conversation'},conversations:[]},'resume-current'),'');
});

test('running conversation disables new dialogue and a creation race preserves draft without resending',async()=>{
  const root=fakeRoot(),destinations=[];
  const running={...emptyConversation('running-conversation'),active_turn_id:'turn-active',turns:[{id:'turn-active',status:'RUNNING',created_at:new Date().toISOString()}]};
  const dispose=await renderCaseAssistant({project:{project_id:'race-resume'},showPage(){},go:path=>destinations.push(path),root,
    assistantApi:{list:async()=>({conversations:[]}),create:async()=>running,send:()=>assert.fail('must not submit into resumed turn')},requirementsApi:materials});
  const input=root.nodes.get('[data-ca-text]');input.value='尚未发送的补充';input.events.input({target:input});
  await root.nodes.get('[data-ca-form]').events.submit({preventDefault(){}});
  assert.deepEqual(destinations,['#/projects/race-resume/requirements?conversation=running-conversation']);
  assert.equal(input.value,'尚未发送的补充');assert.equal(root.nodes.get('[data-ca-new]').disabled,true);dispose();
});

test('duplicate submits are blocked, accepted text clears, and newer typed draft survives response', async () => {
  const root = fakeRoot(); let resolveSend, sends = 0;
  const assistantApi = { list: async () => ({ conversations: [] }), create: async () => emptyConversation('conv-typing'), send: async () => { sends++; return new Promise(resolve => { resolveSend = resolve; }); } };
  const dispose = await renderCaseAssistant({ project: { project_id: 'typing-test' }, showPage() {}, root, assistantApi, requirementsApi: materials });
  const input = root.nodes.get('[data-ca-text]'); input.value = '请设计用例'; input.events.input({ target: input });
  const form = root.nodes.get('[data-ca-form]'); const submit = form.events.submit({ preventDefault() {} }); await tick();
  await form.events.submit({ preventDefault() {} }); assert.equal(sends, 1);
  input.value = '还要覆盖权限'; input.events.input({ target: input });
  resolveSend({ ...emptyConversation('conv-typing'), messages: [{ id: 'm1', role: 'user', text: '请设计用例' }] }); await submit;
  assert.equal(input.value, '还要覆盖权限'); dispose();
});

test('a failed send preserves text and reuses its request id; no automatic POST retry', async () => {
  const root = fakeRoot(); const ids = [];
  const assistantApi = { list: async () => ({ conversations: [] }), create: async () => emptyConversation('conv-retry'), get: async () => emptyConversation('conv-retry'), send: async (_p, _c, body) => { ids.push(body.request_id); throw new Error('WORKBENCH_UNREACHABLE'); } };
  const dispose = await renderCaseAssistant({ project: { project_id: 'retry-test' }, showPage() {}, root, assistantApi, requirementsApi: materials });
  const input = root.nodes.get('[data-ca-text]'); input.value = '保留这些资料并设计用例'; input.events.input({ target: input });
  const submit = () => root.nodes.get('[data-ca-form]').events.submit({ preventDefault() {} });
  await submit(); assert.equal(ids.length, 1); assert.equal(input.value, '保留这些资料并设计用例');
  assert.match(root.nodes.get('[data-ca-error]').innerHTML, /暂时无法连接工作台/);
  await submit(); assert.equal(ids[0], ids[1]); dispose();
});

test('refresh restoration loads existing conversation without creating or submitting again', async () => {
  const root = fakeRoot(); const calls = [];
  const dispose = await renderCaseAssistant({ project: { project_id: 'restore-test' }, query: new URLSearchParams('conversation=conv-existing'), showPage() {}, root,
    assistantApi: { list: async () => ({ conversations: [] }), get: async id => { calls.push(id); return { ...emptyConversation('conv-existing'), messages: [{ id: 'm', role: 'user', text: '已提交消息' }] }; }, create: () => assert.fail('must not create'), send: () => assert.fail('must not resend') }, requirementsApi: materials });
  assert.equal(calls.length, 1); assert.match(root.nodes.get('[data-ca-messages]').innerHTML, /已提交消息/); dispose();
});

test('import mapping retains case type and legacy corrections keep their original workflow', async () => {
  const app = await fs.readFile(new URL('../web-v2/app.js', import.meta.url), 'utf8');
  assert.match(app, /case_type: '用例层级'/);
  assert.match(app, /requirements\?view=legacy&design=/);
  assert.match(app, /value\.query\.get\('view'\) !== 'legacy'/);
});

test('API facade keeps project/conversation identity and stable request id without importing cases', async () => {
  const originalFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return { ok: true, status: 202, json: async () => emptyConversation('conv') }; };
  try {
    const body = { request_id: 'fixed-request-id', text: '补充规则', source_ids: ['source-1'] };
    await caseAssistantApi.send('project/a', 'conv/b', body);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/case-library/projects/project%2Fa/case-assistant/conversations/conv%2Fb/messages');
    assert.deepEqual(JSON.parse(calls[0].options.body), body);
    assert.equal(calls[0].options.method, 'POST');
    assert.doesNotMatch(calls[0].path, /imports|confirm/);
  } finally { globalThis.fetch = originalFetch; }
});

test('download rejects an HTML fallback instead of saving it as a usable Excel file', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, blob: () => assert.fail('HTML must not be downloaded as Excel') });
  try { await assert.rejects(caseAssistantApi.export('p', 'c', 't', 'UI'), { code: 'CASE_ASSISTANT_EXPORT_RESPONSE_INVALID' }); }
  finally { globalThis.fetch = originalFetch; }
});

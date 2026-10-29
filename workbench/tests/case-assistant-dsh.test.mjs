import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCaseAssistantClient } from '../server/case-assistant/dsh-client.mjs';
import { CaseAssistantMcpSession, startCaseAssistantMcp, apply } from '../server/case-assistant/mcp-session.mjs';
import { caseAssistantPrompt, caseAssistantPatch, freezeCaseDesignSkill } from '../server/case-assistant/prompt.mjs';
import { inspectDocument } from '../server/requirements/documents.mjs';
import { docxFixture } from './fixtures/docx-image-fixture.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const body = Buffer.from('编号重复时拒绝新增，原数据不变。');
const source = { snapshot_id: 'source-doc', project_id: 'project-test', kind: 'PRD', file_name: '需求.md', extension: '.md',
  body, sha256: hash(body), bytes: body.length, read_status: 'READ',
  segments: [{ segment_id: 'segment-1', text: body.toString('utf8'), quote_sha256: hash(body), location: { line: 1 } }] };
const messages = [{ id: 'message-user', role: 'user', text: '只需要前端用例。' },
  { id: 'message-assistant', role: 'assistant', text: '错误建议：重复编号也可新增。' }];
const response = () => ({ reply: '已设计前端用例。', questions: [], image_observations: [], cases: [{
  case_id: 'case-draft-1', case_type: 'UI', external_id: 'UI-001', title: '重复编号拒绝新增', module: '设备',
  preconditions: '已有编号 DEV-001 的记录。', test_data: 'DEV-001', pending_questions: [],
  steps: [{ order: 1, action: '输入已有编号并新增', expected: '拒绝新增，原数据不变',
    source_refs: [{ source_id: 'source-doc', segment_id: 'segment-1', quote: '原数据不变' }] }],
}] });
const completed = { processResult: { exitCode: 0, termination: null, outputComplete: true, closeObserved: true },
  events: [{ type: 'status', phase: 'turn_end', reason: { kind: 'completed' } }, { type: 'final', text: '完成' }] };
const probeOutput = [
  '- id: agent-default-model', '    model: deepseek-flash',
  '- id: llm-retry', '  disabled: true', '- id: skill-filesystem', '  disabled: true', '- id: tool-skill', '  disabled: true',
  '- id: workbench-case-assistant-guard', '- id: workbench-case-assistant-mcp',
].join('\n');
const probeConfig = async () => ({ exitCode: 0, termination: null, stdout: probeOutput });
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-assistant-dsh-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const dshHome = path.join(root, 'dsh');
  await fs.mkdir(path.join(dshHome, 'profiles', 'headless'), { recursive: true });
  await fs.writeFile(path.join(dshHome, 'profiles', 'headless', 'package.json'), '{}');
  return { root, config: { provider: 'deepseek-official', model: 'deepseek-flash', dshHome,
    credentialProvider: async () => ({ apiKey: 'private-test-key', baseUrl: 'https://api.deepseek.com/v1' }) } };
}
const input = extra => ({ taskId: 'task-test', projectId: 'project-test', turnId: 'turn-test', messages, sources: [source], ...extra });
async function call(url, name, args = {}) {
  const result = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  return (await result.json()).result;
}

test('Skill is frozen with identity and the new patch keeps other tools and global skills closed', async () => {
  const skill = await freezeCaseDesignSkill();
  assert.equal(skill.sha256, hash(skill.text));
  assert.match(caseAssistantPrompt(skill), /测试工程师的用例编写助手/);
  assert.match(caseAssistantPrompt(skill), /不执行测试/);
  assert.match(caseAssistantPatch(), /skill-filesystem\n  disabled: true/);
  const hooks = new Map();
  apply({ tools: { schemas: () => [{ name: 'shell' }, { name: 'mcp__workbench-case-assistant__read_context' }] },
    on: (event, handler) => hooks.set(event, handler) });
  let denied;
  hooks.get('agent/created')({ agent: { ctx: { tools: { presentAs: () => {}, restrict: value => { denied = value.deny; } } } } });
  assert.deepEqual(denied, ['shell']);
  assert.equal(hooks.get('tools/pre-execute')({ name: 'shell' }, () => 'bad').kind, 'deny');
});

test('frozen source integrity, project identity and input bounds are enforced', () => {
  assert.throws(() => new CaseAssistantMcpSession({ projectId: 'project-other', sources: [source] }), /SOURCE_INVALID/);
  assert.throws(() => new CaseAssistantMcpSession({ projectId: 'project-test', sources: [{ ...source, body: Buffer.from('changed') }] }), /SOURCE_INTEGRITY/);
  assert.throws(() => new CaseAssistantMcpSession({ projectId: 'project-test', sources: [source, source] }), /SOURCE_INVALID/);
});

test('protected Office text reaches generation while its images remain unanalysed and original bytes stay bound',async()=>{
  const body=Buffer.alloc(1024,0x17);
  const protectedSource={...source,body,bytes:body.length,sha256:hash(body),extension:'.docx',file_name:'受保护.docx',
    reading_method:'local-office',read_status:'PARTIAL',sections:{body:'READ',tables:'READ',images:'UNANALYZED'},embedded_images:[],
    issues:[{code:'IMAGES_NOT_EXTRACTED',severity:'COVERAGE_GAP'}]};
  const session=new CaseAssistantMcpSession(input({sources:[protectedSource]}));
  const context=await session.invoke('read_context');
  assert.equal(context.sources[0].reading_method,'local-office');
  assert.equal(context.sources[0].sections.images,'UNANALYZED');
  assert.deepEqual(context.sources[0].images,[]);assert.deepEqual(context.sources[0].issues,protectedSource.issues);
  const document=await session.invoke('read_source',{source_id:source.snapshot_id});
  assert.equal(document.segments[0].text,source.segments[0].text);
  await assert.rejects(session.invoke('read_image',{source_id:source.snapshot_id,image_id:'image-1'}),/IMAGE_NOT_FOUND/);
  assert.equal((await session.invoke('submit_response',response())).accepted,true);
  assert.equal(session.response.cases[0].steps[0].source_refs[0].segment_id,'segment-1');
  assert.throws(()=>new CaseAssistantMcpSession(input({sources:[{...protectedSource,body:Buffer.alloc(1024,0x18)}]})),/SOURCE_INTEGRITY_FAILED/);
  for(const extra of [{reading_method:undefined},{read_status:'READ'},{sections:{images:'READ'}},{embedded_images:[{image_id:'image-1'}]}]){
    assert.throws(()=>new CaseAssistantMcpSession(input({sources:[{...protectedSource,...extra}]})),/DOCX_INVALID_ZIP/);
  }
});

test('ordinary DOCX still exposes verified embedded images for mandatory reading',async()=>{
  const body=docxFixture();
  const doc={snapshot_id:'source-docx',project_id:'project-test',kind:'PRD',...inspectDocument({kind:'PRD',fileName:'普通.docx',body}),body};
  const session=new CaseAssistantMcpSession(input({sources:[doc]}));
  const context=await session.invoke('read_context');
  assert.ok(context.sources[0].images.length>0);
  const image=context.sources[0].images[0];
  const pixels=await session.invoke('read_image',{source_id:doc.snapshot_id,image_id:image.image_id});
  assert.equal(hash(Buffer.from(pixels.content[1].data,'base64')),image.sha256);
  const embedded_images=doc.embedded_images.map((entry,i)=>i?entry:{...entry,sha256:'0'.repeat(64)});
  assert.throws(()=>new CaseAssistantMcpSession(input({sources:[{...doc,embedded_images}]})),/SOURCE_INTEGRITY_FAILED/);
});

test('unread documents and assistant messages remain visibly invalid citations without rejecting the whole draft', async () => {
  const session = new CaseAssistantMcpSession(input());
  await assert.rejects(session.invoke('read_source', { source_id: 'source-doc' }), /READ_CONTEXT_FIRST/);
  const context = await session.invoke('read_context');
  assert.equal(context.messages[1].role, 'assistant');
  assert.equal(context.messages[1].reference_id, undefined);
  assert.equal(context.sources[0].body, undefined);
  const draft = response();
  draft.cases[0].steps[0].source_refs.push({ message_id: 'message-assistant' });
  const accepted = await session.invoke('submit_response', draft);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.human_approved, false);
  assert.equal(accepted.checks.ready_count, 1);
  assert.deepEqual(session.response.cases[0].steps[0].source_refs.map(ref => ref.issue), ['REFERENCE_NOT_READ', 'USER_MESSAGE_NOT_FOUND']);
  assert.ok(accepted.checks.issues.some(issue => issue.code === 'SOURCE_REF_INVALID' && issue.severity === 'WARNING'));
  await assert.rejects(session.invoke('read_context'), /ALREADY_SUBMITTED/);
});

test('short document and user references expand only to their frozen actual identities', async () => {
  const session = new CaseAssistantMcpSession(input());
  const context = await session.invoke('read_context');
  const document = await session.invoke('read_source', { source_id: 'source-doc' });
  const readAgain = await session.invoke('read_source', { source_id: 'source-doc' });
  assert.equal(document.segments[0].reference_id, readAgain.segments[0].reference_id);
  const draft = response();
  draft.cases[0].steps[0].source_refs = [
    { reference_id: document.segments[0].reference_id, quote: '原数据不变' },
    { reference_id: context.messages[0].reference_id },
    { reference_id: 'R-does-not-exist' },
  ];
  assert.equal((await session.invoke('submit_response', draft)).accepted, true);
  assert.deepEqual(session.response.cases[0].steps[0].source_refs, [
    { source_id: 'source-doc', segment_id: 'segment-1', quote: '原数据不变' },
    { message_id: 'message-user' },
    { reference_id: 'R-does-not-exist', validity: 'INVALID', issue: 'UNKNOWN_REFERENCE_ID' },
  ]);
});

test('guessed short reference to unread material cannot bypass read admission', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  const known = [...session.references.entries()].find(([, ref]) => ref.source_id === 'source-doc')[0];
  const draft = response();
  draft.cases[0].steps[0].source_refs = [{ reference_id: known }];
  const accepted = await session.invoke('submit_response', draft);
  assert.equal(accepted.accepted, true);
  assert.equal(session.response.cases[0].steps[0].source_refs[0].issue, 'REFERENCE_NOT_READ');
  assert.ok(accepted.checks.issues.some(issue => issue.code === 'SOURCE_REF_INVALID'));
});

test('staging preserves earlier cases through an invalid batch and permits a single-case correction', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  await session.invoke('read_source', { source_id: 'source-doc' });
  const first = response().cases[0];
  const second = { ...structuredClone(first), case_id: 'case-draft-2', external_id: 'UI-002', title: '待工程师补充的另一用例' };
  assert.equal((await session.invoke('stage_cases', { cases: [first] })).staged_case_count, 1);
  const invalid = structuredClone(second);
  invalid.test_data = '数据\uFFFD';
  await assert.rejects(session.invoke('stage_cases', { cases: [{ ...first, title: '不应保存的修改' }, invalid] }), error => {
    assert.equal(error.message, 'CASE_ASSISTANT_RESPONSE_TEXT_ENCODING_INVALID');
    assert.equal(error.feedback.field, '$.cases[1].test_data');
    return true;
  });
  assert.equal(session.stagedCases.get(first.case_id).title, first.title);
  assert.equal(session.stagedCases.size, 1);
  await session.invoke('stage_cases', { cases: [second] });
  await session.invoke('stage_cases', { cases: [{ ...first, title: '补充后的重复编号测试' }] });
  const context = await session.invoke('read_context');
  assert.equal(context.staged_cases.length, 2);
  assert.equal(context.staged_cases[0].title, '补充后的重复编号测试');
  const { cases, ...final } = response();
  const accepted = await session.invoke('submit_response', { ...final, use_staged_cases: true });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.case_count, 2);
  assert.equal(accepted.human_approved, false);
  assert.deepEqual(session.response.cases.map(entry => entry.external_id), ['UI-001', 'UI-002']);
  assert.equal(session.response.cases[1].title, second.title);
});

test('staged IDs, total count and final mode are explicit and cannot silently drop or publish partial cases', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  const first = response().cases[0];
  const { cases, ...final } = response();
  await assert.rejects(session.invoke('submit_response', final), /SUBMISSION_MODE_INVALID/);
  await assert.rejects(session.invoke('submit_response', { ...final, use_staged_cases: true }), /STAGED_CASES_EMPTY/);
  await assert.rejects(session.invoke('stage_cases', { cases: [{ ...first, case_id: '' }] }), /STAGED_CASE_ID_INVALID/);
  await assert.rejects(session.invoke('stage_cases', { cases: [first, first] }), /STAGED_CASE_ID_INVALID/);
  for (let offset = 0; offset < 200; offset += 20) {
    await session.invoke('stage_cases', { cases: Array.from({ length: 20 }, (_, index) => ({ ...first,
      case_id: `case-${offset + index}`, external_id: `UI-${offset + index}` })) });
  }
  await assert.rejects(session.invoke('stage_cases', { cases: [{ ...first, case_id: 'case-overflow' }] }), /DRAFT_LIMIT_EXCEEDED/);
  assert.equal(session.stagedCases.size, 200);
  assert.equal(session.response, null);
  await assert.rejects(session.invoke('submit_response', { ...response(), use_staged_cases: true }), /SUBMISSION_MODE_INVALID/);
  assert.equal(session.response, null);
  // The legacy full-list mode intentionally replaces the final list; it does not append staged rows.
  assert.equal((await session.invoke('submit_response', response())).case_count, 1);
  assert.equal(session.response.cases.length, 1);
});

test('incomplete business expectations are returned as questions, without blocking submission', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  const draft = response();
  draft.questions = ['编号长度最多多少？'];
  draft.cases[0].steps[0].expected = '';
  draft.cases[0].steps[0].source_refs = [];
  draft.cases[0].pending_questions = ['编号长度最多多少？'];
  const accepted = await session.invoke('submit_response', draft);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.checks.ready_count, 1);
  assert.equal(accepted.checks.pending_count, 0);
  assert.ok(accepted.checks.issues.some(issue => issue.code === 'STEP_EXPECTED_UNRESOLVED' && issue.severity === 'WARNING'));
});

test('global business questions remain visible while a format-valid draft can be submitted', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  await session.invoke('read_source', { source_id: 'source-doc' });
  const draft = response();
  draft.questions = ['重复编号是否拒绝新增？'];
  const accepted = await session.invoke('submit_response', draft);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.checks.ready_count, 1);
  assert.deepEqual(session.response.questions, draft.questions);
  assert.equal(accepted.human_approved, false);
});

test('case-specific questions preserve both format-valid drafts for engineer review', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  await session.invoke('read_source', { source_id: 'source-doc' });
  const draft = response();
  draft.questions = ['编号最长允许多少字符？'];
  draft.cases.push({ ...structuredClone(draft.cases[0]), case_id: 'case-draft-2', external_id: 'UI-002',
    pending_questions: ['编号最长允许多少字符？'] });
  const accepted = await session.invoke('submit_response', draft);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.checks.ready_count, 2);
  assert.equal(accepted.checks.pending_count, 0);
});

test('staged invalid citations remain warnings when correcting another field, and cannot be marked valid by the model', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  await session.invoke('stage_cases', { cases: response().cases });
  const draft = (await session.invoke('read_context')).staged_cases[0];
  assert.equal(draft.steps[0].source_refs[0].issue, 'REFERENCE_NOT_READ');
  await session.invoke('read_source', { source_id: 'source-doc' });
  draft.title = '保留待核对来源，修正标题';
  await session.invoke('stage_cases', { cases: [draft] });
  assert.equal(session.stagedCases.get(draft.case_id).steps[0].source_refs[0].validity, 'INVALID');
  draft.steps[0].source_refs[0].validity = 'VALID';
  await assert.rejects(session.invoke('stage_cases', { cases: [draft] }), error => {
    assert.equal(error.message, 'CASE_ASSISTANT_ARGUMENTS_INVALID');
    assert.equal(error.feedback.field, '$.cases[0].steps[0].source_refs[0].validity');
    return true;
  });
  draft.steps[0].source_refs[0] = response().cases[0].steps[0].source_refs[0];
  await session.invoke('stage_cases', { cases: [draft] });
  assert.equal(session.stagedCases.get(draft.case_id).steps[0].source_refs[0].validity, undefined);
});

test('staging remains non-final and cancellation prevents publication of staged cases', async () => {
  const controller = new AbortController();
  const session = new CaseAssistantMcpSession(input({ signal: controller.signal }));
  await session.invoke('read_context');
  await session.invoke('stage_cases', { cases: response().cases });
  assert.equal(session.response, null);
  controller.abort();
  const { cases, ...final } = response();
  await assert.rejects(session.invoke('submit_response', { ...final, use_staged_cases: true }), /CANCELLED/);
  assert.equal(session.response, null);
});

test('real image content must be read and accounted for; pixels never enter execution metadata', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  const image = { snapshot_id: 'source-image', project_id: 'project-test', kind: 'IMAGE', extension: '.png',
    file_name: '墨刀.png', body: png, bytes: png.length, sha256: hash(png), segments: [] };
  const session = new CaseAssistantMcpSession(input({ sources: [source, image] }));
  await session.invoke('read_context');
  await session.invoke('read_source', { source_id: 'source-doc' });
  await assert.rejects(session.invoke('submit_response', response()), /IMAGES_REQUIRE_READING/);
  const pixels = await session.invoke('read_image', { source_id: 'source-image' });
  assert.equal(pixels.content[1].type, 'image');
  assert.equal(pixels.content[1].data, png.toString('base64'));
  const draft = response();
  draft.image_observations = [{ source_id: 'source-image', observations: [], uncertainties: ['图片太小，无法辨认。'] }];
  assert.equal((await session.invoke('submit_response', draft)).accepted, true);
  assert.equal(session.evidence().images_read.length, 1);
  assert.ok(!JSON.stringify(session.evidence()).includes(png.toString('base64')));
});

test('MCP permits only scoped tools and denies unknown sources/paths without leaking errors', async t => {
  const session = new CaseAssistantMcpSession(input());
  const endpoint = await startCaseAssistantMcp(session);
  t.after(() => endpoint.close());
  const denied = await call(endpoint.url, 'shell', { command: 'pwd' });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /TOOL_DENIED/);
  await call(endpoint.url, 'read_context');
  const wrong = await call(endpoint.url, 'read_source', { source_id: '../secrets' });
  assert.equal(wrong.isError, true);
  assert.ok(!wrong.content[0].text.includes('../secrets'));
  const unexpected = await call(endpoint.url, 'read_source', { source_id: 'source-doc', path: 'C:/private' });
  assert.match(unexpected.content[0].text, /ARGUMENTS_INVALID/);
  const origin = await fetch(endpoint.url, { method: 'POST', headers: { origin: 'https://other.example' }, body: '{}' });
  assert.equal(origin.status, 404);
});

test('MCP field limits match workbook checks and provide an exact repair location', async t => {
  const session = new CaseAssistantMcpSession(input());
  const endpoint = await startCaseAssistantMcp(session);
  t.after(() => endpoint.close());
  await call(endpoint.url, 'read_context');
  await call(endpoint.url, 'read_source', { source_id: 'source-doc' });
  for (const [target, path, maximum] of [
    ['preconditions', '$.cases[0].preconditions', 5000],
    ['test_data', '$.cases[0].test_data', 5000],
    ['action', '$.cases[0].steps[0].action', 3000],
    ['expected', '$.cases[0].steps[0].expected', 3000],
  ]) {
    const draft = response();
    if (target === 'action' || target === 'expected') draft.cases[0].steps[0][target] = '长'.repeat(maximum + 1);
    else draft.cases[0][target] = '长'.repeat(maximum + 1);
    const result = await call(endpoint.url, 'submit_response', draft);
    const error = JSON.parse(result.content[0].text);
    assert.equal(result.isError, true);
    assert.deepEqual(error.feedback, { field: path, rule: 'MAX_LENGTH', max_length: maximum });
    assert.equal(session.response, null);
  }
  const draft = response();
  draft.cases[0].steps[0].source_refs[0].quote = '这句话不存在';
  const accepted = await call(endpoint.url, 'submit_response', draft);
  assert.equal(accepted.isError, undefined);
  assert.equal(session.response.cases[0].steps[0].source_refs[0].issue, 'QUOTE_NOT_FOUND');
  assert.ok(JSON.parse(accepted.content[0].text).checks.issues.some(issue => issue.code === 'SOURCE_REF_INVALID' && issue.severity === 'WARNING'));
});

test('replacement characters are rejected recursively with the exact field before saving the response', async () => {
  const session = new CaseAssistantMcpSession(input());
  await session.invoke('read_context');
  await session.invoke('read_source', { source_id: 'source-doc' });
  for (const field of ['$.reply', '$.cases[0].steps[0].action', '$.cases[0].steps[0].source_refs[0].quote']) {
    const draft = response();
    if (field === '$.reply') draft.reply = '结果\uFFFD';
    else if (field.endsWith('.action')) draft.cases[0].steps[0].action = '输入\uFFFD已有\uFFFD编号\uFFFD并新增';
    else draft.cases[0].steps[0].source_refs[0].quote = '原数据\uFFFD不变';
    await assert.rejects(session.invoke('submit_response', draft), error => {
      assert.equal(error.message, 'CASE_ASSISTANT_RESPONSE_TEXT_ENCODING_INVALID');
      assert.equal(error.feedback.field, field);
      return true;
    });
    assert.equal(session.response, null);
  }
  assert.equal((await session.invoke('submit_response', response())).accepted, true);
});

test('new DSH round receives explicit history and prior draft, and returns only safe execution metadata', async t => {
  const options = await setup(t);
  let endpointUrl;
  const progress = [];
  const client = createCaseAssistantClient({ ...options, probeConfig, runHarness: async args => {
    endpointUrl = args.env.WORKBENCH_CASE_ASSISTANT_ENDPOINT;
    assert.equal(args.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com/anthropic');
    assert.ok(!args.args.includes('--session-id'));
    const context = await call(endpointUrl, 'read_context');
    assert.match(context.content[0].text, /上一轮检查发现待补充/);
    await call(endpointUrl, 'read_source', { source_id: 'source-doc' });
    const result = await call(endpointUrl, 'submit_response', response());
    assert.equal(result.isError, undefined);
    return { ...completed, processResult: { ...completed.processResult, stderr: 'private-test-key and source content' } };
  } });
  assert.equal(client.available, true);
  const result = await client.generate(input({ previous: { reply: '上一轮检查发现待补充' }, onProgress: async event => progress.push(event.stage) }));
  assert.equal(result.cases.length, 1);
  assert.equal(result.execution.engine, 'dsh');
  assert.ok(progress.includes('CHECKING_DRAFT'));
  assert.ok(!JSON.stringify(result.execution).includes('private-test-key'));
  assert.ok(!JSON.stringify(result.execution).includes('原数据不变'));
  await assert.rejects(fetch(endpointUrl, { method: 'POST', body: '{}' }));
});

test('process failure remains failure even after a valid draft was submitted', async t => {
  const options = await setup(t);
  let endpointUrl;
  const client = createCaseAssistantClient({ ...options, probeConfig, runHarness: async args => {
    endpointUrl = args.env.WORKBENCH_CASE_ASSISTANT_ENDPOINT;
    await call(endpointUrl, 'read_context');
    await call(endpointUrl, 'read_source', { source_id: 'source-doc' });
    await call(endpointUrl, 'submit_response', response());
    return { ...completed, processResult: { ...completed.processResult, exitCode: 1, stderr: 'secret-private-detail' } };
  } });
  await assert.rejects(client.generate(input()), error => {
    assert.equal(error.message, 'CASE_ASSISTANT_DSH_FAILED');
    assert.equal(error.execution.process.exit_code, 1);
    assert.ok(!JSON.stringify(error).includes('secret-private-detail'));
    return true;
  });
  await assert.rejects(fetch(endpointUrl));
});

test('JSON recovery progress and safe evidence retain the single process and original limits', async t => {
  const options = await setup(t);
  const stages = [];
  let starts = 0;
  const recovery = { type: 'status', phase: 'case_assistant_json_retry', retry: 1, max_retries: 2, raw: 'private-provider-output' };
  const client = createCaseAssistantClient({ ...options, probeConfig, runHarness: async args => {
    starts += 1;
    assert.equal(args.maxToolCalls, 80);
    assert(args.timeoutMs <= 360000);
    await args.onLifecycle({ type: 'harness_event', phase: recovery.phase });
    const url = args.env.WORKBENCH_CASE_ASSISTANT_ENDPOINT;
    await call(url, 'read_context');
    await call(url, 'read_source', { source_id: 'source-doc' });
    await call(url, 'submit_response', response());
    return { ...completed, events: [recovery, ...completed.events] };
  } });
  const result = await client.generate(input({ onProgress: event => stages.push(event.stage) }));
  assert.equal(starts, 1);
  assert(stages.includes('REPAIRING_FORMAT'));
  assert.equal(result.execution.limits.json_retries, 2);
  assert.deepEqual(result.execution.process.json_recovery_attempts, [{ retry: 1, max_retries: 2 }]);
  assert.doesNotMatch(JSON.stringify(result.execution), /private-provider-output/);
});

test('tool JSON exhaustion has a specific failure; malformed transport and other errors stay distinct', async t => {
  const options = await setup(t);
  for (const [message, code, expected] of [
    ['DeepSeek Messages stream: tool input is invalid JSON', 'MALFORMED_RESPONSE', 'CASE_ASSISTANT_TOOL_JSON_INVALID'],
    ['DeepSeek Messages SSE contains invalid JSON', 'MALFORMED_RESPONSE', 'CASE_ASSISTANT_DSH_FAILED'],
    ['private-auth-details', 'AUTH', 'CASE_ASSISTANT_DSH_FAILED'],
  ]) {
    let starts = 0;
    const client = createCaseAssistantClient({ ...options, probeConfig, runHarness: async () => {
      starts += 1;
      return { processResult: { ...completed.processResult, exitCode: 1 }, events: [
        { type: 'status', phase: 'turn_end', reason: { kind: 'error', error: { code, message } } },
      ] };
    } });
    await assert.rejects(client.generate(input()), error => {
      assert.equal(error.message, expected);
      assert.equal(error.execution.process.provider_error, code);
      assert.doesNotMatch(JSON.stringify(error.execution), /private-auth-details|SSE contains/);
      return true;
    });
    assert.equal(starts, 1);
  }
});

test('missing submission, incomplete process output, and invalid config never count as success', async t => {
  const options = await setup(t);
  const missing = createCaseAssistantClient({ ...options, probeConfig, runHarness: async () => completed });
  await assert.rejects(missing.generate(input()), /RESPONSE_MISSING/);
  const incomplete = createCaseAssistantClient({ ...options, probeConfig,
    runHarness: async () => ({ ...completed, processResult: { ...completed.processResult, outputComplete: false } }) });
  await assert.rejects(incomplete.generate(input()), /DSH_FAILED/);
  let started = false;
  const invalid = createCaseAssistantClient({ ...options, probeConfig: async () => ({ exitCode: 0, stdout: '' }),
    runHarness: async () => { started = true; return completed; } });
  await assert.rejects(invalid.generate(input()), /DSH_CONFIG_INVALID/);
  assert.equal(started, false);
});

test('cancellation stops admission and reaches an active owned process; MCP closes after abort', async t => {
  const options = await setup(t);
  const before = new AbortController(); before.abort();
  let called = false;
  const early = createCaseAssistantClient({ ...options, probeConfig, runHarness: async () => { called = true; return completed; } });
  await assert.rejects(early.generate(input({ signal: before.signal })), /CANCELLED/);
  assert.equal(called, false);
  const controller = new AbortController();
  let endpointUrl;
  const active = createCaseAssistantClient({ ...options, probeConfig, runHarness: async args => {
    endpointUrl = args.env.WORKBENCH_CASE_ASSISTANT_ENDPOINT;
    controller.abort();
    assert.equal(args.signal.aborted, true);
    return { processResult: { exitCode: 1, termination: 'cancelled' }, events: [] };
  } });
  await assert.rejects(active.generate(input({ signal: controller.signal })), /CANCELLED/);
  await assert.rejects(fetch(endpointUrl));
});

test('deadline abort is distinct from user cancellation and does not start DSH after expiry', async t => {
  const options = await setup(t);
  let called = false;
  const client = createCaseAssistantClient({ ...options, config: { ...options.config, timeoutMs: 5 },
    probeConfig: async () => { await new Promise(resolve => setTimeout(resolve, 20)); return { exitCode: 0, stdout: probeOutput }; },
    runHarness: async () => { called = true; return completed; } });
  await assert.rejects(client.generate(input()), /TIMED_OUT/);
  assert.equal(called, false);
});

test('availability requires a real configured runtime and task paths cannot escape its data root', async t => {
  const options = await setup(t);
  assert.equal(createCaseAssistantClient({ ...options, config: { ...options.config, dshHome: path.join(options.root, 'missing') } }).available, false);
  const client = createCaseAssistantClient({ ...options, probeConfig, runHarness: async () => completed });
  await assert.rejects(client.generate(input({ taskId: '../outside' })), /ID_INVALID/);
});

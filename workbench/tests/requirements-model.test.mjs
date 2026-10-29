import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIREMENTS_MODEL_NONEMPTY_EXAMPLE, REQUIREMENTS_MODEL_OUTPUT_CONTRACT, REQUIREMENTS_MODEL_SYSTEM_PROMPT, requirementsModelInput } from '../server/requirements/model.mjs';
import { createRequirementsModel } from '../server/requirements-model.mjs';
import { createCandidateQualityReviewer } from '../server/quality-review.mjs';

test('requirements adapter alone requests high thinking and a longer bounded answer without retries', async () => {
  let clientOptions, requestOptions;
  const model = await createRequirementsModel({
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'fixture', source: 'fixture', baseUrl: 'https://api.deepseek.com' }),
    clientFactory: options => {
      clientOptions = options;
      return { async json(_system, _payload, options) {
        requestOptions = options;
        return { value: { candidates: { UI: [], BACKEND: [] }, issues: [] }, usage: { response_model: 'deepseek-flash' } };
      }, async close() {} };
    },
  });
  await model.generate({ input: { system_prompt: 'fixture' }, signal: AbortSignal.timeout(1000) });
  assert.equal(clientOptions.timeout, 180000);
  assert.deepEqual(model.requestProfile, {
    thinking: { type: 'enabled' }, reasoning_effort: 'high', max_output_tokens: 32768,
    timeout_ms: 180000, max_attempts: 1,
  });
  assert.equal(requestOptions.reasoningEffort, 'high');
  assert.equal(requestOptions.maxOutputTokens, 32768);
  assert.equal(requestOptions.maxAttempts, 1);
  assert.ok(requestOptions.signal);
});

test('full-generation lane uses low reasoning without changing consent, token bound or retry count', async () => {
  let options, payload;
  const model = await createRequirementsModel({
    configuration: { provider:'deepseek-official',model:'deepseek-flash' },
    credentialProvider: async()=>({apiKey:'fixture',source:'fixture',baseUrl:'https://api.deepseek.com'}),
    clientFactory:()=>({async json(_system,data,request){payload=data;options=request;return{value:{candidates:{UI:[],BACKEND:[]},issues:[]},usage:{response_model:'deepseek-flash'}};},close(){}}),
  });
  const input={system_prompt:'fixture',generation_partition:{case_type:'UI',order:1,total:2},source_segments:[{text:'冻结来源'}]};
  await model.generate({input});
  assert.equal(options.reasoningEffort,'low');
  assert.equal(options.maxAttempts,1);
  assert.equal(options.maxOutputTokens,32768);
  assert.equal(model.profileFor(input).reasoning_effort,'low');
  assert.equal(model.profileFor({}).reasoning_effort,'high');
  assert.deepEqual(payload.source_segments,input.source_segments);
  assert.equal(payload.generation_partition.case_type,'UI');
});

test('UI quality review uses its bounded profile without changing requirements or allowing malformed approval', async () => {
  const calls=[];
  const model=await createRequirementsModel({
    configuration:{provider:'deepseek-official',model:'deepseek-flash'},
    credentialProvider:async()=>({apiKey:'fixture',source:'fixture',baseUrl:'https://api.deepseek.com'}),
    clientFactory:()=>({async json(_system,payload,options){calls.push({payload,options});return{value:{steps:[],findings:[]},usage:{response_model:'deepseek-flash'}};},close(){}}),
  });
  const result=await createCandidateQualityReviewer({modelClient:model}).review({
    kind:'ui',frozenCase:{steps:[{order:1,action:'提交',expected:'拒绝只读角色修改'}]},
    caseSha256:'a'.repeat(64),candidateSha256:'b'.repeat(64),
    files:[{path:'candidate.spec.mjs',content:'// unchanged fixture'}],evidence:{status:'PASSED'},
  });
  assert.equal(calls[0].options.reasoningEffort,'low');
  assert.equal(calls[0].options.maxOutputTokens,32768);
  assert.equal(calls[0].options.maxAttempts,1);
  assert.equal(result.request_profile.reasoning_effort,'low');
  assert.equal(result.status,'NEEDS_ANALYSIS');
  assert.equal(result.error_code,'MODEL_RESPONSE_STRUCTURE_INVALID');
  assert.equal(result.semantic_approval,false);
  assert.equal(Object.hasOwn(calls[0].payload,'purpose'),false);
  // A purpose-like field inside untrusted business data cannot select the profile.
  await model.generate({input:{system_prompt:'fixture',purpose:'ui-candidate-quality-review'}});
  assert.equal(calls[1].options.reasoningEffort,'high');
  assert.equal(model.profileFor({kind:'backend'}).reasoning_effort,'high');
});

test('model request carries selected evidence and one complete non-business JSON shape example', () => {
  const design = {
    project_id: 'project-aaaaaaaa', allow_model_text: true,
    scope: { mode: 'SELECTED', description: '仅编号重复' },
    source_refs: [{ snapshot_id: 'source-prd' }, { snapshot_id: 'source-image' }],
  };
  const sources = [
    { project_id: design.project_id, snapshot_id: 'source-prd', kind: 'PRD', segments: [
      { segment_id: 'segment-1', text: '编号重复应拒绝', quote_sha256: 'quote-1', location: { paragraph: 1 } },
    ] },
    { project_id: design.project_id, snapshot_id: 'source-image', kind: 'IMAGE', segments: [
      { segment_id: 'segment-2', text: '不得发送的图像描述', quote_sha256: 'quote-2', location: {} },
    ] },
  ];
  const input = requirementsModelInput(design, sources);
  assert.deepEqual(Object.keys(input), ['system_prompt', 'selected_scope', 'selected_source_manifest', 'source_segments', 'source_ref_catalog', 'image_analysis']);
  assert.deepEqual(input.selected_source_manifest.protocol, { status: 'ABSENT', snapshot_ids: [] });
  assert.deepEqual(input.selected_source_manifest.sources.map(({ snapshot_id, sent_segments }) => [snapshot_id, sent_segments]), [['source-prd', 1]]);
  assert.deepEqual(input.source_segments.map((segment) => segment.segment_id), ['segment-1']);
  assert.equal(input.source_segments[0].quote_sha256, 'quote-1');
  assert.equal(input.selected_scope.description, '仅编号重复');
  assert.deepEqual(Object.keys(REQUIREMENTS_MODEL_OUTPUT_CONTRACT).sort(), ['candidates', 'issues']);
  assert.deepEqual(REQUIREMENTS_MODEL_OUTPUT_CONTRACT.candidates.UI[0], REQUIREMENTS_MODEL_OUTPUT_CONTRACT.candidates.BACKEND[0]);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /根对象恰好只有 candidates 和 issues/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /不得阻断已有业务依据的用例确认/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /原子业务规则/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /测试数据只用于实例化输入值/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /不得从测试数据推导允许\/拒绝规则/);
  const exampleJson = JSON.stringify(REQUIREMENTS_MODEL_NONEMPTY_EXAMPLE, null, 2);
  assert.ok(input.system_prompt.includes(exampleJson));
  const parsedExample = JSON.parse(exampleJson);
  assert.deepEqual(Object.keys(parsedExample), ['candidates', 'issues']);
  assert.deepEqual(Object.keys(parsedExample.candidates), ['UI', 'BACKEND']);
  assert.deepEqual(Object.keys(parsedExample.candidates.UI[0]), ['content', 'issues']);
  assert.deepEqual(Object.keys(parsedExample.candidates.BACKEND[0]), ['content', 'issues']);
  assert.deepEqual(Object.keys(parsedExample.candidates.BACKEND[0].content), Object.keys(parsedExample.candidates.UI[0].content));
  assert.equal(parsedExample.candidates.UI[0].content.steps[0].expected, '');
  assert.deepEqual(parsedExample.candidates.UI[0].content.steps[0].source_refs, []);
  assert.ok(!Object.hasOwn(parsedExample.candidates.UI[0].content, 'issues'));
  assert.match(input.system_prompt, /候选 issues 与 content 平级/);
  assert.doesNotMatch(input.system_prompt, /"external_id":"string"/);
});

test('requirements model retains only a whitelisted transport code and never exception text', async () => {
  const privateKey = 'fixture-api-key-do-not-persist';
  const hostile = `fetch failed https://user:proxy-pass@proxy.invalid/path?token=${privateKey}; Authorization: Bearer ${privateKey}`;
  const model = await createRequirementsModel({
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: privateKey, source: 'fixture', baseUrl: 'https://api.deepseek.com' }),
    clientFactory: () => ({
      async json(_system, _payload, { onTrace }) {
        await onTrace({ type: 'MODEL_TRANSPORT_FINISHED', error_code: 'DEEPSEEK_CONNECTION_FAILED', network_error_code: 'ECONNRESET', message: hostile, url: hostile });
        const error = new Error(hostile);
        error.code = 'DEEPSEEK_CONNECTION_FAILED';
        throw error;
      },
      async close() {},
    }),
  });
  let caught;
  try { await model.generate({ input: { system_prompt: 'fixture' } }); } catch (error) { caught = error; }
  assert.equal(caught?.requirement_diagnostic?.error_code, 'DEEPSEEK_CONNECTION_FAILED');
  assert.equal(caught?.requirement_diagnostic?.network_error_code, 'ECONNRESET');
  assert.equal(JSON.stringify(caught?.requirement_diagnostic).includes(hostile), false);
  assert.equal(JSON.stringify(caught?.requirement_diagnostic).includes(privateKey), false);
  assert.equal(JSON.stringify(caught?.requirement_diagnostic).includes('proxy-pass'), false);
  assert.equal(JSON.stringify(caught?.requirement_diagnostic).includes('api.deepseek.com'), false);
});

test('requirements model rejects unapproved network diagnostic codes and local transport errors', async () => {
  const model = await createRequirementsModel({
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'fixture', source: 'fixture', baseUrl: 'https://api.deepseek.com' }),
    clientFactory: () => ({
      async json(_system, _payload, { onTrace }) {
        await onTrace({ type: 'MODEL_TRANSPORT_FINISHED', error_code: 'DEEPSEEK_TRANSPORT_ERROR', network_error_code: 'BAD_CODE', transport_error_kind: 'TYPE_ERROR', message: 'must not persist' });
        throw new Error('DEEPSEEK_TRANSPORT_ERROR');
      },
      async close() {},
    }),
  });
  let caught;
  try { await model.generate({ input: { system_prompt: 'fixture' } }); } catch (error) { caught = error; }
  assert.equal(caught?.message, 'DEEPSEEK_TRANSPORT_ERROR');
  assert.deepEqual(caught?.requirement_diagnostic, { error_code: 'DEEPSEEK_TRANSPORT_ERROR', transport_error_kind: 'TYPE_ERROR' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DeepSeek } from '../../src/deepseek.mjs';
import { RequirementsManager } from '../server/requirements/manager.mjs';
import { prepareImageParts, imageRequestEvidence, normalizeImageObservations } from '../server/requirements/images.mjs';
import { sha256 } from '../server/requirements/documents.mjs';
import { resolveSourceRef } from '../server/requirements/candidates.mjs';
import { imageAnalysisView } from '../web-v2/requirements.js';
import { requirementsRoute } from '../server/requirements-routes.mjs';
import { REQUIREMENTS_IMAGE_MODEL_SYSTEM_PROMPT, REQUIREMENTS_IMAGE_NONEMPTY_EXAMPLE } from '../server/requirements/model.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const projectId = 'project-visiontest';
const observation = image => ({ snapshot_id: image.snapshot_id, sha256: image.sha256,
  observations: [{ description: '图中可见合成测试表格', location: '页面中央' }], uncertainties: ['当前画面不定义业务规则'] });
async function fixture(t, { supportsImages = true, response } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirements-images-'));
  const calls = [];
  const manager = new RequirementsManager({ root, projectStore: { async getProject(id) { return id === projectId ? { project_id: id, revision: 1, cases: [] } : null; } },
    modelClient: { supportsImages, model: 'deepseek-flash', async generate(request) {
      calls.push(request);
      return response ? response(request) : { candidates: { UI: [], BACKEND: [] }, issues: [],
        image_observations: (request.input.image_parts || []).map(observation), usage: { total_tokens: 17 }, model: 'deepseek-flash' };
    } },
  });
  await manager.init();
  t.after(async () => { await manager.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  const prd = await manager.upload(projectId, { kind: 'PRD', fileName: 'requirements.md', body: Buffer.from('业务规则：重复编号必须拒绝。') });
  const image = await manager.upload(projectId, { kind: 'IMAGE', fileName: 'prototype.png', body: png });
  const create = allowModelImages => manager.createDesign(projectId, { sourceIds: [prd.snapshot_id, image.snapshot_id], scope: { mode: 'SELECTED', description: '重复编号拒绝与本次图像读取' }, allowModelText: true, allowModelImages });
  async function settled(id) {
    for (let i = 0; i < 100; i++) {
      const design = await manager.getDesign(projectId, id);
      if (design.status !== 'RUNNING') return design;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('fixture did not settle');
  }
  return { manager, calls, prd, image, create, settled };
}

test('transport sends actual image content blocks without exposing image bytes in trace', async () => {
  const traces = []; let request;
  const client = new DeepSeek({ key: 'fixture-private-key', model: 'deepseek-flash', fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }], usage: { total_tokens: 3 } }));
  } });
  await client.json('Return JSON.', { rule: 'text evidence' }, { maxAttempts: 1, images: [{ mime_type: 'image/png', body: png, snapshot_id: 'source-test', sha256: sha256(png) }], onTrace: item => traces.push(item) });
  const content = request.messages[1].content;
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.equal(content[0].type, 'text');
  const data = content.find(item => item.type === 'image_url').image_url.url;
  assert.deepEqual(Buffer.from(data.split(',')[1], 'base64'), png);
  assert.match(content[1].text, /source-test/);
  assert.doesNotMatch(JSON.stringify(traces), /fixture-private-key|data:image|iVBOR/);
  let sent = false;
  const unsupported = new DeepSeek({ key: 'fixture', model: 'deepseek-v4-pro', fetchImpl: async () => { sent = true; } });
  await assert.rejects(unsupported.json('x', {}, { images: [{ mime_type: 'image/png', body: png }] }), /MODEL_IMAGE_UNSUPPORTED/);
  assert.equal(sent, false);
});

test('vision prompt has one complete three-key example and no obsolete two-key closing instruction', () => {
  const example = JSON.parse(JSON.stringify(REQUIREMENTS_IMAGE_NONEMPTY_EXAMPLE));
  assert.deepEqual(Object.keys(example), ['candidates', 'issues', 'image_observations']);
  assert.equal(example.image_observations.length, 1);
  assert.deepEqual(Object.keys(example.candidates.UI[0]), ['content', 'issues']);
  assert.equal(example.candidates.UI[0].content.issues, undefined);
  assert.ok(REQUIREMENTS_IMAGE_MODEL_SYSTEM_PROMPT.includes(JSON.stringify(example, null, 2)));
  assert.doesNotMatch(REQUIREMENTS_IMAGE_MODEL_SYSTEM_PROMPT, /根对象恰好只有 candidates 和 issues 两个键|写根级 issues 数组并关闭根对象/);
  assert.match(REQUIREMENTS_IMAGE_MODEL_SYSTEM_PROMPT, /三项全部完成后才关闭根对象/);
});

test('JSON-mode provider missing a content-closing brace remains a one-attempt paid failure without repair', async () => {
  const invalid = '{"candidates":{"UI":[{"content":{"steps":[],"issues":[]}],"BACKEND":[]},"issues":[],"image_observations":[]}';
  let attempts = 0; const traces = [];
  const client = new DeepSeek({ key: 'fixture', fetchImpl: async (_url, options) => {
    attempts++;
    assert.deepEqual(JSON.parse(options.body).response_format, { type: 'json_object' });
    return new Response(JSON.stringify({ model: 'deepseek-flash', usage: { prompt_tokens: 7, completion_tokens: 9, total_tokens: 16 },
      choices: [{ finish_reason: 'stop', message: { content: invalid } }] }));
  } });
  await assert.rejects(client.json('Return JSON.', {}, { maxAttempts: 1, onTrace: event => traces.push(event) }), /DEEPSEEK_JSON_INVALID/);
  assert.equal(attempts, 1);
  const failure = traces.find(event => event.type === 'MODEL_RESPONSE_REJECTED');
  assert.equal(failure.response_text, invalid);
  assert.equal(failure.usage.total_tokens, 16);
  assert.equal(failure.finish_reason, 'stop');
});

test('image consent gates both admissions; ordinary text generation never transports archived images', async t => {
  const f = await fixture(t);
  const denied = await f.create(false);
  await assert.rejects(f.manager.startGeneration(projectId, denied.design_id, { revision: 1, allowModelText: true, allowModelImages: true }), /IMAGE_AUTH_REQUIRED/);
  assert.equal(f.calls.length, 0);
  const consented = await f.create(true);
  await assert.rejects(f.manager.startGeneration(projectId, consented.design_id, { revision: 1, allowModelText: true }), /IMAGE_AUTH_REQUIRED/);
  assert.equal(f.calls.length, 0);
  await f.manager.startGeneration(projectId, denied.design_id, { revision: 1, allowModelText: true });
  const result = await f.settled(denied.design_id);
  assert.equal(result.generation.image_analysis.status, 'NOT_REQUESTED');
  assert.equal(f.calls[0].input.image_parts, undefined);
  assert.equal(f.calls[0].input.source_segments.some(item => item.kind === 'IMAGE'), false);
});

test('multimodal generation records validated observations without mutating sources or confirming cases', async t => {
  const f = await fixture(t);
  const original = await f.manager.getSource(projectId, f.image.snapshot_id);
  const design = await f.create(true);
  await f.manager.startGeneration(projectId, design.design_id, { revision: 1, allowModelText: true, allowModelImages: true });
  const result = await f.settled(design.design_id);
  assert.equal(result.status, 'PENDING_REVIEW');
  assert.equal(result.model_requests.length, 1);
  assert.equal(result.model_requests[0].usage.total_tokens, 17);
  assert.equal(result.generation.image_analysis.status, 'ANALYZED');
  assert.equal(result.generation.image_analysis.source_snapshots[0].sha256, sha256(png));
  assert.equal(result.generation.image_analysis.observations[0].review, 'PENDING_CANDIDATE_REVIEW');
  assert.deepEqual(f.calls[0].input.image_parts[0].body, png);
  assert.match(f.calls[0].input.system_prompt, /三个键/);
  assert.doesNotMatch(JSON.stringify(result), /iVBOR|data:image/);
  assert.deepEqual(await f.manager.getSource(projectId, f.image.snapshot_id), original);
  const preview = await f.manager.getImage(projectId, f.image.snapshot_id);
  assert.deepEqual(preview.body, png);
  await assert.rejects(f.manager.getImage(projectId, f.prd.snapshot_id), /IMAGE_REQUIRED/);
  let headers, responseBytes;
  await requirementsRoute({ request: { method: 'GET' }, response: {
    writeHead(status, value) { assert.equal(status, 200); headers = value; }, end(bytes) { responseBytes = bytes; },
  }, url: new URL(`http://127.0.0.1:4322/api/case-library/projects/${projectId}/requirements/sources/${f.image.snapshot_id}/image`), manager: f.manager });
  assert.deepEqual(responseBytes, png);
  assert.equal(headers['x-source-sha256'], original.sha256);
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(resolveSourceRef({ snapshot_id: f.image.snapshot_id, segment_id: 'image-1' }, design, [f.image]), null);
  await assert.rejects(f.manager.startGeneration(projectId, design.design_id, { revision: result.revision, allowModelText: true, allowModelImages: true }), /MODEL_STATE_INVALID|BUDGET_EXHAUSTED/);
});

test('unsupported capability and altered original bytes reject before model admission', async t => {
  const f = await fixture(t, { supportsImages: false });
  const design = await f.create(true);
  await assert.rejects(f.manager.startGeneration(projectId, design.design_id, { revision: 1, allowModelText: true, allowModelImages: true }), /IMAGE_UNAVAILABLE/);
  assert.equal(f.calls.length, 0);
  f.manager.modelClient.supportsImages = true;
  const file = path.join(f.manager.store.sourceRoot(projectId, f.image.snapshot_id), 'original.bin');
  await fs.writeFile(file, Buffer.concat([png, Buffer.from('altered')]));
  await assert.rejects(f.manager.startGeneration(projectId, design.design_id, { revision: 1, allowModelText: true, allowModelImages: true }), /SOURCE_INTEGRITY_FAILED/);
  assert.equal(f.calls.length, 0);
});

test('wrong image identity is a paid failure, not silently accepted vision evidence', async t => {
  const f = await fixture(t, { response: request => ({ candidates: { UI: [], BACKEND: [] }, issues: [], usage: { total_tokens: 23 },
    image_observations: [{ ...observation(request.input.image_parts[0]), sha256: 'wrong' }] }) });
  const design = await f.create(true);
  await f.manager.startGeneration(projectId, design.design_id, { revision: 1, allowModelText: true, allowModelImages: true });
  const result = await f.settled(design.design_id);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.generation.error, 'REQUIREMENT_IMAGE_OBSERVATIONS_SOURCE_INVALID');
  assert.equal(result.generation.image_analysis.status, 'FAILED');
  assert.equal(result.model_requests[0].usage.total_tokens, 23);
  await assert.rejects(f.manager.startGeneration(projectId, design.design_id, { revision: result.revision, allowModelText: true, allowModelImages: true }), /BUDGET_EXHAUSTED/);
});

test('bounded complete observations and safe UI explicitly distinguish reading from semantic approval', () => {
  const source = { snapshot_id: 'source-one', sha256: sha256(png), bytes: png.length, file_name: '<img>.png' };
  const parts = prepareImageParts([source], new Map([[source.snapshot_id, png]]));
  const evidence = imageRequestEvidence(parts);
  assert.throws(() => normalizeImageObservations([], evidence), /OBSERVATIONS_INVALID/);
  assert.throws(() => prepareImageParts(Array(4).fill(source), new Map([[source.snapshot_id, png]])), /IMAGE_LIMIT_EXCEEDED/);
  const normalized = normalizeImageObservations([{ ...observation(source), observations: [{ description: '<script>evil</script>', location: 'top' }] }], evidence);
  const html = imageAnalysisView(normalized);
  assert.match(html, /待人工核对/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(imageAnalysisView(imageRequestEvidence([])), /未向模型发送图片/);
});

test('ALL authorized images retain actual bytes and provenance across both UI and BACKEND requests', async t => {
  const f = await fixture(t);
  const design = await f.manager.createDesign(projectId,{sourceIds:[f.prd.snapshot_id,f.image.snapshot_id],
    scope:{mode:'ALL_CURRENT'},allowModelText:true,allowModelImages:true});
  await f.manager.startGeneration(projectId,design.design_id,{revision:1,allowModelText:true,allowModelImages:true});
  const result=await f.settled(design.design_id);
  assert.equal(result.status,'PENDING_REVIEW',JSON.stringify(result.generation));
  assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls.map(x=>x.input.generation_partition.case_type),['UI','BACKEND']);
  for(const call of f.calls){assert.deepEqual(call.input.image_parts[0].body,png);
    assert.equal(call.input.image_parts[0].sha256,f.image.sha256);}
  assert.deepEqual(result.model_requests.map(x=>x.status),['COMPLETED','COMPLETED']);
  assert.equal(result.generation.image_analysis.status,'ANALYZED');
  assert.equal(result.generation.image_analysis.source_snapshots[0].sha256,f.image.sha256);
  assert.equal(JSON.stringify(result).includes('iVBOR'),false);
});

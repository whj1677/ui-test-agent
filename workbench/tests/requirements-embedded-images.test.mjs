import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectDocument, sha256, extractDocxImages } from '../server/requirements/documents.mjs';
import { prepareImageParts, imageRequestEvidence } from '../server/requirements/images.mjs';
import { RequirementsManager } from '../server/requirements/manager.mjs';
import { resolveSourceRef } from '../server/requirements/candidates.mjs';
import { requirementsRoute } from '../server/requirements-routes.mjs';
import { imageAnalysisView } from '../web-v2/requirements.js';
import { PNG, docxFixture } from './fixtures/docx-image-fixture.mjs';

function sourceFor(body, id = 'source-parent') {
  return { ...inspectDocument({ kind: 'PRD', fileName: 'requirements.docx', body }), snapshot_id: id, kind: 'PRD' };
}

test('DOCX reads only body-referenced PNG/JPEG bytes with parent provenance and visible positions', () => {
  const jpeg = Buffer.from([255, 216, 0, 255, 217]);
  const body = docxFixture({ images: [{ name: 'ui.png', body: PNG }, { name: 'page.jpg', body: jpeg }, { name: 'orphan.png', body: PNG }],
    references: [{ id: 'rId1', target: 'media/ui.png' }, { id: 'rId2', target: '/word/media/page.jpg' }, { id: 'rId3', target: 'media/ui.png' }] });
  const source = sourceFor(body);
  assert.equal(source.sections.images, 'UNANALYZED');
  assert.equal(source.read_status, 'PARTIAL');
  assert.equal(source.embedded_images.length, 2);
  assert.deepEqual(source.embedded_images[0].references, [{ relationship_id: 'rId1', location: { paragraph: 2 } }, { relationship_id: 'rId3', location: { paragraph: 4 } }]);
  assert.equal(source.embedded_images[0].body, undefined);
  assert.ok(source.issues.some(issue => issue.code === 'UNREFERENCED_OR_UNSUPPORTED_IMAGE_UNANALYZED'));
  const parts = prepareImageParts([source], new Map([[source.snapshot_id, body]]));
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map(part => part.body), [PNG, jpeg]);
  assert.equal(parts[0].parent_sha256, source.sha256);
  assert.equal(parts[0].sha256, sha256(PNG));
  assert.equal(parts[1].mime_type, 'image/jpeg');
  const evidence = imageRequestEvidence(parts);
  assert.doesNotMatch(JSON.stringify(evidence), /iVBOR|data:image|"type":"Buffer"/);
  assert.match(imageAnalysisView(evidence, 'project-test'), /sources\/source-parent\/image\?embedded=image-1/);
  assert.match(imageAnalysisView(evidence, 'project-test'), /段落 2/);
});

test('DOCX external, unsupported and missing images remain explicit unanalysed gaps without bytes', () => {
  const body = docxFixture({ images: [{ name: 'vector.svg', body: '<svg/>' }], references: [
    { id: 'rId1', target: 'https://example.invalid/tracking.png', external: true, link: true },
    { id: 'rId2', target: 'media/vector.svg' }, { id: 'rId3', target: 'media/missing.png' },
  ] });
  const source = sourceFor(body);
  assert.deepEqual(extractDocxImages(body), []);
  for (const code of ['LINKED_IMAGE_UNANALYZED', 'EMBEDDED_IMAGE_TYPE_UNANALYZED', 'EMBEDDED_IMAGE_MISSING']) assert.ok(source.issues.some(issue => issue.code === code));
});

test('DOCX blocks unsafe image paths, duplicate relationships, XML entities and forged image signatures', () => {
  for (const target of ['../media/prototype.png', 'media/../prototype.png', 'media/%2e%2e.png', 'file:///tmp/image.png', 'media\\prototype.png', '/elsewhere/image.png']) {
    assert.throws(() => sourceFor(docxFixture({ references: [{ id: 'rId1', target }] })), /IMAGE_PATH_UNSAFE/);
  }
  assert.throws(() => sourceFor(docxFixture({ references: [{ id: 'duplicate', target: 'media/prototype.png' }, { id: 'duplicate', target: 'media/prototype.png' }] })), /RELATION_INVALID/);
  assert.throws(() => sourceFor(docxFixture({ relationshipXml: '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]><Relationships/>' })), /XML_UNSAFE/);
  assert.throws(() => sourceFor(docxFixture({ images: [{ name: 'fake.png', body: Buffer.from('not-a-png') }] })), /IMAGE_INVALID/);
});

test('DOCX and independent images share count/total budgets and frozen parent identity', () => {
  const body = docxFixture({ images: [1, 2, 3].map(n => ({ name: `${n}.png`, body: PNG })) });
  const doc = sourceFor(body);
  const standalone = { snapshot_id: 'source-single', sha256: sha256(PNG), bytes: PNG.length, file_name: 'single.png' };
  assert.throws(() => prepareImageParts([doc, standalone], new Map([[doc.snapshot_id, body], [standalone.snapshot_id, PNG]])), /IMAGE_LIMIT_EXCEEDED/);
  assert.throws(() => prepareImageParts([doc], new Map([[doc.snapshot_id, Buffer.concat([body, Buffer.from('tamper')])]])), /SOURCE_INTEGRITY_FAILED/);
  const altered = structuredClone(doc); altered.embedded_images[0].sha256 = 'bad';
  assert.throws(() => prepareImageParts([altered], new Map([[altered.snapshot_id, body]])), /SOURCE_INTEGRITY_FAILED/);
  const large = Buffer.concat([PNG, Buffer.alloc(7 * 1024 * 1024 - PNG.length)]);
  const largeBody = docxFixture({ images: [{ name: 'large.png', body: large }] });
  const largeSources = [1, 2, 3].map(n => sourceFor(largeBody, `source-large-${n}`));
  assert.throws(() => prepareImageParts(largeSources, new Map(largeSources.map(source => [source.snapshot_id, largeBody]))), /IMAGE_LIMIT_EXCEEDED/);
});

test('embedded images require both image authorizations; actual bytes enter one bounded request and previews', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirements-embedded-'));
  const projectId = 'project-embeddedtest', calls = [];
  const manager = new RequirementsManager({ root, projectStore: { async getProject(id) { return id === projectId ? { project_id: id, revision: 1, cases: [] } : null; } },
    modelClient: { supportsImages: true, async generate(request) {
      calls.push(request);
      return { candidates: { UI: [], BACKEND: [] }, issues: [], image_observations: (request.input.image_parts || []).map(part => ({
        snapshot_id: part.snapshot_id, sha256: part.sha256, observations: [], uncertainties: ['合成像素图没有业务规则。'],
      })) };
    } },
  });
  await manager.init();
  t.after(async () => { await manager.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  const source = await manager.upload(projectId, { kind: 'PRD', fileName: 'prototype.docx', body: docxFixture() });
  const create = allowModelImages => manager.createDesign(projectId, { sourceIds: [source.snapshot_id], scope: { mode: 'SELECTED', description: '本次DOCX正文与嵌入图片读取' }, allowModelText: true, allowModelImages });
  const denied = await create(false), allowed = await create(true);
  await assert.rejects(manager.startGeneration(projectId, denied.design_id, { revision: 1, allowModelText: true, allowModelImages: true }), /IMAGE_AUTH_REQUIRED/);
  await assert.rejects(manager.startGeneration(projectId, allowed.design_id, { revision: 1, allowModelText: true }), /IMAGE_AUTH_REQUIRED/);
  assert.equal(calls.length, 0);
  const settle = async id => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const design = await manager.getDesign(projectId, id);
      if (design.status !== 'RUNNING') return design;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('fixture did not settle');
  };
  await manager.startGeneration(projectId, denied.design_id, { revision: 1, allowModelText: true });
  assert.equal((await settle(denied.design_id)).generation.image_analysis.status, 'NOT_REQUESTED');
  assert.equal(calls[0].input.image_parts, undefined);
  await manager.startGeneration(projectId, allowed.design_id, { revision: 1, allowModelText: true, allowModelImages: true });
  const result = await settle(allowed.design_id), part = calls[1].input.image_parts[0];
  assert.equal(result.status, 'PENDING_REVIEW');
  assert.equal(result.generation.image_analysis.status, 'ANALYZED');
  assert.deepEqual(part.body, PNG);
  assert.equal(part.parent_snapshot_id, source.snapshot_id);
  assert.equal(calls[1].input.source_segments[0].text, source.segments[0].text);
  assert.equal(resolveSourceRef({ snapshot_id: part.snapshot_id, segment_id: 'image-1' }, result, [source]), null);
  assert.equal((await manager.getSource(projectId, source.snapshot_id)).sections.images, 'UNANALYZED');
  assert.deepEqual(await manager.getSource(projectId, source.snapshot_id), source);
  let bytes, headers;
  await requirementsRoute({ request: { method: 'GET' }, response: { writeHead(status, value) { assert.equal(status, 200); headers = value; }, end(value) { bytes = value; } },
    url: new URL(`http://127.0.0.1:4322/api/case-library/projects/${projectId}/requirements/sources/${source.snapshot_id}/image?embedded=image-1`), manager });
  assert.deepEqual(bytes, PNG);
  assert.equal(headers['x-source-sha256'], sha256(PNG));
  await assert.rejects(manager.getImage(projectId, source.snapshot_id, '../image-1'), /IMAGE_REQUIRED/);
  await assert.rejects(manager.getImage(projectId, source.snapshot_id, 'image-2'), /IMAGE_REQUIRED/);
});

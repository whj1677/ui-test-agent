import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FRONTEND_HANDOFF_SCHEMA, canonicalJson, frontendHandoffHash, sourceSnapshotHash, validateFrontendHandoff } from '../server/frontend-handoff-contract.mjs';
import { prepare, seal, validateFile } from '../../skills/frontend-module-handoff/scripts/handoff.mjs';

function example() {
  const files = [{ path: 'src/Example.vue', sha256: 'a'.repeat(64), line_count: 100 }];
  const ref = { path: files[0].path, start_line: 1, end_line: 5 };
  return { schema: FRONTEND_HANDOFF_SCHEMA, package_id: 'handoff-test', created_at: '2026-10-14T01:00:00Z', module: { name: '示例', aliases: ['示例模块'] }, source: { revision: null, files, snapshot_sha256: sourceSnapshotHash(files) }, pages: [{ id: 'example', name: '示例页面', entry_paths: ['/example'], source_refs: [ref], controls: [{ id: 'submit', purpose: '提交表单', locator_candidates: [{ strategy: 'role', role: 'button', value: '保存', evidence: 'source-derived', scope: '可见弹窗' }], source_refs: [ref], notes: ['可见性与唯一性需在页面核对。'] }], waits: [{ id: 'loaded', description: '详情加载结束后等待表单可交互。', source_refs: [ref] }], technical_notes: [] }], unresolved: [{ topic: '部署版本', reason: '尚未与线上版本核对。' }] };
}
test('valid bounded technical hints are canonical and do not claim runtime validation', () => {
  const value = example(), result = validateFrontendHandoff(value);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.sha256, frontendHandoffHash(JSON.parse(JSON.stringify(value))));
  assert.equal(canonicalJson({ z: 1, a: 2 }), canonicalJson({ a: 2, z: 1 }));
  value.pages[0].controls[0].locator_candidates[0].evidence = 'runtime-verified';
  assert.equal(validateFrontendHandoff(value).ok, false);
});
test('unknown schema and fields cannot introduce expected values, source text or scripts', () => {
  for (const key of ['source_code', 'expected', 'input_values', 'script', '__proto__']) {
    const value = example();
    Object.defineProperty(value.pages[0], key, { value: 'x', enumerable: true });
    assert.equal(validateFrontendHandoff(value).ok, false, key);
  }
  const value = example(); value.schema = 'workbench/frontend-module-handoff-v2';
  assert.equal(validateFrontendHandoff(value).ok, false);
});
test('source references are bound to existing manifest files and valid line ranges', () => {
  for (const ref of [{ path: '../escape.vue', start_line: 1, end_line: 2 }, { path: 'src/Example.vue', start_line: 0, end_line: 3 }, { path: 'src/Example.vue', start_line: 1, end_line: 101 }]) {
    const value = example(); value.pages[0].source_refs = [ref];
    assert.equal(validateFrontendHandoff(value).ok, false);
  }
  const value = example(); value.source.files[0].sha256 = 'b'.repeat(64);
  assert.equal(validateFrontendHandoff(value).ok, false);
});
test('relative source manifest excludes secrets, dependencies, builds and traversal', () => {
  for (const relative of ['.env', 'src/../../secret.vue', 'C:/src/a.vue', '/src/a.vue', 'node_modules/a.vue', 'dist/a.js', 'src/credentials.json', 'src\\a.vue']) {
    const value = example(); value.source.files[0].path = relative; value.source.snapshot_sha256 = sourceSnapshotHash(value.source.files);
    assert.equal(validateFrontendHandoff(value).ok, false, relative);
  }
});
test('absolute routes, embedded code, template fragments and credential patterns are rejected', () => {
  for (const body of ['https://example.test/a', 'C:\\src\\app.vue', 'const token = 123', '<a-button>保存</a-button>', 'x => x()', 'Bearer abcdefghij', 'page.evaluate(foo)', '```js\nhello\n```']) {
    const value = example(); value.pages[0].waits[0].description = body;
    assert.equal(validateFrontendHandoff(value).ok, false, body);
  }
  for (const route of ['https://example.test/a', '//example.test/a', '/a?secret=1', '/a#token', '/../../a']) {
    const value = example(); value.pages[0].entry_paths = [route];
    assert.equal(validateFrontendHandoff(value).ok, false, route);
  }
});
test('CSS can scope and exclude decorative DOM without encoding data or code', () => {
  const value = example();
  value.pages[0].controls[0].locator_candidates = [{ strategy: 'css', value: '.timeline .segment:not(.placeholder)', evidence: 'source-derived' }];
  assert.equal(validateFrontendHandoff(value).ok, true);
  value.pages[0].controls[0].locator_candidates[0].value = '[value="business-input"]';
  assert.equal(validateFrontendHandoff(value).ok, false);
});
test('size, repeated identities and missing module aliases are rejected', () => {
  assert.equal(validateFrontendHandoff(' '.repeat(262145)).ok, false);
  const value = example(); value.pages.push(structuredClone(value.pages[0]));
  assert.equal(validateFrontendHandoff(value).ok, false);
  const missing = example(); delete missing.module.aliases;
  assert.equal(validateFrontendHandoff(missing).ok, false);
  assert.equal(validateFrontendHandoff(null).ok, false);
  assert.equal(validateFrontendHandoff('{').ok, false);
});
test('standalone developer and workbench validators cannot drift', async () => {
  const base = path.dirname(fileURLToPath(import.meta.url));
  assert.equal(await fs.readFile(path.join(base, '../server/frontend-handoff-contract.mjs'), 'utf8'), await fs.readFile(path.join(base, '../../skills/frontend-module-handoff/scripts/contract.mjs'), 'utf8'));
});
async function withFixture(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'handoff-contract-'));
  try {
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src/Example.vue'), '<template>\n<button>保存</button>\n</template>\n<!-- source stays private -->\n');
    const selectionFile = path.join(root, 'selection.json'), manifestFile = path.join(root, 'internal/manifest.json'), draftFile = path.join(root, 'internal/draft.json'), outputFile = path.join(root, 'public.json');
    await fs.writeFile(selectionFile, JSON.stringify({ module: example().module, files: ['src/Example.vue'] }));
    await prepare({ root, selectionFile, manifestFile });
    await fs.writeFile(draftFile, JSON.stringify({ pages: example().pages, unresolved: example().unresolved }));
    await callback({ root, selectionFile, manifestFile, draftFile, outputFile });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
test('prepare and seal bind real hashes while omitting source and local root', async () => withFixture(async ctx => {
  const result = await seal(ctx), output = await fs.readFile(ctx.outputFile, 'utf8'), document = JSON.parse(output);
  assert.equal(output.includes(ctx.root), false);
  assert.equal(output.includes('<template>'), false);
  assert.equal(output.includes('source stays private'), false);
  assert.equal(document.source.files[0].sha256, createHash('sha256').update(await fs.readFile(path.join(ctx.root, 'src/Example.vue'))).digest('hex'));
  assert.equal(result.sha256, (await validateFile(ctx.outputFile)).sha256);
  await assert.rejects(seal(ctx), /EEXIST/);
}));
test('seal refuses source changes and preserves original evidence', async () => withFixture(async ctx => {
  const old = await fs.readFile(ctx.manifestFile, 'utf8');
  await fs.appendFile(path.join(ctx.root, 'src/Example.vue'), '\nchanged');
  await assert.rejects(seal(ctx), /Source changed/);
  assert.equal(await fs.readFile(ctx.manifestFile, 'utf8'), old);
  await assert.rejects(fs.access(ctx.outputFile));
}));
test('seal refuses invented draft metadata and invalid source references', async () => withFixture(async ctx => {
  const draft = { pages: example().pages, unresolved: [], business_expectation: 'PASS' };
  await fs.writeFile(ctx.draftFile, JSON.stringify(draft));
  await assert.rejects(seal(ctx), /unexpected fields/);
  delete draft.business_expectation; draft.pages[0].source_refs[0].end_line = 99;
  await fs.writeFile(ctx.draftFile, JSON.stringify(draft));
  await assert.rejects(seal(ctx), /source line range/);
}));

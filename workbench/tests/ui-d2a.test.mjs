import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const mapping = { external_id:'用例编号', title:'标题', module:'模块', preconditions:'前置条件', test_data:'测试数据', steps:'步骤', expected:'逐步预期', status:'内容状态' };
const sampleA = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_CASES_A.xlsx', import.meta.url));
const sampleB = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_CASES_B.xlsx', import.meta.url));
const nativeSample = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_NATIVE_SAMPLE.json', import.meta.url));

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-d2a-test-')); t.after(() => fs.rm(root, { recursive:true, force:true }));
  const store = new CaseLibraryStore(path.join(root, 'case-library')); await store.init();
  return { store, manager:new CaseLibraryManager(store) };
}

test('workspace entry is a same-origin whitelist and old workbench remains available', async (t) => {
  const { store, manager } = await setup(t); const server = createWorkbenchServer({ caseStore:store, caseManager:manager });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [pathname, type] of [['/','text/html'], ['/workspace/','text/html'], ['/workspace/app.js','text/javascript'], ['/workspace/api.js','text/javascript'], ['/workspace/styles.css','text/css']]) {
    const response = await fetch(`${base}${pathname}`); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), new RegExp(type)); assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  }
  assert.equal((await fetch(`${base}/workspace/../../server/app.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/workspace/demo-data.js`)).status, 404);
});

test('UI-D2A xlsx samples preserve exact source text and classifications through real parser', async (t) => {
  const { manager } = await setup(t); const project = await manager.createProject({ name:'样例核对', description:'' });
  const uploadA = await manager.upload({ fileName:encodeURIComponent('UI_D2A_CASES_A.xlsx'), contentType:xlsxType, body:await fs.readFile(sampleA) });
  assert.deepEqual(uploadA.workbook.sheets, [{ name:'体验项目A', row_count:3, headers:Object.values(mapping) }]);
  const previewA = await manager.preview(project.project_id, { upload_id:uploadA.upload_id, sheet_name:'体验项目A', mapping });
  assert.deepEqual(previewA.summary, { NEW:2, DUPLICATE:0, CONFLICT:0, PENDING_CLARIFICATION:1, UNIMPORTABLE:0 });
  assert.equal(previewA.items[0].content.external_id, 'UI-D2A-001');
  assert.match(previewA.items[0].content.test_data, /220\.5 kW[\s\S]*3\.65 V[\s\S]*127\.0\.0\.1[\s\S]*中文多行数据/);
  assert.deepEqual(previewA.items[0].content.steps.map(({ action, expected }) => ({ action, expected })), [
    { action:'打开设备概览', expected:'概览页加载完成' }, { action:'核对参数摘要', expected:'显示220.5 kW与3.65 V' }, { action:'检查服务地址', expected:'显示127.0.0.1' },
  ]);
  assert.equal(previewA.items[2].content.steps[1].expected, ''); assert.equal(previewA.items[2].classification, 'PENDING_CLARIFICATION');
  const uploadB = await manager.upload({ fileName:encodeURIComponent('UI_D2A_CASES_B.xlsx'), contentType:xlsxType, body:await fs.readFile(sampleB) });
  const previewB = await manager.preview(project.project_id, { upload_id:uploadB.upload_id, sheet_name:'体验项目B', mapping });
  assert.equal(previewB.summary.NEW, 1); assert.equal(previewB.items[0].content.external_id, 'UI-D2A-B-001'); assert.match(previewB.items[0].content.test_data, /v1\.2\.3/);
});

test('committed native sample came from supported export schema and survives official import parser', async (t) => {
  const { manager } = await setup(t); const target = await manager.createProject({ name:'原生包目标', description:'' });
  const bytes = await fs.readFile(nativeSample); const pkg = JSON.parse(bytes);
  assert.equal(pkg.schema, 'workbench/case-package-v1'); assert.equal(pkg.cases.length, 3); assert.equal('demo_only' in pkg, false);
  assert.ok(pkg.package_id); assert.ok(pkg.source_project.project_id); assert.ok(pkg.cases.every((item) => item.root_source?.stable_id && item.lineage?.length && item.content?.steps?.length));
  const upload = await manager.upload({ fileName:'UI_D2A_NATIVE_SAMPLE.json', contentType:'application/json', body:bytes });
  const preview = await manager.preview(target.project_id, { upload_id:upload.upload_id });
  assert.deepEqual(preview.summary, { NEW:2, DUPLICATE:0, CONFLICT:0, PENDING_CLARIFICATION:1, UNIMPORTABLE:0 });
});

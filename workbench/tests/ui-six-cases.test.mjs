import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const mapping = { external_id:'用例编号', title:'标题', module:'模块', preconditions:'前置条件', test_data:'测试数据', steps:'步骤', expected:'逐步预期', status:'内容状态' };
const xlsxFile = fileURLToPath(new URL('../examples/ui-six-cases/UI_TRIAL_6_CASES.xlsx', import.meta.url));
const jsonFile = fileURLToPath(new URL('../examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json', import.meta.url));

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-six-cases-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const store = new CaseLibraryStore(path.join(root, 'case-library'));
  await store.init();
  return new CaseLibraryManager(store);
}

test('six-case xlsx uses the supported mapping and preserves paired business expectations', async (t) => {
  const manager = await setup(t);
  const project = await manager.createProject({ name:'六案例 Excel 核对', description:'' });
  const upload = await manager.upload({ fileName:'UI_TRIAL_6_CASES.xlsx', contentType:xlsxType, body:await fs.readFile(xlsxFile) });
  assert.deepEqual(upload.workbook.sheets, [{ name:'六条用例', row_count:6, headers:Object.values(mapping) }]);
  const preview = await manager.preview(project.project_id, { upload_id:upload.upload_id, sheet_name:'六条用例', mapping });
  assert.deepEqual(preview.summary, { NEW:6, DUPLICATE:0, CONFLICT:0, PENDING_CLARIFICATION:0, UNIMPORTABLE:0 });
  assert.deepEqual(preview.items.map((item) => item.content.external_id), ['TC-001','TC-002','TC-003','TC-004','TC-005','TC-006']);
  assert.ok(preview.items.every((item) => item.content.status === 'CONFIRMED'));
  for (const [normalIndex, faultIndex] of [[0,3],[1,4],[2,5]]) {
    assert.deepEqual(preview.items[normalIndex].content.steps, preview.items[faultIndex].content.steps);
  }
});

test('committed six-case json is a formal backend package and reimports all six cases', async (t) => {
  const manager = await setup(t);
  const target = await manager.createProject({ name:'六案例 JSON 复导', description:'' });
  const bytes = await fs.readFile(jsonFile);
  const pkg = JSON.parse(bytes);
  assert.equal(pkg.schema, 'workbench/case-package-v1');
  assert.equal(pkg.source_project.name, 'TEST-SITE-01 六案例导入验证');
  assert.equal(pkg.cases.length, 6);
  assert.ok(pkg.cases.every((item) => item.root_source?.stable_id && item.lineage?.length && item.content?.status === 'CONFIRMED'));
  const upload = await manager.upload({ fileName:'UI_TRIAL_6_CASES.workbench.json', contentType:'application/json', body:bytes });
  const preview = await manager.preview(target.project_id, { upload_id:upload.upload_id });
  assert.deepEqual(preview.summary, { NEW:6, DUPLICATE:0, CONFLICT:0, PENDING_CLARIFICATION:0, UNIMPORTABLE:0 });
  const confirmed = await manager.confirm(target.project_id, preview.preview_id);
  assert.equal(confirmed.result.added, 6);
  assert.equal(confirmed.project.cases.length, 6);
});

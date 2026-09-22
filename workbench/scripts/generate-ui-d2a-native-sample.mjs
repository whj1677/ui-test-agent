import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-d2a-native-sample-'));
try {
  const store = new CaseLibraryStore(path.join(root, 'case-library')); await store.init();
  const manager = new CaseLibraryManager(store);
  const project = await manager.createProject({ name: 'UI-D2A 原生包样例来源', description: '独立合成项目，由正式后端导出。' });
  const source = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_CASES_A.xlsx', import.meta.url));
  const upload = await manager.upload({
    fileName: encodeURIComponent('UI_D2A_CASES_A.xlsx'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: await fs.readFile(source),
  });
  const mapping = { external_id:'用例编号', title:'标题', module:'模块', preconditions:'前置条件', test_data:'测试数据', steps:'步骤', expected:'逐步预期', status:'内容状态' };
  const preview = await manager.preview(project.project_id, { upload_id:upload.upload_id, sheet_name:'体验项目A', mapping });
  const confirmed = await manager.confirm(project.project_id, preview.preview_id, {});
  if (confirmed.result.added !== 3) throw new Error('UI_D2A_SAMPLE_IMPORT_UNEXPECTED');
  const pkg = await manager.exportPackage(project.project_id);
  const output = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_NATIVE_SAMPLE.json', import.meta.url));
  await fs.writeFile(output, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  const validationStore = new CaseLibraryStore(path.join(root, 'validation')); await validationStore.init();
  const validationManager = new CaseLibraryManager(validationStore);
  const target = await validationManager.createProject({ name:'正式解析验证', description:'' });
  const packageUpload = await validationManager.upload({ fileName:'UI_D2A_NATIVE_SAMPLE.json', contentType:'application/json', body:await fs.readFile(output) });
  const packagePreview = await validationManager.preview(target.project_id, { upload_id:packageUpload.upload_id });
  if (packagePreview.summary.NEW !== 2 || packagePreview.summary.PENDING_CLARIFICATION !== 1) throw new Error('UI_D2A_NATIVE_SAMPLE_VALIDATION_FAILED');
  console.log(JSON.stringify({ output, schema:pkg.schema, cases:pkg.cases.length, summary:packagePreview.summary }));
} finally {
  await fs.rm(root, { recursive:true, force:true });
}

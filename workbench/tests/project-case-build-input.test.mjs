import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { BuildTaskManager, promptFor } from '../server/build/manager.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const MAPPING = {
  external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据',
  steps: '步骤', expected: '逐步预期', status: '内容状态',
};

async function excelFixture() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('项目用例');
  sheet.addRow(Object.values(MAPPING));
  sheet.addRow(['001', '额定参数检查', '设备', '设备已上电\n网络可达', '额定功率=220.5 kW\n电压=3.65 V\n地址=127.0.0.1', '打开参数页\n读取额定值', '页面已打开\n显示原始数值', '已确认']);
  sheet.addRow(['002', '中文多步骤', '交互', '页面已加载', '版本=3.10.2\n用户=测试员', '点击开始\n等待结果', '按钮已响应\n结果为完成', 'CONFIRMED']);
  sheet.addRow(['003', '缺少预期', '交互', '', '', '执行动作', '', '已确认']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function setup() {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-case-build-'));
  const paths = createPaths({ localRoot });
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const project = await caseManager.createProject({ name: '输入传递项目', description: '真实 Excel 导入' });
  const upload = await caseManager.upload({
    fileName: 'project-cases.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: await excelFixture(),
  });
  const preview = await caseManager.preview(project.project_id, { upload_id: upload.upload_id, sheet_name: '项目用例', mapping: MAPPING });
  const confirmed = await caseManager.confirm(project.project_id, preview.preview_id, {});
  const buildStore = new BuildTaskStore(paths.buildTasksRoot); await buildStore.init();
  let sequence = 0;
  const adapter = { async runHarnessTask() { throw new Error('HARNESS_MUST_NOT_RUN'); } };
  const manager = new BuildTaskManager({
    store: buildStore, caseStore, paths, adapter,
    idFactory: () => `build-project-case-${String(++sequence).padStart(8, '0')}`,
  });
  return { localRoot, paths, caseStore, caseManager, buildStore, manager, project: confirmed.project };
}

function request(project, item, suffix) {
  const record = item.versions.find((entry) => entry.version === item.current_version);
  return {
    request_id: `case-build-request-${suffix.padEnd(8, '0')}`,
    project_id: project.project_id, case_id: item.case_id, case_version: record.version,
    content_sha256: record.content_sha256, environment_id: 'synthetic-probe-normal-v1',
  };
}

test('真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算', async () => {
  const context = await setup();
  try {
    const [first, second, pending] = context.project.cases;
    assert.equal(first.status, 'CONFIRMED'); assert.equal(second.status, 'CONFIRMED'); assert.equal(pending.status, 'PENDING_CONFIRMATION');
    const budgetBefore = await context.buildStore.getBudget();
    const task = await context.manager.submitProjectCase(request(context.project, first, 'freeze-a'));
    assert.equal(task.source.project_id, context.project.project_id);
    assert.equal(task.source.case_id, first.case_id);
    assert.equal(task.source.case_version, 1);
    assert.equal(task.execution_policy.mode, 'INPUT_ONLY');
    assert.equal(task.execution_policy.launch_enabled, false);
    assert.deepEqual(task.input_bundle.snapshot.content.steps, first.versions[0].content.steps);
    assert.equal(task.input_bundle.snapshot.content.preconditions, '设备已上电\n网络可达');
    assert.equal(task.input_bundle.snapshot.content.test_data, '额定功率=220.5 kW\n电压=3.65 V\n地址=127.0.0.1');
    assert.match(task.input_bundle.task_markdown, /220\.5 kW/);
    assert.match(task.input_bundle.task_markdown, /127\.0\.0\.1/);
    assert.doesNotMatch(task.input_bundle.task_markdown, /PROBE-42/);
    assert.match(promptFor({ kind: 'initial', task, entryUrl: 'http://127.0.0.1:1234/probe', candidatePath: 'X:/task/output/candidate.spec.mjs' }), /input\/case-snapshot\.json/);
    for (const file of task.files) {
      const body = await fs.readFile(path.join(context.buildStore.taskDirectory(task.task_id), file.relative_path));
      assert.equal(body.length, file.bytes);
    }
    await assert.rejects(() => context.manager.start(task.task_id), /BUILD_INPUT_ONLY_TASK_NOT_STARTABLE/);
    assert.deepEqual(await context.buildStore.getBudget(), budgetBefore);

    const other = await context.manager.submitProjectCase(request(context.project, second, 'freeze-b'));
    assert.notEqual(other.task_id, task.task_id);
    assert.notEqual(other.template.input_sha256, task.template.input_sha256);
    assert.match(other.input_bundle.task_markdown, /版本=3\.10\.2/);
    assert.doesNotMatch(other.input_bundle.task_markdown, /220\.5 kW/);
  } finally { await fs.rm(context.localRoot, { recursive: true, force: true }); }
});

test('v1/v2 快照独立，精确关联校验和并发幂等均 fail closed', async () => {
  const context = await setup();
  try {
    const first = context.project.cases[0];
    const v1Request = request(context.project, first, 'version1');
    const v1 = await context.manager.submitProjectCase(v1Request);
    const v1Snapshot = structuredClone(v1.input_bundle.snapshot);
    const updatedProject = await context.caseManager.updateCase(context.project.project_id, first.case_id, {
      revision: context.project.revision,
      content: { ...first.versions[0].content, title: '额定参数检查 v2', test_data: '额定功率=221.0 kW\n地址=127.0.0.1' },
    });
    const updated = updatedProject.cases.find((item) => item.case_id === first.case_id);
    const v2Request = request(updatedProject, updated, 'version2');
    const v2 = await context.manager.submitProjectCase(v2Request);
    assert.equal(v2.source.case_version, 2);
    assert.equal(v1.input_bundle.snapshot.content.title, v1Snapshot.content.title);
    assert.equal((await context.buildStore.getTask(v1.task_id)).input_bundle.snapshot.content.test_data, v1Snapshot.content.test_data);
    assert.match(v2.input_bundle.task_markdown, /221\.0 kW/);

    const repeatedRequest = request(updatedProject, updated, 'parallel');
    const repeated = await Promise.all([
      context.manager.submitProjectCase(repeatedRequest), context.manager.submitProjectCase(repeatedRequest),
    ]);
    assert.equal(repeated[0].task_id, repeated[1].task_id);
    assert.equal((await context.buildStore.listTasks()).filter((task) => task.source?.creation_request_id === repeatedRequest.request_id).length, 1);

    await assert.rejects(() => context.manager.submitProjectCase({ ...v2Request, request_id: 'case-build-request-bad-hash', content_sha256: '0'.repeat(64) }), /CASE_BUILD_CONTENT_HASH_MISMATCH/);
    await assert.rejects(() => context.manager.submitProjectCase({ ...v2Request, request_id: 'case-build-request-bad-version', case_version: 99 }), /CASE_BUILD_VERSION_NOT_FOUND/);
    await assert.rejects(() => context.manager.submitProjectCase({ ...v2Request, request_id: 'case-build-request-bad-env00', environment_id: 'https://example.com' }), /CASE_BUILD_ENVIRONMENT_NOT_ALLOWED/);
    await assert.rejects(() => context.manager.submitProjectCase({ ...v2Request, request_id: 'case-build-request-crosscase', case_id: context.project.cases[1].case_id }), /CASE_BUILD_(VERSION_NOT_FOUND|CONTENT_HASH_MISMATCH)/);
    const secondProject = await context.caseManager.createProject({ name: '另一个项目', description: '' });
    await assert.rejects(() => context.manager.submitProjectCase({ ...v2Request, request_id: 'case-build-request-crossproj', project_id: secondProject.project_id }), /CASE_NOT_FOUND/);
    const pending = updatedProject.cases[2];
    await assert.rejects(() => context.manager.submitProjectCase(request(updatedProject, pending, 'pending0')), /CASE_BUILD_CONTENT_NOT_CONFIRMED/);

    const restartedStore = new BuildTaskStore(context.paths.buildTasksRoot); await restartedStore.init();
    const restored = await restartedStore.getTask(v2.task_id);
    assert.equal(restored.source.case_version, 2);
    assert.equal(restored.input_bundle.snapshot.content.title, '额定参数检查 v2');
  } finally { await fs.rm(context.localRoot, { recursive: true, force: true }); }
});

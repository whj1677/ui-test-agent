import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { appendCaseVersion, createDemoState, freezeCaseVersion, generationPhase, humanReviewPhase, makeCasePackage, registrationPhase, technicalValidationPhase } from './demo-data.js';

const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
const mapping = await readFile(new URL('./API_MAPPING.md', import.meta.url), 'utf8');

test('演示边界明确且不调用正式API', () => {
  assert.match(html, /交互原型/);
  assert.match(html, /演示数据/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\/api\//);
});

test('六个核心界面都有独立路由和业务内容', () => {
  for (const marker of ['#/projects', "page === 'cases'", "page === 'import'", "page === 'case'", "page === 'build'", "page === 'run'"]) assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const heading of ['所有项目','用例库','导入用例','用例内容','建例任务详情','执行结果详情']) assert.match(app, new RegExp(heading));
});

test('演示数据覆盖高密度、空项目、跨项目同编号和分层状态', () => {
  const state = createDemoState();
  assert.equal(state.projects.length, 4);
  assert.equal(state.cases.filter((item) => item.projectId === 'demo-project-inspection').length, 120);
  assert.equal(state.cases.filter((item) => item.projectId === 'demo-project-empty').length, 0);
  const grouped = Map.groupBy(state.cases, (item) => item.externalId);
  assert.ok([...grouped.values()].some((items) => new Set(items.map((item) => item.projectId)).size > 1));
  for (const value of ['未建例','生成中','待人工核对','断言不符','运行中断','验收范围待确认']) assert.match(JSON.stringify(state), new RegExp(value));
});

test('导入预览、幂等与明确冲突选择均有确定性交互', () => {
  for (const value of ['新增','重复','同源版本冲突','待澄清','不能导入','作为独立副本导入']) assert.match(app, new RegExp(value));
  assert.match(app, /importableRows/);
  assert.match(app, /25条\/页/);
  assert.match(app, /导出选中/);
  assert.match(app, /导出全部/);
  assert.match(app, /demo_only/);
});

test('结果页保留原始事实且步骤切换不重建视频', () => {
  assert.match(app, /video controls/);
  assert.match(app, /#step-detail/);
  assert.match(app, /innerHTML = stepDetail/);
  assert.match(app, /问题归因待分析/);
  assert.match(app, /无步骤时间点关联/);
  assert.match(app, /不下载伪造ZIP/);
});

test('砂岩陶土主题使用附件指定关键色值且能力映射不伪装缺失项', () => {
  for (const token of ['#F5F3EF','#ECE7E0','#FFFDF9','#DCD4CA','#332F2B','#6C635B','#805E49','#6B4C39','#EEE1D5']) assert.match(css, new RegExp(token,'i'));
  assert.doesNotMatch(css, /#315ee7/i);
  for (const missing of ['批量执行','通用Web审批','通用环境管理','多人权限']) assert.match(mapping, new RegExp(missing));
});

test('用例版本正文与建例任务快照在修改和序列化后保持独立', () => {
  const state = createDemoState();
  const testCase = state.cases.find((item) => item.id === 'demo-case-query');
  const v1 = testCase.versions.find((item) => item.version === 1);
  const snapshot = freezeCaseVersion(testCase, v1, 'demo-env-synthetic');
  const original = structuredClone({ preconditions: v1.preconditions, testData: v1.testData, steps: v1.steps });

  const v2 = appendCaseVersion(testCase, {
    preconditions: 'v2前置：使用新的演示上下文。',
    testData: 'v2数据第一行\nv2数据第二行',
    steps: [{ order: 1, action: '执行v2动作。', expected: '得到v2结果。' }],
  }, state.demoClock);

  assert.deepEqual({ preconditions: v1.preconditions, testData: v1.testData, steps: v1.steps }, original);
  assert.deepEqual({ preconditions: snapshot.preconditions, testData: snapshot.testData, steps: snapshot.steps }, original);
  assert.equal(v2.preconditions, 'v2前置：使用新的演示上下文。');
  assert.equal(v2.testData, 'v2数据第一行\nv2数据第二行');
  assert.equal(v2.steps[0].action, '执行v2动作。');

  const restored = JSON.parse(JSON.stringify({ testCase, snapshot }));
  assert.equal(restored.testCase.versions[0].preconditions, original.preconditions);
  assert.equal(restored.testCase.versions[1].preconditions, v2.preconditions);
  assert.equal(restored.snapshot.preconditions, original.preconditions);
});

test('阶段条使用明确映射且技术验证不会被单项正常通过提前完成', () => {
  assert.deepEqual(generationPhase('未开始'), { state: 'pending', label: '待开始' });
  assert.deepEqual(generationPhase('正在生成候选'), { state: 'active', label: '进行中' });
  assert.deepEqual(generationPhase('候选已生成'), { state: 'done', label: '已完成' });
  assert.deepEqual(generationPhase('生成异常'), { state: 'error', label: '错误' });
  assert.deepEqual(generationPhase('供应商新状态'), { state: 'unknown', label: '未知' });
  assert.deepEqual(technicalValidationPhase({ normal: '通过', counterexample: '未运行', mapping: '结构验证失败', businessReview: '未进行' }), { state: 'error', label: '错误' });
  assert.deepEqual(technicalValidationPhase({ normal: '通过', counterexample: '断言不符', mapping: '已完成', businessReview: '检查范围待确认' }), { state: 'active', label: '进行中' });
  assert.deepEqual(technicalValidationPhase({ normal: '通过', counterexample: '断言不符', mapping: '已完成', businessReview: '已完成' }), { state: 'done', label: '已完成' });
  assert.deepEqual(humanReviewPhase('范围待确认'), { state: 'active', label: '进行中' });
  assert.deepEqual(registrationPhase('未登记'), { state: 'pending', label: '待开始' });
});

test('JSON用例包按明确选择导出且保留所选版本完整正文', () => {
  const state = createDemoState();
  const project = state.projects.find((item) => item.id === 'demo-project-inspection');
  const selected = state.cases.filter((item) => item.projectId === project.id && ['demo-case-query', 'demo-case-reviewed'].includes(item.id));
  const selectedPackage = makeCasePackage(project, selected);
  assert.equal(selectedPackage.schema, 'workbench/case-package-v1');
  assert.equal(selectedPackage.demo_only, true);
  assert.equal(selectedPackage.cases.length, 2);
  assert.deepEqual(selectedPackage.cases.map((item) => item.external_id), ['DEMO-Q-001', 'DEMO-S-001']);
  assert.equal(selectedPackage.cases[0].preconditions, selected[0].versions[0].preconditions);
  assert.deepEqual(selectedPackage.cases[0].steps, selected[0].versions[0].steps);

  const all = state.cases.filter((item) => item.projectId === project.id);
  const allPackage = makeCasePackage(project, all);
  assert.equal(allPackage.cases.length, 120);
  assert.ok(allPackage.cases.every((item) => item.source_identity.startsWith(`${project.id}/`)));
});

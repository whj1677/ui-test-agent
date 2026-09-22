import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDemoState } from './demo-data.js';

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

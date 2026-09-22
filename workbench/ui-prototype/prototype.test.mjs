import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const notes = await readFile(new URL('./DESIGN_NOTES.md', import.meta.url), 'utf8');

test('原型明确标注演示边界且不调用正式 API', () => {
  assert.match(html, /交互原型/);
  assert.match(html, /演示数据/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\/api\//);
});

test('三条验收流程的关键页面和交互均存在', () => {
  for (const marker of [
    'create-project-dialog',
    'import-preview-table',
    'case-table',
    'pending-issue',
    'run-detail',
    'result-video',
  ]) assert.match(app, new RegExp(marker));
  assert.match(app, /Excel 用例/);
  assert.match(app, /平台用例包/);
});

test('关键状态分离且未实现能力明确标记', () => {
  for (const value of ['未建例', '生成中', '待人工核对', '断言不符', '运行中断', '验收范围待确认']) {
    assert.match(app, new RegExp(value));
  }
  assert.match(notes, /批量执行/);
  assert.match(notes, /通用\s*Web\s*审批/);
  assert.match(notes, /环境管理/);
});

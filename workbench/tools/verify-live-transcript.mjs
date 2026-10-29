/**
 * 端到端核对：真实会话日志 → NativeDshManager.getTranscript → UI 渲染函数。
 * 只读；不启动 Host、不调用模型。
 *
 * 用法：node verify-live-transcript.mjs <dataRoot> <projectId> [输出html路径] [sessionWorkspace]
 *
 * 注意：dsh 按 cwd 分目录保存会话，且会话日志跟随**当时的工作目录**。
 * 若本机迁移过工作目录（native-dsh 会把 session_id 置空并记入 session_history），
 * 历史会话的日志仍留在旧目录下；此时需要显式传入该会话当时的 sessionWorkspace 才能读到。
 */
import fs from 'node:fs';
import path from 'node:path';
import {NativeDshManager} from '../server/native-dsh/manager.mjs';
import {nativeDshTranscriptHtml} from '../web-v2/native-dsh.js';

const [dataRoot, projectId, outHtml, sessionWorkspace] = process.argv.slice(2);
if (!dataRoot || !projectId) {
  console.error('用法：node verify-live-transcript.mjs <dataRoot> <projectId> [输出html路径] [sessionWorkspace]');
  process.exit(2);
}

// 会话日志总是位于 <dataRoot>/native-dsh/runtime-home 下；
// workspaceRoot 只影响"没有 session_workspace 时"的回退推导，这里按读取到的会话为准。
const manager = new NativeDshManager({
  root: path.join(dataRoot, 'native-dsh'),
  workspaceRoot: dataRoot,
  caseStore: {getProject: async (id) => (id === projectId ? {project_id: projectId, cases: []} : null)},
  projectEnvironments: {},
  buildManager: {},
  client: {available: false},
});

if (sessionWorkspace) {
  const file = path.join(dataRoot, 'native-dsh', projectId, 'session.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.session_workspace = sessionWorkspace;
  fs.writeFileSync(file, JSON.stringify(value));
  console.log('已按参数覆盖 session_workspace =', sessionWorkspace, '（仅本机只读核对用）');
}

const transcript = await manager.getTranscript(projectId);
const summary = {
  available: transcript.available,
  reason: transcript.reason ?? null,
  session_id: transcript.session_id,
  integrity: transcript.integrity ?? null,
  entries: transcript.turns?.length ?? 0,
  user_entries: transcript.turns?.filter((t) => t.role === 'user').length ?? 0,
  assistant_entries: transcript.turns?.filter((t) => t.role === 'assistant').length ?? 0,
  tool_calls: transcript.turns?.filter((t) => t.role === 'tool_call').length ?? 0,
  tool_results: transcript.turns?.filter((t) => t.role === 'tool_result').length ?? 0,
  tool_errors: transcript.turns?.filter((t) => t.role === 'tool_result' && t.is_error).length ?? 0,
  skipped: transcript.skipped ?? 0,
};
console.log(JSON.stringify(summary, null, 2));

if (!transcript.available) process.exit(1);

// 第一条真实 user 输入（编排方实际传进去的内容）
const firstUser = transcript.turns.find((t) => t.role === 'user');
console.log('\n=== 第一条编排方输入（前 200 字）===');
console.log(String(firstUser?.text ?? '').slice(0, 200));

const html = nativeDshTranscriptHtml(transcript);
if (outHtml) fs.writeFileSync(outHtml, html);
console.log('\n渲染 HTML 字节数:', Buffer.byteLength(html, 'utf8'));

const checks = [
  ['渲染出编排方输入', /编排方输入/.test(html)],
  ['渲染出工具调用', /工具调用/.test(html)],
  ['渲染出工具结果', /工具结果/.test(html)],
  ['标注了错误结果', /工具结果（错误）/.test(html)],
  ['未泄漏思考块', !/reasoning/i.test(html)],
  ['无未转义脚本标签', !/<script/i.test(html)],
  ['显示了帧完整度', /读取 \d+\/\d+ 帧/.test(html)],
];
let failed = 0;
console.log('\n=== 断言 ===');
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) failed += 1;
}
process.exit(failed ? 1 : 0);

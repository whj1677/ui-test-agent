import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';
import { nativeDshRoute } from '../server/native-dsh/routes.mjs';
import { nativeDshTranscriptHtml, nativeDshPreflightHtml } from '../web-v2/native-dsh.js';
import { esc } from '../web-v2/workflow.js';
import { staticPreflight, runtimePreflight, combinePreflight, cssTargets } from '../server/native-dsh/preflight.mjs';
import { buildTranscript } from '../server/native-dsh/transcript.mjs';
import { readMultiFrameZstd, parseJsonLines } from '../server/native-dsh/zstd-frames.mjs';

const SESSION = 'session-8d23f460-f32f-4210-94ff-54c0681cdf33';
const PROJECT = 'project-0c7a1af4-c25d-4bd4-8140-a5a43916a7db';

/** dsh 的会话目录名有两种实测编码：%XX 与 dash（- / ~XXXX）。 */
const encodePercent = (cwd) =>
  [...Buffer.from(cwd, 'utf8')].map((byte) => (byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
const encodeDash = (cwd) =>
  [...Buffer.from(cwd, 'utf8')].map((byte) => {
    if ((byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122)) return String.fromCharCode(byte);
    return byte < 128 ? '-' : `~${byte.toString(16).toUpperCase().padStart(4, '0')}`;
  }).join('');

/** 按实测形状造一条最小会话：头 + 一轮含思考/文本/工具调用与结果的对话。 */
function sessionRecords() {
  return [
    { type: 'session', version: 4, id: SESSION, createdAt: 1791973575665, cwd: 'C:\\workspace' },
    { type: 'turn/start', seq: 4, time: 1791973575797 },
    { type: 'user/message', seq: 8, time: 1791973575915, data: { message: { role: 'user', content: [{ type: 'text', text: '复用 page-facts.md 完成用例' }] } } },
    { type: 'assistant/message', seq: 18, time: 1791973577305, data: { turn: 1, step: 1, message: { role: 'assistant', content: [
      { type: 'reasoning', text: 'DO_NOT_RENDER_PRIVATE_THOUGHT' },
      { type: 'text', text: '先读任务输入。' },
    ] } } },
    { type: 'assistant/message', seq: 20, time: 1791973577306, data: { turn: 1, step: 2, message: { role: 'assistant', content: [
      { type: 'reasoning', text: 'ONLY_THINKING_STEP_MUST_NOT_LEAK' },
    ] } } },
    { type: 'tool/call', seq: 21, time: 1791973577307, data: { turn: 1, step: 2, callId: 'call_00_demo', name: 'read', arguments: '{"file_path":"current-task.json"}' } },
    { type: 'tool/result', seq: 22, time: 1791973578185, data: { turn: 1, step: 2, message: { role: 'tool', source: { kind: 'tool', callId: 'call_00_demo' }, toolCallId: 'call_00_demo', content: [{ type: 'text', text: 'task file body' }], isError: false } } },
    { type: 'tool/result', seq: 24, time: 1791973579000, data: { turn: 1, step: 3, message: { role: 'tool', source: { kind: 'tool', callId: 'call_01_demo' }, toolCallId: 'call_01_demo', content: [{ type: 'text', text: 'Error: unknown tool "node -e "' }], isError: true } } },
    { type: 'step/start', seq: 25, time: 1791973579100 },
    { type: 'turn/end', seq: 26, time: 1791973579200 },
  ];
}

/** 每行一个独立 zstd 帧，复现"多帧拼接"这一实测事实。 */
function writeSessionLog(file) {
  const frames = sessionRecords().map((record) => zlib.zstdCompressSync(Buffer.from(`${JSON.stringify(record)}\n`, 'utf8')));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(frames));
  return frames.length;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-dsh-transcript-'));
  const workspace = path.join(root, 'projects', PROJECT, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  const logFile = path.join(root, 'runtime-home', 'sessions', encodePercent(`${workspace}\\`), SESSION, 'session.v4.jsonl.zstd');
  const frames = writeSessionLog(logFile);
  const caseStore = { getProject: async (id) => (id === PROJECT ? { project_id: PROJECT, cases: [] } : null) };
  const manager = new NativeDshManager({ root, workspaceRoot: path.join(root, 'projects'), caseStore, projectEnvironments: {}, buildManager: {}, client: { available: true } });
  fs.mkdirSync(path.join(root, PROJECT), { recursive: true });
  fs.writeFileSync(path.join(root, PROJECT, 'session.json'), JSON.stringify({ schema: 'workbench/native-dsh-v1', project_id: PROJECT, session_id: SESSION, session_workspace: workspace, tasks: [] }));
  return { root, workspace, logFile, frames, manager };
}

test('multi-frame zstd session log is fully decoded while the single-frame reader silently truncates', () => {
  const { logFile, frames } = fixture();
  const naive = zlib.zstdDecompressSync(fs.readFileSync(logFile));
  const multi = readMultiFrameZstd(logFile);
  assert.equal(multi.frames, frames);
  assert.equal(multi.framesDecoded, frames);
  assert.equal(multi.truncated, false);
  assert.ok(multi.text.length > naive.length * 5, '逐帧读取必须显著多于标准库单帧结果');
  assert.equal(parseJsonLines(multi.text).records.length, sessionRecords().length);
});

test('transcript renders operator input, assistant text and tool results without leaking reasoning', () => {
  const { logFile } = fixture();
  const transcript = buildTranscript(logFile);
  const rendered = JSON.stringify(transcript);
  assert.equal(transcript.session_id, SESSION);
  assert.deepEqual(transcript.turns.filter((t) => t.role === 'user').map((t) => t.text), ['复用 page-facts.md 完成用例']);
  assert.deepEqual(transcript.turns.filter((t) => t.role === 'assistant').map((t) => t.text), ['先读任务输入。']);
  assert.equal(transcript.turns.filter((t) => t.role === 'tool_call').length, 1);
  assert.equal(transcript.turns.find((t) => t.role === 'tool_call').tool, 'read');
  const results = transcript.turns.filter((t) => t.role === 'tool_result');
  assert.equal(results.length, 2);
  assert.equal(results[0].tool, 'read', '工具名从 tool/call 按 callId 回填');
  assert.equal(results[0].is_error, false);
  assert.equal(results[1].is_error, true, '错误标记读 data.message.isError');
  assert.doesNotMatch(rendered, /DO_NOT_RENDER_PRIVATE_THOUGHT|ONLY_THINKING_STEP_MUST_NOT_LEAK/);
  assert.doesNotMatch(rendered, /"type":"reasoning"/);
  assert.ok(transcript.integrity.framesDecoded === transcript.integrity.frames);
});

test('manager reads the transcript by locating the session directory that belongs to this workspace', async () => {
  const { manager, frames } = fixture();
  const value = await manager.getTranscript(PROJECT);
  assert.equal(value.available, true);
  assert.equal(value.session_id, SESSION);
  assert.equal(value.integrity.frames, frames);
  assert.deepEqual(value.turns.filter((t) => t.role === 'user').map((t) => t.text), ['复用 page-facts.md 完成用例']);
});

test('manager never reads a same-named session that belongs to another workspace', async () => {
  const { root, manager, logFile } = fixture();
  const foreign = path.join(root, 'runtime-home', 'sessions', encodePercent('C:\\somewhere-else\\workspace\\'), SESSION, 'session.v4.jsonl.zstd');
  writeSessionLog(foreign);
  fs.rmSync(logFile);
  const value = await manager.getTranscript(PROJECT);
  assert.equal(value.available, false);
  assert.equal(value.reason, 'NATIVE_DSH_TRANSCRIPT_NOT_FOUND');
  assert.equal(value.session_id, SESSION);
});

test('missing session, missing log and unreadable log report distinct reasons instead of an empty transcript', async () => {
  const { root, manager, logFile } = fixture();
  // 本用例自己要区分"没有会话 / 有会话但找不到日志 / 日志不可读"，先移除 fixture 预置的日志
  fs.rmSync(logFile);
  fs.writeFileSync(path.join(root, PROJECT, 'session.json'), JSON.stringify({ schema: 'workbench/native-dsh-v1', project_id: PROJECT, session_id: null, tasks: [] }));
  assert.deepEqual(await manager.getTranscript(PROJECT), { available: false, reason: 'NATIVE_DSH_NO_PROJECT_SESSION', session_id: null });

  fs.writeFileSync(path.join(root, PROJECT, 'session.json'), JSON.stringify({ schema: 'workbench/native-dsh-v1', project_id: PROJECT, session_id: SESSION, session_workspace: path.join(root, 'projects', PROJECT, 'workspace'), tasks: [] }));
  // 会话存储存在，但没有任何目录匹配本工作目录 → 这才是"找不到该会话"
  fs.mkdirSync(path.join(root, 'runtime-home', 'sessions', encodePercent('C:\\another-workspace\\')), { recursive: true });
  const noLog = await manager.getTranscript(PROJECT);
  assert.equal(noLog.available, false);
  assert.equal(noLog.reason, 'NATIVE_DSH_TRANSCRIPT_NOT_FOUND');
  assert.equal(noLog.session_id, SESSION);

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, 'not-zstd');
  const unreadable = await manager.getTranscript(PROJECT);
  assert.equal(unreadable.available, false);
  assert.equal(unreadable.reason, 'NATIVE_DSH_TRANSCRIPT_UNSUPPORTED');
  assert.equal(unreadable.session_id, SESSION);
});

test('session store absent is reported as unreadable, not as a missing session', async () => {
  const { root, manager } = fixture();
  fs.rmSync(path.join(root, 'runtime-home'), { recursive: true, force: true });
  const value = await manager.getTranscript(PROJECT);
  assert.equal(value.available, false);
  assert.equal(value.reason, 'NATIVE_DSH_TRANSCRIPT_UNAVAILABLE');
  assert.equal(value.detail, 'SESSION_STORE_ABSENT');
});

test('dash-style session directory (with wrapping dashes) is located, and the directory name is remembered', async () => {
  const { root, manager, logFile } = fixture();
  // 复现实机形态：dash 编码 + 首尾各包一层 '-' + 非 ASCII 用 ~XXXX。
  // 必须先把 fixture 建在 percent 目录下的日志移走，否则匹配到的是那一份，测不到 dash 形态。
  fs.rmSync(path.dirname(logFile), { recursive: true, force: true });
  const dashDir = path.join(root, 'runtime-home', 'sessions', `-${encodeDash('D:\\项目\\workspace\\')}-`);
  fs.mkdirSync(path.join(dashDir, SESSION), { recursive: true });
  writeSessionLog(path.join(dashDir, SESSION, 'session.v4.jsonl.zstd'));
  fs.writeFileSync(path.join(root, PROJECT, 'session.json'), JSON.stringify({ schema: 'workbench/native-dsh-v1', project_id: PROJECT, session_id: SESSION, session_workspace: 'D:\\项目\\workspace\\', tasks: [] }));

  const first = await manager.getTranscript(PROJECT);
  assert.equal(first.available, true, '必须能匹配到实机形态的 dash 编码会话目录（含非 ASCII 的 ~XXXX 与首尾包裹 -）');
  assert.equal(first.integrity.framesDecoded, first.integrity.frames);

  // 定位成功后目录名落盘，后续读取不再依赖编码规则
  const saved = JSON.parse(fs.readFileSync(path.join(root, PROJECT, 'session.json'), 'utf8'));
  assert.equal(saved.session_directory, path.basename(dashDir));
  const second = await manager.getTranscript(PROJECT);
  assert.equal(second.available, true);
  assert.equal(second.integrity.framesDecoded, second.integrity.frames);
});

test('transcript view escapes content and never presents an unreadable result as an empty conversation', () => {
  const html = nativeDshTranscriptHtml({
    available: true, session_id: SESSION, integrity: { frames: 10, framesDecoded: 10, truncated: false },
    turns: [
      { seq: 8, role: 'user', at: 1791973575915, text: '输入<script>alert(1)</script>' },
      { seq: 21, role: 'tool_call', tool: 'read', arguments_preview: '{"file_path":"a&b"}' },
      { seq: 24, role: 'tool_result', tool: 'pwsh', is_error: true, result_preview: 'Error: <unsafe>' },
    ],
  });
  assert.match(html, /编排方输入/); assert.match(html, /dsh 回复|工具调用/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /a&amp;b/);
  assert.match(html, /工具结果（错误）/);
  assert.match(html, /读取 10\/10 帧/);

  const truncated = nativeDshTranscriptHtml({ available: true, session_id: SESSION, integrity: { frames: 10, framesDecoded: 3, truncated: true, reason: 'FRAME_3_FAILED' }, turns: [] });
  assert.match(truncated, /日志未完整解出/);

  for (const reason of ['NATIVE_DSH_NO_PROJECT_SESSION', 'NATIVE_DSH_TRANSCRIPT_NOT_FOUND', 'NATIVE_DSH_TRANSCRIPT_UNREADABLE', 'NATIVE_DSH_TRANSCRIPT_UNAVAILABLE']) {
    const blocked = nativeDshTranscriptHtml({ available: false, reason, session_id: SESSION });
    assert.doesNotMatch(blocked, /没有可展示的对话记录/, `${reason} 不得被显示成"没有对话"`);
    assert.match(blocked, /class="notice"/);
  }
});

test('public view prioritizes the latest assistant reply and its input while retaining chronological history',()=>{
  const html=nativeDshTranscriptHtml({available:true,integrity:{frames:6,framesDecoded:6},turns:[
    {role:'user',text:'OLDER_INPUT'}, {role:'assistant',text:'OLDER_REPLY'},
    {role:'user',text:'CURRENT_INPUT'}, {role:'tool_call',tool:'read',arguments_preview:'KEPT_TOOL'},
    {role:'assistant',text:'LATEST_REPLY'}, {role:'turn_end',type:'turn/end'},
  ]});
  const latest=html.slice(html.indexOf('data-native-transcript-latest'),html.indexOf('class="native-transcript-history"'));
  assert.match(latest,/LATEST_REPLY/);assert.match(latest,/CURRENT_INPUT/);assert.doesNotMatch(latest,/OLDER_INPUT|OLDER_REPLY|KEPT_TOOL/);
  const history=html.slice(html.indexOf('class="native-transcript-history"'));
  for(const value of ['OLDER_INPUT','OLDER_REPLY','CURRENT_INPUT','KEPT_TOOL','LATEST_REPLY'])assert.ok(history.includes(value));
  assert.ok(history.indexOf('OLDER_REPLY')<history.indexOf('LATEST_REPLY'));assert.match(html,/完整公开对话（6 条，按时间顺序）/);assert.match(html,/data-native-transcript-jump/);
});

test('public assistant reply formats real tables, emphasis, inline code and retains the exact original',()=>{
  const text='### 六条核对\n\n| 用例 | 结论 |\n| --- | --- |\n| `UI-WO-01` | **保留失败** |\n| UI-WO-02 | 未执行 |\n\n只读结果，不能记通过。';
  const html=nativeDshTranscriptHtml({available:true,turns:[{role:'assistant',text}]});
  assert.match(html,/<th scope="col">用例<\/th>/);assert.match(html,/<td><code>UI-WO-01<\/code><\/td>/);assert.match(html,/<strong>保留失败<\/strong>/);assert.match(html,/<td>未执行<\/td>/);assert.match(html,/<h5>六条核对<\/h5>/);
  assert.ok(html.includes(esc(text)));assert.match(html,/查看原始回复/);assert.match(html,/只读结果，不能记通过。/);
});

test('public reply tables preserve escaped pipes and code pipes without treating them as new columns',()=>{
  const html=nativeDshTranscriptHtml({available:true,turns:[{role:'assistant',text:'| 字段 | 实际 |\n| --- | --- |\n| `a|b` | x\\|y |'}]});
  assert.match(html,/<td><code>a\|b<\/code><\/td><td>x\|y<\/td>/);
});

test('public reply lists and fenced code are readable without formatting code content',()=>{
  const text='1. **先核对**\n2. 再执行\n\n- 保留失败\n- 保留证据\n\n```html\n<img src=x onerror=alert(1)>\n**literal**\n```';
  const html=nativeDshTranscriptHtml({available:true,turns:[{role:'assistant',text}]});
  assert.match(html,/<ol><li><strong>先核对<\/strong><\/li><li>再执行<\/li><\/ol>/);assert.match(html,/<ul><li>保留失败<\/li><li>保留证据<\/li><\/ul>/);
  assert.match(html,/<pre><code>&lt;img src=x onerror=alert\(1\)&gt;\n\*\*literal\*\*<\/code><\/pre>/);assert.doesNotMatch(html,/<img\b/);
});

test('public formatting never interprets raw HTML, executable links or remote images',()=>{
  const attack='<script>alert(1)</script>\n<img src="https://external.invalid/leak" onerror="alert(2)">\n[open](javascript:alert(3))\n![track](https://external.invalid/image)\n**<iframe src=x>**\n`<svg onload=alert(4)>`';
  const html=nativeDshTranscriptHtml({available:true,session_id:'<unsafe>',turns:[{role:'user',text:'<img src=user>'},{role:'assistant',text:attack},{role:'tool_result',tool:'<script>',result_preview:'<img src=tool>'}]});
  assert.doesNotMatch(html,/<(?:script|img|iframe|svg|a)\b/i);
  assert.doesNotMatch(html,/<[^>]+\s(?:src|href|onerror|onload)\s*=/i);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.match(html,/\[open\]\(javascript:alert\(3\)\)/);assert.ok(html.includes(esc(attack)));
});

test('truncated conversation and no public assistant reply stay distinct from unavailable or empty logs',()=>{
  const incomplete=nativeDshTranscriptHtml({available:true,integrity:{truncated:true,frames:10,framesDecoded:3,reason:'FRAME_FAILED'},turns:[{role:'assistant',text:'PARTIAL_REPLY'}]});
  assert.match(incomplete,/日志未完整解出/);assert.match(incomplete,/本次读取的最新 dsh 回复/);assert.doesNotMatch(incomplete,/日志已完整解出|读取全部成功/);
  const noReply=nativeDshTranscriptHtml({available:true,turns:[{role:'user',text:'WAITING_INPUT'},{role:'tool_call',tool:'read'}]});assert.match(noReply,/尚无可展示的 dsh 回复/);assert.match(noReply,/WAITING_INPUT/);assert.doesNotMatch(noReply,/data-native-transcript-jump/);
  const empty=nativeDshTranscriptHtml({available:true,turns:[]});assert.match(empty,/没有可展示的对话记录/);assert.doesNotMatch(empty,/跳到最新回复/);
});

test('one invalid public timestamp cannot hide a readable reply',()=>{
  const html=nativeDshTranscriptHtml({available:true,turns:[{role:'assistant',at:'invalid timestamp',text:'READABLE_REPLY'}]});assert.match(html,/READABLE_REPLY/);assert.doesNotMatch(html,/Invalid Date/);
});

test('preflight is skipped without a profile and reports admission issues without blocking', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-dsh-preflight-'));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });

  // 无档案：如实说"未启用"，不得显示成"检查通过"
  const absent = await staticPreflight(workspace);
  assert.equal(absent.status, 'SKIPPED');
  assert.equal(absent.reason, 'PROFILE_ABSENT');
  assert.doesNotMatch(nativeDshPreflightHtml(combinePreflight(absent, null)), /检查通过/);

  // 合法档案：非严格模式通过，但保留提示项
  const valid = {
    schema: 'ui-automation/module-profile-v1',
    fingerprint: { value: 'fp' },
    calibration: {},
    targets: {
      ok: { assumes: ['antd'], pointer: 'page.getByRole(...)', verify: 'button:has-text("新增")', verified: { matched: 1 } },
      conditional: { assumes: ['antd-modal'], pointer: 'modal.locator(...)', verify: '.ant-form-item-explain-error', conditional: true, verified: { matched: 0 } },
    },
    cleanup: { note: '删除接口未确认', unverified_at: '2026-10-15T00:00:00Z' },
  };
  fs.writeFileSync(path.join(workspace, 'module-profile.json'), JSON.stringify(valid));
  const pass = await staticPreflight(workspace);
  assert.equal(pass.status, 'WARN');
  assert.deepEqual(pass.errors, []);
  assert.ok(pass.warnings.some(w => w.code === 'CLEANUP_UNVERIFIED'), '清理能力未确认必须被提示');
  assert.deepEqual(cssTargets(valid).map(t => t.name), ['ok', 'conditional'], '只有 verify 为纯 CSS 的目标可被运行期复核');

  // 危险档案：多匹配未收敛 → 即使非严格模式也必须 FAIL
  const risky = structuredClone(valid);
  risky.targets.ok.verified.matched = 2;
  fs.writeFileSync(path.join(workspace, 'module-profile.json'), JSON.stringify(risky));
  const failed = await staticPreflight(workspace);
  assert.equal(failed.status, 'FAIL');
  assert.ok(failed.errors.some(e => e.code === 'SELECTOR_NOT_UNIQUE'));

  // 畸形档案不得把预检打挂
  fs.writeFileSync(path.join(workspace, 'module-profile.json'), '{ not json');
  assert.equal((await staticPreflight(workspace)).status, 'FAIL');
  fs.writeFileSync(path.join(workspace, 'module-profile.json'), JSON.stringify({ ...valid, targets: { broken: null } }));
  const mixed = await staticPreflight(workspace);
  assert.ok(mixed.warnings.some(w => w.code === 'TARGET_NOT_OBJECT'));
});

test('runtime preflight is read-only, never evaluates profile pointers, and degrades instead of throwing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-dsh-runtime-preflight-'));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'module-profile.json'), JSON.stringify({
    schema: 'ui-automation/module-profile-v1', fingerprint: { value: 'fp' }, targets: {
      // pointer 是故意写坏的表达式：预检绝不能执行它
      pointer_must_not_run: { assumes: ['antd'], pointer: 'process.exit(1)', verify: '#target', verified: { matched: 1 } },
    },
  }));

  const calls = [];
  const fakePage = {
    url: () => 'http://example.test/control-electricity-price/config',
    evaluate: async (fn, list) => {
      calls.push(list);
      return list.map(item => ({ name: item.name, matched: item.name === 'pointer_must_not_run' ? 1 : 0 }));
    },
  };
  const fakeBrowser = { contexts: () => [{ pages: () => [fakePage] }], close: async () => { calls.push('closed'); } };
  const chromium = { connectOverCDP: async () => fakeBrowser };

  const outcome = await runtimePreflight({ workspace, baseUrl: null, cdpEndpoint: 'ws://127.0.0.1:1/devtools', chromium, timeoutMs: 3000 });
  assert.equal(outcome.status, 'WARN', '没有 baseUrl 时可达性为 UNKNOWN，整体应是提示而不是失败');
  assert.ok(outcome.checks.some(c => c.name === 'session' && c.status === 'PASS'));
  assert.equal(calls.at(-1), 'closed', '只断开 CDP，不留下连接');

  // 登录页 → 明确 FAIL
  const loginPage = { url: () => 'http://example.test/login?redirect=%2Fworkspace', evaluate: fakePage.evaluate };
  const login = await runtimePreflight({ workspace, baseUrl: null, cdpEndpoint: 'ws://x', chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [loginPage] }], close: async () => {} }) }, timeoutMs: 3000 });
  assert.beats ??= undefined;
  assert.ok(login.checks.some(c => c.name === 'session' && c.status === 'FAIL' && c.detail === 'LOGIN_PAGE'));

  // 目标对不上 → FAIL 并列出具体目标
  const mismatched = { url: () => 'http://example.test/config', evaluate: async () => [{ name: 'pointer_must_not_run', matched: 0 }] };
  const bad = await runtimePreflight({ workspace, baseUrl: null, cdpEndpoint: 'ws://x', chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [mismatched] }], close: async () => {} }) }, timeoutMs: 3000 });
  assert.equal(bad.status, 'FAIL');
  assert.deepEqual(bad.checks.find(c => c.name === 'targets').mismatched, [{ name: 'pointer_must_not_run', matched: 0 }]);

  // 没有浏览器接入 → UNKNOWN，不抛
  const none = await runtimePreflight({ workspace, baseUrl: null, cdpEndpoint: null, chromium: null });
  assert.ok(none.checks.some(c => c.name === 'session' && c.status === 'UNKNOWN'));

  // 连接失败 → UNKNOWN，不抛
  const attachFailed = await runtimePreflight({ workspace, baseUrl: null, cdpEndpoint: 'ws://x', chromium: { connectOverCDP: async () => { throw new Error('ECONNREFUSED'); } }, timeoutMs: 3000 });
  assert.ok(attachFailed.checks.some(c => c.name === 'session' && c.status === 'UNKNOWN'));
});

test('transcript route serves the read-only view over GET only', async () => {
  const { manager } = fixture();
  const call = async (method) => {
    const chunks = [];
    const response = {
      writeHead(status, headers) { this.status = status; this.headers = headers; },
      end(body) { if (body) chunks.push(body); },
    };
    const handled = await nativeDshRoute({
      request: { method, headers: {} },
      response,
      url: new URL(`http://127.0.0.1/api/case-library/projects/${PROJECT}/native-dsh/transcript`),
      manager,
      sendJson(target, status, value) { target.writeHead(status, { 'content-type': 'application/json' }); target.end(JSON.stringify(value)); },
      readJsonBody: async () => ({}),
      trustedMutation: () => true,
      trustedLocalOrigin: () => true,
    });
    return { handled, status: response.status, body: chunks.join('') };
  };

  const get = await call('GET');
  assert.equal(get.handled, true);
  assert.equal(get.status, 200);
  const parsed = JSON.parse(get.body);
  assert.equal(parsed.available, true);
  assert.equal(parsed.session_id, SESSION);

  const post = await call('POST');
  assert.equal(post.handled, true);
  assert.equal(post.status, 404, '对话视图不开放写入方法');
});

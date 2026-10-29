import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDshRoute } from '../server/native-dsh/routes.mjs';
import { nativeDshCaseItems, nativeDshTaskInput, nativeDshTaskHtml, nativeDshArtifactUrl, renderNativeDsh,
  nativeDshPublicEvents, nativeDshProcessHtml, nativeDshRevisionCount, nativeDshHistoryFingerprint, updateNativeDshProcess } from '../web-v2/native-dsh.js';

const row = (id, type = 'UI', status = 'CONFIRMED') => ({ case_id: id, current_version: 2, versions: [
  { version: 1, content_sha256: 'a'.repeat(64), content: { status: 'CONFIRMED', case_type: 'UI', title: 'old' } },
  { version: 2, content_sha256: 'b'.repeat(64), content: { status, case_type: type, title: id, external_id: `TC-${id}` } },
] });
const project = { project_id: 'project-example', cases: [row('one'), row('two'), row('backend', 'BACKEND'), row('unknown', 'UNCLASSIFIED'), row('pending', 'UI', 'PENDING_CONFIRMATION')] };

test('one full submission accepts more than 20 cases and keeps the total time limit bounded', () => {
  const items = nativeDshCaseItems({ cases: Array.from({ length: 200 }, (_, i) => row(`all-${i}`)) });
  assert.equal(nativeDshTaskInput({ items, selected: new Set(items.map(i => i.case_id)), environmentId: 'env', requestId: 'full-request', timeoutMinutes: 120 }).items.length, 200);
  const extra = [...items, { ...items[0], case_id: 'extra' }];
  assert.throws(() => nativeDshTaskInput({ items: extra, selected: new Set(extra.map(i => i.case_id)), environmentId: 'env' }), /200/);
});

test('login preparation blocks start, offers direct recovery, and all-start submits a single full scope', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch }, dom = fakeDom(), posts = [];
  const full = { ...project, cases: Array.from({ length: 41 }, (_, i) => row(`all-${i}`)) };
  let loggedIn = false, html, dispose;
  globalThis.document = dom.document;
  globalThis.fetch = async (url, options = {}) => {
    let value = url.endsWith('/environment') ? { ui_environment_id: 'env', ui: { id: 'env', auth_required: true, auth_role: 'tester' } }
      : url.includes('/auth?') ? { session: { status: loggedIn ? 'VALID' : 'NOT_LOGGED_IN' } } : { available: true, tasks: [] };
    if (options.method === 'POST') {
      posts.push({ url, input: JSON.parse(options.body) });
      if (url.endsWith('/auth/check')) loggedIn = true;
      if (url.endsWith('/tasks')) value = { id: 'full-task', status: 'RUNNING', items: posts.at(-1).input.items, runs: [] };
    }
    return { ok: true, status: 200, json: async () => value };
  };
  try {
    dispose = await renderNativeDsh({ project: full, showPage: value => { html = value; } });
    assert.equal(dom.node('#native-start-all').disabled, true); assert.equal(dom.node('#native-login-open').hidden, false);
    await dom.node('#native-start-all').onclick(); assert.equal(posts.length, 0);
    await dom.node('#native-login-check').onclick(); assert.equal(dom.node('#native-start-all').disabled, false);
    await dom.node('#native-start-all').onclick();
    const tasks = posts.filter(p => p.url.endsWith('/tasks')); assert.equal(tasks.length, 1); assert.equal(tasks[0].input.items.length, 41);
    assert.ok(html.indexOf('id="native-start"') < html.indexOf('data-native-case='));
    assert.match(html, /<details class="panel"><summary>历史任务与故障诊断/); assert.doesNotMatch(html, /本项目任务与证据/);
  } finally { dispose?.(); Object.assign(globalThis, previous); }
});

test('native selection freezes only selected confirmed UI versions, not older or unclassified cases', () => {
  const items = nativeDshCaseItems(project);
  assert.deepEqual(items.map(item => item.case_id), ['one', 'two']);
  const input = nativeDshTaskInput({ items, selected: new Set(['two', 'backend']), environmentId: 'env', requestId: 'request' });
  assert.deepEqual(input, { request_id: 'request', environment_id: 'env', allow_model: true, allow_execution: true, timeout_minutes: 30,
    items: [{ case_id: 'two', case_version: 2, content_sha256: 'b'.repeat(64) }] });
  for (const timeoutMinutes of [0, 121, NaN, 1.5]) assert.throws(() => nativeDshTaskInput({ items, selected: new Set(['one']), environmentId: 'env', requestId: 'r', timeoutMinutes }), /时间上限/);
  assert.throws(() => nativeDshTaskInput({ items, selected: new Set(), environmentId: 'env', requestId: 'r' }), /至少选择/);
});

test('revision notes are optional, bounded and preserve multiline instructions in the task input', () => {
  const args = { items: nativeDshCaseItems(project), selected: new Set(['one']), environmentId: 'env', requestId: 'request' };
  const plain = nativeDshTaskInput(args);
  assert.equal(Object.hasOwn(plain, 'revision_notes'), false);
  assert.deepEqual(nativeDshTaskInput({ ...args, revisionNotes: ' \n\t ' }), plain);
  assert.equal(nativeDshTaskInput({ ...args, revisionNotes: '  修订 001\n保留原断言 <script>  ' }).revision_notes, '修订 001\n保留原断言 <script>');
  assert.equal(nativeDshTaskInput({ ...args, revisionNotes: '文'.repeat(8000) }).revision_notes.length, 8000);
  assert.throws(() => nativeDshTaskInput({ ...args, revisionNotes: '文'.repeat(8001) }), /最多 8000/);
  for (const revisionNotes of [null, 123, {}, []]) assert.throws(() => nativeDshTaskInput({ ...args, revisionNotes }), /应为文本/);
});

test('registration-only UI input requires one case and explicitly denies execution without a target environment', () => {
  const args = { items: nativeDshCaseItems(project), selected: new Set(['one']), requestId: 'request', kind: 'REGISTER_EXISTING_DRAFT' };
  const input = nativeDshTaskInput(args);
  assert.equal(input.kind, args.kind); assert.equal(input.allow_model, true); assert.equal(input.allow_execution, false);
  assert.equal(Object.hasOwn(input, 'environment_id'), false);
  assert.throws(() => nativeDshTaskInput({ ...args, selected: new Set(['one','two']) }), /一条现有脚本/);
  assert.throws(() => nativeDshTaskInput({ ...args, kind: 'UNKNOWN' }), /模式无效/);
  const html = nativeDshTaskHtml({ id: 'registered', kind: args.kind, status: 'COMPLETED', items: [{ external_id: '<001>', status: 'NOT_RUN' }], runs: [] }, 'p');
  assert.match(html, /登记完成 · 未运行/); assert.match(html, /仅登记已有脚本，未运行不计通过/);
  assert.match(html, /&lt;001&gt;/); assert.doesNotMatch(html, /badge success|测试通过/);
});

test('registration start-event wording stays unexecuted without rewriting stored events or normal generation', () => {
  const events = [{ type: 'turn/start', seq: 1, summary: '原生 dsh 开始编写与自测' }, { type: 'progress', seq: 2, summary: '保留实际模型公开说明' }];
  const task = { kind: 'REGISTER_EXISTING_DRAFT', events }, before = JSON.stringify(task);
  assert.equal(nativeDshPublicEvents(task)[0].summary, '原生 dsh 开始登记现有稿件（未运行）');
  assert.match(nativeDshProcessHtml(task), /开始登记现有稿件（未运行）/);
  assert.doesNotMatch(nativeDshProcessHtml(task), /开始编写与自测/);
  assert.equal(nativeDshPublicEvents(task)[1].summary, events[1].summary); assert.equal(JSON.stringify(task), before);
  assert.equal(nativeDshPublicEvents({ events })[0].summary, events[0].summary);
  assert.equal(nativeDshPublicEvents({ kind: 'REGISTER_EXISTING_DRAFT', events: [{ type: 'turn/start', summary: '另一条原始开始说明' }] })[0].summary, '另一条原始开始说明');
});

test('native page can explicitly submit registration only without environment or login and never changes the default mode', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch }, dom = fakeDom(), submitted = [];
  const state = { available: true, session_id: 'main-session', tasks: [] };
  globalThis.document = dom.document;
  globalThis.fetch = async (url, options = {}) => {
    let body = url.endsWith('/environment') ? {} : state;
    if (options.method === 'POST') {
      const input = JSON.parse(options.body); submitted.push(input);
      body = { id: 'register-task', kind: input.kind, status: 'COMPLETED', items: [{ ...input.items[0], status: 'NOT_RUN' }], runs: [] };
      state.tasks.push(body);
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => structuredClone(body) };
  };
  let dispose;
  try {
    dispose = await renderNativeDsh({ project, query: new URLSearchParams('selected=one'), showPage() {} });
    assert.equal(dom.node('#native-start').disabled, true); assert.equal(submitted.length, 0);
    dom.node('#native-task-kind').value = 'REGISTER_EXISTING_DRAFT'; dom.node('#native-task-kind').onchange();
    assert.equal(dom.node('#native-start').disabled, false); assert.match(dom.node('#native-mode-description').textContent, /不登录、不访问测试目标/);
    await dom.node('#native-start').onclick();
    assert.equal(submitted.length, 1); assert.equal(submitted[0].kind, 'REGISTER_EXISTING_DRAFT'); assert.equal(submitted[0].allow_execution, false);
    assert.match(dom.node('#native-history').innerHTML, /登记完成 · 未运行/);
  } finally { dispose?.(); globalThis.document = previous.document; globalThis.fetch = previous.fetch; }
});

test('diagnostic and historical runs keep execution evidence without implying a case pass', () => {
  for (const run of [
    { purpose: 'diagnostic', counts_for_case: false },
    { purpose: 'diagnostic', counts_for_case: true },
    { purpose: 'unclassified', counts_for_case: false },
    {},
    { purpose: 'case', counts_for_case: false },
  ]) {
    const task = { id: 'task-classified', status: 'PARTIAL', items: [{ case_id: 'one', external_id: 'TC-1', status: 'FAILED' }],
      runs: [{ id: 'diagnostic-pass', case_id: 'one', status: 'PASSED', entry: 'specs/<diag>.mjs', artifacts: [{ id: 'trace', kind: 'trace', name: 'trace.zip' }], ...run }] };
    const before = JSON.stringify(task), html = nativeDshTaskHtml(task, 'project-one');
    assert.match(html, run.purpose === 'diagnostic' ? /诊断执行（不计用例结果）/ : run.purpose === 'case' ? /用例执行（不计用例结果）/ : /未归类执行（不计用例结果）/);
    assert.match(html, /执行状态：通过/); assert.doesNotMatch(html, /badge success/);
    assert.match(html, /TC-1：失败/); assert.match(html, /specs\/&lt;diag&gt;\.mjs/); assert.match(html, /files\/trace/);
    assert.equal(JSON.stringify(task), before, 'rendering must not replace recorded execution statuses or projected item statuses');
  }
  const html = nativeDshTaskHtml({ id: 'task-case', runs: [{ id: 'formal-pass', purpose: 'case', counts_for_case: true, status: 'PASSED' }] }, 'project-one');
  assert.match(html, /badge success">通过/); assert.match(html, /<strong>用例执行<\/strong>/);
});

test('task history displays its frozen revision notes as escaped text', () => {
  const task = { id: 'notes-task', revision_notes: '先修 008\n<script>alert(1)</script> & 保留原数据', runs: [] };
  const before = JSON.stringify(task), html = nativeDshTaskHtml(task, 'project-one');
  assert.match(html, /本批修订说明（提交时记录）/);
  assert.match(html, /先修 008\n&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; 保留原数据/);
  assert.doesNotMatch(html, /<script>/); assert.equal(JSON.stringify(task), before);
  assert.doesNotMatch(nativeDshTaskHtml({ id: 'legacy-task' }, 'project-one'), /data-native-revision-notes/);
});

test('native task renders only its safe diagnostic contract, escapes text and preserves recorded state', () => {
  const diagnostic = { schema: 'workbench/native-dsh-task-diagnostic-v1', project_id: 'project-one', task_id: 'failure-task',
    at: '2026-10-15T09:00:15.000Z', phase: 'SAVE_MODEL_STAGE', update_phase: 'SAVE', code: 'EACCES',
    summary: '操作失败：EACCES <script>alert(1)</script> & 保留', message: 'RAW_MESSAGE', stack: 'RAW_STACK', prompt: 'PRIVATE_PROMPT' };
  const task = { id: 'failure-task', status: 'RUNNING', finished_at: diagnostic.at, runs: [], diagnostics: [
    { ...diagnostic, project_id: 'other-project', summary: 'OTHER_PROJECT' },
    { ...diagnostic, task_id: 'other-task', summary: 'OTHER_TASK' },
    { ...diagnostic, schema: 'unknown', summary: 'UNKNOWN_SCHEMA' },
    ...Array.from({ length: 21 }, (_, index) => ({ ...diagnostic, summary: index ? diagnostic.summary : 'TOO_OLD' })),
  ] };
  const before = JSON.stringify(task), html = nativeDshTaskHtml(task, 'project-one');
  assert.match(html, /任务故障诊断/); assert.match(html, /阶段：<code>SAVE_MODEL_STAGE/);
  assert.match(html, /更新环节：<code>SAVE/); assert.match(html, /错误码：<code>EACCES/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; 保留/);
  assert.match(html, /更早诊断（19 条）/); assert.match(html, /data-native-stop="failure-task"/);
  assert.match(html, /尚未收到程序执行记录/);
  assert.doesNotMatch(html, /<script>|RAW_MESSAGE|RAW_STACK|PRIVATE_PROMPT|OTHER_PROJECT|OTHER_TASK|UNKNOWN_SCHEMA|TOO_OLD/);
  assert.equal(JSON.stringify(task), before);
  assert.doesNotMatch(nativeDshTaskHtml({ id: 'legacy-task', status: 'FAILED' }, 'project-one'), /data-native-task-diagnostics/);
});

test('native task displays blocked draft source without inventing a passing run or captured evidence', () => {
  const task = { id: 'task-draft', status: 'BLOCKED', items: [{ external_id: 'TC-024', status: 'NOT_RUN' }], runs: [], drafts: [{
    schema: 'workbench/native-dsh-draft-v1', id: 'draft-one', project_id: 'p', task_id: 'task-draft', external_id: 'TC-024',
    draft_status: 'BLOCKED_PRECONDITION', blocker: { code: 'MISSING_AUTHORIZED_TEST_DATA', summary: '<b>未授权</b>' }, script_sha256: 'a',
    artifacts: [{ id: 'draft-one-source', kind: 'script', name: 'TC-024.spec.mjs', relative_path: 'snapshot/TC-024.spec.mjs', sha256: 'a' }],
  }] };
  const html = nativeDshTaskHtml(task, 'p');
  assert.match(html, /前置阻塞 · 未执行/); assert.match(html, /DSH 报告（未独立核验）/);
  assert.match(html, /&lt;b&gt;未授权&lt;\/b&gt;/); assert.match(html, /files\/draft-one-source/);
  assert.match(html, /尚未收到程序执行记录/); assert.doesNotMatch(html, /badge success|<video|<b>/);
});

test('failed execution evidence stays readable and model reply never determines run status', () => {
  const html = nativeDshTaskHtml({ id: 'task-one', status: 'FINISHED', reply: '<script>All passed</script>', items: [{ case_id: 'one', external_id: 'TC-1', status: 'FAILED' }],
    runs: [{ id: 'run-1', case_id: 'one', status: 'FAILED', error: '<unsafe> failed', artifacts: [
      { id: 'image-1', kind: 'screenshot', name: 'failure.png' }, { id: 'video-1', kind: 'video', name: 'failure.webm' }, { id: 'script-1', kind: 'script', name: 'case.mjs' },
    ] }] }, 'project-example');
  assert.match(html, /TC-1：失败/); assert.match(html, /&lt;unsafe&gt; failed/); assert.match(html, /&lt;script&gt;All passed/);
  assert.match(html, /生成期自测/); assert.match(html, /video controls/); assert.match(html, /files\/image-1/); assert.match(html, /files\/script-1/);
  assert.doesNotMatch(html, /data-native-stop|<script>/);
  assert.equal(nativeDshArtifactUrl('p/a', 't/b', 'f/c'), '/api/case-library/projects/p%2Fa/native-dsh/tasks/t%2Fb/files/f%2Fc');
});

test('failed runs show clean first-line errors and primary evidence while retaining all errors, files and history', () => {
  const scriptSha = 'c'.repeat(64), task = { id: 'task-history', status: 'PARTIAL', items: [{ case_id: 'one', external_id: 'TC-1', status: 'FAILED' }],
    error: { message: '\u001b[31mTask error\u001b[0m\nTask full detail' }, runs: [1, 2].map(number => ({
      id: `run-${number}`, case_id: 'one', purpose: 'case', counts_for_case: true, status: 'FAILED', script_sha256: scriptSha,
      error: `\u001b[31mError: run ${number} failed\u001b[0m\n\u001b]8;;https://example.test\u0007Call log\u001b]8;;\u0007\n  at <spec>:42`,
      artifacts: [
        ...Array.from({ length: 22 }, (_, index) => ({ id: `r${number}-extra-${index}`, kind: 'script', name: index === 0 ? 'old.spec.mjs' : `probe-${index}.mjs`, relative_path: `snapshot/probe-${index}.mjs`, sha256: 'd'.repeat(64) })),
        { id: `r${number}-image`, kind: 'screenshot', name: 'failure.png' },
        { id: `r${number}-video`, kind: 'video', name: 'failure.webm' },
        { id: `r${number}-main`, kind: 'script', name: 'case.spec.mjs', relative_path: 'snapshot/case.spec.mjs', sha256: scriptSha },
      ],
    })) };
  const before = JSON.stringify(task), html = nativeDshTaskHtml(task, 'project-one');
  assert.doesNotMatch(html, /\u001b|\u009b/); assert.match(html, /<p class="notice danger">Task error<\/p>/);
  assert.match(html, /<details data-native-error-detail><summary>完整错误<\/summary><pre class="preserve-text">Task error\nTask full detail/);
  const articles = [...html.matchAll(/<article class="preview-item">([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.equal(articles.length, 2, 'every failed run remains visible');
  for (const [index, article] of articles.entries()) {
    const number = index + 1;
    assert.match(article, /badge warning">失败/);
    assert.ok(article.includes(`<p class="notice danger">Error: run ${number} failed</p>`));
    assert.match(article, /<summary>完整错误<\/summary><pre class="preserve-text">Error:[\s\S]*Call log\n  at &lt;spec&gt;:42<\/pre>/);
    const [primary, allFiles] = article.split('<details data-native-all-files>');
    assert.match(primary, /查看截图：failure.png/); assert.match(primary, /video controls preload="metadata"/);
    assert.match(primary, /主测试脚本：case.spec.mjs/); assert.doesNotMatch(primary, /probe-|old.spec.mjs/);
    assert.match(allFiles, /<summary>全部文件（25）<\/summary>/);
    assert.equal((allFiles.match(/<li><a /g) || []).length, 25);
    for (const artifact of task.runs[index].artifacts) assert.ok(allFiles.includes(nativeDshArtifactUrl('project-one', task.id, artifact.id)), `${artifact.id} remains readable`);
    assert.doesNotMatch(allFiles, /<video|<details[^>]* open/);
  }
  assert.equal(JSON.stringify(task), before, 'display changes never rewrite evidence or run verdicts');
});

test('unconfirmed cancellation stays visibly active with evidence available and no claim of completion', () => {
  const html = nativeDshTaskHtml({ id: 'task-locked', status: 'STOP_UNCONFIRMED', stage: 'process exit unconfirmed', items: [],
    runs: [{ id: 'prior-run', status: 'FAILED', artifacts: [{ id: 'old-image', name: 'failure.png', kind: 'screenshot' }] }] }, 'project-one');
  assert.match(html, /停止尚未确认/); assert.match(html, /暂不能启动新任务或重启工作台/);
  assert.match(html, /data-native-stop="task-locked" disabled>等待停止确认/); assert.match(html, /files\/old-image/);
  assert.doesNotMatch(html, /已取消|任务结束/);
});

test('process timeline only renders public event summaries, latest twenty by default, errors and pending approvals', () => {
  const task = { status: 'RUNNING', stage: '正在检查弹窗', events: Array.from({ length: 25 }, (_, index) => ({ type: index === 24 ? 'tool/result' : 'tool/call', seq: index + 1, at: '2026-10-14T10:00:00Z', tool_name: 'pwsh', summary: `公开步骤 ${index + 1}`, is_error: index === 24 })),
    pending_approvals: [{ id: 'approval-safe', tool_name: 'pwsh', purpose: '运行本项目测试工具', command: 'DO_NOT_RENDER_SECRET_COMMAND' }] };
  task.events.push({ type: 'thinking', seq: 26, summary: 'DO_NOT_RENDER_PRIVATE_THOUGHT' }, { type: 'reasoning', seq: 27, summary: 'DO_NOT_RENDER_REASONING' },
    { type: 'progress', seq: 28, summary: '复用已验证的月份定位 <script>', thinking: 'DO_NOT_RENDER_HIDDEN_FIELD', raw: { content: 'DO_NOT_RENDER_RAW' } });
  const html = nativeDshProcessHtml(task);
  assert.equal(nativeDshPublicEvents(task).length, 26); assert.match(html, /展开更早过程（6 条）/);
  assert.match(html, /<ol aria-label="最近执行过程">/); assert.match(html, /<details data-native-events-history>/);
  assert.match(html, /notice danger/); assert.match(html, /工具错误/); assert.match(html, /等待权限操作（1 项）/);
  assert.match(html, /运行本项目测试工具/); assert.match(html, /原生 dsh 窗口/);
  assert.match(html, /过程说明/); assert.match(html, /月份定位 &lt;script&gt;/);
  assert.doesNotMatch(html, /DO_NOT_RENDER|<script>/);
  assert.equal((html.match(/<li /g) || []).length, 26);
  const recentList = html.split('<ol aria-label="最近执行过程">')[1].split('</ol>')[0];
  assert.equal((recentList.match(/<li /g) || []).length, 20);
});

test('repair display counts changed self-tested bundles per case instead of counting tool calls as repairs', () => {
  assert.equal(nativeDshRevisionCount({ runs: [
    { case_id: 'one', bundle_sha256: 'A' }, { case_id: 'one', bundle_sha256: 'A' },
    { case_id: 'two', bundle_sha256: 'X' }, { case_id: 'one', bundle_sha256: 'B' },
    { case_id: 'two', script_sha256: 'Y' }, { case_id: 'two', script_sha256: 'Y' }, { case_id: 'one' },
  ].map(run => ({ ...run, purpose: 'case', counts_for_case: true })) }), 2);
  assert.equal(nativeDshRevisionCount({ events: [{ type: 'tool/call', tool_name: 'edit_file' }] }), 0);
  assert.match(nativeDshProcessHtml({ runs: ['A', 'B'].map(script_sha256 => ({ case_id: 'one', script_sha256, purpose: 'case', counts_for_case: true })) }), /脚本修订后自测 1 次/);
});

test('revision counts ignore diagnostic, unclassified and uncounted runs between formal case attempts', () => {
  const task = { runs: [
    { case_id: 'one', bundle_sha256: 'A', purpose: 'case', counts_for_case: true },
    { case_id: 'one', bundle_sha256: 'diagnostic-change', purpose: 'diagnostic', counts_for_case: false },
    { case_id: 'one', bundle_sha256: 'legacy-change' },
    { case_id: 'one', bundle_sha256: 'unknown-change', purpose: 'unclassified', counts_for_case: true },
    { case_id: 'one', bundle_sha256: 'excluded-change', purpose: 'case', counts_for_case: false },
    { case_id: 'one', bundle_sha256: 'A', purpose: 'case', counts_for_case: true },
    { case_id: 'one', bundle_sha256: 'B', purpose: 'case', counts_for_case: true },
  ] };
  const before = JSON.stringify(task);
  assert.equal(nativeDshRevisionCount(task), 1);
  assert.equal(nativeDshRevisionCount({ runs: task.runs.filter(run => run.purpose !== 'case') }), 0);
  assert.equal(JSON.stringify(task), before);
});

test('legacy tool results with unknown error status never claim zero errors or receive inferred history', () => {
  const runtime = { tool_exit_code_tracking: true };
  const legacy = { runtime, events: [{ type: 'tool/result', seq: 1 }, { type: 'tool/result', seq: 2, is_error: false }] };
  const before = JSON.stringify(legacy), html = nativeDshProcessHtml(legacy);
  assert.match(html, /工具错误：旧记录未完整采集/); assert.doesNotMatch(html, /工具错误 0 次/); assert.equal(JSON.stringify(legacy), before);
  assert.equal(nativeDshPublicEvents(legacy)[0].is_error, null);
  assert.match(nativeDshProcessHtml({ runtime, events: [{ type: 'tool/result', is_error: false }] }), /工具错误 0 次/);
  assert.match(nativeDshProcessHtml({ runtime, events: [{ type: 'tool/result', is_error: false }, { type: 'tool/result', is_error: true }] }), /工具错误 1 次/);
});

test('tool error totals require explicit runtime exit-code tracking capability without rewriting legacy records', () => {
  const events = [{ type: 'tool/result', is_error: false }, { type: 'tool/result', is_error: true }];
  for (const runtime of [undefined, {}, { tool_exit_code_tracking: false }, { tool_exit_code_tracking: 'true' }]) {
    const task = { runtime, events }, before = JSON.stringify(task), html = nativeDshProcessHtml(task);
    assert.match(html, /工具错误：旧记录未完整采集/); assert.doesNotMatch(html, /工具错误 \d+ 次/);
    assert.equal(JSON.stringify(task), before);
  }
  const task = { events }, node = { innerHTML: '' };
  updateNativeDshProcess(node, task); assert.match(node.innerHTML, /工具错误：旧记录未完整采集/);
  updateNativeDshProcess(node, { ...task, runtime: { tool_exit_code_tracking: true } });
  assert.match(node.innerHTML, /工具错误 1 次/); assert.doesNotMatch(node.innerHTML, /旧记录未完整采集/);
});

test('progress-only updates preserve the task evidence fingerprint and expanded event history', () => {
  const task = { id: 'task-one', status: 'RUNNING', stage: 'before', events: [], pending_approvals: [], runs: [{ id: 'run-one', status: 'FAILED', artifacts: [{ id: 'video-one', kind: 'video' }] }] };
  const next = { ...task, elapsed_ms: 2500, stage: '使用已有定位', events: [{ type: 'progress', seq: 1, at: '2026-10-14T10:00:00Z', summary: '只检查发生变化的部分' }], pending_approvals: [{ id: 'ask-one', purpose: '执行工具' }] };
  assert.equal(nativeDshHistoryFingerprint([task]), nativeDshHistoryFingerprint([next]), 'progress must not force replacement of the video subtree');
  let writes = 0, contents = '';
  const node = { querySelector: () => ({ open: true }), set innerHTML(value) { writes++; contents = value; }, get innerHTML() { return contents; } };
  next.events = Array.from({ length: 25 }, (_, index) => ({ type: 'tool/result', seq: index, summary: `step-${index}` }));
  updateNativeDshProcess(node, next); assert.equal(writes, 1); assert.match(contents, /data-native-events-history open/);
  updateNativeDshProcess(node, structuredClone(next)); assert.equal(writes, 1, 'unchanged progress does not rebuild its DOM');
  next.stage = '开始自测'; updateNativeDshProcess(node, next); assert.equal(writes, 2); assert.match(contents, /开始自测/);
  assert.doesNotMatch(contents, /<video/);
});

function routeFixture() {
  const calls = [], sent = [];
  const manager = Object.fromEntries(['describe', 'create', 'get', 'stop'].map(name => [name, async (...args) => { calls.push({ name, args }); return { name }; }]));
  manager.artifact = async (...args) => { calls.push({ name: 'artifact', args }); return { root: 'owned-root', media: { id: 'file', sha256: 'd'.repeat(64) } }; };
  const invoke = async (suffix, method = 'GET', body = {}, trusted = true) => nativeDshRoute({
    request: { method, headers: { range: 'bytes=0-99' } }, response: {}, url: new URL(`http://127.0.0.1/api/case-library/projects/project-one/native-dsh${suffix}`), manager,
    sendJson: (_response, status, value) => sent.push({ status, value }), readJsonBody: async () => body, trustedMutation: () => trusted,
    sendRegisteredMedia: async (request, response, root, media) => calls.push({ name: 'media', root, media, range: request.headers.range }),
  });
  return { calls, sent, invoke };
}

test('native routes preserve project ownership and only explicit POST creates or stops work', async () => {
  const { calls, sent, invoke } = routeFixture();
  await invoke(''); await invoke('/tasks/task-a');
  assert.deepEqual(calls, [{ name: 'describe', args: ['project-one'] }, { name: 'get', args: ['project-one', 'task-a'] }]);
  const body = { request_id: 'r', items: [{ case_id: 'one' }] };
  await invoke('/tasks', 'POST', body); await invoke('/tasks/task-a/stop', 'POST');
  assert.deepEqual(calls.slice(2), [{ name: 'create', args: ['project-one', body] }, { name: 'stop', args: ['project-one', 'task-a'] }]);
  assert.deepEqual(sent.map(item => item.status), [200, 200, 202, 202]);
  await assert.rejects(invoke('/tasks/task-a/stop', 'POST', { project_id: 'another' }), /INVALID_STOP_REQUEST/);
  await invoke('/tasks', 'POST', body, false); assert.equal(sent.at(-1).status, 403); assert.equal(calls.length, 4);
  await invoke('/tasks/task-a/stop'); assert.equal(sent.at(-1).status, 404); assert.equal(calls.length, 4);
});

test('artifact route delegates registered media with Range and scoped artifact lookup', async () => {
  const { calls, sent, invoke } = routeFixture();
  await invoke('/tasks/task-a/files/file-a');
  assert.deepEqual(calls[0], { name: 'artifact', args: ['project-one', 'task-a', 'file-a'] });
  assert.equal(calls[1].root, 'owned-root'); assert.equal(calls[1].range, 'bytes=0-99'); assert.equal(sent.length, 0);
});

test('session opener requires same-origin POST and redirects without returning credentials in JSON', async () => {
  const calls = [], sent = [], headers = [];
  const args = { request: { method: 'POST', headers: { 'content-length': '0' } },
    response: { writeHead: (...values) => headers.push(values), end: () => calls.push('end') },
    url: new URL('http://127.0.0.1:4322/api/case-library/projects/project-one/native-dsh/open-session'),
    manager: { openSession: async id => { calls.push(id); return { url: 'http://127.0.0.1:3080/?token=fixture#workbench-session=existing' }; } },
    sendJson: (_res, ...values) => sent.push(values), trustedMutation: () => true,
    readJsonBody: () => { throw Error('Opener must not read a case or task request'); } };
  await nativeDshRoute(args);
  assert.deepEqual(calls, ['project-one', 'end']);
  assert.equal(headers[0][0], 303); assert.equal(headers[0][1]['Cache-Control'], 'no-store');
  assert.equal(headers[0][1]['Referrer-Policy'], 'no-referrer'); assert.match(headers[0][1].Location, /workbench-session=existing/);
  assert.equal(sent.length, 0);
  args.trustedMutation = () => false;
  await nativeDshRoute(args); assert.equal(sent.at(-1)[0], 403); assert.equal(calls.length, 2);
  args.trustedMutation = () => true; args.request.headers['content-length'] = '2';
  await assert.rejects(nativeDshRoute(args), /INVALID_OPEN_REQUEST/); assert.equal(calls.length, 2);
  args.request.method = 'GET'; await nativeDshRoute(args); assert.equal(sent.at(-1)[0], 404); assert.equal(calls.length, 2);
});

test('only the empty session form may use same-origin authentication without JSON', async () => {
  const sent = [], calls = [], args = {
    request: { method: 'POST', headers: { 'content-length': '0', 'content-type': 'application/x-www-form-urlencoded' } },
    response: { writeHead: () => {}, end: () => {} },
    url: new URL('http://127.0.0.1:4322/api/case-library/projects/project-one/native-dsh/open-session'),
    manager: { openSession: async () => { calls.push('open'); return { url: 'http://127.0.0.1:3080/?token=fixture#workbench-session=existing' }; } },
    trustedMutation: () => false, trustedLocalOrigin: () => true, sendJson: (_res, status, value) => sent.push({ status, value }) };
  await nativeDshRoute(args); assert.deepEqual(calls, ['open']);
  args.url = new URL('http://127.0.0.1:4322/api/case-library/projects/project-one/native-dsh/tasks');
  await nativeDshRoute(args); assert.equal(sent.at(-1).status, 403); assert.equal(calls.length, 1);
  args.url = new URL('http://127.0.0.1:4322/api/case-library/projects/project-one/native-dsh/open-session');
  args.trustedLocalOrigin = () => false;
  await nativeDshRoute(args); assert.equal(sent.at(-1).status, 403); assert.equal(calls.length, 1);
});

test('only owned execute route bypasses browser Origin and passes bearer for manager validation', async () => {
  const calls = [];
  const args = { request: { method: 'POST', headers: { authorization: 'Bearer short-lived' } }, response: {},
    url: new URL('http://127.0.0.1/api/case-library/projects/project-one/native-dsh/tasks/task-a/execute'),
    manager: { executeRequest: async (...values) => { calls.push(values); return { status: 'FAILED' }; } },
    readJsonBody: async () => ({ entry: 'one.spec.mjs' }), trustedMutation: () => { throw Error('should use owned bearer validation'); },
    sendJson: (_res, status, value) => { calls.push({ status, value }); },
  };
  await nativeDshRoute(args);
  assert.deepEqual(calls[0], ['project-one', 'task-a', { entry: 'one.spec.mjs' }, 'Bearer short-lived']);
  assert.deepEqual(calls[1], { status: 200, value: { status: 'FAILED' } });
  args.manager.executeRequest = async () => { throw Error('NATIVE_DSH_EXECUTION_UNAUTHORIZED'); };
  await assert.rejects(nativeDshRoute(args), /EXECUTION_UNAUTHORIZED/);
});

function fakeDom() {
  const nodes = new Map(), cases = ['one', 'two'].map(id => ({ dataset: { nativeCase: id }, checked: false, disabled: false }));
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', disabled: false, value: selector === '#native-timeout' ? '30' : '',
      querySelectorAll(kind) {
        if (kind !== '[data-native-stop]') return [];
        return [...this.innerHTML.matchAll(/data-native-stop="([^"]+)"/g)].map(match => { const button = node(`stop:${match[1]}`); button.dataset = { nativeStop: match[1] }; return button; });
      } });
    return nodes.get(selector);
  };
  return { node, cases, document: { querySelector: node, querySelectorAll: selector => selector === '[data-native-case]' ? cases : selector === '[data-native-stop]' ? [...node('#native-history').querySelectorAll(selector), ...node('#native-current').querySelectorAll(selector)] : [] } };
}

test('session button opens only a stored session and remains available without target login or selected cases', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch, window: globalThis.window, URL: globalThis.URL };
  const dom = fakeDom(), posts = []; let html, dispose;
  const opened = [], fakeWindow = { closed: false, location: { href: null, replace(value) { this.href = value; } }, close() { this.closed = true; } };
  globalThis.document = dom.document;
  globalThis.window = { open: () => fakeWindow };
  globalThis.URL = class extends previous.URL { constructor(value, base) { super(value, base); } };
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') posts.push(url);
    const body = url.endsWith('/environment') ? {} : { available: true, session_id: 'existing', can_open_session: true, tasks: [] };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  try {
    dispose = await renderNativeDsh({ project, showPage: value => { html = value; } });
    assert.equal(dom.node('#native-open-session').disabled, false);
    assert.equal(dom.node('#native-start').disabled, true);
    // 工作台页面统一下发 `form-action 'none'`，因此**不能**再用原生表单提交打开会话
    assert.match(html, /<button type="button" class="button" id="native-open-session" disabled>在 dsh 中打开此会话<\/button>/);
    assert.doesNotMatch(html, /<form[^>]*open-session/);
    assert.match(html, /在 dsh 中打开此会话/); assert.equal(posts.length, 0);

    // 打开会话：由同源服务端解析目标地址，前端只导航（表单提交被 CSP 拦、前端跟随重定向被 CORS 拦）
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === 'POST' && url.endsWith('/session-url')) {
        posts.push(url);
        return { ok: true, status: 200, url: 'http://127.0.0.1:4322/api', headers: { get: () => null }, json: async () => ({ url: 'http://127.0.0.1:59999/?token=one-time#workbench-session=existing', session_id: 'existing' }) };
      }
      return { ok: true, status: 200, url: 'http://127.0.0.1:4322/api', headers: { get: () => null }, json: async () => ({ available: true, session_id: 'existing', can_open_session: true, tasks: [] }) };
    };
    await dom.node('#native-open-session').onclick();
    assert.deepEqual(posts, ['/api/case-library/projects/project-example/native-dsh/session-url']);
    assert.equal(fakeWindow.location.href, 'http://127.0.0.1:59999/?token=one-time#workbench-session=existing');
    assert.equal(fakeWindow.closed, false);
    assert.equal(dom.node('#native-open-session').disabled, false, '打开后按钮要恢复可用');
    assert.equal(dom.node('#native-error').textContent, '');

    // 非回环地址不得作为导航目标，且必须关掉占位窗口
    const strayWindow = { closed: false, location: { href: null, replace(value) { this.href = value; } }, close() { this.closed = true; } };
    globalThis.window = { open: () => strayWindow };
    globalThis.fetch = async (url, options = {}) => (options.method === 'POST'
      ? { ok: true, status: 200, url: 'http://127.0.0.1:4322/api', headers: { get: () => null }, json: async () => ({ url: 'http://evil.example.com/?token=x' }) }
      : { ok: true, status: 200, url: 'http://127.0.0.1:4322/api', headers: { get: () => null }, json: async () => ({ available: true, session_id: 'existing', can_open_session: true, tasks: [] }) });
    await dom.node('#native-open-session').onclick();
    assert.equal(strayWindow.location.href, null, '外部地址不得被导航');
    assert.equal(strayWindow.closed, true, '拒绝时必须关掉占位窗口');

    // 弹窗被拦截：要给出可操作的提示，而不是静默失败
    globalThis.window = { open: () => null };
    await dom.node('#native-open-session').onclick();
    assert.match(dom.node('#native-error').textContent, /拦截了新窗口/);

    globalThis.fetch = async url => ({ ok: true, status: 200, url: 'http://127.0.0.1:4322/api', headers: { get: () => null }, json: async () => url.endsWith('/environment') ? {} : { available: true, can_open_session: true, session_id: null, tasks: [] } });
    await dom.node('#native-refresh').onclick();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(dom.node('#native-open-session').disabled, true);
  } finally { dispose?.(); Object.assign(globalThis, previous); }
});

test('separate selections preserve retry identity, active progress, failure evidence and cancellation', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch };
  const dom = fakeDom(), calls = [], submitted = [], state = { available: true, project_id: project.project_id, session_id: 'persistent-session', active_task_id: null, tasks: [] };
  globalThis.document = dom.document;
  let failNextCreate = true, deferCreate = null, resolveCreate;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/environment')) return { ok: true, status: 200, json: async () => ({ ui_environment_id: 'env', ui: { id: 'env', name: 'test' } }) };
    if (options.method === 'POST' && url.endsWith('/tasks')) {
      const body = JSON.parse(options.body); submitted.push(body);
      if (failNextCreate) { failNextCreate = false; throw Error('connection interrupted'); }
      if (deferCreate) await deferCreate;
      const task = { id: `task-${state.tasks.length + 1}`, session_id: state.session_id, status: 'RUNNING', items: body.items, revision_notes: body.revision_notes, runs: [] };
      state.tasks.unshift(task); state.active_task_id = task.id;
      return { ok: true, status: 202, json: async () => structuredClone(task) };
    }
    if (options.method === 'POST' && url.endsWith('/stop')) {
      const task = state.tasks[0]; task.status = 'CANCELLED'; task.error = 'CANCELLED_BY_USER'; state.active_task_id = null;
      task.runs = [{ id: 'failed-run', case_id: task.items[0].case_id, status: 'FAILED', error: 'locator failed', artifacts: [{ id: 'failed-image', kind: 'screenshot', name: 'failure.png' }] }];
      return { ok: true, status: 202, json: async () => structuredClone(task) };
    }
    return { ok: true, status: 200, json: async () => structuredClone(state) };
  };
  let dispose, pageHtml;
  try {
    dispose = await renderNativeDsh({ project, query: new URLSearchParams('selected=one,backend'), showPage(value) { pageHtml = value; } });
    assert.equal(submitted.length, 0, 'opening the page must never start a model');
    assert.equal(dom.node('#native-start').disabled, false);
    assert.match(pageHtml, /<textarea id="native-revision-notes"[^>]*maxlength="8000"/);
    dom.node('#native-revision-notes').value = '补齐原测试数据\n保留失败证据';
    await dom.node('#native-start').onclick();
    assert.match(dom.node('#native-error').textContent, /暂时无法连接/);
    assert.equal(dom.node('#native-revision-notes').value, '补齐原测试数据\n保留失败证据', 'failed submission must preserve the revision draft');
    assert.equal(dom.node('#native-revision-notes').disabled, false);
    assert.equal(submitted[0].revision_notes, '补齐原测试数据\n保留失败证据');
    const firstRequest = submitted[0].request_id;
    deferCreate = new Promise(resolve => { resolveCreate = resolve; });
    const pending = dom.node('#native-start').onclick();
    assert.equal(dom.node('#native-start').disabled, true); assert.equal(dom.node('#native-start').textContent, '正在提交…');
    assert.equal(dom.node('#native-revision-notes').disabled, true);
    resolveCreate(); await pending; deferCreate = null;
    assert.equal(submitted[1].request_id, firstRequest, 'an ambiguous network retry must retain request identity');
    assert.equal(dom.node('#native-start').disabled, true); assert.equal(dom.cases[0].checked, false);
    assert.equal(dom.node('#native-revision-notes').value, '', 'accepted task clears the revision draft');
    assert.equal(dom.node('#native-revision-notes').disabled, false);
    assert.match(dom.node('#native-current').innerHTML, /补齐原测试数据\n保留失败证据/);
    await dom.node('stop:task-1').onclick();
    assert.match(dom.node('#native-history').innerHTML, /locator failed/); assert.match(dom.node('#native-history').innerHTML, /files\/failed-image/);
    assert.equal(submitted.length, 2, 'stopping must never start another batch');
    dom.cases[1].checked = true; dom.cases[1].onchange();
    await dom.node('#native-start').onclick();
    assert.notEqual(submitted[2].request_id, firstRequest); assert.deepEqual(submitted[2].items.map(item => item.case_id), ['two']);
    assert.equal(Object.hasOwn(submitted[2], 'revision_notes'), false, 'a new blank batch must not inherit the previous notes');
    assert.equal(state.tasks[0].session_id, state.tasks[1].session_id);
    const beforeDispose = calls.length; dispose(); await dom.node('#native-refresh').onclick();
    assert.equal(calls.length, beforeDispose, 'disposed page does not continue polling');
  } finally { dispose?.(); Object.assign(globalThis, previous); }
});

test('changing only revision notes creates a new request identity after a failed submission', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch };
  const dom = fakeDom(), submitted = [];
  globalThis.document = dom.document;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') { submitted.push(JSON.parse(options.body)); throw Error('connection interrupted'); }
    return { ok: true, status: 200, json: async () => url.endsWith('/environment')
      ? { ui_environment_id: 'env', ui: { id: 'env' } }
      : { available: true, tasks: [] } };
  };
  let dispose;
  try {
    dispose = await renderNativeDsh({ project, query: new URLSearchParams('selected=one'), showPage() {} });
    dom.node('#native-revision-notes').value = '先核对月份';
    await dom.node('#native-start').onclick();
    await dom.node('#native-start').onclick();
    assert.equal(submitted[1].request_id, submitted[0].request_id);
    dom.node('#native-revision-notes').value = '先核对月份\n再补齐电价';
    await dom.node('#native-start').onclick();
    assert.notEqual(submitted[2].request_id, submitted[1].request_id);
    assert.deepEqual(submitted[2].items, submitted[1].items);
    assert.equal(submitted[2].revision_notes, '先核对月份\n再补齐电价');
    assert.equal(submitted[0].revision_notes, '先核对月份');
    assert.equal(dom.node('#native-revision-notes').value, submitted[2].revision_notes);
    assert.equal(dom.node('#native-revision-notes').disabled, false);
  } finally { dispose?.(); Object.assign(globalThis, previous); }
});

test('another project busy or unconfirmed stop disables submission while preserving read-only evidence', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch };
  for (const locked of [false, true]) {
    const dom = fakeDom(); globalThis.document = dom.document; let submissions = 0, dispose;
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === 'POST') submissions++;
      const body = url.endsWith('/environment') ? { ui_environment_id: 'env', ui: { id: 'env' } } : {
        available: true, runtime_busy: true, active_task_id: locked ? 'locked-task' : null,
        tasks: locked ? [{ id: 'locked-task', status: 'STOP_UNCONFIRMED', items: [], runs: [] }] : [],
      };
      return { ok: true, status: 200, json: async () => body };
    };
    try {
      dispose = await renderNativeDsh({ project, query: new URLSearchParams('selected=one'), showPage() {} });
      assert.equal(dom.node('#native-start').disabled, true);
      await dom.node('#native-start').onclick(); assert.equal(submissions, 0);
      assert.match(dom.node('#native-session').textContent, locked ? /停止尚未确认/ : /其他项目/);
    } finally { dispose?.(); }
  }
  Object.assign(globalThis, previous);
});


test('frozen reruns never masquerade as model generation or missing DSH tool telemetry',()=>{
  const task={id:'rerun',kind:'FROZEN_SCRIPT_RERUN',model_calls:0,status:'COMPLETED',runs:[{id:'r',purpose:'case',counts_for_case:true,status:'PASSED'}]};
  const process=nativeDshProcessHtml(task),html=nativeDshTaskHtml(task,'p');
  assert.match(process,/模型调用 0/);assert.doesNotMatch(process,/旧记录未完整采集|脚本修订后自测|尚未收到过程记录/);
  assert.match(html,/原脚本复跑（无模型）/);assert.doesNotMatch(html,/生成期自测/);
});

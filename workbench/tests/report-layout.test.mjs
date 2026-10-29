import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderReport } from '../server/report-snapshots.mjs';

function entry(id, overrides = {}) {
  return { case_id: `case-${id}`, external_id: `UI-${id}`, title: `用例 ${id}`, case_version: 1,
    case_type: 'UI', state: 'PASSED', result: 'PASSED', evidence_status: 'COMPLETE',
    content: { steps: [{ order: 1, action: '读取结果', expected: '返回原始值' }] },
    steps: [{ order: 1, status: 'PASSED', actual: '已读取' }], media: [], ...overrides };
}
function snapshot(entries, overrides = {}) {
  return { project: { project_id: 'project-report-layout', name: '报告排版回归' },
    report_id: 'report-layout-fixture', scope: 'project_latest', group_key: 'all',
    created_at: '2026-10-09T00:00:00.000Z', entries,
    counts: { requested: entries.length, executed: 0, passed: 0, failed: 0, not_run: 0 }, ...overrides };
}
function section(html, id) {
  const value = html.match(new RegExp(String.raw`<section[^>]* id="${id}"[^>]*>([\s\S]*?)</section>`));
  assert.ok(value, `section ${id} is present`);
  return value[1];
}
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('problem cases lead the index while failure, blocking, non-execution and incomplete evidence remain distinct', () => {
  const r = snapshot([
    entry('pass'),
    entry('fail', { state: 'FAILED', result: 'FAILED', steps: [{ order: 1, status: 'FAILED', actual: '服务拒绝' }] }),
    entry('blocked', { state: 'BLOCKED', result: 'NOT_RUN', reason: 'SCRIPT_MISSING', steps: [] }),
    entry('pending', { state: 'NOT_RUN', result: 'NOT_RUN', reason: 'CURRENT_VERSION_NOT_RUN', steps: [] }),
    entry('incomplete', { state: 'INCOMPLETE', result: 'PASSED', evidence_status: 'INCOMPLETE' }),
  ]);
  const html = renderReport(r), issues = section(html, 'attention'), index = section(html, 'case-index');
  assert.doesNotMatch(issues, /UI-pass/);
  for (const id of ['fail', 'blocked', 'pending', 'incomplete']) {
    assert.ok(issues.includes(`UI-${id}`));
    assert.ok(index.indexOf(`UI-${id}`) < index.indexOf('UI-pass'));
  }
  assert.match(issues, /失败/);
  assert.match(issues, /已阻塞/);
  assert.match(issues, /未执行/);
  assert.match(issues, /不完整/);
  assert.match(issues, /脚本缺失/);
  assert.match(issues, /当前用例版本尚未执行/);
  const incomplete = html.match(/<details id="case-4"[\s\S]*?<\/article>/)?.[0];
  assert.ok(incomplete);
  assert.match(incomplete, /当前结果：<strong>不完整<\/strong>/);
  assert.match(incomplete, /原始执行：<b>通过<\/b>/);
  assert.match(incomplete, /执行证据：不完整/);
  assert.match(html, /<details id="case-1"[^>]* open>/);
  assert.doesNotMatch(html, /<details id="case-0"[^>]* open>/);
});

test('the same case in two scopes keeps unique anchors, frozen counts and immutable input', () => {
  const counts = { requested: 2, executed: 2, passed: 1, failed: 1, not_run: 0, count_unit: 'CASE_SCOPE' };
  const r = snapshot([
    entry('shared', { group_key: 'scope-editor', run_id: 'run-editor' }),
    entry('shared', { group_key: 'scope-viewer', run_id: 'run-viewer', state: 'FAILED', result: 'FAILED' }),
  ], { counts, case_count: 1, groups: [
    { group_key: 'scope-editor', scope: { environment_name: '编辑角色环境', role: 'editor' }, counts: { requested: 1, passed: 1, failed: 0, not_run: 0 } },
    { group_key: 'scope-viewer', scope: { environment_name: '只读角色环境', role: 'viewer' }, counts: { requested: 1, passed: 0, failed: 1, not_run: 0 } },
  ] });
  const before = structuredClone(r);
  const html = renderReport(deepFreeze(r));
  assert.deepEqual(r, before);
  assert.match(html, /用例×范围条目 2 · 已执行 2 · 通过 1 · 失败 1 · 未执行 0/);
  assert.match(html, /统计单位为“用例×范围条目”/);
  const anchors = [...html.matchAll(/id="(case-\d+)"/g)].map(match => match[1]);
  assert.deepEqual(anchors.sort(), ['case-0', 'case-1']);
  for (const [, target] of html.matchAll(/href="#(case-\d+)"/g)) assert.ok(anchors.includes(target));
  const index = section(html, 'case-index');
  assert.match(index, /范围 1/);
  assert.match(index, /范围 2/);
  assert.match(html, /编辑角色环境/);
  assert.match(html, /只读角色环境/);
});

test('untrusted text is escaped and media can only embed the matching offline data URL', () => {
  const attack = `<script>alert("x")</script>&'`;
  const r = snapshot([entry('escape', { title: attack,
    content: { preconditions: attack, test_data: attack, steps: [{ order: 1, action: attack, expected: attack }] },
    media: [
      { kind: 'image', included: true, name: 'safe.png', data_url: 'data:image/png;base64,aW1hZ2U=' },
      { kind: 'video', included: true, name: 'browser-window.webm', data_url: 'data:video/webm;base64,dmlkZW8=' },
      { kind: 'trace', included: true, name: 'trace.zip', data_url: 'data:application/zip;base64,dHJhY2U=' },
      { kind: 'image', included: true, name: attack, data_url: 'https://external.invalid/track.png' },
      { kind: 'video', included: true, name: 'bad.webm', data_url: 'javascript:alert(1)' },
      { kind: 'image', included: true, name: 'wrong-type.svg', data_url: 'data:image/svg+xml;base64,PHN2Zz4=' },
    ] })], { project: { name: attack } });
  const html = renderReport(r);
  assert.doesNotMatch(html, /<script\b/i);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;&amp;&#39;/);
  assert.equal([...html.matchAll(/<img\b/g)].length, 2); // Thumbnail and full original use the same valid image.
  assert.equal([...html.matchAll(/<video\b/g)].length, 1);
  const sources = [...html.matchAll(/<[^>]+(?:src|href)="([^"#][^"]*)"/g)].map(match => match[1]);
  assert.equal(sources.length, 6);
  assert.ok(sources.every(source => /^data:(?:image\/png|video\/webm|application\/zip);base64,/.test(source)));
  assert.doesNotMatch(html, /external\.invalid|javascript:alert|data:image\/svg\+xml/);
});

test('backend setup, business requests and cleanup stay readable and false or zero facts are not treated as absent', () => {
  const request = (id, method, url, status, responseStatus, actual) => ({ request_id: id, status,
    request: { method, url }, response: { status: responseStatus },
    assertions: [{ target: 'json', pointer: '/value', status, actual, actual_exists: true }] });
  const backend = entry('backend', { case_type: 'BACKEND', state: 'FAILED', result: 'FAILED',
    evidence_status: 'HTTP_REQUEST_RESPONSE_ASSERTIONS',
    content: { steps: [
      { order: 1, action: '读取开关', expected: '值为 false' },
      { order: 2, action: '检查剩余数量', expected: '数量为 1' },
    ] }, steps: [{ order: 1, status: 'PASSED', actual: false }, { order: 2, status: 'FAILED', actual: 0 }],
    http_evidence: {
      setup: [request('prepare', 'POST', 'https://target.invalid/api/setup', 'PASSED', 201, true)],
      steps: [{ order: 1, requests: [request('read', 'GET', 'https://target.invalid/api/items', 'PASSED', 200, false)] },
        { order: 2, requests: [{ request_id: 'check', status: 'FAILED', request: { kind: 'response-reference', source_request_id: 'read' },
          response: { status: 200 }, assertions: [{ target: 'json', pointer: '/count', status: 'FAILED', expected: 1, actual: 0 }] }] }],
      cleanup: [request('cleanup', 'DELETE', 'https://target.invalid/api/owned-item', 'PASSED', 204, null)],
    },
  });
  const html = renderReport(snapshot([backend]));
  for (const expected of ['准备数据', 'POST https://target.invalid/api/setup', '步骤 1',
    'GET https://target.invalid/api/items', '复用响应 read', '清理数据', 'DELETE https://target.invalid/api/owned-item',
    'HTTP 201', 'HTTP 204', '通过 / false', '失败 / 0', '查看完整请求、响应与断言']) assert.ok(html.includes(expected), expected);
  assert.match(html, /&quot;actual&quot;: false/);
  assert.match(html, /&quot;actual&quot;: 0/);
});


function image(name, bytes = 'identical captured image') {
  return { kind: 'image', included: true, name, bytes: Buffer.byteLength(bytes),
    sha256: createHash('sha256').update(bytes).digest('hex'), data_url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` };
}
function shotSteps(html) {
  return [...html.matchAll(/<section class="shot-step">([\s\S]*?)<\/section>/g)].map(match => match[1]);
}
function caseArticle(html, index) {
  const match = html.match(new RegExp(String.raw`<details id="case-${index}"[\s\S]*?</article>`));
  assert.ok(match, `case ${index} remains present`);
  return match[0];
}

test('shuffled attachments with identical hashes remain bound to each step and before/after phase', () => {
  const ui = entry('shots', {
    content: { steps: [{ order: 2, action: '拒绝重复新增', expected: '显示拒绝原因' }, { order: 1, action: '初始化', expected: '显示初始记录' }] },
    steps: [
      { order: 1, execution_status: 'PASSED', before_screenshot_file_name: 'one-before.png', screenshot_file_name: 'one-after.png', screenshot_phase: 'after' },
      { order: 2, execution_status: 'FAILED', before_screenshot_file_name: 'two-before.png', screenshot_file_name: 'two-failure.png', screenshot_phase: 'failure-after' },
    ],
    media: [image('two-failure.png'), image('finished.png'), image('one-after.png'), image('two-before.png'), image('one-before.png')],
  });
  const html = renderReport(snapshot([ui])), shots = shotSteps(html);
  assert.equal(shots.length, 2);
  assert.match(shots[0], /<h5>步骤 1<\/h5>/);
  assert.match(shots[1], /<h5>步骤 2<\/h5>/);
  const downloads = card => [...card.matchAll(/download="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(downloads(shots[0]), ['one-before.png', 'one-after.png']);
  assert.deepEqual(downloads(shots[1]), ['two-before.png', 'two-failure.png']);
  assert.match(shots[0], /步骤 1 · 执行前页面/);
  assert.match(shots[0], /步骤 1 · 步骤结束后页面/);
  assert.match(shots[1], /步骤 2 · 失败后页面/);
  assert.doesNotMatch(shots[1], /步骤 2 · 步骤结束后页面/);
  assert.match(html, /其他截图（1）/);
  assert.ok(!shots.some(card => card.includes('finished.png')));
});

test('duplicate and missing names leave explicit placeholders without guessing or borrowing another case image', () => {
  const first = entry('missing', {
    steps: [{ order: 1, execution_status: 'FAILED', before_screenshot_file_name: 'duplicate.png', screenshot_file_name: 'absent.png', screenshot_phase: 'failure-after' }],
    media: [image('duplicate.png', 'first duplicate'), image('duplicate.png', 'second duplicate'), image('case_step_1-after.png', 'similar filename is not binding')],
  });
  const other = entry('other', { media: [image('absent.png', 'belongs to another case')] });
  const html = renderReport(snapshot([first, other])), article = caseArticle(html, 0), cards = shotSteps(article);
  assert.equal(cards.length, 1);
  assert.match(cards[0], /截图名称重复，无法确定对应文件/);
  assert.match(cards[0], /对应截图未携带/);
  assert.match(cards[0], /步骤 1 · 失败后页面/);
  assert.doesNotMatch(cards[0], /<img\b|popovertarget=/);
  assert.match(article, /其他截图（3）/);
  assert.ok(!article.includes(other.media[0].data_url), 'another case cannot fill a missing screenshot');
});

test('same case and image filenames in different scopes get unique popovers while preserving complete data', () => {
  const make = (group, failed = false) => entry('same-case', {
    group_key: group, state: failed ? 'FAILED' : 'PASSED', result: failed ? 'FAILED' : 'PASSED',
    steps: [{ order: 1, execution_status: failed ? 'FAILED' : 'PASSED', before_screenshot_file_name: 'before.png',
      screenshot_file_name: 'after.png', screenshot_phase: failed ? 'failure-after' : 'after' }],
    media: [image('before.png', `${group}: before original`), image('after.png', `${group}: after original`)],
  });
  const report = snapshot([make('scope-one'), make('scope-two', true)]), before = structuredClone(report);
  const html = renderReport(deepFreeze(report));
  assert.deepEqual(report, before);
  const ids = [...html.matchAll(/<div popover id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  const targets = [...html.matchAll(/popovertarget="([^"]+)"/g)].map(match => match[1]);
  assert.equal(targets.length, 8); // One open button and one close button for every original.
  for (const id of ids) assert.equal(targets.filter(target => target === id).length, 2);
  for (let index = 0; index < report.entries.length; index++) {
    const cards = [...caseArticle(html, index).matchAll(/<figure class="shot-card">([\s\S]*?)<\/figure>/g)].map(match => match[1]);
    assert.equal(cards.length, 2);
    for (let phase = 0; phase < cards.length; phase++) {
      const urls = [...cards[phase].matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(urls, [report.entries[index].media[phase].data_url, report.entries[index].media[phase].data_url]);
    }
  }
});

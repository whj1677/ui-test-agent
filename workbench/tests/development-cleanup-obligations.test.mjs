import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkFidelity, inspectFailureCleanup, inspectAssertionSources } from '../server/build/development-fidelity.mjs';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { UI_OWNED_CLEANUP_GUIDANCE } from '../server/build/development-task.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

const frozen = { preconditions: '每条用例独立使用新运行编号 {{runId}}；不得重用其他用例数据。', steps: [
  { order: 1, action: '初始化本次运行编号，然后执行测试', expected: '显示非空拒绝说明。' },
  { order: 2, action: '点击“清理本次数据”，仅清理当前运行编号 {{runId}}。', expected: '清理完成；不得清理其他运行编号。' },
] };
const step = (n, body = '') => `await test.step('CASE_STEP_${n}',async()=>{${body}});`;
const wrap = body => `import {test,expect} from '@playwright/test';test('owned',async({page})=>{await page.goto(process.env.PROBE_URL);${body}});`;
const ordinary = step(1, `await expect(page.locator('#feedback')).toHaveText(/\S/);`) + step(2, `await page.getByRole('button',{name:'清理本次数据'}).click();`);

test('owned run with only normal last-step cleanup is blocked; frozen business content is unchanged', () => {
  const before = structuredClone(frozen);
  const result = checkFidelity(wrap(ordinary), frozen);
  assert.equal(result.failure_cleanup.blocking.length, 1);
  assert.equal(result.failure_cleanup.blocking[0].step, 2);
  assert.equal(result.failure_cleanup.blocking[0].status, 'MISSING_FAILURE_CLEANUP');
  assert.equal(result.semantic_pass, false);
  assert.deepEqual(frozen, before);
});

test('cleanup gate does not invent teardown for ordinary business deletion or absent scope', () => {
  const businessDelete = { preconditions: '打开工单管理', steps: [{ order: 1, action: '删除历史工单', expected: '删除成功' }] };
  assert.equal(inspectFailureCleanup(wrap(step(1)), businessDelete).obligations.length, 0);
  const noOwnership = { steps: [{ order: 1, action: '清理列表筛选', expected: '显示所有工单' }] };
  assert.equal(inspectFailureCleanup(wrap(step(1)), noOwnership).obligations.length, 0);
  const explicit = { steps: [{ order: 1, action: '执行操作', expected: '无论成功失败都清理测试数据' }] };
  assert.equal(inspectFailureCleanup(wrap(step(1)), explicit).blocking.length, 1);
});

test('late, empty and diagnostic finalizers do not cover failures in the first original step', () => {
  for (const body of [
    ordinary + 'try {} finally { await cleanup(); }',
    `try { ${ordinary} } finally {}`,
    `try { ${ordinary} } finally { await console.log('cleanup'); }`,
    `// finally cleanup\n${ordinary}`,
  ]) assert.equal(inspectFailureCleanup(wrap(body), frozen).blocking.length, 1);
});

test('enclosing awaited teardown and hooks are only review leads, never semantic approval', () => {
  for (const code of [
    wrap(`try { ${ordinary} } finally { await cleanupOwned(); }`),
    `import {test,expect} from '@playwright/test';test.afterEach(async()=>{await cleanupOwned();});test('owned',async()=>{${ordinary}});`,
  ]) {
    const result = checkFidelity(code, frozen);
    assert.equal(result.failure_cleanup.blocking.length, 0);
    assert.equal(result.failure_cleanup.obligations[0].status, 'FAILURE_CLEANUP_REVIEW_REQUIRED');
    assert.equal(result.semantic_pass, false);
    assert.equal(result.human_review_required, true);
  }
  const fixture = `import {test} from './owned-fixture.mjs';test('owned',async()=>{${ordinary}});`;
  assert.equal(inspectFailureCleanup(fixture, frozen).obligations[0].status, 'FAILURE_CLEANUP_REVIEW_REQUIRED');
});

test('nonempty explanation cannot become an exact observed error message', () => {
  const code = wrap(step(1, `const feedback=page.locator('#feedback');await expect(feedback).toHaveText('工单编号已存在。');`) + step(2));
  const result = inspectAssertionSources(code, frozen);
  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].status, 'UNBOUND_NONEMPTY_MESSAGE_LITERAL');
  assert.equal(result.blocking[0].step, 1);
  assert.equal(result.blocking[0].expected_literal, '工单编号已存在。');
});

test('explicit source literal, non-whitespace predicate, negation and unrelated data are not overblocked', () => {
  const code = body => wrap(step(1, body));
  const known = structuredClone(frozen);
  known.steps[0].expected += '文案为“工单编号已存在。”。';
  assert.equal(inspectAssertionSources(code(`await expect(feedback).toHaveText('工单编号已存在。');`), known).blocking.length, 0);
  for (const body of [
    `await expect(page.getByRole('alert')).toHaveText(/\S/);`,
    `await expect(feedback).not.toHaveText('新增成功');`,
    `await expect(page.getByLabel('编号')).toHaveText('WO-1001');`,
    `console.log(await feedback.textContent());`,
  ]) assert.equal(inspectAssertionSources(code(body), frozen).blocking.length, 0);
});

for (const [name, candidate, expectedCode] of [
  ['missing failure cleanup', wrap(ordinary), 'READY_WITH_FAILURE_CLEANUP_GAP'],
  ['invented exact error', wrap(`try { ${step(1, `await expect(page.locator('#feedback')).toHaveText('工单编号已存在。');`)}${step(2)} } finally { await page.getByRole('button',{name:'清理本次数据'}).click(); }`), 'READY_WITH_UNBOUND_BUSINESS_ASSERTION'],
  ['invented keyword pattern', wrap(`try { ${step(1, `await expect(page.locator('#feedback')).toHaveText(/\\S/);await expect(page.locator('#feedback')).toContainText(/已存在|重复/);`)}${step(2)} } finally { await page.getByRole('button',{name:'清理本次数据'}).click(); }`), 'READY_WITH_UNBOUND_BUSINESS_ASSERTION'],
]) test(`ready gate rejects ${name} despite green self-test and model review; needs_analysis preserves it`, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-cleanup-gate-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('owned-cleanup-gate-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const session = new DevelopmentSession({ directory, frozenCase: frozen, normalUrl: 'http://127.0.0.1:1', persist: async () => {}, signal: new AbortController().signal, qualityPolicy: { required: true, validation_mode: 'normal-only' } });
  await session.init();
  await session.invoke('write_draft', { code: candidate, previous_sha256: null });
  const bundle = await developmentBundle(path.dirname(session.draftPath));
  // Gate-only synthetic evidence. This test never executes a target or calls a model.
  const last = { number: 1, sha256: digest(candidate), bundle_sha256: bundle.sha256, result: { complete_pass: true }, coverage: { complete: true, items: [] }, status: 'PASSED' };
  session.state.self_tests.push(last);
  session.state.quality_reviews.push({ key: session.qualityKey(last, bundle), status: 'NO_FINDINGS', review: { status: 'NO_FINDINGS', semantic_approval: false } });
  const coverage = frozen.steps.map(item => ({ order: item.order, requirement: item.expected, execution: 1, uncovered: '', check_lines: [1] }));
  await assert.rejects(session.invoke('submit_candidate', { sha256: digest(candidate), outcome: 'ready', coverage }), new RegExp(expectedCode));
  assert.equal(session.state.submission, null);
  assert.equal(session.state.independent_validations.length, 0);
  const result = await session.invoke('submit_candidate', { sha256: digest(candidate), outcome: 'needs_analysis', coverage });
  assert.equal(result.frozen, true);
  assert.equal(session.state.submission.outcome, 'needs_analysis');
  assert.equal(session.state.submission.semantic_approval, false);
  assert.equal(await fs.readFile(path.join(directory, 'final/candidate.spec.mjs'), 'utf8'), candidate);
});

// Prompt-contract regression, not evidence that arbitrary generated code obeys it.
test('generation cleanup guidance distinguishes confirmed ownership from attempted setup and stale completion', async () => {
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /owned only AFTER authoritative creation success/);
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /HTTP 201, created:true, and the same runId/);
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /Do not set an owned\/touched flag before the creation result/);
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /do not guess ownership or delete that uncertain identifier/);
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /Matching stale text left by an earlier cleanup is not completion/);
  assert.match(UI_OWNED_CLEANUP_GUIDANCE, /Keep cleanup errors visible alongside the original failure/);
  const source = await fs.readFile(new URL('../server/build/development-task.mjs', import.meta.url), 'utf8');
  const instructions = source.slice(source.indexOf('const instructions = ['));
  assert.match(instructions, /UI_OWNED_CLEANUP_GUIDANCE,/);
});


test('nonempty-only message rejects invented static keyword regexes, including the real UI02 pattern', () => {
  for (const pattern of ['/已存在|重复/', '/duplicate|already exists/i', '/\\S.*重复/']) {
    const candidate = wrap(step(1, `const notice=page.locator('#feedback');await expect(notice).toHaveText(/\\S/);await expect(notice).toContainText(${pattern});`));
    const check = inspectAssertionSources(candidate, frozen);
    assert.equal(check.blocking.length, 1);
    assert.equal(check.blocking[0].status, 'UNBOUND_NONEMPTY_MESSAGE_PATTERN');
  }
});

test('generic nonempty regex syntax and explicitly source-bound words are not keyword-copy failures', () => {
  for (const pattern of ['/\\S/', '/^(?!\\s*$).+$/', '/^[\\s\\S]+$/', '/(?<reason>\\S+)/', '/^\\p{L}+$/u']) {
    const candidate = wrap(step(1, `await expect(feedback).toHaveText(${pattern});`));
    assert.equal(inspectAssertionSources(candidate, frozen).blocking.length, 0);
  }
  const known = structuredClone(frozen);
  known.steps[0].expected += '提示文案包含“已存在”或“重复”。';
  const code = wrap(step(1, 'await expect(feedback).toContainText(/已存在|重复/);'));
  assert.equal(inspectAssertionSources(code, known).blocking.length, 0);
  assert.equal(checkFidelity(code, known).semantic_pass, false);
});

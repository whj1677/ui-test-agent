import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkFidelity, inspectAssertionSources } from '../server/build/development-fidelity.mjs';
import { DevelopmentSession, digest } from '../server/build/development-session.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

// The frozen search expectations reproduce the real KC-02 mismatch. These are
// regression inputs, not a revision of its stored manual case or candidate.
const frozen = { preconditions: '独立重置演示数据', test_data: '本机合成数据', steps: [
  { order: 1, action: '在搜索框输入小写eq-10', expected: '立即筛选，匹配EQ-101至EQ-108全部8条，回到第1页' },
  { order: 2, action: '清空后输入大写EQ-106', expected: '仅显示EQ-106，共1条，第1/1页' },
  { order: 3, action: '输入eq-1并查看边界', expected: '匹配编号含eq-1的设备，搜索不区分大小写且组合筛选立即生效' },
] };
const wrap = body => `import {test,expect} from '@playwright/test';test('frozen',async({page})=>{await page.goto(process.env.PROBE_URL);${body}});`;
const step = (order, body) => `await test.step('CASE_STEP_${order}',async()=>{${body}});`;
const originalMistake = wrap(step(1, `await expect.soft(page.locator('#summary')).toHaveText('共8条');`)
  + step(2, `await expect(page.locator('#summary')).toHaveText('共1条');`)
  + step(3, `const rows=[{status:await page.locator('#row-status').innerText()}];for(const row of rows){expect(row.status).toBe('空闲');}`));

test('historical KC-02 unsupported idle assertion is inventoried and cannot be treated as source-bound', () => {
  const before = structuredClone(frozen);
  const review = checkFidelity(originalMistake, frozen);
  assert.equal(review.assertion_sources.assertions.length, 3);
  assert.equal(review.assertion_sources.blocking.length, 1);
  assert.equal(review.assertion_sources.blocking[0].step, 3);
  assert.equal(review.assertion_sources.blocking[0].expected_literal, '空闲');
  assert.match(review.assertion_sources.blocking[0].source, /row.status/);
  assert.equal(review.semantic_pass, false);
  assert.deepEqual(frozen, before);
  assert.match(originalMistake, /共8条/);
});

test('named frozen status, equivalent idle label and pure observations do not get broad automatic rejection', () => {
  const known = { ...frozen, steps: frozen.steps.map(item => item.order === 3 ? { ...item, action: '选择空闲状态并搜索eq-1', expected: '仅显示空闲的匹配设备' } : item) };
  const code = wrap(step(3, `expect(row.status).toBe('idle');`));
  const review = inspectAssertionSources(code, known);
  assert.equal(review.blocking.length, 0);
  assert.equal(review.assertions[0].status, 'SOURCE_MENTION_REQUIRES_REVIEW');
  assert.equal(checkFidelity(code, known).semantic_pass, false);
  const observed = wrap(step(3, `console.log(row.status);expect(row.id).toMatch(/eq-1/i);`));
  assert.equal(inspectAssertionSources(observed, frozen).blocking.length, 0);
  const negated = wrap(step(3, `expect(row.status).not.toBe('空闲');`));
  assert.equal(inspectAssertionSources(negated, frozen).assertions[0].status, 'SEMANTIC_REVIEW_REQUIRED');
});

test('soft state checks are detected; helper scope and dynamic predicates remain explicit unproved review work', () => {
  assert.equal(inspectAssertionSources(wrap(step(3, `expect.soft(row.state).toEqual('空闲');`)), frozen).blocking.length, 1);
  const helper = `function helper(row){expect(row.status).toBe('空闲');}${wrap(step(3, 'helper(row);'))}`;
  assert.equal(inspectAssertionSources(helper, frozen).assertions[0].status, 'UNSCOPED_STATUS_REVIEW_REQUIRED');
  const dynamic = wrap(step(3, `expect(row.status).toBe(observedStatus);`));
  assert.equal(inspectAssertionSources(dynamic, frozen).assertions[0].status, 'SEMANTIC_REVIEW_REQUIRED');
});

test('initial total and off-page exclusion stay visible as independent review gaps', () => {
  const bookable = { preconditions: '初始资源 8 条，按编号升序，每页 3 条', steps: [
    { order: 1, action: '当前页全选', expected: '已选集合不含 EQ-104，仅空闲设备可被选入预约。' },
  ] };
  const old = wrap(step(1, `expect(selectedIds).not.toContain('EQ-104');`));
  const missing = inspectAssertionSources(old, bookable).review_requirements;
  assert.equal(missing[0].status, 'PRECONDITION_ASSERTION_NOT_FOUND');
  assert.equal(missing[0].expected, 8);
  assert.equal(missing[1].status, 'GLOBAL_SCOPE_REVIEW_REQUIRED');
  const stronger = wrap(`await expect(page.locator('#statTotal')).toHaveText('8');` + step(1, `await page.getByRole('button',{name:'下一页'}).click();await expect(checkboxOf('EQ-104')).not.toBeChecked();`));
  const candidates = inspectAssertionSources(stronger, bookable).review_requirements;
  assert.equal(candidates[0].status, 'ASSERTION_CANDIDATE_REQUIRES_REVIEW');
  assert.equal(candidates[1].status, 'GLOBAL_SCOPE_REVIEW_REQUIRED');
  assert.equal(checkFidelity(stronger, bookable).semantic_pass, false);
});

test('ready admission blocks known unbound assertions even with a synthetic passing report, while failed difference is preserved', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'assertion-source-gate-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const session = new DevelopmentSession({ directory, frozenCase: frozen, normalUrl: 'http://127.0.0.1:1', persist: async () => {}, signal: new AbortController().signal });
  await session.init();
  await session.invoke('write_draft', { code: originalMistake, previous_sha256: null });
  const bundle = await developmentBundle(path.dirname(session.draftPath));
  // Synthetic self-test state exercises admission only, never product execution.
  session.state.self_tests.push({ number: 1, sha256: digest(originalMistake), bundle_sha256: bundle.sha256,
    result: { complete_pass: true }, coverage: { complete: true, items: [] }, status: 'PASSED' });
  const coverage = frozen.steps.map(item => ({ order: item.order, requirement: item.expected, execution: 1, uncovered: '', check_lines: [1] }));
  await assert.rejects(session.invoke('submit_candidate', { sha256: digest(originalMistake), outcome: 'ready', coverage }), /READY_WITH_UNBOUND_BUSINESS_ASSERTION/);
  assert.equal(session.state.submission, null);
  session.state.self_tests[0].result.complete_pass = false;
  session.state.self_tests[0].status = 'FAILED';
  await session.invoke('submit_candidate', { sha256: digest(originalMistake), outcome: 'business_difference', coverage });
  assert.equal(session.state.submission.outcome, 'business_difference');
  assert.equal(session.state.fidelity_review.finite_checks.assertion_sources.blocking.length, 1);
  assert.equal(session.state.fidelity_review.steps[0].self_test.result.complete_pass, false);
  assert.equal(session.state.fidelity_review.semantic_approval, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDesignCheck } from '../server/requirements/quality.mjs';
import { enhancedGenerationInput, reviewModelInput, repairModelInput, validateQualityReview } from '../server/requirements/quality-model.mjs';
import { normalizeCandidate, confirmCandidate } from '../server/requirements/candidates.mjs';

const ref = { snapshot_id: 's-prd', segment_id: 'seg-1', quote_sha256: 'q-1' };
const design = { project_id: 'project-quality', allow_model_text: true,
  scope: { mode: 'SELECTED', description: '预约规则' }, source_refs: [{ snapshot_id: 's-prd', sha256: 's-1' }] };
const sources = [{ project_id: design.project_id, snapshot_id: 's-prd', sha256: 's-1', kind: 'PRD',
  segments: [{ segment_id: 'seg-1', quote_sha256: 'q-1', text: '说明长度与预约时间', location: { paragraph: 1 } }] }];
const content = { external_id: 'A-1', title: '预约', module: '',
  preconditions: '固定时钟 2026-10-01T09:00:00+08:00；R1 为 SUBMITTED',
  test_data: '说明=质量问题换货；开始=2026-10-01T10:00:00+08:00；结束=2026-10-01T11:00:00+08:00',
  steps: [{ order: 1, action: '对 R1 SUBMITTED 提交预约', expected: 'R1 REJECTED；以有权身份读取记录状态', source_refs: [ref] }] };
const check = () => ({ target: '预约', source_refs: [ref], prerequisites: [{ name: '状态', value: 'SUBMITTED', source_refs: [ref] }],
  text_lengths: [{ label: '说明', value: '质量问题换货', trim: true, claimed_length: 6, step_order: 1 }],
  time_ranges: [{ label: '预约', now: '2026-10-01T09:00:00+08:00', start: '2026-10-01T10:00:00+08:00',
    end: '2026-10-01T11:00:00+08:00', claimed_duration_minutes: 60, claimed_lead_minutes: 60, step_order: 1 }],
  state_transitions: [{ record_id: 'R1', before: 'SUBMITTED', after: 'REJECTED', step_order: 1 }],
  observations: [{ step_order: 1, description: '以有权身份读取记录状态' }] });
const candidates = { UI: [{ candidate_id: 'c-ui', content, issues: [], design_check: check(),
  quality_check: { status: 'NEEDS_REVIEW', findings: [{ code: 'DATA', message: '程序发现' }], calculations: [] } }],
  BACKEND: [{ candidate_id: 'c-be', content, issues: [], design_check: check() }] };

test('computable declarations are checked against candidate text and selected source', () => {
  const result = evaluateDesignCheck(check(), content, design, sources);
  assert.equal(result.status, 'CHECKED');
  assert.deepEqual(result.findings, []);
  assert.equal(result.calculations.find((x) => x.kind === 'TEXT_LENGTH').actual, 6);
  assert.deepEqual(result.calculations.find((x) => x.kind === 'TIME_RANGE').actual,
    { duration_minutes: 60, lead_minutes: 60 });
});

test('self-reported length and time do not override recomputation or missing body evidence', () => {
  const raw = check();
  raw.text_lengths[0].claimed_length = 9;
  raw.time_ranges[0].claimed_duration_minutes = 121;
  raw.time_ranges[0].start = '2026-10-01T10:29:00+08:00';
  const result = evaluateDesignCheck(raw, content, design, sources);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_LENGTH_MISMATCH'));
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_TIME_MISMATCH'));
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_TIME_UNLOCATED'));
});

test('expected text cannot self-prove length or time inputs, but transition after may be expected', () => {
  const onlyExpected = { ...content, test_data: '', preconditions: '', steps: [{ order: 1,
    action: '提交 R1 SUBMITTED', expected: '质量问题换货，2026-10-01T09:00:00+08:00，2026-10-01T10:00:00+08:00，2026-10-01T11:00:00+08:00；R1 REJECTED' }] };
  const result = evaluateDesignCheck(check(), onlyExpected, design, sources);
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_VALUE_UNLOCATED'));
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_TIME_UNLOCATED'));
  assert.ok(!result.findings.some((x) => x.code === 'DESIGN_CHECK_STATE_UNLOCATED'));
});

test('negative duration and lead are computed, and declared step must match actual order', () => {
  const data = { ...content, preconditions: '固定时钟 2026-10-01T11:00:00+08:00；R1 为 SUBMITTED',
    test_data: '说明=质量问题换货；开始=2026-10-01T10:00:00+08:00；结束=2026-10-01T09:00:00+08:00' };
  const raw = check();
  raw.time_ranges[0] = { ...raw.time_ranges[0], now: '2026-10-01T11:00:00+08:00',
    end: '2026-10-01T09:00:00+08:00', claimed_duration_minutes: -60, claimed_lead_minutes: -60 };
  assert.ok(!evaluateDesignCheck(raw, data, design, sources).findings.some((x) => x.code === 'DESIGN_CHECK_TIME_MISMATCH'));
  const reordered = { ...data, steps: [{ ...data.steps[0], order: 2 }] };
  assert.equal(evaluateDesignCheck(raw, reordered, design, sources).status, 'NOT_CHECKED');
});

test('missing structure is not checked; wrong source and chained state are findings', () => {
  assert.equal(evaluateDesignCheck(null, content, design, sources).status, 'NOT_CHECKED');
  const raw = check();
  raw.source_refs = [{ ...ref, quote_sha256: 'wrong' }];
  raw.state_transitions.push({ record_id: 'R1', before: 'SUBMITTED', after: 'CLOSED', step_order: 1 });
  const result = evaluateDesignCheck(raw, content, design, sources);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_SOURCE_INVALID'));
  assert.ok(result.findings.some((x) => x.code === 'DESIGN_CHECK_STATE_CHAIN_MISMATCH'));
});

test('enhanced inputs preserve selected sources while using separate generation, review and repair instructions', () => {
  const generated = enhancedGenerationInput(design, sources);
  assert.match(generated.system_prompt, /design_check/);
  assert.match(generated.system_prompt, /所有候选默认待人工确认，由产品状态统一管理/);
  assert.match(generated.system_prompt, /没有真实问题时 issues=\[\]/);
  assert.equal(generated.selected_source_manifest.protocol.status, 'ABSENT');
  const review = reviewModelInput({ baseInput: generated, candidates });
  assert.equal(review.candidates.length, 2);
  assert.equal(review.candidates[0].quality_check.findings[0].message, '程序发现');
  assert.match(review.system_prompt, /独立测试用例审查者/);
  assert.equal(review.source_segments[0].text, '说明长度与预约时间');
  const repaired = repairModelInput({ baseInput: generated, candidates,
    review: { reviews: [], coverage_findings: [] } });
  assert.equal(repaired.original_candidates.length, 2);
  assert.match(repaired.system_prompt, /定向修订者/);
  assert.match(repaired.system_prompt, /有据预期不得仅因待人工确认而留空/);
  assert.match(repaired.system_prompt, /单纯流程提示如需保留只能用 INFO/);
  assert.match(repaired.system_prompt, /candidate_id、content、issues、design_check 四个平级键/);
  assert.doesNotMatch(repaired.system_prompt, /每个候选对象恰好包含 content、issues、design_check 三个平级键/);
});

test('review and repair carry the same authorized image parts and reject missing bytes', () => {
  const baseInput = enhancedGenerationInput(design, sources);
  const image = { snapshot_id: 'image-1', sha256: 'sha-image', body: Buffer.from('fixture') };
  baseInput.image_parts = [image];
  baseInput.image_analysis = { status: 'REQUESTED', source_snapshots: [{ snapshot_id: image.snapshot_id, sha256: image.sha256 }] };
  const review = reviewModelInput({ baseInput, candidates });
  assert.equal(review.image_parts[0], image);
  assert.equal(review.visual_sources[0].snapshot_id, 'image-1');
  const repair = repairModelInput({ baseInput, candidates, review: { reviews: [], coverage_findings: [] } });
  assert.equal(repair.image_parts[0], image);
  delete baseInput.image_parts;
  assert.throws(() => reviewModelInput({ baseInput, candidates }), /REQUIREMENT_QUALITY_IMAGE_REQUIRED/);
});

test('review validation requires every candidate exactly once and traceable findings', () => {
  const result = { reviews: [
    { candidate_id: 'c-ui', verdict: 'NEEDS_REVISION', findings: [{ code: 'DATA_MISSING', message: '前提不充分', step_order: 1, source_refs: [ref] }] },
    { candidate_id: 'c-be', verdict: 'NO_FINDINGS', findings: [] },
  ], coverage_findings: [{ message: '时长边界未覆盖', source_refs: [ref] }] };
  assert.deepEqual(validateQualityReview(result, { candidates, design, sources }), result);
  assert.throws(() => validateQualityReview({ ...result, reviews: result.reviews.slice(0, 1) }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
  assert.throws(() => validateQualityReview({ ...result, reviews: [result.reviews[0], result.reviews[0]] }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
  assert.throws(() => validateQualityReview({ ...result, reviews: [{ ...result.reviews[0], findings: [] }, result.reviews[1]] }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
  assert.throws(() => validateQualityReview({ ...result, reviews: [{ ...result.reviews[0], findings: [{ ...result.reviews[0].findings[0], source_refs: [] }] }, result.reviews[1]] }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
  assert.throws(() => validateQualityReview({ ...result, reviews: [{ ...result.reviews[0], findings: [{ ...result.reviews[0].findings[0], step_order: 2 }] }, result.reviews[1]] }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
  assert.throws(() => validateQualityReview({ ...result, unexpected: true }, { candidates, design, sources }), /REQUIREMENT_QUALITY_REVIEW_INVALID/);
});
test('invalid review locates a schema failure without trusting or silently repairing model text', () => {
  const result = { reviews: [{ candidate_id: 'c-ui', verdict: 'NEEDS_REVISION', findings: [{ code: 'DATA_MISSING', message: '数据不足', step_order: [1], source_refs: [ref] }] }, { candidate_id: 'c-be', verdict: 'NO_FINDINGS', findings: [] }], coverage_findings: [] };
  assert.throws(() => validateQualityReview(result, { candidates, design, sources }), error => {
    assert.equal(error.message, 'REQUIREMENT_QUALITY_REVIEW_INVALID');
    assert.deepEqual(error.quality_validation, { path: 'reviews[0].findings[0]', reason: 'STEP_ORDER' });
    return true;
  });
});
test('a reference to another case baseline cannot be confirmed as a standalone case', () => {
  const c = normalizeCandidate({ content: { ...content, preconditions: '同基线', test_data: '同上' }, issues: [] }, 'UI', design, sources);
  assert(c.issues.some(item => item.code === 'VALIDATION_NON_STANDALONE_DATA'));
  assert.equal(c.content.steps[0].expected, content.steps[0].expected, 'protect expectation rather than deleting it');
  assert.throws(() => confirmCandidate(c, design, sources), /REQUIREMENT_CONFIRM_BLOCKED/);
  const repaired = normalizeCandidate({ content, issues: [] }, 'UI', design, sources);
  assert(!repaired.issues.some(item => item.code === 'VALIDATION_NON_STANDALONE_DATA'));
});

test('model input refs match the exact three-key output contract without changing stored metadata', () => {
  const baseInput = enhancedGenerationInput(design, sources);
  const internal = structuredClone(candidates);
  const enriched = { ...ref, location: { paragraph: 7 } };
  internal.UI[0].content.steps[0].source_refs = [enriched];
  internal.UI[0].issues = [{ code: 'X', source_refs: [enriched] }];
  internal.UI[0].design_check.source_refs = [enriched];
  internal.UI[0].quality_check.findings[0].source_refs = [enriched];
  const original = JSON.stringify(internal);
  const review = reviewModelInput({ baseInput, candidates: internal });
  const repair = repairModelInput({ baseInput, candidates: internal, review: { reviews: [], coverage_findings: [] } });
  for (const rows of [review.candidates, repair.original_candidates]) {
    assert.deepEqual(rows[0].content.steps[0].source_refs, [ref]);
    assert.deepEqual(rows[0].issues[0].source_refs, [ref]);
    assert.deepEqual(rows[0].quality_check.findings[0].source_refs, [ref]);
    assert.deepEqual(rows[0].design_check.source_refs, [ref]);
  }
  assert.equal(JSON.stringify(internal), original);
  for (const input of [baseInput, review, repair]) {
    assert.deepEqual(input.source_ref_catalog, [ref]);
    assert.match(input.system_prompt, /source_ref_catalog/);
    assert.match(input.system_prompt, /读回准备与被测行为|独立读回前的无筛选准备/);
  }
});

test('bad reference keys and the historical extra-hash-character failure remain blocking and diagnosable', () => {
  const realHash = 'aaedd0040c1b5a5c46a69095d1b6f37d88c9ca82d6d8912a094e9d0c57478695';
  const currentSources = structuredClone(sources);
  currentSources[0].segments[0].quote_sha256 = realHash;
  const valid = { ...ref, quote_sha256: realHash };
  const result = reference => ({ reviews: [{ candidate_id: 'c-ui', verdict: 'NEEDS_REVISION', findings: [
    { code: 'EXPECTED_MISSING', message: '检查有据预期', step_order: 1, source_refs: [reference] },
  ] }, { candidate_id: 'c-be', verdict: 'NO_FINDINGS', findings: [] }], coverage_findings: [] });
  assert.equal(validateQualityReview(result(valid), { candidates, design, sources: currentSources }).reviews[0].verdict, 'NEEDS_REVISION');
  for (const [reference, rule] of [[{ ...valid, location: { line: 24 } }, 'REF_KEYS'],
    [{ ...valid, quote_sha256: 'aaeedd0040c1b5a5c46a69095d1b6f37d88c9ca82d6d8912a094e9d0c57478695' }, 'QUOTE_HASH'],
    [{ ...valid, snapshot_id: 'unselected' }, 'SOURCE_NOT_SELECTED'], [{ ...valid, segment_id: 'missing' }, 'SEGMENT_UNKNOWN']]) {
    assert.throws(() => validateQualityReview(result(reference), { candidates, design, sources: currentSources }), error => {
      assert.deepEqual(error.quality_validation, { path: 'reviews[0].findings[0]', reason: 'SOURCE_REF', reference: { index: 0, rule } });
      return true;
    });
  }
  const sourceChanged = structuredClone(currentSources); sourceChanged[0].sha256 = 'changed';
  assert.throws(() => validateQualityReview(result(valid), { candidates, design, sources: sourceChanged }), error => error.quality_validation.reference.rule === 'SNAPSHOT_HASH');
  const foreign = structuredClone(currentSources); foreign[0].project_id = 'another-project';
  assert.throws(() => validateQualityReview(result(valid), { candidates, design, sources: foreign }), error => error.quality_validation.reference.rule === 'SOURCE_PROJECT');
});

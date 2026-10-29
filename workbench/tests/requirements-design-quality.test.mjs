import test from 'node:test';
import assert from 'node:assert/strict';
import { requirementsModelInput, REQUIREMENTS_MODEL_SYSTEM_PROMPT } from '../server/requirements/model.mjs';
import { normalizeCandidate, applyHumanDecisions, confirmCandidate } from '../server/requirements/candidates.mjs';

const projectId = 'project-quality';
const segment = (id, text) => ({ segment_id: id, text, quote_sha256: `sha-${id}`, location: { paragraph: 1 } });
const source = (snapshot_id, kind, segments, project_id = projectId) =>
  ({ snapshot_id, kind, segments, project_id, read_status: segments.length ? 'READ' : 'UNANALYZED',
    sections: { body: 'READ', tables: 'READ' } });
const design = ids => ({ project_id: projectId, allow_model_text: true,
  scope: { mode: 'SELECTED', description: '只设计一项规则' },
  source_refs: ids.map(snapshot_id => ({ snapshot_id })) });

test('current selected readable protocol is reported despite a historical no-protocol sentence', () => {
  const protocol = source('protocol', 'PROTOCOL', [segment('api1', 'GET /items 返回当前列表。')]);
  protocol.read_status = 'PARTIAL';
  const input = requirementsModelInput(design(['prd', 'protocol']), [
    source('prd', 'PRD', [segment('p1', '首轮未提供协议；后来可能补充。')]),
    protocol,
  ]);
  assert.deepEqual(input.selected_source_manifest.protocol, { status: 'PROVIDED', snapshot_ids: ['protocol'] });
  assert.deepEqual(input.selected_source_manifest.sources.map(({ snapshot_id, sent_segments }) => [snapshot_id, sent_segments]),
    [['prd', 1], ['protocol', 1]]);
  assert.equal(input.selected_source_manifest.sources[1].read_status, 'PARTIAL');
  assert.equal(input.selected_source_manifest.binding_status, 'NOT_CONFIRMED');
  assert.equal(input.selected_source_manifest.execution_status, 'NOT_VERIFIED');
  assert.equal(input.source_segments.length, 2);
  assert.equal(input.source_segments[1].text, 'GET /items 返回当前列表。');
});

test('unselected, cross-project, image, and empty protocols never imply a readable selected protocol', () => {
  const sources = [
    source('prd', 'PRD', [segment('p1', '已确认业务规则')]),
    source('empty', 'PROTOCOL', []),
    source('foreign', 'PROTOCOL', [segment('f1', '不属于本项目')], 'project-foreign'),
    source('unselected', 'PROTOCOL', [segment('u1', '不在本设计范围')]),
    source('image', 'IMAGE', []),
  ];
  const input = requirementsModelInput(design(['prd', 'empty', 'foreign', 'image']), sources);
  assert.deepEqual(input.selected_source_manifest.protocol, { status: 'ABSENT', snapshot_ids: [] });
  assert.deepEqual(input.selected_source_manifest.sources.map(item => [item.snapshot_id, item.sent_segments]),
    [['prd', 1], ['empty', 0]]);
  assert.deepEqual(input.source_segments.map(item => item.snapshot_id), ['prd']);
  const withProtocol = requirementsModelInput(design(['prd', 'unselected']), sources);
  assert.deepEqual(withProtocol.selected_source_manifest.protocol,
    { status: 'PROVIDED', snapshot_ids: ['unselected'] });
  assert.deepEqual(withProtocol.source_segments.map(item => item.snapshot_id), ['prd', 'unselected']);
});

test('design prompt requires conflict uncertainty and distinguishable reachable cases without changing JSON shape', () => {
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /受影响候选的 expected 留空/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /双方 snapshot_id、segment_id/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /不能声称拒绝独立证明某一规则/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /独立记录代号和初始状态/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /只有 protocol\.status=PROVIDED/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /不得假设能从列表操作/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /不要求 UI 直接输入接口字段、幂等键/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /详情、并发冲突/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /初始状态→动作→后状态/);
  assert.match(REQUIREMENTS_MODEL_SYSTEM_PROMPT, /未明示的成功码不要按惯例补/);
});

const candidateDesign = { project_id: projectId, source_refs: [{ snapshot_id: 'prd' }] };
const candidateSources = [source('prd', 'PRD', [segment('p1', '需要人工核对的规则')])];
const ref = { snapshot_id: 'prd', segment_id: 'p1', quote_sha256: 'sha-p1' };
function proposed(issues) {
  return { content: { external_id: 'BE-1', title: '候选', module: '', preconditions: '', test_data: '',
    steps: [
      { order: 1, action: '提交第一项', expected: '模型选边的预期', source_refs: [ref] },
      { order: 2, action: '查询第二项', expected: '无争议预期', source_refs: [ref] },
    ] }, issues };
}

test('explicit model business conflict keeps the proposal but removes the affected expected and blocks confirmation', () => {
  const raw = proposed([{ code: 'SOURCE_CONFLICT', severity: 'BLOCKING', step_order: 1,
    message: '两处来源冲突，须人工核对。' }]);
  const candidate = normalizeCandidate(raw, 'BACKEND', candidateDesign, candidateSources);
  assert.equal(candidate.content.steps[0].expected, '');
  assert.equal(candidate.content.steps[1].expected, '无争议预期');
  assert.equal(candidate.content.steps[0].source_refs[0].segment_id, 'p1');
  assert.equal(candidate.model_proposal.content.steps[0].expected, '模型选边的预期');
  assert.deepEqual(candidate.model_proposal.issues, [{ code: 'SOURCE_CONFLICT', severity: 'BLOCKING',
    step_order: 1, message: '两处来源冲突，须人工核对。' }]);
  assert.deepEqual(candidate.issues.filter(item => item.code === 'VALIDATION_EXPECTED_MISSING')
    .map(item => item.step_order), [1]);
  assert.throws(() => confirmCandidate(candidate, candidateDesign, candidateSources), /REQUIREMENT_CONFIRM_BLOCKED/);
});

test('INFO technical gap leaves a sourced model expected untouched', () => {
  const candidate = normalizeCandidate(proposed([{ code: 'PROTOCOL_MISSING', severity: 'INFO',
    message: '技术协议尚未提供。' }]), 'BACKEND', candidateDesign, candidateSources);
  assert.equal(candidate.content.steps[0].expected, '模型选边的预期');
  assert.equal(candidate.model_proposal, undefined);
  assert.doesNotThrow(() => confirmCandidate(candidate, candidateDesign, candidateSources));
});

test('routine human confirmation stays pending without clearing a sourced expected, while a real conflict blocks it', () => {
  const routine = normalizeCandidate(proposed([{ code: 'PENDING_HUMAN_CONFIRMATION', severity: 'INFO',
    message: '候选仍需人工确认。' }]), 'BACKEND', candidateDesign, candidateSources);
  assert.equal(routine.content.steps[0].expected, '模型选边的预期');
  assert.equal(routine.content.status, 'PENDING_CONFIRMATION');
  assert.equal(routine.confirmation_status, 'PENDING_CONFIRMATION');
  assert.equal(routine.model_proposal, undefined);
  assert.doesNotThrow(() => confirmCandidate(routine, candidateDesign, candidateSources));

  const conflict = normalizeCandidate(proposed([{ code: 'SOURCE_CONFLICT', severity: 'CLARIFICATION',
    step_order: 1, message: '两个来源对该预期有未决冲突。' }]), 'BACKEND', candidateDesign, candidateSources);
  assert.equal(conflict.content.steps[0].expected, '');
  assert.equal(conflict.content.steps[1].expected, '无争议预期');
  assert.equal(conflict.model_proposal.content.steps[0].expected, '模型选边的预期');
  assert.equal(conflict.confirmation_status, 'PENDING_CONFIRMATION');
  assert.throws(() => confirmCandidate(conflict, candidateDesign, candidateSources), /REQUIREMENT_CONFIRM_BLOCKED/);
});

test('unexpected severity is normalized to blocking before guarding the model expectation', () => {
  for (const severity of ['blocking', undefined]) {
    const candidate = normalizeCandidate(proposed([{ code: 'SOURCE_CONFLICT', severity,
      step_order: 1, message: '来源冲突待审阅。' }]), 'BACKEND', candidateDesign, candidateSources);
    assert.equal(candidate.issues[0].severity, 'BLOCKING');
    assert.equal(candidate.content.steps[0].expected, '');
    assert.equal(candidate.content.steps[1].expected, '无争议预期');
    assert.equal(candidate.model_proposal.content.steps[0].expected, '模型选边的预期');
  }
});

test('invalid or missing conflict step order conservatively clears every expected', () => {
  for (const step_order of [99, 0, null]) {
    const candidate = normalizeCandidate(proposed([{ code: 'RULE_UNDECIDED', severity: 'CLARIFICATION',
      step_order, message: '目标步骤不明确。' }]), 'UI', candidateDesign, candidateSources);
    assert.deepEqual(candidate.content.steps.map(item => item.expected), ['', '']);
    assert.deepEqual(candidate.model_proposal.content.steps.map(item => item.expected),
      ['模型选边的预期', '无争议预期']);
    assert.throws(() => confirmCandidate(candidate, candidateDesign, candidateSources), /REQUIREMENT_CONFIRM_BLOCKED/);
  }
});

test('later human edit and sourced decision can confirm without losing the original proposal', () => {
  const original = normalizeCandidate(proposed([{ code: 'SOURCE_CONFLICT', severity: 'BLOCKING',
    step_order: 1, message: '需人工裁决。' }]), 'BACKEND', candidateDesign, candidateSources);
  const reviewed = structuredClone(original);
  reviewed.content.steps[0].expected = '人工确认后的预期';
  applyHumanDecisions(reviewed, reviewed.issues.map(item => ({ issue_id: item.issue_id,
    reviewer: '人工审阅者', text: '已核对来源并确认该预期', step_order: 1 })));
  const amended = normalizeCandidate({ content: reviewed.content }, 'BACKEND', candidateDesign,
    candidateSources, reviewed);
  assert.equal(amended.content.steps[0].expected, '人工确认后的预期');
  assert.deepEqual(amended.model_proposal, original.model_proposal);
  assert.ok(amended.content.steps[0].source_refs.some(item => item.decision_id));
  assert.doesNotThrow(() => confirmCandidate(amended, candidateDesign, candidateSources));
});

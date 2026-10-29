import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RequirementsManager } from '../server/requirements/manager.mjs';
import { confirmCandidate } from '../server/requirements/candidates.mjs';
import { sha256 } from '../server/requirements/documents.mjs';

const PROJECT_A = 'project-aaaaaaaa';
const PROJECT_B = 'project-bbbbbbbb';
function project(id) { return { project_id: id, revision: 1, cases: [], imports: [] }; }
async function fixture(modelResult) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirements-domain-'));
  const projects = new Map([[PROJECT_A, project(PROJECT_A)], [PROJECT_B, project(PROJECT_B)]]);
  const calls = [];
  const manager = new RequirementsManager({
    root,
    projectStore: { async getProject(id) { return projects.has(id) ? structuredClone(projects.get(id)) : null; } },
    modelClient: { async generate(request) {
      calls.push(request);
      const result = await modelResult(request.input);
      if (request.input.generation_partition) {
        const other = request.input.generation_partition.case_type === 'UI' ? 'BACKEND' : 'UI';
        result.candidates[other] = [];
      }
      return result;
    } },
    confirmCases: async ({ projectId, projectRevision, designId, candidates }) => {
      const item = projects.get(projectId);
      assert.equal(item.revision, projectRevision);
      const cases = candidates.map((candidate, index) => {
        const content = { ...structuredClone(candidate.content), requirements_origin: {
          project_id: projectId, design_id: designId, candidate_id: candidate.candidate_id,
        } };
        if (candidate.target_case) {
          const existing = item.cases.find((entry) => entry.case_id === candidate.target_case.case_id);
          assert.ok(existing);
          const nextVersion = existing.current_version + 1;
          existing.versions.push({ version: nextVersion, content, content_sha256: `hash-revision-${nextVersion}` });
          existing.current_version = nextVersion;
          return { candidate_id: candidate.candidate_id, case_id: existing.case_id, version: nextVersion };
        }
        const caseId = `case-aaaaaaaa${item.cases.length + index}`;
        item.cases.push({
          case_id: caseId, current_version: 1, root_source: structuredClone(candidate.root_source),
          versions: [{ version: 1, content, content_sha256: `hash-${index}` }],
        });
        return { candidate_id: candidate.candidate_id, case_id: caseId, version: 1 };
      });
      item.revision += 1;
      return { cases };
    },
  });
  await manager.init();
  return { root, projects, manager, calls, async close() { await manager.shutdown(); await fs.rm(root, { recursive: true, force: true }); } };
}
async function waitFor(manager, projectId, designId, state) {
  // Concurrent Windows test workers can delay filesystem persistence beyond a
  // one-second polling window. Keep the terminal-state assertion unchanged.
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const design = await manager.getDesign(projectId, designId);
    if (design.status === state) return design;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`TIMEOUT_WAITING_FOR_${state}`);
}

test('selected project sources and explicit model authorization yield sourced candidates, never an automatic confirmation', async (t) => {
  const f = await fixture((input) => {
    const ref = input.source_segments.find((segment) => segment.kind === 'PRD');
    assert.ok(ref);
    assert.ok(!input.source_segments.some((segment) => segment.kind === 'IMAGE'));
    const content = {
      external_id: 'BE-001', title: '重复编号拒绝', module: '设备台账',
      preconditions: '', test_data: '重复编号',
      steps: [{ order: 1, action: '提交重复编号', expected: '拒绝重复编号', source_refs: [{ snapshot_id: ref.snapshot_id, segment_id: ref.segment_id, quote_sha256: ref.quote_sha256 }] }],
    };
    return { candidates: { UI: [], BACKEND: [{ content, issues: [] }] }, issues: [], model: 'configured-test-model', usage: { input_tokens: 10, output_tokens: 20 } };
  });
  t.after(f.close);
  const requirement = await f.manager.upload(PROJECT_A, {
    kind: 'PRD', fileName: 'prd.md', body: Buffer.from('重复编号必须拒绝'),
    documentVersion: 'v1', documentStatus: 'CONFIRMED',
  });
  const image = await f.manager.upload(PROJECT_A, {
    kind: 'IMAGE', fileName: 'screen.png',
    body: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)]),
  });
  assert.equal((await f.manager.listSources(PROJECT_A)).sources.length, 2);
  assert.equal((await f.manager.listSources(PROJECT_B)).sources.length, 0);
  await assert.rejects(f.manager.createDesign(PROJECT_B, { sourceIds: [requirement.snapshot_id], scope: { mode: 'ALL_CURRENT' } }), /REQUIREMENT_SOURCE_NOT_FOUND/);
  const design = await f.manager.createDesign(PROJECT_A, {
    sourceIds: [requirement.snapshot_id, image.snapshot_id], scope: { mode: 'ALL_CURRENT' },
    allowModelText: true, allowModelImages: false,
  });
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: false }), /REQUIREMENT_MODEL_AUTH_REQUIRED/);
  const task = await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  assert.equal(task.status, 'RUNNING');
  const generated = await waitFor(f.manager, PROJECT_A, design.design_id, 'PENDING_REVIEW');
  assert.equal(f.calls.length, 2);
  assert.equal(generated.model_requests.length, 2);
  assert.equal(generated.candidates.BACKEND[0].confirmation_status, 'PENDING_CONFIRMATION');
  assert.equal(generated.candidates.BACKEND[0].content.steps[0].source_refs[0].quote_sha256, requirement.segments[0].quote_sha256);
  assert.equal((await f.manager.listDesigns(PROJECT_A)).designs[0].design_id, design.design_id);
  const receipt = await f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: generated.revision, projectRevision: 1, candidateIds: [generated.candidates.BACKEND[0].candidate_id],
  });
  assert.equal(receipt.cases[0].case_id, 'case-aaaaaaaa0');
  const confirmedDesign = await f.manager.getDesign(PROJECT_A, design.design_id);
  assert.equal(confirmedDesign.candidates.BACKEND[0].confirmation_status, 'CONFIRMED');
  assert.equal(confirmedDesign.projectRevision, 2);
  assert.equal(confirmedDesign.sourceProjectRevision, 1);
  await assert.rejects(f.manager.editCandidate(PROJECT_A, design.design_id, confirmedDesign.candidates.BACKEND[0].candidate_id, {
    revision: confirmedDesign.revision, content: confirmedDesign.candidates.BACKEND[0].content,
  }), /REQUIREMENT_CONFIRMED_CANDIDATE_IMMUTABLE/);
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: generated.revision + 1, projectRevision: 2, candidateIds: [generated.candidates.BACKEND[0].candidate_id],
  }), /REQUIREMENT_REVISION_CONFLICT|REQUIREMENT_ALREADY_CONFIRMED|REQUIREMENT_CONFIRM_STATE_INVALID/);
});

test('unresolved model expectation stays blank across storage until a sourced human decision', async (t) => {
  const f = await fixture((input) => {
    const ref = input.source_segments[0];
    return { candidates: { UI: [], BACKEND: [{ content: {
      external_id: 'BE-CONFLICT', title: '冲突预期', module: '', preconditions: '', test_data: '',
      steps: [{ order: 1, action: '提交申请', expected: '模型自行选定拒绝', source_refs: [
        { snapshot_id: ref.snapshot_id, segment_id: ref.segment_id, quote_sha256: ref.quote_sha256 },
      ] }, { order: 2, action: '查询无争议状态', expected: '显示当前状态', source_refs: [
        { snapshot_id: ref.snapshot_id, segment_id: ref.segment_id, quote_sha256: ref.quote_sha256 },
      ] }],
    }, issues: [{ code: 'SOURCE_CONFLICT', severity: 'BLOCKING', step_order: 1,
      message: '两处已选来源对允许条件存在冲突。' }] }] }, issues: [] };
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, {
    kind: 'PRD', fileName: 'prd.md', body: Buffer.from('申请条件存在待人工确认的冲突'),
  });
  const design = await f.manager.createDesign(PROJECT_A, {
    sourceIds: [source.snapshot_id], scope: { mode: 'ALL_CURRENT' }, allowModelText: true,
  });
  await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  const generated = await waitFor(f.manager, PROJECT_A, design.design_id, 'PENDING_REVIEW');
  const candidate = generated.candidates.BACKEND[0];
  assert.equal(candidate.content.steps[0].expected, '');
  assert.equal(candidate.model_proposal.content.steps[0].expected, '模型自行选定拒绝');
  assert.deepEqual(candidate.issues.map(item => item.code), ['SOURCE_CONFLICT', 'VALIDATION_EXPECTED_MISSING']);
  assert.deepEqual((await f.manager.getDesign(PROJECT_A, design.design_id)).candidates.BACKEND[0].model_proposal,
    candidate.model_proposal);
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: generated.revision, projectRevision: 1, candidateIds: [candidate.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  const content = structuredClone(candidate.content);
  content.steps[0].expected = '人工决定后的可核验预期';
  await assert.rejects(f.manager.editCandidate(PROJECT_A, design.design_id, candidate.candidate_id, {
    revision: generated.revision, content,
    decisions: [{ issue_id: candidate.issues[0].issue_id, reviewer: '业务审阅者',
      text: '错把步骤一冲突的决定绑定步骤二', step_order: 2 }],
  }), /REQUIREMENT_DECISION_STEP_MISMATCH/);
  const afterRejected = await f.manager.getDesign(PROJECT_A, design.design_id);
  assert.equal(afterRejected.revision, generated.revision);
  assert.equal(afterRejected.candidates.BACKEND[0].content.steps[0].expected, '');
  assert.deepEqual(afterRejected.candidates.BACKEND[0].model_proposal, candidate.model_proposal);
  const reviewed = await f.manager.editCandidate(PROJECT_A, design.design_id, candidate.candidate_id, {
    revision: generated.revision, content,
    decisions: candidate.issues.map(item => ({ issue_id: item.issue_id, reviewer: '业务审阅者',
      text: '人工核对选中来源后决定该预期', step_order: 1 })),
  });
  assert.equal(reviewed.candidates.BACKEND[0].content.steps[0].expected, '人工决定后的可核验预期');
  assert.deepEqual(reviewed.candidates.BACKEND[0].model_proposal, candidate.model_proposal);
  const receipt = await f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: reviewed.revision, projectRevision: 1, candidateIds: [candidate.candidate_id],
  });
  assert.equal(receipt.cases.length, 1);
});

test('correcting a source role creates a new snapshot and keeps the old snapshot unchanged', async (t) => {
  const f = await fixture(() => ({ candidates: { UI: [], BACKEND: [] }, issues: [] }));
  t.after(f.close);
  const originalBytes = Buffer.from('业务规则：重复编号必须拒绝');
  const original = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'requirements.md', body: originalBytes });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [original.snapshot_id], scope: { mode: 'ALL' } });
  const corrected = await f.manager.upload(PROJECT_A, { kind: 'MRD', fileName: 'requirements.md', body: originalBytes, replacesSourceId: original.snapshot_id });
  assert.notEqual(corrected.snapshot_id, original.snapshot_id);
  assert.equal(corrected.supersedes_source_id, original.snapshot_id);
  assert.equal(corrected.kind, 'MRD');
  assert.equal((await f.manager.getSource(PROJECT_A, original.snapshot_id)).kind, 'PRD');
  assert.equal((await f.manager.getDesign(PROJECT_A, design.design_id)).source_refs[0].snapshot_id, original.snapshot_id);
  await assert.rejects(f.manager.upload(PROJECT_A, { kind: 'MRD', fileName: 'requirements.md', body: Buffer.from('different'), replacesSourceId: original.snapshot_id }), /REQUIREMENT_SOURCE_REPLACEMENT_CONTENT_MISMATCH/);
});

test('unscoped global business issue blocks all confirmation; reviewed scope leaves affected candidates gated', async (t) => {
  const f = await fixture((input) => {
    const ref = input.source_segments[0];
    const step = { order: 1, action: '提交重复编号', expected: '拒绝重复编号', source_refs: [
      { snapshot_id: ref.snapshot_id, segment_id: ref.segment_id, quote_sha256: ref.quote_sha256 },
    ] };
    const candidate = (type) => ({ content: {
      external_id: `${type}-001`, title: '重复编号拒绝', module: '', preconditions: '', test_data: '',
      steps: [step],
    }, issues: [] });
    return {
      candidates: { UI: [candidate('UI')], BACKEND: [candidate('BE')] },
      issues: [{ code: 'BUSINESS_CONFLICT', severity: 'BLOCKING', message: '后端重复编号错误码冲突' }],
    };
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('重复编号必须拒绝') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  const generated = await waitFor(f.manager, PROJECT_A, design.design_id, 'PENDING_REVIEW');
  const uiId = generated.candidates.UI[0].candidate_id;
  const backendId = generated.candidates.BACKEND[0].candidate_id;
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: generated.revision, projectRevision: 1, candidateIds: [uiId],
  }), /REQUIREMENT_GLOBAL_ISSUE_UNRESOLVED/);
  await assert.rejects(f.manager.reviewDesignIssue(PROJECT_A, design.design_id, {
    revision: generated.revision, issueId: generated.issues[0].issue_id, reviewer: '测试工程师', decisionText: '仅影响后端',
  }), /REQUIREMENT_SCOPE_CANDIDATES_REQUIRED/);
  await assert.rejects(f.manager.reviewDesignIssue(PROJECT_A, design.design_id, {
    revision: generated.revision, issueId: generated.issues[0].issue_id, reviewer: '测试工程师',
    decisionText: '可能不影响用例', affectedCandidateIds: [],
  }), /REQUIREMENT_SCOPE_EMPTY_REQUIRES_CONFIRMATION/);
  const scoped = await f.manager.reviewDesignIssue(PROJECT_A, design.design_id, {
    revision: generated.revision, issueId: generated.issues[0].issue_id, reviewer: '测试工程师',
    decisionText: '已核对需求冲突仅涉及后端错误码，前端拒绝显示不受影响', affectedCandidateIds: [backendId],
  });
  assert.equal(scoped.candidates.BACKEND[0].issues.at(-1).code, 'GLOBAL_BUSINESS_ISSUE');
  const uiReceipt = await f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: scoped.revision, projectRevision: 1, candidateIds: [uiId],
  });
  assert.equal(uiReceipt.cases.length, 1);
  const afterUi = await f.manager.getDesign(PROJECT_A, design.design_id);
  assert.equal(afterUi.projectRevision, 2);
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: afterUi.revision, projectRevision: afterUi.projectRevision, candidateIds: [backendId],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  const issueId = afterUi.candidates.BACKEND[0].issues.at(-1).issue_id;
  const reviewedBackend = await f.manager.editCandidate(PROJECT_A, design.design_id, backendId, {
    revision: afterUi.revision,
    decisions: [{ issue_id: issueId, reviewer: '测试工程师', text: '错误码按需求评审结果核对，当前仅确认拒绝行为', step_order: 1 }],
  });
  const backendReceipt = await f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: reviewedBackend.revision, projectRevision: 2, candidateIds: [backendId],
  });
  assert.equal(backendReceipt.cases.length, 1);
  assert.equal((await f.manager.getDesign(PROJECT_A, design.design_id)).projectRevision, 3);
});

test('fabricated source references are visible and block confirmation', async (t) => {
  const f = await fixture((input) => {
    const ref = input.source_segments[0];
    return {
      candidates: {
        UI: [{
          content: {
            external_id: 'UI-001', title: '错误来源', module: '', preconditions: '', test_data: '',
            steps: [{ order: 1, action: '查看页面', expected: '显示成功', source_refs: [{ snapshot_id: ref.snapshot_id, segment_id: 'segment-fake' }] }],
          },
          issues: [],
        }],
        BACKEND: [],
      },
      issues: [],
    };
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'MRD', fileName: 'mrd.md', body: Buffer.from('查询应显示失败原因') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL_CURRENT' }, allowModelText: true });
  await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  const generated = await waitFor(f.manager, PROJECT_A, design.design_id, 'PENDING_REVIEW');
  const candidate = generated.candidates.UI[0];
  assert.ok(candidate.issues.some((item) => item.code === 'VALIDATION_SOURCE_REF_INVALID'));
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: generated.revision, projectRevision: 1, candidateIds: [candidate.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  assert.equal(f.projects.get(PROJECT_A).cases.length, 0);
  const invalidIssue = candidate.issues.find((item) => item.code === 'VALIDATION_SOURCE_REF_INVALID');
  const reviewed = await f.manager.editCandidate(PROJECT_A, design.design_id, candidate.candidate_id, {
    revision: generated.revision,
    decisions: [{ issue_id: invalidIssue.issue_id, reviewer: '测试工程师', text: '需求评审确认该页面应提示失败原因', step_order: 1 }],
  });
  assert.equal(reviewed.candidates.UI[0].content.steps[0].source_refs[0].decision_id, reviewed.candidates.UI[0].human_decisions[0].decision_id);
  assert.equal(reviewed.candidates.UI[0].issues.filter((item) => item.code.startsWith('VALIDATION_')).length, 0);
  const changedContent = structuredClone(reviewed.candidates.UI[0].content);
  changedContent.steps[0].expected = '页面显示成功';
  const changed = await f.manager.editCandidate(PROJECT_A, design.design_id, candidate.candidate_id, {
    revision: reviewed.revision, content: changedContent,
  });
  assert.ok(changed.candidates.UI[0].issues.some((item) => item.code === 'VALIDATION_EXPECTED_SOURCE_MISSING'));
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: changed.revision, projectRevision: 1, candidateIds: [candidate.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  const currentIssue = changed.candidates.UI[0].issues.find((item) => item.code === 'VALIDATION_EXPECTED_SOURCE_MISSING');
  const finalReview = await f.manager.editCandidate(PROJECT_A, design.design_id, candidate.candidate_id, {
    revision: changed.revision,
    decisions: [{ issue_id: currentIssue.issue_id, reviewer: '测试工程师', text: '评审后明确该预期及其边界', step_order: 1 }],
  });
  const receipt = await f.manager.confirmCandidates(PROJECT_A, design.design_id, {
    revision: finalReview.revision, projectRevision: 1, candidateIds: [candidate.candidate_id],
  });
  assert.equal(receipt.cases.length, 1);
  const imported = f.projects.get(PROJECT_A).cases[0].versions[0].content;
  assert.equal(imported.requirements_review.human_decisions.length, 2);
  assert.equal(imported.requirements_review.human_decisions[1].reviewer, '测试工程师');
});

test('a sent failed model request exhausts this design budget without an automatic retry', async (t) => {
  const f = await fixture(() => {
    const error = new Error('DEEPSEEK_JSON_INVALID');
    error.requirement_diagnostic = { error_code: 'DEEPSEEK_JSON_INVALID', finish_reason: 'stop', response_model: 'configured-model',
      usage: { prompt_tokens: 10, completion_tokens: 4 }, response_text: '{"candidates":' };
    throw error;
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('必须拒绝重复编号') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  const failed = await waitFor(f.manager, PROJECT_A, design.design_id, 'FAILED');
  assert.equal(failed.model_requests.length, 1);
  assert.equal(failed.generation.diagnostic.error_code, 'DEEPSEEK_JSON_INVALID');
  assert.equal(failed.generation.diagnostic.response_text, '{"candidates":');
  assert.equal(failed.model_requests[0].usage.prompt_tokens, 10);
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.manager.startGeneration(PROJECT_A, design.design_id, {
    revision: failed.revision, allowModelText: true,
  }), /REQUIREMENT_MODEL_BUDGET_EXHAUSTED/);
});

test('model failure persists only whitelisted transport diagnostics, never hostile error text or URL', async (t) => {
  const privateValue = 'fixture-key-not-for-storage';
  const hostile = `proxy https://user:proxy-pass@proxy.invalid/path?token=${privateValue}`;
  const f = await fixture(() => {
    const error = new Error(hostile);
    error.requirement_diagnostic = {
      error_code: 'DEEPSEEK_CONNECTION_FAILED', network_error_code: 'ECONNREFUSED',
      transport_error_kind: 'INVALID_ENUM', message: hostile, request: hostile, url: hostile,
      api_key: privateValue,
    };
    throw error;
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('编号必须唯一') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  await f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  const failed = await waitFor(f.manager, PROJECT_A, design.design_id, 'FAILED');
  assert.deepEqual(failed.generation.diagnostic, { error_code: 'DEEPSEEK_CONNECTION_FAILED', network_error_code: 'ECONNREFUSED' });
  const serialized = JSON.stringify(failed);
  assert.equal(serialized.includes(hostile), false);
  assert.equal(serialized.includes(privateValue), false);
  assert.equal(serialized.includes('proxy-pass'), false);
});

test('model preparation reserves the only slot before awaits and shutdown prevents an unsent call', async (t) => {
  const f = await fixture(() => ({ candidates: { UI: [], BACKEND: [] }, issues: [] }));
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('必须拒绝重复编号') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  const originalGetProject = f.manager.projectStore.getProject;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  f.manager.projectStore.getProject = async (id) => { await gate; return originalGetProject(id); };
  const first = f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true });
  assert.equal(f.manager.starting, true);
  await assert.rejects(f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true }), /REQUIREMENT_MODEL_BUSY/);
  const stopping = f.manager.shutdown();
  release();
  await assert.rejects(first, /REQUIREMENT_SERVICE_NOT_ACCEPTING|REQUIREMENT_MODEL_CANCELLED/);
  await stopping;
  assert.equal(f.manager.active, null);
  assert.equal(f.calls.length, 0);
});

test('generation persistence failure releases reservation without calling model', async (t) => {
  const f = await fixture(() => ({ candidates: { UI: [], BACKEND: [] }, issues: [] }));
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('必须拒绝重复编号') });
  const design = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  f.manager.store.updateDesign = async () => { throw new Error('DISK_WRITE_FAILED'); };
  await assert.rejects(f.manager.startGeneration(PROJECT_A, design.design_id, { revision: 1, allowModelText: true }), /DISK_WRITE_FAILED/);
  assert.equal(f.manager.active, null);
  assert.equal(f.calls.length, 0);
});

test('partial body reading needs an explicit adopted scope, while an unanalyzed image alone does not block text', () => {
  const text = '编号重复时拒绝';
  const source = {
    project_id: PROJECT_A, snapshot_id: 'source-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', kind: 'PRD',
    sections: { body: 'PARTIAL', tables: 'READ', images: 'UNANALYZED' },
    segments: [{ segment_id: 'segment-1', text, quote_sha256: sha256(text), location: { paragraph: 1 } }],
  };
  const design = { project_id: PROJECT_A, source_refs: [{ snapshot_id: source.snapshot_id }] };
  const candidate = {
    confirmation_status: 'PENDING_CONFIRMATION', issues: [], human_decisions: [], coverage_decision: null,
    content: { steps: [{ order: 1, action: '输入重复编号', expected: '拒绝', source_refs: [
      { snapshot_id: source.snapshot_id, segment_id: 'segment-1', quote_sha256: sha256(text) },
    ] }] },
  };
  assert.throws(() => confirmCandidate(candidate, design, [source]), /REQUIREMENT_COVERAGE_DECISION_REQUIRED/);
  candidate.coverage_decision = { reviewer: '测试工程师', adopted_scope: '仅覆盖已读的重复编号规则' };
  assert.doesNotThrow(() => confirmCandidate(candidate, design, [source]));
  source.sections.body = 'READ';
  candidate.coverage_decision = null;
  assert.doesNotThrow(() => confirmCandidate(candidate, design, [source]));
});

test('protocol mapping versions preserve the confirmed case and distinguish partial, conflict and technical confirmation', async (t) => {
  const f = await fixture(() => ({ candidates: { UI: [], BACKEND: [] }, issues: [] }));
  t.after(f.close);
  const content = {
    case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-001', title: '读取状态',
    steps: [{ order: 1, action: '读取设备', expected: '状态为正常' }, { order: 2, action: '读取电压', expected: '单位为 V' }],
  };
  f.projects.get(PROJECT_A).cases.push({
    case_id: 'case-bbbbbbbb', current_version: 1,
    versions: [{ version: 1, content: structuredClone(content), content_sha256: 'case-sha-1' }],
  });
  f.projects.get(PROJECT_A).cases.push({
    case_id: 'case-cccccccc', current_version: 1,
    versions: [{ version: 1, content: { ...structuredClone(content), status: 'DRAFT' }, content_sha256: 'case-sha-draft' }],
  });
  await assert.rejects(f.manager.createBinding(PROJECT_A, {
    caseId: 'case-cccccccc', caseVersion: 1, caseContentSha256: 'case-sha-draft', protocolSourceId: 'source-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  }), /BINDING_CASE_NOT_CONFIRMED/);
  const requirementsText = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('状态正常') });
  await assert.rejects(f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: requirementsText.snapshot_id, expectedRevision: 0,
  }), /BINDING_PROTOCOL_REQUIRED/);
  const protocol = await f.manager.upload(PROJECT_A, { kind: 'PROTOCOL', fileName: 'protocol.md', body: Buffer.from('命令 01 读取状态\n\n命令 02 读取电压') });
  const first = await f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: protocol.snapshot_id, mappings: [], expectedRevision: 0, confirmation: 'DRAFT',
  });
  assert.equal(first.status, 'PARTIAL');
  const mappings = [1, 2].map((order) => ({
    step_order: order, status: 'MAPPED', request: `命令 0${order}`, observation: '核对实际状态和值',
    source_refs: [{ snapshot_id: protocol.snapshot_id, segment_id: `segment-${order}`, quote_sha256: protocol.segments[order - 1].quote_sha256 }],
  }));
  const second = await f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: protocol.snapshot_id, mappings, expectedRevision: 1,
    confirmation: 'CONFIRM', reviewer: '测试工程师',
  });
  assert.equal(second.version, 2);
  assert.equal(second.status, 'COMPLETE');
  assert.equal(second.confirmation_status, 'CONFIRMED');
  const third = await f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: protocol.snapshot_id, expectedRevision: 2, confirmation: 'DRAFT',
    mappings: [{ ...mappings[0], status: 'CONFLICT' }], proposedCaseRevision: { expected: '改成故障' },
  });
  assert.equal(third.status, 'CONFLICT');
  for (const confirmation of ['DRAFT', 'CONFIRM']) {
    await assert.rejects(f.manager.createBinding(PROJECT_A, {
      caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
      protocolSourceId: protocol.snapshot_id, mappings, expectedRevision: third.version,
      confirmation, reviewer: '测试工程师',
    }), /BINDING_CONFLICT_UNRESOLVED/);
  }
  await assert.rejects(f.manager.createBindingRevision(PROJECT_A, {
    caseId: 'case-bbbbbbbb', bindingVersion: third.version,
  }), /BINDING_REVISION_REQUIREMENTS_SOURCE_REQUIRED/);
  const stored = await f.manager.getBindings(PROJECT_A, 'case-bbbbbbbb');
  assert.equal(stored.bindings.length, 3);
  assert.equal(stored.bindings[1].execution_ready, false);
  assert.deepEqual(f.projects.get(PROJECT_A).cases[0].versions[0].content, content);
  const otherProtocol = await f.manager.upload(PROJECT_A, { kind: 'PROTOCOL', fileName: 'protocol-v2.md',
    body: Buffer.from('命令 01 读取状态\n\n命令 02 读取电压') });
  const otherMappings = mappings.map((row, index) => ({ ...row, source_refs: [{
    snapshot_id: otherProtocol.snapshot_id, segment_id: otherProtocol.segments[index].segment_id,
    quote_sha256: otherProtocol.segments[index].quote_sha256,
  }] }));
  const otherSourceBinding = await f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: otherProtocol.snapshot_id, mappings: otherMappings,
    expectedRevision: third.version, confirmation: 'CONFIRM', reviewer: '测试工程师',
  });
  assert.equal(otherSourceBinding.status, 'COMPLETE');
  const revisedContent = structuredClone(content);
  revisedContent.steps[0].expected = '状态为故障';
  f.projects.get(PROJECT_A).cases[0].versions.push({ version: 2, content: revisedContent, content_sha256: 'case-sha-2' });
  f.projects.get(PROJECT_A).cases[0].current_version = 2;
  const revisedVersionBinding = await f.manager.createBinding(PROJECT_A, {
    caseId: 'case-bbbbbbbb', caseVersion: 2, caseContentSha256: 'case-sha-2',
    protocolSourceId: protocol.snapshot_id, mappings,
    expectedRevision: otherSourceBinding.version, confirmation: 'CONFIRM', reviewer: '测试工程师',
  });
  assert.equal(revisedVersionBinding.status, 'COMPLETE');
  await assert.rejects(f.manager.createBinding(PROJECT_B, {
    caseId: 'case-bbbbbbbb', caseVersion: 1, caseContentSha256: 'case-sha-1',
    protocolSourceId: protocol.snapshot_id, expectedRevision: 0,
  }), /BINDING_CASE_VERSION_MISMATCH/);
});

test('conflict binding creates one sourced revision design and only a reviewed expected change versions the same case', async (t) => {
  const f = await fixture((input) => {
    const source = input.source_segments[0];
    return { candidates: { UI: [], BACKEND: [{ content: {
      external_id: 'BE-REV-1', title: '重复编号拒绝', module: '', preconditions: '', test_data: '',
      steps: [{ order: 1, action: '提交重复编号', expected: '拒绝请求', source_refs: [
        { snapshot_id: source.snapshot_id, segment_id: source.segment_id, quote_sha256: source.quote_sha256 },
      ] }, { order: 2, action: '查询原记录', expected: '原记录仍存在', source_refs: [
        { snapshot_id: source.snapshot_id, segment_id: source.segment_id, quote_sha256: source.quote_sha256 },
      ] }],
    }, issues: [] }] }, issues: [] };
  });
  t.after(f.close);
  const source = await f.manager.upload(PROJECT_A, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from('重复编号应拒绝') });
  const firstDesign = await f.manager.createDesign(PROJECT_A, { sourceIds: [source.snapshot_id], scope: { mode: 'ALL' }, allowModelText: true });
  await f.manager.startGeneration(PROJECT_A, firstDesign.design_id, { revision: 1, allowModelText: true });
  const firstGenerated = await waitFor(f.manager, PROJECT_A, firstDesign.design_id, 'PENDING_REVIEW');
  const firstCandidate = firstGenerated.candidates.BACKEND[0];
  const initialReceipt = await f.manager.confirmCandidates(PROJECT_A, firstDesign.design_id, {
    revision: firstGenerated.revision, projectRevision: 1, candidateIds: [firstCandidate.candidate_id],
  });
  const caseId = initialReceipt.cases[0].case_id;
  const originalVersion = structuredClone(f.projects.get(PROJECT_A).cases[0].versions[0]);
  const protocol = await f.manager.upload(PROJECT_A, { kind: 'PROTOCOL', fileName: 'protocol.md', body: Buffer.from('冲突：重复编号返回错误码 02') });
  const binding = await f.manager.createBinding(PROJECT_A, {
    caseId, caseVersion: 1, caseContentSha256: originalVersion.content_sha256,
    protocolSourceId: protocol.snapshot_id, expectedRevision: 0, confirmation: 'DRAFT',
    mappings: [{ step_order: 1, status: 'CONFLICT', request: '提交编号', observation: '错误码 02',
      source_refs: [{ snapshot_id: protocol.snapshot_id, segment_id: protocol.segments[0].segment_id, quote_sha256: protocol.segments[0].quote_sha256 }] },
    { step_order: 2, status: 'MAPPED', request: '查询原记录', observation: '仍存在',
      source_refs: [{ snapshot_id: protocol.snapshot_id, segment_id: protocol.segments[0].segment_id, quote_sha256: protocol.segments[0].quote_sha256 }] }],
    conflictNote: '协议错误码与既有预期冲突',
  });
  assert.equal(binding.status, 'CONFLICT');
  const revisionDesign = await f.manager.createBindingRevision(PROJECT_A, { caseId, bindingVersion: binding.version });
  assert.equal(revisionDesign.status, 'PENDING_REVIEW');
  assert.equal(revisionDesign.model_requests.length, 0);
  assert.equal(revisionDesign.target_case.case_id, caseId);
  assert.equal(revisionDesign.candidates.UI.length, 0);
  assert.equal(revisionDesign.candidates.BACKEND[0].confirmation_status, 'PENDING_CONFIRMATION');
  assert.ok(revisionDesign.source_refs.some((ref) => ref.snapshot_id === protocol.snapshot_id));
  assert.ok(revisionDesign.candidates.BACKEND[0].issues.some((issue) => issue.code === 'BUSINESS_CONFLICT'));
  assert.equal((await f.manager.createBindingRevision(PROJECT_A, { caseId, bindingVersion: binding.version })).design_id, revisionDesign.design_id);
  const revisionCandidate = revisionDesign.candidates.BACKEND[0];
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, revisionDesign.design_id, {
    revision: revisionDesign.revision, projectRevision: 2, candidateIds: [revisionCandidate.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  const conflictIssue = revisionCandidate.issues.find((issue) => issue.code === 'BUSINESS_CONFLICT');
  const unchangedReview = await f.manager.editCandidate(PROJECT_A, revisionDesign.design_id, revisionCandidate.candidate_id, {
    revision: revisionDesign.revision,
    decisions: [{ issue_id: conflictIssue.issue_id, reviewer: '测试工程师', text: '核对协议错误码 02', step_order: 1 }],
  });
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, revisionDesign.design_id, {
    revision: unchangedReview.revision, projectRevision: 2, candidateIds: [revisionCandidate.candidate_id],
  }), /BINDING_REVISION_EXPECTED_UNCHANGED/);
  const changedContent = structuredClone(unchangedReview.candidates.BACKEND[0].content);
  changedContent.steps[0].expected = '拒绝请求并返回错误码 02';
  const smuggledAction = structuredClone(changedContent);
  smuggledAction.steps[1].action = '删除原记录';
  await assert.rejects(f.manager.editCandidate(PROJECT_A, revisionDesign.design_id, revisionCandidate.candidate_id, {
    revision: unchangedReview.revision, content: smuggledAction,
  }), /BINDING_REVISION_INPUT_CHANGED/);
  const smuggledData = structuredClone(changedContent);
  smuggledData.preconditions = '先删除数据库记录';
  smuggledData.test_data = '新编号';
  await assert.rejects(f.manager.editCandidate(PROJECT_A, revisionDesign.design_id, revisionCandidate.candidate_id, {
    revision: unchangedReview.revision, content: smuggledData,
  }), /BINDING_REVISION_INPUT_CHANGED/);
  const changed = await f.manager.editCandidate(PROJECT_A, revisionDesign.design_id, revisionCandidate.candidate_id, {
    revision: unchangedReview.revision, content: changedContent,
  });
  assert.ok(changed.candidates.BACKEND[0].issues.some((issue) => issue.code === 'REVISION_EXPECTED_REVIEW_REQUIRED'));
  await assert.rejects(f.manager.confirmCandidates(PROJECT_A, revisionDesign.design_id, {
    revision: changed.revision, projectRevision: 2, candidateIds: [revisionCandidate.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);
  const changedIssue = changed.candidates.BACKEND[0].issues.find((issue) => issue.code === 'REVISION_EXPECTED_REVIEW_REQUIRED');
  assert.ok(changedIssue);
  const approved = await f.manager.editCandidate(PROJECT_A, revisionDesign.design_id, revisionCandidate.candidate_id, {
    revision: changed.revision,
    decisions: [{ issue_id: changedIssue.issue_id, reviewer: '测试工程师', text: '评审确认错误码 02 为预期', step_order: 1 }],
  });
  const secondReceipt = await f.manager.confirmCandidates(PROJECT_A, revisionDesign.design_id, {
    revision: approved.revision, projectRevision: 2, candidateIds: [revisionCandidate.candidate_id],
  });
  assert.equal(secondReceipt.cases[0].case_id, caseId);
  assert.equal(secondReceipt.cases[0].version, 2);
  assert.deepEqual(f.projects.get(PROJECT_A).cases[0].versions[0], originalVersion);
  assert.equal((await f.manager.createBindingRevision(PROJECT_A, { caseId, bindingVersion: binding.version })).design_id, revisionDesign.design_id);
  await assert.rejects(f.manager.createBindingRevision(PROJECT_B, { caseId, bindingVersion: binding.version }), /BINDING_REVISION_INPUT_INVALID/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RequirementsManager } from '../server/requirements/manager.mjs';

const PROJECT = 'project-aaaaaaaa';
async function fixture(generate, sourceText = '有效预约可创建。') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirements-quality-'));
  const project = { project_id: PROJECT, revision: 1, cases: [], imports: [] };
  const calls = [];
  const manager = new RequirementsManager({ root,
    projectStore: { async getProject(id) { return id === PROJECT ? structuredClone(project) : null; } },
    modelClient: { model: 'substitute', requestProfile: { max_attempts: 1, max_output_tokens: 2000 },
      async generate(request) { calls.push(request); return generate(request, calls.length); } },
    confirmCases: async ({ candidates }) => ({ cases: candidates.map((candidate, index) => ({
      candidate_id: candidate.candidate_id, case_id: `case-aaaaaaaa${index}`, version: 1,
    })) }),
  });
  await manager.init();
  const source = await manager.upload(PROJECT, { kind: 'PRD', fileName: 'prd.md', body: Buffer.from(sourceText) });
  return { root, manager, project, source, calls, async close() { await manager.shutdown(); await fs.rm(root, { recursive: true, force: true }); } };
}
function candidate(input, candidateId) {
  const source = input.source_segments[0];
  const ref = { snapshot_id: source.snapshot_id, segment_id: source.segment_id, quote_sha256: source.quote_sha256 };
  return { ...(candidateId ? { candidate_id: candidateId } : {}), content: {
    external_id: 'BE-001', title: '有效预约', module: '', preconditions: '', test_data: '有效预约',
    steps: [{ order: 1, action: '提交有效预约', expected: '创建成功', source_refs: [ref] }],
  }, issues: [], design_check: { target: '有效预约', source_refs: [ref], prerequisites: [],
    text_lengths: [], time_ranges: [], state_transitions: [], observations: [] } };
}
function modelOutput(input, id = null) {
  return { candidates: { UI: [], BACKEND: [candidate(input, id)] }, issues: [],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
}
function reviewOutput(input, finding = null) {
  const ref = input.source_segments[0];
  return { reviews: input.candidates.map((item) => ({ candidate_id: item.candidate_id,
    verdict: finding ? 'NEEDS_REVISION' : 'NO_FINDINGS',
    findings: finding ? [{ code: 'MIXED_CAUSE', message: '非目标前提不完整', step_order: 1,
      source_refs: [{ snapshot_id: ref.snapshot_id, segment_id: ref.segment_id, quote_sha256: ref.quote_sha256 }] }] : [],
  })), coverage_findings: [], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } };
}
async function designAndStart(f, qualityMode = 'CHECKED', scope = '仅有效预约') {
  const design = await f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id],
    scope: { mode: 'SELECTED', description: scope }, allowModelText: true, qualityMode });
  await f.manager.startGeneration(PROJECT, design.design_id, { revision: 1, allowModelText: true });
  return design;
}
async function waitTerminal(manager, designId) {
  // This is a completion check, not a latency assertion. Concurrent filesystem
  // fixtures can exceed five seconds on Windows without a workflow failure.
  const deadline = Date.now() + 15000;
  let lastStatus;
  while (Date.now() < deadline) {
    const current = await manager.getDesign(PROJECT, designId);
    lastStatus = current.status;
    if (['PENDING_REVIEW', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(current.status)) return current;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`QUALITY_TEST_TIMEOUT: last_status=${lastStatus}`);
}

test('mode is fixed, SELECTED and text consent are required, STANDARD keeps one request', async (t) => {
  const f = await fixture(async ({ input }) => modelOutput(input));
  t.after(f.close);
  assert.deepEqual(f.manager.diagnostics().quality_modes, ['STANDARD', 'CHECKED']);
  await assert.rejects(f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id],
    scope: { mode: 'ALL_CURRENT' }, allowModelText: true, qualityMode: 'CHECKED' }), /REQUIREMENT_QUALITY_MODE_SCOPE_INVALID/);
  await assert.rejects(f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id],
    scope: { mode: 'SELECTED', description: '有效预约' }, allowModelText: false, qualityMode: 'CHECKED' }), /REQUIREMENT_QUALITY_MODE_SCOPE_INVALID/);
  await assert.rejects(f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id],
    scope: { mode: 'SELECTED', description: '有效预约' }, allowModelText: true, qualityMode: 'checked' }), /REQUIREMENT_QUALITY_MODE_INVALID/);
  const design = await designAndStart(f, 'STANDARD');
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.model_requests.length, 1);
  assert.equal(done.quality_mode, 'STANDARD');
  assert.equal(done.quality, undefined);
});

test('full STANDARD partitions output only, preserves complete sources and sums two actual request usages', async t => {
  const f = await fixture(async ({ input }) => {
    const row = candidate(input);
    const type = input.generation_partition.case_type;
    row.content.external_id = `${type}-001`;
    return { candidates: { UI: type === 'UI' ? [row] : [], BACKEND: type === 'BACKEND' ? [row] : [] }, issues: [],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
  });
  t.after(f.close);
  const mrd = await f.manager.upload(PROJECT, { kind: 'MRD', fileName: 'mrd.md', body: Buffer.from('独立读取预约结果。') });
  const d = await f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id, mrd.snapshot_id],
    scope: { mode: 'ALL_CURRENT' }, allowModelText: true });
  assert.equal(d.generation_budget.max_requests, 2);
  await f.manager.startGeneration(PROJECT, d.design_id, { revision: 1, allowModelText: true });
  const done = await waitTerminal(f.manager, d.design_id);
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls.map(x => x.input.generation_partition.case_type), ['UI','BACKEND']);
  assert.deepEqual(f.calls[0].input.source_segments, f.calls[1].input.source_segments);
  assert.equal(f.calls[0].input.source_segments.length, 2);
  assert.equal(done.candidates.UI.length, 1);
  assert.equal(done.candidates.BACKEND.length, 1);
  assert.deepEqual(done.model_requests.map(x => x.status), ['COMPLETED','COMPLETED']);
  assert.equal(done.generation.usage.total_tokens, 60);
  await assert.rejects(f.manager.startGeneration(PROJECT,d.design_id,{revision:done.revision,allowModelText:true}), /REQUIREMENT_MODEL_STATE_INVALID/);
});

test('second full STANDARD failure retains first draft, completed usage and rejected-call usage without replay', async t => {
  const f = await fixture(async ({ input }, number) => {
    if (number === 2) {
      const error = new Error('DEEPSEEK_OUTPUT_TRUNCATED');
      error.requirement_diagnostic = { error_code: error.message, usage: { total_tokens: 17 } };
      throw error;
    }
    return { candidates: { UI: [candidate(input)], BACKEND: [] }, issues: [], usage: { total_tokens: 30 } };
  });
  t.after(f.close);
  const d = await f.manager.createDesign(PROJECT,{sourceIds:[f.source.snapshot_id],scope:{mode:'ALL_CURRENT'},allowModelText:true});
  await f.manager.startGeneration(PROJECT,d.design_id,{revision:1,allowModelText:true});
  const done = await waitTerminal(f.manager,d.design_id);
  assert.equal(done.status,'FAILED');
  assert.equal(done.candidates.UI.length,1);
  assert.equal(done.candidates.BACKEND.length,0);
  assert.deepEqual(done.model_requests.map(x=>x.status),['COMPLETED','FAILED']);
  assert.equal(done.model_requests[0].usage.total_tokens,30);
  assert.equal(done.generation.usage.total_tokens,47);
  assert.equal(f.calls.length,2);
  await assert.rejects(f.manager.startGeneration(PROJECT,d.design_id,{revision:done.revision,allowModelText:true}),/REQUIREMENT_MODEL_BUDGET_EXHAUSTED/);
});

test('cancelling second partition preserves first success and releases the model slot', async t => {
  let entered;
  const second = new Promise(resolve => { entered = resolve; });
  const f = await fixture(async ({ input, signal }, number) => {
    if (number === 1) return { candidates: {UI:[candidate(input)],BACKEND:[]},issues:[],usage:{total_tokens:30} };
    entered();
    await new Promise((_,reject) => signal.addEventListener('abort',()=>reject(new Error('REQUIREMENT_MODEL_CANCELLED')),{once:true}));
  });
  t.after(f.close);
  const d = await f.manager.createDesign(PROJECT,{sourceIds:[f.source.snapshot_id],scope:{mode:'ALL_CURRENT'},allowModelText:true});
  const start = await f.manager.startGeneration(PROJECT,d.design_id,{revision:1,allowModelText:true});
  await second;
  await f.manager.cancelGeneration(PROJECT,start.task_id);
  const done = await waitTerminal(f.manager,d.design_id);
  assert.equal(done.status,'CANCELLED');
  assert.deepEqual(done.model_requests.map(x=>x.status),['COMPLETED','CANCELLED']);
  assert.equal(done.candidates.UI.length,1);
  assert.equal(done.generation.usage.total_tokens,30);
  assert.equal(f.calls.length,2);
  assert.equal(f.manager.diagnostics().active,null);
});

test('full partition cannot leak cases into the other lane', async t => {
  const f = await fixture(async ({input})=>modelOutput(input));
  t.after(f.close);
  const d = await f.manager.createDesign(PROJECT,{sourceIds:[f.source.snapshot_id],scope:{mode:'ALL_CURRENT'},allowModelText:true});
  await f.manager.startGeneration(PROJECT,d.design_id,{revision:1,allowModelText:true});
  const done = await waitTerminal(f.manager,d.design_id);
  assert.equal(done.status,'FAILED');
  assert.equal(done.generation.error,'REQUIREMENT_MODEL_PARTITION_INVALID');
  assert.equal(f.calls.length,1);
  assert.equal(done.candidates.BACKEND.length,0);
});

test('cancel after reservation but before dispatch retains NOT_SENT ledger and makes zero model calls', async (t) => {
  const f = await fixture(async () => { throw new Error('SHOULD_NOT_CALL_MODEL'); });
  t.after(f.close);
  const getDesign = f.manager.store.getDesign.bind(f.manager.store);
  f.manager.store.getDesign = async (...args) => {
    const design = await getDesign(...args);
    if (design?.status === 'RUNNING' && design.model_requests.at(-1)?.status === 'RESERVED') {
      await f.manager.cancelGeneration(PROJECT, design.generation.task_id);
    }
    return design;
  };
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'CANCELLED');
  assert.equal(f.calls.length, 0);
  assert.equal(done.model_requests.length, 1);
  assert.equal(done.model_requests[0].status, 'CANCELLED');
  assert.equal(done.model_requests[0].dispatch_state, 'NOT_SENT');
  assert.equal(done.quality.usage_summary.not_sent_requests, 1);
  assert.equal(done.quality.usage_summary.unknown_requests, 0);
  await assert.rejects(f.manager.startGeneration(PROJECT, design.design_id, {
    revision: done.revision, allowModelText: true,
  }), /REQUIREMENT_MODEL_STATE_INVALID|REQUIREMENT_MODEL_BUDGET_EXHAUSTED/);
});

test('cancel a sent stage preserves diagnostic usage and cannot send the next stage', async (t) => {
  const f = await fixture(async ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('MODEL_ABORTED');
      error.requirement_diagnostic = { usage: { total_tokens: 9, prompt_tokens: 6, completion_tokens: 3 } };
      reject(error);
    }, { once: true });
  }));
  t.after(f.close);
  const design = await designAndStart(f);
  const deadline = Date.now() + 3000;
  while (f.calls.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls.length, 1);
  await f.manager.cancelGeneration(PROJECT, `generation-${design.design_id}`);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'CANCELLED');
  assert.deepEqual(done.model_requests.map(item => item.stage), ['GENERATE']);
  assert.equal(done.model_requests[0].status, 'CANCELLED');
  assert.equal(done.model_requests[0].usage.total_tokens, 9);
  assert.equal(done.quality.usage_summary.known_requests, 1);
  assert.equal(done.generation.usage.total_tokens, 9);
});

test('clean CHECKED design reserves and completes GENERATE then REVIEW only', async (t) => {
  const f = await fixture(async ({ input }) => input.candidates ? reviewOutput(input) : modelOutput(input));
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.equal(done.quality.review_completed, true);
  assert.deepEqual(done.model_requests.map(item => item.stage), ['GENERATE', 'REVIEW']);
  assert.deepEqual(done.model_requests.map(item => item.status), ['COMPLETED', 'COMPLETED']);
  assert.equal(done.quality.snapshots.length, 1);
  assert.equal(done.quality.reviews.length, 1);
  assert.equal(done.quality.usage_summary.known_requests, 2);
  assert.equal(done.quality.usage_summary.tokens.total_tokens, 40);
  const polled = await f.manager.getGeneration(PROJECT, `generation-${design.design_id}`);
  assert.equal(polled.request_count, 2);
  assert.equal(polled.usage_summary.request_count, 2);
  assert.equal(polled.usage_summary.tokens.total_tokens, 40);
  assert.equal(done.candidates.BACKEND[0].quality_check.status, 'CHECKED');
  assert.equal(done.candidates.BACKEND[0].quality_review.status, 'REVIEWED');
  assert.equal(new Set(done.model_requests.map(item => item.input_sha256)).size, 2);
});

test('finding triggers one identity-preserving REPAIR and complete RECHECK, retaining earlier snapshots and requests', async (t) => {
  let originalId;
  const f = await fixture(async ({ input }) => {
    if (input.original_candidates) return modelOutput(input, originalId);
    if (input.candidates) {
      const firstReview = !originalId;
      originalId = input.candidates[0].candidate_id;
      return reviewOutput(input, firstReview);
    }
    return modelOutput(input);
  });
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.deepEqual(done.model_requests.map(item => item.stage), ['GENERATE', 'REVIEW', 'REPAIR', 'RECHECK']);
  assert.equal(done.quality.snapshots.length, 2);
  assert.equal(done.quality.reviews.length, 2);
  assert.equal(done.quality.snapshots[0].candidates.BACKEND[0].candidate_id,
    done.quality.snapshots[1].candidates.BACKEND[0].candidate_id);
});

test('repair cannot replace an original candidate identity and cannot obtain a clean review by deletion', async (t) => {
  let originalId;
  const f = await fixture(async ({ input }) => {
    if (input.original_candidates) {
      const output = modelOutput(input, 'candidate-forged-replacement');
      return output;
    }
    if (input.candidates) {
      originalId = input.candidates[0].candidate_id;
      return reviewOutput(input, true);
    }
    return modelOutput(input);
  });
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'FAILED');
  assert.equal(done.generation.error, 'REQUIREMENT_QUALITY_REPAIR_IDENTITY_INVALID');
  assert.deepEqual(done.model_requests.map(item => item.stage), ['GENERATE', 'REVIEW', 'REPAIR']);
  assert.ok(done.model_requests.every(item => item.status === 'COMPLETED'));
  assert.equal(done.candidates.BACKEND[0].candidate_id, originalId);
  assert.equal(done.quality.snapshots.length, 1);
  assert.equal(done.quality.failed_stage_output.stage, 'REPAIR');
  assert.equal(done.quality.failed_stage_output.safe.candidate_ids.BACKEND[0].candidate_id, 'candidate-forged-replacement');
});

test('review omission or forged source fails closed while retaining candidate, paid usage and diagnostic hash', async (t) => {
  for (const invalid of ['OMITTED', 'FORGED']) {
    const f = await fixture(async ({ input }) => {
      if (!input.candidates) return modelOutput(input);
      if (invalid === 'OMITTED') return { reviews: [], coverage_findings: [], usage: { total_tokens: 7 } };
      const result = reviewOutput(input, true);
      result.reviews[0].findings[0].source_refs[0].quote_sha256 = 'forged';
      return result;
    });
    t.after(f.close);
    const design = await designAndStart(f);
    const done = await waitTerminal(f.manager, design.design_id);
    assert.equal(done.status, 'FAILED');
    assert.equal(done.generation.error, 'REQUIREMENT_QUALITY_REVIEW_INVALID');
    assert.deepEqual(done.model_requests.map(item => item.status), ['COMPLETED', 'COMPLETED']);
    assert.equal(done.quality.review_completed, false);
    assert.equal(done.candidates.BACKEND.length, 1);
    assert.equal(done.quality.snapshots.length, 1);
    assert.equal(done.quality.failed_stage_output.stage, 'REVIEW');
    assert.match(done.quality.failed_stage_output.output_sha256, /^[a-f0-9]{64}$/);
    if (invalid === 'FORGED') {
      assert.equal(done.quality.failed_stage_output.safe.reviews[0].findings[0].source_refs[0].quote_sha256, 'forged');
    }
    await assert.rejects(f.manager.startGeneration(PROJECT, design.design_id, {
      revision: done.revision, allowModelText: true,
    }), /REQUIREMENT_MODEL_BUDGET_EXHAUSTED|REQUIREMENT_MODEL_STATE_INVALID/);
    assert.equal(f.calls.length, 2);
  }
});

test('usage with null total remains unknown rather than a zero-cost claim', async (t) => {
  const f = await fixture(async ({ input }) => {
    if (!input.candidates) return modelOutput(input);
    const result = reviewOutput(input);
    result.usage = { total_tokens: null, prompt_tokens: 5 };
    return result;
  });
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.equal(done.quality.usage_summary.known_requests, 1);
  assert.equal(done.quality.usage_summary.unknown_requests, 1);
  assert.equal(done.generation.usage.total_tokens, 30);
});

test('a transient completion write failure retains returned usage and never starts another stage', async (t) => {
  const f = await fixture(async ({ input }) => modelOutput(input));
  t.after(f.close);
  const original = f.manager.store.updateDesign.bind(f.manager.store);
  let injected = false;
  f.manager.store.updateDesign = async (projectId, designId, revision, mutate) => {
    const draft = structuredClone(await f.manager.store.getDesign(projectId, designId));
    const proposed = mutate(draft);
    if (!injected && proposed.model_requests?.some(request => request.status === 'COMPLETED')) {
      injected = true;
      throw new Error('SYNTHETIC_COMPLETION_WRITE_FAILED');
    }
    return original(projectId, designId, revision, mutate);
  };
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(injected, true);
  assert.equal(done.status, 'FAILED');
  assert.equal(done.model_requests[0].usage.total_tokens, 30);
  assert.equal(done.generation.usage.total_tokens, 30);
  assert.equal(f.calls.length, 1);
  assert.equal(done.quality.review_completed, undefined);
});

test('restart marks a reserved stage NOT_SENT and interrupted without resending', async (t) => {
  const f = await fixture(async () => { throw new Error('SHOULD_NOT_CALL_MODEL'); });
  t.after(f.close);
  const design = await f.manager.createDesign(PROJECT, { sourceIds: [f.source.snapshot_id],
    scope: { mode: 'SELECTED', description: '仅有效预约' }, allowModelText: true, qualityMode: 'CHECKED' });
  await f.manager.store.updateDesign(PROJECT, design.design_id, design.revision, (current) => {
    current.status = 'RUNNING';
    current.generation = { task_id: `generation-${design.design_id}`, status: 'RUNNING', stage: 'GENERATE' };
    current.model_requests = [{ request_id: 'request-restart', stage: 'GENERATE', status: 'RESERVED',
      input_sha256: 'frozen-input', usage: null }];
    return current;
  });
  const restarted = new RequirementsManager({ root: f.root,
    projectStore: { async getProject() { return structuredClone(f.project); } },
    modelClient: { async generate() { throw new Error('SHOULD_NOT_CALL_MODEL'); } },
  });
  await restarted.init();
  t.after(() => restarted.shutdown());
  const done = await restarted.getDesign(PROJECT, design.design_id);
  assert.equal(done.status, 'INTERRUPTED');
  assert.equal(done.model_requests[0].status, 'INTERRUPTED');
  assert.equal(done.model_requests[0].dispatch_state, 'NOT_SENT');
  assert.equal(done.quality.usage_summary.not_sent_requests, 1);
  assert.equal(done.quality.usage_summary.unknown_requests, 0);
  assert.equal(f.calls.length, 0);
});

test('repaired calculation replaces old program/review findings in current candidate but keeps original snapshot', async (t) => {
  let originalId;
  const f = await fixture(async ({ input }) => {
    if (input.original_candidates) {
      const output = modelOutput(input, originalId);
      output.candidates.BACKEND[0].content.test_data = '有效预约 abc';
      output.candidates.BACKEND[0].design_check.text_lengths = [
        { label: '用途', value: 'abc', trim: false, claimed_length: 3, step_order: 1 },
      ];
      return output;
    }
    if (input.candidates) {
      const first = !originalId;
      originalId = input.candidates[0].candidate_id;
      return reviewOutput(input, first);
    }
    const output = modelOutput(input);
    output.candidates.BACKEND[0].content.test_data = '有效预约 abc';
    output.candidates.BACKEND[0].design_check.text_lengths = [
      { label: '用途', value: 'abc', trim: false, claimed_length: 4, step_order: 1 },
    ];
    return output;
  });
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.equal(done.quality.snapshots.length, 2);
  assert.ok(done.quality.snapshots[0].candidates.BACKEND[0].issues.some(item => item.code === 'DESIGN_CHECK_LENGTH_MISMATCH'));
  assert.ok(!done.candidates.BACKEND[0].issues.some(item => item.code === 'DESIGN_CHECK_LENGTH_MISMATCH' || item.code === 'MIXED_CAUSE'));
  assert.equal(done.candidates.BACKEND[0].quality_check.status, 'CHECKED');
  assert.equal(done.quality.reviews[0].result.reviews[0].findings[0].code, 'MIXED_CAUSE');
});

test('sourced unreachable page finding blocks confirmation until content and human decisions are revised', async (t) => {
  let originalId;
  const sourceText = '固定8本图书，编号BK-001至BK-008；每页5条。按编号搜索BK-001只匹配BK-001，筛选后仅一页。';
  const f = await fixture(async ({ input }) => {
    if (input.candidates) {
      originalId ||= input.candidates[0].candidate_id;
      const review = reviewOutput(input, true);
      review.reviews[0].findings[0].code = 'PAGE_UNREACHABLE';
      review.reviews[0].findings[0].message = 'BK-001筛选后仅1条，不能进入第2页。';
      return review;
    }
    const output = modelOutput(input, input.original_candidates ? originalId : null);
    const row = output.candidates.BACKEND[0];
    row.content.external_id = 'BE-BK-R8-UNREACHABLE';
    row.content.title = '筛选后翻到第2页';
    row.content.preconditions = '固定8本，BK-001筛选后仅1条。';
    row.content.test_data = '搜索词BK-001；每页5条。';
    row.content.steps[0].action = '按BK-001筛选后翻到第2页';
    row.content.steps[0].expected = '第2页显示筛选结果';
    row.design_check.target = 'BK-001';
    return output;
  }, sourceText);
  t.after(f.close);
  const design = await designAndStart(f, 'CHECKED', '图书筛选与分页');
  const done = await waitTerminal(f.manager, design.design_id);
  const row = done.candidates.BACKEND[0];
  assert.equal(done.status, 'PENDING_REVIEW');
  assert.equal(done.quality.reviews.length, 2);
  assert.equal(done.quality.reviews[1].result.reviews[0].findings[0].code, 'PAGE_UNREACHABLE');
  assert.ok(row.issues.some(item => item.code === 'PAGE_UNREACHABLE' && item.origin === 'QUALITY_REVIEW' && !item.resolved_at));
  await assert.rejects(f.manager.confirmCandidates(PROJECT, design.design_id, {
    revision: done.revision, projectRevision: 1, candidateIds: [row.candidate_id],
  }), /REQUIREMENT_CONFIRM_BLOCKED/);

  const content = structuredClone(row.content);
  content.steps[0].action = '按BK-001筛选，观察当前页';
  content.steps[0].expected = '仅BK-001，只有第1页';
  const issueDecisions = row.issues.filter(item => item.severity !== 'INFO' && !item.resolved_at).map(item => ({
    issue_id: item.issue_id, reviewer: '测试工程师', text: 'PRD明确筛选后只有一页，删除不可达的第二页动作。', step_order: 1,
  }));
  const revised = await f.manager.editCandidate(PROJECT, design.design_id, row.candidate_id, {
    revision: done.revision, content, decisions: issueDecisions,
  });
  const stale = revised.candidates.BACKEND[0].issues.filter(item => item.code === 'QUALITY_CONTENT_CHANGED' && !item.resolved_at);
  assert.ok(stale.length > 0);
  const decided = await f.manager.editCandidate(PROJECT, design.design_id, row.candidate_id, {
    revision: revised.revision, decisions: stale.map(item => ({ issue_id: item.issue_id,
      reviewer: '测试工程师', text: '按同一PRD确认新动作与预期。', step_order: 1 })),
  });
  const receipt = await f.manager.confirmCandidates(PROJECT, design.design_id, {
    revision: decided.revision, projectRevision: 1, candidateIds: [row.candidate_id],
  });
  assert.equal(receipt.cases.length, 1);
  assert.equal(f.calls.length, 4);
});

test('human content edits become STALE and require current step decision before confirmation', async (t) => {
  const f = await fixture(async ({ input }) => input.candidates ? reviewOutput(input) : modelOutput(input));
  t.after(f.close);
  const design = await designAndStart(f);
  const done = await waitTerminal(f.manager, design.design_id);
  const candidateId = done.candidates.BACKEND[0].candidate_id;
  const firstContent = structuredClone(done.candidates.BACKEND[0].content);
  firstContent.steps[0].expected = '首次人工核对的结果';
  const changed = await f.manager.editCandidate(PROJECT, design.design_id, candidateId, {
    revision: done.revision, content: firstContent,
  });
  assert.equal(changed.quality.review_completed, true);
  assert.equal(changed.candidates.BACKEND[0].quality_review.status, 'STALE');
  const issue1 = changed.candidates.BACKEND[0].issues.find(item => item.code === 'QUALITY_CONTENT_CHANGED');
  await assert.rejects(f.manager.confirmCandidates(PROJECT, design.design_id, {
    revision: changed.revision, projectRevision: 1, candidateIds: [candidateId],
  }), /REQUIREMENT_CONFIRM_BLOCKED|REQUIREMENT_QUALITY_STALE_DECISION_REQUIRED/);
  const decided1 = await f.manager.editCandidate(PROJECT, design.design_id, candidateId, {
    revision: changed.revision, decisions: [{ issue_id: issue1.issue_id, reviewer: '人工核对者',
      text: '按来源核对首次人工预期', step_order: 1 }],
  });
  const secondContent = structuredClone(decided1.candidates.BACKEND[0].content);
  secondContent.steps[0].expected = '再次人工核对的结果';
  const changedAgain = await f.manager.editCandidate(PROJECT, design.design_id, candidateId, {
    revision: decided1.revision, content: secondContent,
  });
  const issue2 = changedAgain.candidates.BACKEND[0].issues.filter(item => item.code === 'QUALITY_CONTENT_CHANGED').at(-1);
  const decided2 = await f.manager.editCandidate(PROJECT, design.design_id, candidateId, {
    revision: changedAgain.revision, decisions: [{ issue_id: issue2.issue_id, reviewer: '人工核对者',
      text: '按来源核对最终人工预期', step_order: 1 }],
  });
  assert.equal(decided2.candidates.BACKEND[0].quality_review.status, 'STALE');
  const receipt = await f.manager.confirmCandidates(PROJECT, design.design_id, {
    revision: decided2.revision, projectRevision: 1, candidateIds: [candidateId],
  });
  assert.equal(receipt.cases.length, 1);
  assert.equal(f.calls.length, 2);
});

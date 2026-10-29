import test from 'node:test';
import assert from 'node:assert/strict';
import { caseType, candidateBlockers, bindingMissingSteps, editableMapping, copyPreviousInterfaceMapping, candidateDetail, caseCorrectionContent, correctionInitialSelection, candidateEditContent, candidateContentFromPanel, formatSourceLocation, parseRequirementsScopePlan, startNextRequirementsScope, finishRequirementsScope, modelProposalDetail, qualityCandidateDetail, qualityDesignDetail, qualityRequestLimit, qualityProgressLabel, qualityConfirmationPending, generationNeedsReconciliation, generationTerminalMessage, generationStatusHtml, cacheBindingDraft, restoreBindingDraft, persistBindingFormEvent, renderRequirements, generationFailureHtml, disposeRequirementsPolling } from '../web-v2/requirements.js';

test('terminal generation reconciles only its current running design and gives a reviewable outcome', () => {
  const design = { generation: { task_id: 'task-current', status: 'RUNNING' } };
  assert.equal(generationNeedsReconciliation(design, { task_id: 'task-current', status: 'COMPLETED' }), true);
  assert.equal(generationNeedsReconciliation(design, { task_id: 'task-current', status: 'FAILED' }), true);
  assert.equal(generationNeedsReconciliation(design, { task_id: 'task-current', status: 'RUNNING' }), false);
  assert.equal(generationNeedsReconciliation({ generation: { task_id: 'task-current', status: 'CANCEL_REQUESTED' } }, { task_id: 'task-current', status: 'CANCEL_REQUESTED' }), false);
  assert.equal(generationNeedsReconciliation({ generation: { task_id: 'task-current', status: 'CANCEL_REQUESTED' } }, { task_id: 'task-current', status: 'CANCELLED' }), true);
  assert.equal(generationNeedsReconciliation(design, { task_id: 'task-old', status: 'COMPLETED' }), false);
  assert.equal(generationNeedsReconciliation(design, null), false);
  assert.equal(generationTerminalMessage({ status: 'COMPLETED' }, 9, 7), '资料分析已结束：前端 9 条、后端 7 条候选待人工审阅。');
  assert.match(generationTerminalMessage({ status: 'COMPLETED' }), /查看已保存/);
  assert.match(generationTerminalMessage({ status: 'FAILED' }), /不会自动重试/);
});

test('quality display distinguishes stale evidence from approval and escapes model findings', () => {
  const candidate = { quality_check: { status: 'STALE', findings: [{ code: 'LENGTH', message: '<script>wrong length</script>', step_order: 2 }], calculations: [{ actual: 6, expected: 9 }] },
    quality_review: { status: 'STALE', verdict: 'NO_FINDINGS', findings: [] } };
  const before = structuredClone(candidate);
  const html = qualityCandidateDetail(candidate);
  assert.match(html, /旧检查已失效/);
  assert.match(html, /须逐项记录人工核对决定/);
  assert.match(html, /&lt;script&gt;wrong length&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<input|<button|<textarea/);
  assert.deepEqual(candidate, before);
  assert.equal(qualityCandidateDetail({}), '');
});

test('quality mode cost disclosure and failed-stage evidence do not imply successful review', () => {
  assert.equal(qualityRequestLimit('CHECKED'), 4);
  assert.equal(qualityRequestLimit('STANDARD'), 1);
  const design = { model_requests: [{ stage: 'GENERATE' }, { stage: 'REVIEW' }], quality: {
    mode: 'CHECKED', stage: 'REVIEW', status: 'FAILED', snapshots: [{ stage: 'GENERATE', candidates: {} }], reviews: [],
  } };
  assert.match(qualityProgressLabel(design), /独立审查.*已登记 2 \/ 最多 4.*失败/);
  assert.match(qualityProgressLabel(design, { stage: 'RECHECK', request_count: 4 }), /复审修订稿.*已登记 4/);
  assert.match(qualityDesignDetail(design), /1 份稿件 \/ 0 次审查/);
  assert.match(qualityDesignDetail(design), /失败或取消保留已有稿件/);
  assert.equal(qualityDesignDetail({ quality: { mode: 'STANDARD' } }), '');
});

test('unresolved model proposal is read-only, escaped, and separate from the current expected result', () => {
  const candidate = { content: { steps: [{ order: 1, action: '申请', expected: '' }] }, model_proposal: { content: {
    preconditions: '<img src=x onerror=alert(1)>', test_data: '原始数据',
    steps: [{ order: 1, action: '申请', expected: '<script>错误确定值</script>', source_refs: [] }],
  } } };
  const before = structuredClone(candidate);
  const html = modelProposalDetail(candidate);
  assert.match(html, /<summary>模型原提议（生成时未确认）<\/summary>/);
  assert.match(html, /&lt;script&gt;错误确定值&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img|<textarea|<input|<button/);
  assert.deepEqual(candidate, before);
  assert.equal(modelProposalDetail({ content: before.content }), '');
});

test('explicit scope plans are bounded to four nonempty user-defined scopes', () => {
  assert.deepEqual(parseRequirementsScopePlan('搜索\n借阅\n归还'), ['搜索', '借阅', '归还']);
  assert.throws(() => parseRequirementsScopePlan(''), /至少填写一个/);
  assert.throws(() => parseRequirementsScopePlan('a\nb\nc\nd\ne'), /最多规划 4 份/);
  assert.throws(() => parseRequirementsScopePlan('x'.repeat(2001)), /最多 2000 个字符/);
});

test('scope scheduler starts two frozen designs serially, only after each terminal result', async () => {
  const plan = { confirmed: true, allowModelText: true, allowModelImages: false, items: [
    { designId: 'design-one', scope: '第一份', status: 'PREPARED' },
    { designId: 'design-two', scope: '第二份', status: 'PREPARED' },
  ] };
  const started = [];
  const api = {
    getDesign: async id => ({ design_id: id, revision: 3 }),
    startGeneration: async (_project, id, body) => { started.push({ id, body }); return { task_id: `generation-${id}` }; },
  };
  const first = await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api });
  assert.equal(first.taskId, 'generation-design-one');
  assert.equal(started.length, 1);
  assert.equal(await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api }), null);
  assert.equal(finishRequirementsScope(plan, first.taskId, { status: 'COMPLETED', usage: { total_tokens: 12 } }), true);
  const second = await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api });
  assert.equal(second.taskId, 'generation-design-two');
  assert.equal(started.length, 2);
  assert.equal(started[1].body.revision, 3);
  assert.equal(finishRequirementsScope(plan, second.taskId, { status: 'FAILED', error: 'OUTPUT_TRUNCATED' }), true);
  assert.equal(await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api }), null);
  assert.deepEqual(plan.items.map(item => item.status), ['COMPLETED', 'FAILED']);
  assert.equal(finishRequirementsScope(plan, first.taskId, { status: 'COMPLETED' }), false);
});

test('render competition and page leave cannot double-submit; return reads the active task without replay', async () => {
  let active = true, releaseDesign;
  const designGate = new Promise(resolve => { releaseDesign = resolve; });
  const calls = [];
  const plan = { confirmed: true, allowModelText: true, items: [
    { designId: 'design-one', scope: '第一份', status: 'PREPARED' },
    { designId: 'design-two', scope: '第二份', status: 'PREPARED' },
  ] };
  const api = {
    getDesign: async id => id === 'design-one' ? designGate : ({ design_id: id, revision: 1 }),
    startGeneration: async (_project, id) => { calls.push(id); return { task_id: `generation-${id}` }; },
  };
  const firstPending = startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api, isActive: () => active });
  assert.equal(plan.items[0].status, 'STARTING');
  const competingRender = startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api, isActive: () => active });
  active = false;
  releaseDesign({ design_id: 'design-one', revision: 1 });
  assert.equal(await firstPending, null);
  assert.equal(await competingRender, null);
  assert.equal(plan.items[0].status, 'PREPARED');
  assert.deepEqual(calls, []);

  active = true;
  const first = await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api, isActive: () => active });
  assert.equal(first.taskId, 'generation-design-one');
  assert.deepEqual(calls, ['design-one']);
  plan.paused = true; // Same effect as disposing the route poller.
  assert.equal(finishRequirementsScope(plan, first.taskId, { status: 'COMPLETED' }), true);
  assert.equal(await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api, isActive: () => active }), null);
  assert.deepEqual(calls, ['design-one']);

  plan.paused = false; // User explicitly resumes the confirmed plan after return.
  const second = await startNextRequirementsScope(plan, { projectId: 'project-x', requirementsApi: api, isActive: () => active });
  assert.equal(second.taskId, 'generation-design-two');
  assert.deepEqual(calls, ['design-one', 'design-two']);
});

test('legacy cases remain unclassified until evidence names their type', () => {
  assert.equal(caseType({ external_id: 'OLD-01' }), null);
  assert.equal(caseType({ content: { case_type: 'BACKEND' } }), 'BACKEND');
});

test('unresolved source conflict prevents candidate confirmation', () => {
  const candidate = { issues: [
    { severity: 'INFO', code: 'FORMAT_NOTE' },
    { severity: 'CONFLICT', code: 'PRD_MRD_DISAGREE' },
    { severity: 'BLOCKING', code: 'REVIEWED', resolved_at: '2026-09-26T00:00:00Z' },
  ] };
  assert.deepEqual(candidateBlockers(candidate).map(issue => issue.code), ['PRD_MRD_DISAGREE']);
});

test('one unmapped business observation keeps the full binding incomplete', () => {
  const steps = [{ order: 1 }, { order: 2 }];
  const mappings = [
    { order: 1, command: 'READ', business_observation: 'read back status', source_refs: [
      { snapshot_id: 'protocol-1', segment_id: 'seg-1', quote_sha256: 'hash-1' },
    ] },
    { order: 2, command: 'WRITE', business_observation: '' },
  ];
  assert.deepEqual(bindingMissingSteps(steps, mappings), [2]);
});

test('typed mapping without a protocol quote remains a partial binding', () => {
  assert.deepEqual(bindingMissingSteps([{ order: 1 }], [
    { order: 1, command: 'READ', business_observation: 'read back status', source_refs: [] },
  ]), [1]);
});

test('saved backend mapping fields reopen as editable values', () => {
  const row = editableMapping({ step_order: 2, request: 'READ', observation: 'status = ready',
    unit: 'kW', source_refs: [{ snapshot_id: 'protocol-1', segment_id: 'seg-1', quote_sha256: 'hash-1' }] });
  assert.equal(row.order, 2);
  assert.equal(row.command, 'READ');
  assert.equal(row.business_observation, 'status = ready');
  assert.deepEqual(bindingMissingSteps([{ order: 2 }], [row]), []);
});

test('binding form input and reference change events cache drafts by case version and protocol', () => {
  const state = { bindingDrafts: {}, bindingReviewer: 'Reviewer' };
  const refs = [{ snapshot_id: 'protocol-a', segment_id: 'seg-a', quote_sha256: 'hash-a' }];
  const mappings = [{ order: 1, command: 'GET /thing', business_observation: 'thing appears', source_refs: refs }];
  const conflict = '协议状态与用例预期不同';
  const collectMappings = () => structuredClone(mappings);

  const formEvent = (type, target) => {
    const event = new Event(type);
    Object.defineProperty(event, 'target', { value: target });
    return event;
  };
  const quoteChange = formEvent('change', {
    dataset: { bindSourceRef: 'seg-a' }, value: '',
    matches: selector => selector.includes('[data-bind-source-ref]'),
  });
  assert.equal(persistBindingFormEvent(state, { caseKey: 'case-1:v2:sha2', protocolId: 'protocol-a', event: quoteChange, collectMappings, conflict }), true);
  assert.deepEqual(restoreBindingDraft(state, 'case-1:v2:sha2', 'protocol-a')?.mappings[0].source_refs, refs);
  const conflictInput = formEvent('input', {
    dataset: { bindConflict: '' }, value: conflict,
    matches: selector => selector.includes('[data-bind-conflict]'),
  });
  assert.equal(persistBindingFormEvent(state, { caseKey: 'case-1:v2:sha2', protocolId: 'protocol-a', event: conflictInput, collectMappings, conflict: '' }), true);

  assert.deepEqual(restoreBindingDraft(state, 'case-1:v2:sha2', 'protocol-a'), { mappings, reviewer: 'Reviewer', conflict });
  assert.equal(restoreBindingDraft(state, 'case-1:v2:sha2', 'protocol-b'), null);
  assert.equal(restoreBindingDraft(state, 'case-1:v1:sha1', 'protocol-a'), null);
  assert.equal(persistBindingFormEvent(state, { caseKey: 'case-1:v2:sha2', protocolId: 'protocol-a', event: formEvent('change', { matches: () => false }), collectMappings, conflict }), false);
});

test('copying prior interface material preserves current step observation and only current protocol quotes', () => {
  const prior = { order: 1, command: 'GET /v1/items/{id}', request_fields: 'id=fixture A', units: 'id: string',
    response_fields: 'data.id', cleanup: 'read-only', business_observation: 'item A exists', source_refs: [
      { snapshot_id: 'protocol-current', segment_id: 'segment-valid', quote_sha256: 'hash-valid' },
      { snapshot_id: 'protocol-old', segment_id: 'segment-old', quote_sha256: 'hash-old' },
      { snapshot_id: 'protocol-current', segment_id: 'segment-changed', quote_sha256: 'old-hash' },
    ] };
  const current = { order: 2, action: 'read item B', expected: 'item B is visible',
    command: '', business_observation: 'item B matches expected state', source_refs: [] };
  const copied = copyPreviousInterfaceMapping(prior, current, 'protocol-current', [
    { segment_id: 'segment-valid', quote_sha256: 'hash-valid' },
    { segment_id: 'segment-changed', quote_sha256: 'new-hash' },
  ]);
  assert.equal(copied.command, prior.command);
  assert.equal(copied.request_fields, prior.request_fields);
  assert.equal(copied.cleanup, prior.cleanup);
  assert.equal(copied.business_observation, current.business_observation);
  assert.equal(copied.action, current.action);
  assert.equal(copied.expected, current.expected);
  assert.deepEqual(copied.source_refs, [prior.source_refs[0]]);
  copied.source_refs[0].segment_id = 'local-edit';
  assert.equal(prior.source_refs[0].segment_id, 'segment-valid');
  assert.equal(copyPreviousInterfaceMapping({ command: '', source_refs: [] }, current,
    'protocol-current', []).command, '');
});

test('conflict revision edits expected without changing confirmed case identity or actions', () => {
  const candidate = { target_case: { case_id: 'case-1', case_version: 1 }, content: {
    external_id: 'BE-01', title: 'Original', module: 'Core', preconditions: 'ready', test_data: 'old',
    case_type: 'BACKEND', steps: [{ order: 1, action: 'WRITE', expected: 'old result', source_refs: [{ decision_id: 'd1' }] }],
  } };
  const result = candidateEditContent(candidate, { title: 'tampered', module: 'Other', preconditions: 'changed',
    test_data: 'changed', actions: { 1: 'DELETE' }, expecteds: { 1: 'revised result' } });
  assert.equal(result.title, 'Original');
  assert.equal(result.module, 'Core');
  assert.equal(result.preconditions, 'ready');
  assert.equal(result.test_data, 'old');
  assert.equal(result.steps[0].action, 'WRITE');
  assert.equal(result.steps[0].expected, 'revised result');
  assert.deepEqual(result.steps[0].source_refs, [{ decision_id: 'd1' }]);
});

test('case correction editor permits sourced step changes while freezing identity and old binding editor', () => {
  const candidate = { candidate_id: 'candidate-1', target_case: { case_id: 'case-1', case_version: 1 },
    content: { external_id: 'BE-R8', title: 'Old', module: 'Library', preconditions: '8 books', test_data: 'BK-001',
      case_type: 'BACKEND', steps: [{ order: 1, action: 'Old action', expected: 'Old result', source_refs: [] }] }, issues: [] };
  const source = { snapshot_id: 'source-1', kind: 'PRD', file_name: 'prd.md',
    segments: [{ segment_id: 'segment-1', quote_sha256: 'hash-1', text: 'Eight books', location: { line: 1 } }] };
  const correction = candidateDetail(candidate, true, [source], true, {
    revision_basis: { mode: 'CASE_DESIGN_CORRECTION' }, source_refs: [{ snapshot_id: 'source-1' }] });
  assert.match(correction, /data-correction-action/);
  assert.match(correction, /data-correction-ref/);
  assert.match(correction, /data-req-add-step/);
  assert.doesNotMatch(correction, /name="module"/);
  const oldBinding = candidateDetail(candidate, true, [source], true, { revision_basis: { binding_id: 'binding-1' } });
  assert.doesNotMatch(oldBinding, /data-correction-action|data-req-add-step|data-step-action/);
  const revised = caseCorrectionContent(candidate, { title: 'Reachable pages', preconditions: 'one match', test_data: 'BK-001',
    steps: [{ action: 'Search', expected: 'One result', source_refs: [{ snapshot_id: 'source-1', segment_id: 'segment-1', quote_sha256: 'hash-1' }] },
      { action: 'Clear filter', expected: 'Second page', source_refs: [{ snapshot_id: 'source-1', segment_id: 'segment-1', quote_sha256: 'hash-1' }] }] });
  assert.equal(revised.external_id, 'BE-R8');
  assert.equal(revised.case_type, 'BACKEND');
  assert.equal(revised.module, 'Library');
  assert.deepEqual(revised.steps.map(step => step.order), [1, 2]);
  assert.equal(candidate.content.steps.length, 1);
  assert.deepEqual(correctionInitialSelection({ revision_basis: { mode: 'CASE_DESIGN_CORRECTION' },
    candidates: { UI: [], BACKEND: [{ candidate_id: 'candidate-1', case_type: 'BACKEND' }] } }),
  { type: 'BACKEND', candidateId: 'candidate-1' });
  assert.equal(correctionInitialSelection({ revision_basis: { mode: 'BINDING_CONFLICT' },
    candidates: { UI: [], BACKEND: [{ candidate_id: 'candidate-1', case_type: 'BACKEND' }] } }), null);
});

test('source locations are readable without losing segment identity', () => {
  assert.equal(formatSourceLocation({ line: 7 }), '第 7 行');
  assert.equal(formatSourceLocation({ paragraph: 3 }), '第 3 段');
  assert.equal(formatSourceLocation({ table: 2, row: 4, cell: 1 }), '表 2 第 4 行第 1 列');
  assert.equal(formatSourceLocation({ line: 8 }, 'table_row'), '第 8 行（表格行）');
  assert.equal(formatSourceLocation({ other: 1 }), '位置待核对');
});

test('same-screen review submits the currently edited expectation with its decision', () => {
  const candidate = { target_case: { case_id: 'case-1', case_version: 1 }, content: {
    external_id: 'BE-01', title: 'Original', module: 'Core', preconditions: '', test_data: '',
    case_type: 'BACKEND', steps: [{ order: 1, action: '创建', expected: '原预期', source_refs: [] }],
  } };
  const currentExpected = '原预期；还须核对持久化';
  const panel = { querySelector(selector) {
    if (selector === '[data-step-expected]' || selector === '[data-step-expected="1"]') return { value: currentExpected };
    return null;
  } };
  const content = candidateContentFromPanel(candidate, panel);
  assert.equal(content.steps[0].expected, currentExpected);
  assert.equal(content.steps[0].action, '创建');
  assert.equal(candidate.content.steps[0].expected, '原预期');
  assert.equal(candidateContentFromPanel(candidate, { querySelector: () => null }), null);
});

test('checked confirmation waits for the whole workflow and preserves explicit human review after edits', () => {
  const design = { quality: { mode: 'CHECKED', status: 'REVIEWED', review_completed: true } };
  assert.equal(qualityConfirmationPending(design, { status: 'RUNNING' }), true);
  assert.equal(qualityConfirmationPending(design, { status: 'FAILED' }), true);
  assert.equal(qualityConfirmationPending(design, { status: 'COMPLETED' }), false);
  design.quality.status = 'STALE';
  assert.equal(qualityConfirmationPending(design, { status: 'COMPLETED' }), false);
  design.quality.review_completed = false;
  assert.equal(qualityConfirmationPending(design, { status: 'COMPLETED' }), true);
});


test('generation failure keeps technical usage and diagnosis inside closed details', () => {
  const task = { status: 'FAILED', error: { code: 'DEEPSEEK_CONNECTION_FAILED' }, usage: { total_tokens: 42 }, diagnostic: { network_error_code: '<unsafe>' } };
  const html = generationFailureHtml(task);
  const main = html.slice(0, html.indexOf('<details>'));
  assert.match(main, /未产出可审阅的测试用例/);
  assert.match(main, /工作台管理员/);
  assert.match(main, /不会自动重试/);
  assert.doesNotMatch(main, /token|费用|额度|DEEPSEEK|unsafe/);
  assert.match(html, /<details><summary>技术详情/);
  assert.match(html, /token：合计 42/);
  assert.doesNotMatch(html, /<details open>|<unsafe>/);
  assert.match(generationFailureHtml(task, 2), /已产出的用例草稿已保留/);
  assert.match(generationFailureHtml({ error: 'DEEPSEEK_OUTPUT_TRUNCATED' }), /缩小本轮范围/);
  assert.doesNotMatch(qualityDesignDetail({ quality: { mode: 'CHECKED', status: 'FAILED' } }), /data-req-quality-design open/);
});

test('explicit generate action submits selected text without a second consent and preserves optional images', async t => {
  const oldDocument = globalThis.document;
  let root, html = '';
  const calls = [];
  const project = { project_id: 'tester-simple-generation', name: 'Test' };
  const capabilities = { accepting: true, active: false, model_available: true, image_model_available: true, model: 'hidden-provider', quality_modes: ['CHECKED'] };
  const facade = {
    listSources: async () => ({ sources: [{ snapshot_id: 'prd', kind: 'PRD', file_name: 'req.md', embedded_images: [{ id: 'image' }] }], capabilities }),
    createDesign: async (_project, body) => { calls.push(['create', body]); return { design_id: 'new-design', revision: 1 }; },
    startGeneration: async (_project, _design, body) => { calls.push(['start', body]); return { task_id: 'new-task' }; },
  };
  const showPage = value => {
    if (root) root.isConnected = false;
    html = value;
    const listeners = {};
    const generate = { dataset: { reqGenerate: '' }, disabled: /data-req-generate[^>]*disabled/.test(html) };
    generate.closest = () => generate;
    root = { isConnected: true, listeners, generate,
      querySelectorAll: () => [], querySelector: selector => selector === '[data-req-generate]' ? generate : {},
      addEventListener: (event, handler) => { listeners[event] = handler; } };
  };
  globalThis.document = { querySelector: () => root };
  t.after(() => { disposeRequirementsPolling(); globalThis.document = oldDocument; });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await renderRequirements({ project, showPage, toast() {}, go() {}, requirementsApi: facade });
  assert.equal(root.generate.disabled, true);
  assert.deepEqual(calls, []);
  root.listeners.change({ target: { dataset: { reqSource: 'prd' }, checked: true } });
  await flush();
  assert.equal(root.generate.disabled, false);
  assert.doesNotMatch(html, /data-req-text-consent|允许本机已配置|hidden-provider|token|额度|费用/);
  assert.match(html, />生成测试用例<\/button>/);
  assert.match(html, /同时分析所选图片/);
  assert.doesNotMatch(html.match(/<input[^>]*data-req-image-consent[^>]*>/)[0], /checked/);
  assert.match(html, /<details class="req-generation-options"><summary>高级设置/);
  assert.deepEqual(calls, []);
  root.listeners.click({ target: root.generate });
  await flush();
  assert.deepEqual(calls.map(([kind]) => kind), ['create', 'start']);
  assert.equal(calls[0][1].allowModelText, true);
  assert.deepEqual(calls[0][1].sourceIds, ['prd']);
  assert.equal(calls[0][1].allowModelImages, false);
  assert.equal(calls[1][1].allowModelText, true);
  assert.equal(calls[1][1].allowModelImages, false);
  root.listeners.change({ target: { dataset: { reqImageConsent: '' }, checked: true } });
  await flush();
  assert.match(html.match(/<input[^>]*data-req-image-consent[^>]*>/)[0], /checked/);
  assert.equal(calls.length, 2);
  root.listeners.click({ target: root.generate });
  await flush();
  assert.equal(calls[2][1].allowModelImages, true);
  assert.equal(calls[3][1].allowModelImages, true);
  for (const [key, blocked, allowed] of [['active', true, false], ['model_available', false, true], ['accepting', false, true]]) {
    capabilities[key] = blocked;
    await renderRequirements({ project, showPage, toast() {}, go() {}, requirementsApi: facade });
    assert.equal(root.generate.disabled, true);
    root.listeners.click({ target: root.generate });
    await flush();
    assert.equal(calls.length, 4);
    capabilities[key] = allowed;
  }
  await renderRequirements({ project, showPage, toast() {}, go() {}, requirementsApi: facade });
  root.listeners.change({ target: { dataset: { reqQualityMode: '' }, checked: true } });
  await flush();
  assert.equal(root.generate.disabled, true); // Enhanced review still requires a selected scope.
  assert.equal(calls.length, 4);
});

// In-memory facade and DOM event harness only: no server, project store, or model.
async function requirementsHarness(t, projectId, overrides = {}, isCurrent = () => true) {
  const previousDocument = globalThis.document;
  let html, root;
  const project = { project_id: projectId, name: '范围核对', revision: 9 };
  const capabilities = { accepting: true, active: false, model_available: true, confirm_sink_available: true };
  const sources = [{ snapshot_id: 'source-a', kind: 'PRD', file_name: '需求.md' }, { snapshot_id: 'source-b', kind: 'MRD', file_name: '补充.md' }];
  const design = { design_id: 'design-1', revision: 2, issues: [], candidates: { UI: [1, 2, 3].map(index => ({ candidate_id: `candidate-${index}`, case_type: 'UI', confirmation_status: 'PENDING', issues: [], content: { external_id: `UI-00${index}`, title: `业务场景 ${index}`, steps: [{ order: 1, action: '读取', expected: '符合来源', source_refs: [] }] } })), BACKEND: [] } };
  const calls = [];
  const api = {
    listSources: async () => ({ sources, capabilities }),
    listDesigns: async () => ({ designs: [design] }), getDesign: async () => design,
    createDesign: async (_project, body) => { calls.push({ kind: 'create', body }); return { design_id: 'design-1', revision: 2 }; },
    startGeneration: async (_project, _design, body) => { calls.push({ kind: 'start', body }); return { task_id: 'task-1' }; },
    confirmCandidates: async (_project, _design, body) => {
      calls.push({ kind: 'confirm', body });
      for (const candidate of design.candidates.UI) if (body.candidateIds.includes(candidate.candidate_id)) candidate.confirmation_status = 'CONFIRMED';
      return { cases: body.candidateIds.map(id => ({ case_id: id, version: 1 })) };
    }, ...overrides,
  };
  const showPage = value => {
    if (root) root.isConnected = false;
    html = value;
    root = { isConnected: true, listeners: {}, nodes: {}, querySelectorAll: () => [],
      querySelector(selector) { return this.nodes[selector] ||= { value: '', innerHTML: '', textContent: '' }; },
      addEventListener(event, handler) { this.listeners[event] = handler; } };
  };
  globalThis.document = { querySelector: () => root };
  t.after(() => { disposeRequirementsPolling(); globalThis.document = previousDocument; });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const render = () => renderRequirements({ project, showPage, go() {}, toast() {}, requirementsApi: api, isCurrent });
  await render();
  return { calls, sources, design, capabilities, render,
    get html() { return html; }, get root() { return root; },
    async change(dataset, checked = true) { root.listeners.change({ target: { dataset, checked } }); await flush(); },
    async click(dataset) {
      const key = Object.keys(dataset)[0].replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
      const tag = html.match(new RegExp(`<button[^>]*data-${key}(?:=["'][^"']*["'])?[^>]*>`))?.[0] || '';
      const button = { dataset, disabled: /\bdisabled\b/.test(tag), closest: () => button };
      root.listeners.click({ target: button }); await flush();
    },
  };
}

test('V2 confirmation separates viewed unselected detail from the adjacent selected batch', async t => {
  const h = await requirementsHarness(t, 'v2-confirm-range');
  await h.change({ reqCandidate: 'candidate-1' });
  await h.change({ reqCandidate: 'candidate-2' });
  await h.click({ reqOpenCandidate: 'candidate-3' });
  assert.match(h.html, /当前查看 UI-003 · 未选入左侧批量操作/);
  assert.match(h.html, /data-req-selected-ids>UI-001 · UI-002<\/p>/);
  assert.match(h.html, /本次不包含右侧正在查看的 UI-003/);
  const listStart = h.html.indexOf('<aside class="req-candidate-list">');
  const listEnd = h.html.indexOf('</aside>', listStart);
  assert.ok(h.html.indexOf('data-req-confirm ', listStart) < listEnd);
  assert.ok(h.html.indexOf('data-req-confirm-current') > listEnd);
  await h.click({ reqConfirm: '' });
  assert.deepEqual(h.calls[0].body.candidateIds, ['candidate-1', 'candidate-2']);
  assert.equal(h.design.candidates.UI[2].confirmation_status, 'PENDING');
  await h.click({ reqConfirmCurrent: '' });
  assert.deepEqual(h.calls[1].body.candidateIds, ['candidate-3']);
  assert.equal(h.calls[0].body.revision, 2);
  assert.equal(h.calls[0].body.projectRevision, 9);
});

test('V2 removal excludes only that snapshot from the next generation request and preserves source history', async t => {
  const h = await requirementsHarness(t, 'v2-remove-source');
  await h.change({ reqSource: 'source-a' });
  await h.change({ reqSource: 'source-b' });
  assert.match(h.html, /data-req-remove-source="source-a"/);
  assert.match(h.html, /href="#\/projects\/v2-remove-source\/import"/);
  await h.click({ reqRemoveSource: 'source-a' });
  assert.doesNotMatch(h.html, /data-req-remove-source="source-a"/);
  assert.match(h.html, /data-req-source="source-a"/);
  assert.equal(h.sources.length, 2);
  assert.deepEqual(h.calls, []);
  await h.click({ reqGenerate: '' });
  assert.deepEqual(h.calls[0].body.sourceIds, ['source-b']);
  assert.equal(h.calls[0].body.allowModelImages, false);
});

test('V2 current and batch confirmation preserve quality, global, source and unavailable-sink gates', async t => {
  const h = await requirementsHarness(t, 'v2-confirm-gates');
  await h.change({ reqCandidate: 'candidate-1' });
  h.design.issues = [{ severity: 'BLOCKING', message: '业务范围未定' }];
  await h.render();
  await h.click({ reqConfirm: '' }); await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.calls.length, 0);
  h.design.issues = [];
  h.design.quality = { mode: 'CHECKED', review_completed: false };
  await h.render();
  await h.click({ reqConfirm: '' }); await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.calls.length, 0);
  delete h.design.quality;
  h.design.candidates.UI[0].issues = [{ severity: 'CONFLICT', message: '来源冲突' }];
  await h.render();
  await h.click({ reqConfirm: '' }); await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.calls.length, 0);
  h.design.candidates.UI[0].issues = [];
  h.sources[0].sections = { body: 'PARTIAL' };
  h.design.candidates.UI[0].content.steps[0].source_refs = [{ snapshot_id: 'source-a' }];
  await h.render();
  await h.click({ reqConfirm: '' }); await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.calls.length, 0);
  h.sources[0].sections.body = 'READ';
  h.capabilities.confirm_sink_available = false;
  await h.render();
  await h.click({ reqConfirm: '' }); await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.calls.length, 0);
});

test('V2 progress uses only reported stages and never invents processed file counts or percentages', () => {
  const html = generationStatusHtml({ status: 'RUNNING', stage: 'REVIEW', started_at: new Date(Date.now() - 65000).toISOString() });
  assert.match(html, /正在检查测试用例/);
  assert.match(html, /已用 1 分/);
  assert.match(html, /<progress aria-label=/);
  assert.doesNotMatch(html, /<progress[^>]*(?:value|max)=|已处理.*份|\d+%/);
  assert.match(generationStatusHtml({ status: 'CANCEL_REQUESTED' }), /正在取消用例生成/);
  assert.match(generationStatusHtml({ status: 'COMPLETED', started_at: '2026-10-01T00:00:00Z', finished_at: '2026-10-01T00:01:05Z' }), /已用 1 分 5 秒/);
});

test('V2 advanced scope panel stays open after selecting a scope and respects deliberate collapse', async t => {
  const h = await requirementsHarness(t, 'v2-scope-open');
  h.root.querySelector('.req-preparation-settings').open = true;
  h.root.listeners.change({ target: { dataset: { reqScope: '' }, value: 'SELECTED' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(h.html, /<details class="req-preparation-settings" open>/);
  assert.doesNotMatch(h.html.match(/<input[^>]*data-req-scope-text[^>]*>/)[0], /disabled/);
  h.root.querySelector('.req-preparation-settings').open = false;
  h.root.listeners.change({ target: { dataset: { reqScope: '' }, value: 'ALL' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(h.html, /<details class="req-preparation-settings">/);
  assert.match(h.html.match(/<input[^>]*data-req-scope-text[^>]*>/)[0], /disabled/);
  assert.deepEqual(h.calls, []);
});

test('V2 source history stays open for three selections and respects deliberate collapse on removal', async t => {
  const h = await requirementsHarness(t, 'v2-history-open');
  h.sources.push({ snapshot_id: 'source-c', kind: 'IMAGE', file_name: '公开合成.png' });
  await h.render();
  h.root.querySelector('.req-source-history').open = true;
  for (const id of ['source-a', 'source-b', 'source-c']) {
    await h.change({ reqSource: id });
    assert.match(h.html, /<details class="req-source-history" open>/);
    assert.match(h.html, new RegExp(`data-req-remove-source="${id}"`));
  }
  h.root.querySelector('.req-source-history').open = false;
  await h.click({ reqRemoveSource: 'source-a' });
  assert.match(h.html, /<details class="req-source-history">/);
  assert.doesNotMatch(h.html, /data-req-remove-source="source-a"/);
  assert.match(h.html, /data-req-source="source-a"/);
  assert.equal(h.sources.length, 3);
  assert.deepEqual(h.calls, []);
});

test('V2 uploaded-file draft and metadata survive selection-driven rerender without starting generation', async t => {
  const oldDataTransfer = globalThis.DataTransfer;
  globalThis.DataTransfer = class {
    constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; }
  };
  t.after(() => { globalThis.DataTransfer = oldDataTransfer; });
  const h = await requirementsHarness(t, 'v2-upload-draft');
  const file = { name: '页面.png', size: 12 };
  h.root.listeners.change({ target: { dataset: { reqFile: '' }, files: [file] } });
  h.root.listeners.input({ target: { dataset: { reqVersion: '' }, value: 'V2' } });
  await h.change({ reqSource: 'source-a' });
  assert.equal(h.root.querySelector('[data-req-file]').files[0], file);
  assert.match(h.html, /value="IMAGE" selected/);
  assert.match(h.html, /data-req-version value="V2"/);
  assert.deepEqual(h.calls, []);
});

test('V2 selected edited case cannot be confirmed until its unsaved detail is saved or cancelled', async t => {
  const h = await requirementsHarness(t, 'v2-edit-confirm', { editCandidate: async () => {} });
  await h.change({ reqCandidate: 'candidate-1' });
  await h.click({ reqEditCandidate: '' });
  assert.match(h.root.querySelector('[data-req-current-confirm]').innerHTML, /先保存或取消/);
  assert.equal(h.root.querySelector('[data-req-confirm]').disabled, true);
  await h.click({ reqCancelEdit: '' });
  assert.match(h.root.querySelector('[data-req-current-confirm]').innerHTML, /data-req-confirm-current/);
  assert.equal(h.root.querySelector('[data-req-confirm]').disabled, false);
  assert.deepEqual(h.calls, []);
});

test('V2 delayed old-project render cannot bind handlers to the next project root', async t => {
  const previousDocument = globalThis.document;
  let root, releaseFirst, current = 'A';
  const delayed = new Promise(resolve => { releaseFirst = resolve; });
  const goCalls = [];
  const render = id => renderRequirements({ project: { project_id: `v2-race-${id}`, name: id },
    isCurrent: () => current === id, toast() {}, go: path => goCalls.push(path),
    requirementsApi: { listSources: async () => { if (id === 'A') await delayed; return { sources: [] }; } },
    showPage() {
      if (current !== id) return;
      root = { dataset: { reqProject: `v2-race-${id}` }, isConnected: true, listeners: {},
        querySelector: () => ({}), querySelectorAll: () => [],
        addEventListener(event, handler) { (this.listeners[event] ||= []).push(handler); } };
    },
  });
  globalThis.document = { querySelector: () => root };
  t.after(() => { disposeRequirementsPolling(); globalThis.document = previousDocument; });
  const first = render('A'); current = 'B'; await render('B'); releaseFirst(); await first;
  assert.equal(root.listeners.click.length, 1);
  const button = { dataset: { reqGoWorkbench: '' }, closest: () => button };
  for (const handler of root.listeners.click) handler({ target: button });
  assert.deepEqual(goCalls, ['#/projects/v2-race-B']);
});

test('V2 leaving during design creation prevents a later generation submission and detached-root actions', async t => {
  let current = true, releaseCreate;
  const delayed = new Promise(resolve => { releaseCreate = resolve; });
  const starts = [];
  const h = await requirementsHarness(t, 'v2-action-leave', {
    createDesign: async () => delayed,
    startGeneration: async (...args) => { starts.push(args); return { task_id: 'unexpected' }; },
  }, () => current);
  await h.change({ reqSource: 'source-a' });
  await h.click({ reqGenerate: '' });
  const before = h.html;
  current = false;
  releaseCreate({ design_id: 'design-1', revision: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(starts, []);
  assert.equal(h.html, before);
  await h.change({ reqSource: 'source-b' });
  await h.click({ reqConfirmCurrent: '' });
  assert.equal(h.html, before);
  assert.deepEqual(h.calls, []);
});

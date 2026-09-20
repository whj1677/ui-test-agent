import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRecords, classifyRequest, analyzeRound } from '../scripts/analyze-model-round.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('classification separates proposals from measured completion, repairs and partial review', () => {
  const classify = (phase, input) => classifyRequest({ phase, input }).category;
  assert.equal(classify('adaptive_plan', {}), 'ordinary_planning');
  assert.equal(classify('adaptive_plan', { correction: {code:'PROTOCOL_SOURCE_REF_UNKNOWN'}}), 'format_reference_repair');
  assert.equal(classify('adaptive_plan', { repair_focus: {} }), 'missing_assertion_supplement');
  assert.equal(classify('adaptive_plan', { correction: { code: 'PLAN_CURRENT_PAGE_UNPROVEN' } }), 'missing_assertion_supplement');
  assert.equal(classify('adaptive_plan', { correction: { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' } }), 'semantic_candidate_repair');
  assert.equal(classify('adaptive_audit', { complete: true, current_fragment: { actions: [], assertions: [{}] } }), 'candidate_review');
  assert.equal(classify('adaptive_audit', { complete: true, current_fragment: { actions: [], assertions: [] }, previous: [{}] }), 'completion_verification');
  assert.equal(classify('adaptive_audit', { review_correction: {}, complete: true }), 'format_reference_repair');
  assert.equal(classify('adaptive_audit', { partial_assertion_review: {} }), 'partial_assertion_review');
  const r = {phase: 'adaptive_plan', input: { previous: [{assertions: [{}]}],
    progress: {remaining_obligations: [{}]} }};
  assert.equal(classifyRequest(r, {actions: [], assertions: [{}]}).category, 'incremental_assertion_planning');
  assert.equal(classifyRequest(r, {actions: [{}], assertions: []}).category, 'ordinary_planning');
});

test('one logical call, two physical attempts, usage duplicated by provider is counted once', () => {
  const at = '2026-09-20T00:00:00.000Z', request_id = 'r1';
  const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
  const records = [
    { type: 'MODEL_REQUEST', request_id, at, phase: 'adaptive_plan', input: {} },
    { type: 'MODEL_TRANSPORT_STARTED', request_id, attempt: 1 },
    { type: 'MODEL_TRANSPORT_FINISHED', request_id, attempt: 1, duration_ms: 100 },
    { type: 'MODEL_TRANSPORT_STARTED', request_id, attempt: 2 },
    { type: 'MODEL_TRANSPORT_FINISHED', request_id, attempt: 2, duration_ms: 200 },
    { type: 'MODEL_RESPONSE_PARSED', request_id, at: '2026-09-20T00:00:01.000Z', usage },
    { type: 'MODEL_PROVIDER_RESULT', request_id, at: '2026-09-20T00:00:01.010Z', usage },
  ];
  const result = analyzeRecords(records);
  assert.equal(result.logical_calls, 1);
  assert.equal(result.rows[0].latency_ms, 1010);
  assert.equal(result.by_category[0].transport_attempts, 2);
  assert.equal(result.by_category[0].transport_ms, 300);
  assert.equal(result.by_category[0].total_tokens, 15);
  assert.equal(result.by_category[0].missing_cache_usage_calls, 1);
  assert.throws(() => analyzeRecords([...records, records[0]]), /DUPLICATE/);
});

test('missing timings and usage remain explicitly unknown, never synthetic zero', () => {
  const r = analyzeRecords([{ type: 'MODEL_REQUEST', request_id: 'r', phase: 'input_review', input: {} }]);
  assert.equal(r.rows[0].transport_ms, null);
  assert.equal(r.rows[0].latency_ms, null);
  assert.equal(r.by_category[0].missing_transport_calls, 1);
  assert.equal(r.by_category[0].missing_usage_calls, 1);
});

test('a pre-execution failure has no recordings, but a missing attempted run is not hidden', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'model-diagnosis-no-run-'));
  const diagnostics=path.join(dir,'product-data/tasks/t/diagnostics');
  await fs.mkdir(diagnostics,{recursive:true});
  await fs.writeFile(path.join(diagnostics,'1.json'),JSON.stringify({record:{type:'MODEL_REQUEST',request_id:'r',phase:'input_review'}}));
  const task={id:'t',finished_at:'2026-09-20T00:01:00Z',results:[{case_id:'c',attempts:0,status:'NEEDS_MAPPING'}]};
  const round={tasks:[task],budget:{calls:1,elapsed_ms:1000}};
  await fs.writeFile(path.join(dir,'round.json'),JSON.stringify(round));
  const result=await analyzeRound(dir);
  assert.equal(result.recording.length,0);
  assert.equal(result.no_execution_tasks.length,1);
  assert.equal(result.by_category[0].missing_usage_calls,1);
  task.results[0].attempts=1;
  await fs.writeFile(path.join(dir,'round.json'),JSON.stringify(round));
  await assert.rejects(analyzeRound(dir),{code:'ENOENT'});
});

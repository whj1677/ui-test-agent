import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { dataset, samples, frozenCase, observations, startTarget, input, reviewInput, authoredAnswer } from '../qa/20261002-trim-contains-closeout/scenario.mjs';
import { executeBackendCase, backendDigest } from '../server/backend/execution.mjs';
import { createCandidateQualityReviewer, prepareCandidateQualityInput, classifyCandidateQualityAnswer } from '../server/quality-review.mjs';
import { createQualityReviewToolSession } from '../server/quality-review-harness.mjs';
import { startQualityReviewMcp } from '../server/quality-review-harness-mcp.mjs';

async function run(variant, candidate = 'raw-partial') {
  const site = await startTarget(variant);
  try {
    const args = input(site.base, candidate);
    const result = await executeBackendCase(args);
    return { args, result, requests: [...site.requests] };
  } finally { await site.close(); }
}
async function aReplay(args, answer) {
  return createCandidateQualityReviewer({ modelClient: { async generate() { return structuredClone(answer); } } }).review(args);
}
async function bReplay(args, answer, malformed = false) {
  const prepared = prepareCandidateQualityInput(args);
  const session = createQualityReviewToolSession({ payload: prepared.payload });
  const endpoint = await startQualityReviewMcp((name, params) => session.invoke(name, params));
  const invoke = async (name, params = {}) => {
    const response = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: session.toolCalls + 1, method: 'tools/call', params: { name, arguments: params } }) });
    assert.equal(response.status, 200);
    const body = await response.json(); assert.notEqual(body.result?.isError, true, JSON.stringify(body));
  };
  try {
    await invoke('read_case');
    await invoke('submit_obligations', { obligations: args.frozenCase.steps.flatMap(step =>
      ['action', 'expected'].map(field => ({ order: step.order, field, quote: step[field], check: '只读核对原文义务' }))) });
    await invoke('read_candidate'); await invoke('read_evidence');
    if (malformed) {
      const response = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"incomplete":' });
      assert.equal(response.status, 400);
      assert.equal(session.answer, null); assert.equal(session.phase, 'EVIDENCE_READ');
      return { status: 'NEEDS_ANALYSIS', boundary: endpoint.receipt, phase: session.phase, semantic_approval: false };
    }
    await invoke('submit_review', answer);
    return { status: classifyCandidateQualityAnswer(session.answer), boundary: endpoint.receipt,
      findings: session.answer.findings, semantic_approval: false };
  } finally { await endpoint.close(); }
}

test('frozen partial keyword hits two exact records and excludes two near neighbours', () => {
  for (const sample of samples) assert.deepEqual(observations(sample.raw).items, sample.records);
  assert.deepEqual(observations(' k-00 ').items, samples[1].records);
  assert.deepEqual(observations(' BK-006 ').items, observations(' BK-006 ', 'equals-trim').items);
  assert.notDeepEqual(observations(' K-00 ').items, observations(' K-00 ', 'equals-trim').items);
  assert.notDeepEqual(observations(' K-00 ').items, observations(' K-00 ', 'contains-no-trim').items);
  assert.equal(dataset.length, 4);
});

test('real executor: correct contains passes raw hit/non-hit/whitespace and literal pre/post dataset', async () => {
  const evidence = await run('contains-trim');
  assert.equal(evidence.result.status, 'PASSED');
  assert.deepEqual(evidence.result.steps.map(step => step.status), ['PASSED', 'PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(evidence.requests.map(row => row.raw_keyword), samples.map(row => row.raw));
  assert.equal(evidence.result.model_calls, 0);
  assert.deepEqual(observations('').items, dataset);
});

for (const variant of ['equals-trim', 'contains-no-trim']) {
  test(`real executor: unchanged oracle rejects ${variant} on partial query; failures retained`, async () => {
    const evidence = await run(variant);
    assert.equal(evidence.result.status, 'FAILED');
    assert.equal(evidence.result.steps[0].status, 'PASSED');
    assert.equal(evidence.result.steps[1].status, 'FAILED');
    assert(evidence.result.steps[1].requests[0].assertions.some(row => row.pointer === '/items' && row.status === 'FAILED'));
    assert.equal(evidence.requests[1].raw_keyword, ' K-00 ');
    assert.deepEqual(evidence.result.steps.slice(2).map(row => row.status), ['NOT_RUN', 'NOT_RUN']);
  });
}

test('caller trim masks bad target and complete-ID rewrite fails: candidate must preserve frozen inputs', async () => {
  assert.equal((await run('contains-no-trim', 'caller-trim')).result.status, 'PASSED');
  assert.equal((await run('contains-trim', 'complete-id')).result.status, 'FAILED');
});

test('A/B paired offline host contracts classify same authored clean and weak cases separately', async () => {
  for (const weak of [false, true]) {
    const args = reviewInput(input('http://127.0.0.1:4380', weak ? 'caller-trim' : 'raw-partial'), { status: 'PASSED', provenance: 'offline authored contract sample' });
    const answer = authoredAnswer({ weak });
    const a = await aReplay(args, answer), b = await bReplay(args, answer);
    // UNCERTAIN is intentionally stricter than a repair finding alone.
    assert.equal(a.status, weak ? 'NEEDS_ANALYSIS' : 'NO_FINDINGS');
    assert.equal(b.status, weak ? 'NEEDS_ANALYSIS' : 'NO_FINDINGS');
    assert.equal(a.semantic_approval, false); assert.equal(b.semantic_approval, false);
    assert.equal(b.boundary.requests.filter(row => row.outcome === 'INVOKED').length, 5);
  }
});

test('A clean answer never substitutes for malformed B tool JSON and boundary remains inspectable', async () => {
  const args = reviewInput(input('http://127.0.0.1:4380'), { status: 'PASSED' });
  const a = await aReplay(args, authoredAnswer()), b = await bReplay(args, null, true);
  assert.equal(a.status, 'NO_FINDINGS'); assert.equal(b.status, 'NEEDS_ANALYSIS');
  assert.equal(b.boundary.requests.at(-1).outcome, 'JSON_PARSE_REJECTED');
  assert.equal(b.boundary.requests.at(-1).http_status, 400);
  assert.equal(b.boundary.requests.at(-1).sha256.length, 64);
  assert.equal(b.phase, 'EVIDENCE_READ');
});

test('saved real B raw findings replay unchanged through A host and B tools, without new provider call', async () => {
  const folder = new URL('../qa/20261002-trim-contains-closeout/', import.meta.url);
  const read = async name => JSON.parse(await fs.readFile(new URL(name, folder), 'utf8'));
  const oldCase = (await read('original-case.json')).versions[0];
  const plan = JSON.parse(await fs.readFile(new URL('../qa/20261001-release-goal-round4/closeout/b-persisted-final.json', import.meta.url), 'utf8'));
  const review = plan.generation_session.quality_reviews[0];
  const args = { kind: 'backend', frozenCase: oldCase.content,
    caseSha256: oldCase.content_sha256.toLowerCase(), candidateSha256: plan.execution_sha256,
    execution: plan.execution, context: { source: 'saved real B fixture, original quotes untouched' },
    evidence: plan.generation_session.self_tests[0].result };
  assert.equal(backendDigest(plan.execution), plan.execution_sha256);
  const answer = { steps: review.steps, findings: review.findings };
  const a = await aReplay(args, answer), b = await bReplay(args, answer);
  assert.equal(a.status, 'REPAIR_REQUIRED'); assert.equal(b.status, 'REPAIR_REQUIRED');
  assert.deepEqual(a.findings, review.findings); assert.deepEqual(b.findings, review.findings);
  assert.equal(review.process_diagnostic.mcp_boundary.received, 9);
});

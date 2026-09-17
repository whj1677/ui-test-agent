import test from 'node:test';
import assert from 'node:assert/strict';
import { blockAuditInput, validateBlockAudit } from '../src/block-audit.mjs';

const details = { name: '详情', locator: { kind: 'testid', value: 'details' } };
function input() {
  return blockAuditInput(
    {
      original: { expected: '删除后记录消失' },
      pages: [{ url: 'http://localhost/items', text: '删除', controls: [details] }],
      discovery_memory: { summary: '已有删除能力' },
      handoff: {
        actions: [
          {
            id: 'view',
            entry_path: '/items',
            controls: [{ id: 'source-details', locator: details.locator }],
          },
        ],
      },
    },
    { blocked: true, reason: '没有精确删除控件依据。' },
  );
}
const repair = (ref) => ({ outcome: 'REPAIR', reason: '建议重新生成候选。', evidence_refs: [ref] });
const reference = (entry) => ({
  evidence_id: entry.evidence_id,
  fact: structuredClone(entry.fact),
});

test('block review catalogs structured controls/routes with provenance, excluding expected text and model interpretation', () => {
  const request = input();
  assert.equal(request.evidence_catalog.length, 3);
  assert.deepEqual(
    request.evidence_catalog.map((e) => e.source.kind),
    ['snapshot', 'handoff', 'handoff'],
  );
  assert.ok(!JSON.stringify(request.evidence_catalog).includes('删除'));
  assert.deepEqual(request.evidence_catalog, input().evidence_catalog);
  const ref = reference(request.evidence_catalog[0]);
  assert.deepEqual(validateBlockAudit(repair(ref), request), repair(ref));
});

test('details evidence cannot be rebound to a delete name or a different locator', () => {
  const request = input();
  for (const change of [
    (fact) => {
      fact.name = '删除';
    },
    (fact) => {
      fact.locator.value = 'delete';
    },
    (fact) => {
      fact.cleanup_supported = true;
    },
  ]) {
    const ref = reference(request.evidence_catalog[0]);
    change(ref.fact);
    assert.throws(() => validateBlockAudit(repair(ref), request), {
      code: 'BLOCK_AUDIT_EVIDENCE_INVALID',
    });
  }
});

test('arbitrary quotes, invented IDs, duplicate references and empty repair evidence are rejected', () => {
  const request = input();
  const ref = reference(request.evidence_catalog[0]);
  for (const reply of [
    { outcome: 'REPAIR', reason: '存在删除', evidence_quotes: ['详情'] },
    repair({ ...ref, evidence_id: 'original.expected' }),
    { ...repair(ref), evidence_refs: [] },
    { ...repair(ref), evidence_refs: [ref, ref] },
  ])
    assert.throws(() => validateBlockAudit(reply, request));
  assert.equal(
    validateBlockAudit({ outcome: 'BLOCKED', reason: '缺失技术资料', evidence_refs: [] }, request)
      .outcome,
    'BLOCKED',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveAuditInput, ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';
import { reviewPartialAssertions } from '../src/partial-assertion-review.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { NEGATIVE_ROW_GUIDANCE } from '../src/negative-row-scope.mjs';

const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const positive = {
  target: { kind: 'cell', table, key: { column: '编号', value: 'R009' }, column: '编号' },
  check: 'text',
  expected: 'R009',
  obligation_ids: ['O1'],
};
const count = { target: table, check: 'row_count', expected: 1, obligation_ids: ['O1'] };

for (const split of [false, true])
  test(
    'program derived sampling groups distinguish joint evidence from separate times: ' + split,
    async () => {
      const current = split ? [count] : [positive, count];
      const input = {
        complete: false,
        original: {
          steps: [
            {
              step_id: 'S1',
              expected: '当前表唯一行是R009，不出现R001。',
              obligations: [{ id: 'O1', text: '当前表唯一行是R009，不出现R001' }],
            },
          ],
        },
        current_fragment: { assertions: current },
        candidate_plan: {
          steps: [
            {
              step_id: 'S1',
              checkpoints: split
                ? [{ assertions: [positive] }, { assertions: [count] }]
                : [{ assertions: [positive, count] }],
            },
          ],
        },
      };
      const before = structuredClone(input);
      const context = adaptiveAuditInput(input);
      assert.equal(
        context.assertion_catalog[0].planned_sampling_group ===
          context.assertion_catalog[1].planned_sampling_group,
        !split,
      );
      assert.deepEqual(input, before, 'group metadata never rewrites the candidate');
      const audit = {
        outcome: 'REPAIR',
        checks: [
          {
            step_id: 'S1',
            obligation_id: 'O1',
            status: 'MISSING',
            assertion_indices: [0, 1],
            reason: '需要审查当前组件及其组合',
          },
        ],
        issues: [{ code: 'ASSERTION_GAP', step_id: 'S1', reason: '组合仍未完成审查' }],
      };
      const result = await reviewPartialAssertions(context, audit, async (request) => ({
        assertion_checks: request.partial_assertion_review.required_refs.map((ref) => ({
          assertion_ref: ref,
          status: 'UNRESOLVED',
          reason: '注入不确定结果，不得被分组元数据覆盖',
        })),
      }));
      assert.equal(result.outcome, 'REPAIR');
      assert.ok(result.issues.some((i) => i.code === 'ACTION_MISMATCH'));
      assert.equal(result.checks[0].status, 'MISSING');
    },
  );

test('same explicit negative capability reaches planner and reviewer without new predicate', () => {
  assert.ok(ADAPTIVE_NEXT_PROMPT.includes(NEGATIVE_ROW_GUIDANCE));
  assert.ok(ADAPTIVE_REVIEW_REFERENCES.includes(NEGATIVE_ROW_GUIDANCE));
  assert.match(NEGATIVE_ROW_GUIDANCE, /check:"count",expected:0/);
  assert.match(
    ADAPTIVE_REVIEW_REFERENCES,
    /Lack of standalone sufficiency is NOT semantic invalidity/,
  );
});

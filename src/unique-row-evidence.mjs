import { semanticHash } from './common.mjs';
import { stepCheckpoints } from './plan-steps.mjs';
import { sourceUniqueRows } from './table-cardinality.mjs';

export function uniqueRowRequirements(original) {
  const keys = new Set(sourceUniqueRows(original.expected));
  return (original.obligations ?? []).flatMap((o) =>
    sourceUniqueRows(o.text)
      .filter((key) => keys.has(key))
      .map((key) => ({ source_ref: o.id, key, row_count: 1 })),
  );
}

function identityTable(assertion, key) {
  const target = assertion.target;
  if (
    assertion.check === 'table_cells' &&
    assertion.expected?.rows?.some((r) => r.key === key && r.cells?.length)
  )
    return target;
  if (target?.key?.value !== key) return null;
  if (target.kind === 'row' && !target.target && assertion.check === 'visible') return target.table;
  if (
    target.kind === 'cell' &&
    target.column === target.key.column &&
    assertion.check === 'text' &&
    assertion.expected === key
  )
    return target.table;
  return null;
}

export function uniqueRowEvidenceGaps(original, step) {
  return uniqueRowRequirements(original).filter(
    ({ source_ref, key }) =>
      !stepCheckpoints(step).some((point) => {
        const assertions = point.assertions.filter((a) => a.obligation_ids?.includes(source_ref));
        return assertions.some((a) => {
          const table = identityTable(a, key);
          if (!table) return false;
          if (
            a.check === 'table_cells' &&
            a.expected.exact_rows === true &&
            a.expected.rows.length === 1
          )
            return true;
          return assertions.some(
            (b) =>
              b.check === 'row_count' &&
              b.expected === 1 &&
              semanticHash(b.target) === semanticHash(table),
          );
        });
      }),
  );
}

export const UNIQUE_ROW_GUIDANCE = `An explicit original sole-row/sole-record identity (唯一行是/唯一记录为 + original identity) requires BOTH membership and total cardinality one in the SAME table and SAME checkpoint. step_capabilities.unique_rows is a source fact, not measured proof. Use a table_cells matrix with that original key and exact_rows:true for the explicitly sole row, OR its scoped identity measurement plus row_count:1 on that same table, binding BOTH to that original sole-record obligation. A row locator itself being unique, count:1 of the matching row, exclusion of a different key, raw sampled rows, or a previous step's count does NOT prove that no other rows exist. Never borrow a different checkpoint's count or another table's identity. Partial fragments can gather evidence, but the joint proof must exist before completion. This rule does not add closure to ordinary membership/first-row/prefix expectations, does not replace required fields or explicit exclusions, and never authorizes original-source changes or business-action replay.`;

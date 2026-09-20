import { installTableInvariantSampler } from './table-invariant.mjs';

export const isNegativeRowAssertion = (a) =>
  ['row', 'cell'].includes(a.target?.kind) &&
  (a.check === 'hidden' || (a.check === 'count' && a.expected === 0));

// Uses the same fixed bounded native-table sampler and mutation epoch as the
// assertion group. A missing target is not evidence that its parent exists.
export async function installNegativeRowSampler(page, key) {
  await installTableInvariantSampler(page, key);
  await page.evaluate((key) => {
    window[key].sampleNegativeRowScope = (tables, spec) => {
      const invalid = (reason) => ({ error: 'ROW_NEGATIVE_SCOPE_' + reason });
      if (tables.length !== 1) return invalid('TABLE_NOT_UNIQUE');
      if (tables[0].closest('[aria-busy="true"]') || tables[0].querySelector('[aria-busy="true"]'))
        return invalid('LOADING');
      const matrix = window[key].sampleTable(tables[0]);
      if (matrix.error) return invalid(matrix.error);
      const index = matrix.headers.indexOf(spec.key.column);
      if (index < 0) return invalid('KEY_COLUMN_MISSING');
      if (spec.kind === 'cell' && !matrix.headers.includes(spec.column))
        return invalid('CELL_COLUMN_MISSING');
      const keys = matrix.rows.map((row) => row[index]);
      if (keys.some((k) => !k) || new Set(keys).size !== keys.length)
        return invalid('KEY_IDENTITY_INVALID');
      return {
        scope: 'complete_current_native_table',
        key: spec.key,
        target_kind: spec.kind,
        inner_target: spec.target ?? null,
        column: spec.column ?? null,
        matrix,
      };
    };
  }, key);
}

export const NEGATIVE_ROW_GUIDANCE = `Explicit absence of an ORIGINAL record key in the current results table can use the existing locator {kind:"row",table:<observed table locator>,key:{column:<observed exact key header>,value:<original excluded identity>}} with check:"count",expected:0 (or hidden). Do not add an inner target when checking the ROW itself. Do not require an excluded identity to be visible first or turn its exclusion into a positive table_cells row. This is a read-only assertion, not permission to click a missing record or invent a table/header. The runtime requires one visible complete supported native parent table, unambiguous key identities and a same-group matrix sample; missing/hidden parents, ambiguous/unsupported/truncated structures are technical failures, never absence passes. It covers only the current complete rendered table, NOT other pages, the whole screen, future states or hidden/virtual data. For cell or inner-control absence the predicate concerns that target, not automatically the whole record. Keep unchanged original scope, sources and timing; no prior-step measurement substitution. A scoped complete same-checkpoint table matrix asserting the original sole record, or that record plus the original exact row count, may jointly prove exclusion of a DIFFERENT key in that table; an isolated count, different tables/times or whole-page absence cannot use this implication. Do not demand a redundant explicit negative assertion when the same-scope joint proof genuinely suffices, and never approve contrary or unresolved semantics.`;

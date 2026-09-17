export const DYNAMIC_ROW_GUIDANCE = `Dynamic row binding: technical_context.dynamic_row_bindings describes observed table schemas and reusable inner-control patterns, NOT test outcomes. A row/cell locator may combine such an observed table, an exact observed column header, an ORIGINAL-case identity value and an observed inner target pattern. The original query/filter must remain in the plan before that lookup. The row need not be present or unique in the INITIAL unfiltered snapshot: the fixed runtime checks exact key uniqueness in the CURRENT filtered state and fails on zero/multiple/wrong targets; never use nth/first. Preserve the original selection column (e.g. park), then assert the original record id/fields. Do not replace that selection with an easier record or require expected field values to be observed before generating a test. Missing table/header/inner target evidence still needs targeted recovery; unsupported tables and ambiguity at execution remain failures. This rule does not authorize writes or waive ownership/cleanup.`;

export function dynamicRowEvidence(pages) {
  const bindings = new Map();
  for (const page of pages ?? []) {
    if (page.login_page || page.network_issues?.length) continue;
    for (const table of page.controls ?? []) {
      if (
        !table.locator ||
        !Array.isArray(table.headers) ||
        !table.headers.length ||
        table.headers.some((h) => typeof h !== 'string' || !h.trim()) ||
        new Set(table.headers).size !== table.headers.length
      )
        continue;
      const targets = new Map();
      for (const control of page.controls ?? []) {
        const row = control.locator;
        if (
          row?.kind === 'row' &&
          row.target &&
          JSON.stringify(row.table) === JSON.stringify(table.locator)
        )
          targets.set(JSON.stringify(row.target), row.target);
      }
      const fact = {
        url: page.url,
        table: table.locator,
        headers: table.headers,
        inner_targets: [...targets.values()],
        evidence: 'DOM_OBSERVED_SCHEMA_NOT_RESULT',
        runtime_checks: ['exact_column', 'unique_current_row', 'unique_inner_target'],
      };
      bindings.set(JSON.stringify(fact), fact);
    }
  }
  return structuredClone([...bindings.values()]);
}

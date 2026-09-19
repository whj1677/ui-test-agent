// Advisory syntax facts for independent semantic review, never an acceptance
// receipt. Real uniqueness, object scope and values remain executor obligations.
export const EVIDENCE_SOURCE_GUIDANCE =
  'EVIDENCE-SOURCE CONSTRAINTS: Distinguish what the UI must display from where its proof must come from. If the original says a note/history/other region must NOT be used as a field, even if it contains the same number, the conditional distractor value is NOT a required UI value. Do not invent an assertion that the note must contain that number. A correctly scoped exact native definition-field or row+column value assertion can jointly support its original value obligation and an applicable evidence-source constraint: bind both source_refs/obligation_ids, and explain why THIS measured field is not a whole-region substring or a different field. This does not remove any obligation or waive current object identity, unique runtime binding, timing, source grounding or actual field comparison. If the original also requires that a note/region is visible, measure that visibility separately with an appropriate observed unique target and bind that same original constraint; visibility/heading alone is not proof of the business field value. If the original positively REQUIRES note text/value, a separate scoped measurement of that content remains necessary. Explicit whole-region absence, temporal unchanged behavior, multi-valued exclusions and unclear field association are NOT covered by this rule. Never turn even-if/即使 into mandatory presence, nor drop an explicit positive note requirement. Reviewer evidence_binding entries describe only candidate locator syntax, NOT observed binding or successful execution; neither these tags, labels, metadata, reasons nor copied IDs establish coverage. Whole dialog contains, a matching title or a value elsewhere cannot discharge a field-value/source requirement. Independently evaluate all original clauses and counterexamples; keep MISSING/UNCLEAR findings when evidence is genuinely insufficient. Return only the existing output schema, never these advisory fields.';

export function assertionEvidenceBinding(assertion) {
  const target = assertion?.target;
  const predicate = assertion?.check ?? null;
  const common = { basis: 'candidate_locator_syntax_only', runtime_verified: false, predicate };
  const comparison =
    {
      text: 'exact_text',
      number: 'numeric',
      display_number: 'numeric_projection',
      contains: 'substring',
    }[predicate] ?? 'not_a_field_value_comparison';
  if (target?.kind === 'within' && target.target?.kind === 'definition')
    return {
      ...common,
      kind: 'native_definition_field',
      object_scope: structuredClone(target.scope),
      declared_field_label: target.target.name,
      comparison,
    };
  if (target?.kind === 'cell')
    return {
      ...common,
      kind: 'table_record_field',
      table: structuredClone(target.table),
      record_key: structuredClone(target.key),
      declared_field_label: target.column,
      comparison,
    };
  if (predicate === 'table_cells')
    return {
      ...common,
      kind: 'table_matrix',
      table: structuredClone(target),
      key_column: assertion.expected?.key_column,
      declared_columns: [
        ...new Set(
          (assertion.expected?.rows ?? []).flatMap((r) => (r.cells ?? []).map((c) => c.column)),
        ),
      ],
    };
  const leaf = target?.kind === 'within' ? target.target : target;
  if (leaf?.kind === 'role' && leaf.role === 'heading')
    return { ...common, kind: 'heading_only', field_value_proof: false };
  if ((target?.kind === 'within' && !target.target) || leaf?.role === 'dialog')
    return { ...common, kind: 'whole_region', field_value_proof: false };
  return { ...common, kind: 'other_locator', field_binding_not_established: true };
}

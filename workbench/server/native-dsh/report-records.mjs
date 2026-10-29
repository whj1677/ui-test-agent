// Reports consume the same verified frozen bindings as the native console.
// Keep this adapter separate from legacy execution/approval operations.
export async function nativeReportRecords(manager, projectId) {
  const view = await manager.console(projectId);
  return view.records.filter(row => row.project_id === projectId && row.purpose === 'case' &&
    row.recorded_counts_for_case === true && ['CURRENT', 'HISTORICAL'].includes(row.binding_status)).map(row => ({
    ...row,
    schema: 'workbench/native-dsh-report-run-v1',
    executed_case_id: row.case_id, executed_case_version: row.case_version,
    executed_external_id: row.external_id, executed_content_sha256: row.content_sha256,
    execution_status: ['QUEUED', 'RUNNING', 'STOPPING', 'CANCELLED', 'INTERRUPTED'].includes(row.status) ? row.status : 'FINISHED',
    // Missing/tampered source is retained as the latest incomplete attempt, never
    // omitted in favour of an older pass. Console's count eligibility is intact.
    evidence_status: row.counts_for_case ? row.evidence_status : 'INCOMPLETE',
    reason: row.counts_for_case ? null : row.source?.reason || 'NATIVE_SOURCE_UNAVAILABLE',
    qualification: 'NATIVE_EXECUTION_NOT_PRODUCT_APPROVAL', approval_status: 'NOT_APPROVED',
    files: (row.files || []).map(file => ({ ...file, sha256: file.sha256?.toUpperCase() })),
  }));
}

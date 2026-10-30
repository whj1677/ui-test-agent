// Receipts decide completion; model prose never establishes a case result.
export const ATTEMPT_LIMIT = 3; // Initial execution plus at most two repairs.
export function batchCoverage(task, ids) {
  return task.items.filter(item => ids.has(item.case_id)).map(item => {
    const runs = task.runs.filter(run => run.case_id === item.case_id && run.counts_for_case);
    const draft = (task.drafts || []).filter(row => row.case_id === item.case_id).at(-1);
    return { case_id: item.case_id, status: item.status, attempts: runs.length, evidence_status: runs.at(-1)?.evidence_status || null,
      handled: runs.length > 0 || draft?.draft_status === 'BLOCKED_PRECONDITION' };
  });
}
export function assertAttemptAllowed(task, item, classification) {
  const latest = task.runs.filter(run => run.case_id === item.case_id && run.counts_for_case).at(-1);
  if (classification.counts_for_case && item.status === 'PASSED' && latest?.evidence_status !== 'INCOMPLETE') throw Error('NATIVE_DSH_CASE_ALREADY_PASSED');
  if (task.runs.filter(run => run.case_id === item.case_id && run.counts_for_case === classification.counts_for_case).length >= ATTEMPT_LIMIT)
    throw Error('NATIVE_DSH_ATTEMPT_LIMIT');
}
export function closeoutReason(active, currentTime = Date.now()) {
  if (!active.closeout || active.executePromise || active.draftPromise || active.batchClosed) return null;
  if (active.closeout.tools >= 12) return 'NATIVE_DSH_CLOSEOUT_TOOL_LIMIT';
  // This is a lack-of-progress guard after execution, not a task duration limit.
  if (currentTime - active.closeout.lastProgress > 120_000) return 'NATIVE_DSH_CLOSEOUT_STALLED';
  return null;
}

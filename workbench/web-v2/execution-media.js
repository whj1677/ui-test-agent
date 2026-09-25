export function executionMediaUrl(run, fileId) {
  return run.origin === 'EXPLICIT_CANDIDATE_TRIAL' ? `/api/runs/${encodeURIComponent(run.run_id)}/media/${encodeURIComponent(fileId)}` : `/api/build/tasks/${encodeURIComponent(run.source_build_task_id)}/media/${encodeURIComponent(fileId)}`;
}

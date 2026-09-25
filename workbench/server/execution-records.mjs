import { developmentRecords } from './build/candidate-trials.mjs';
import { reviewFor } from './batches.mjs';

export async function projectRecords({buildStore, caseStore, store, buildManager}, projectId) {
  const project = await caseStore.getProject(projectId);
  if (!project) throw Error('CASE_PROJECT_NOT_FOUND');
  const tasks = (await buildStore.listTasks()).filter(t => t.source?.project_id === projectId);
  const records = tasks.filter(t => !t.development).flatMap(task => (task.candidates || []).flatMap(candidate => (candidate.trial_runs || []).map(run => ({
    ...run, project_id: projectId, project_name: project.name, source_build_task_id: task.task_id,
    candidate_version: candidate.version, candidate_sha256: candidate.sha256,
    frozen_case_content: project.cases.find(c => c.case_id === run.executed_case_id)?.versions.find(v => v.version === run.executed_case_version)?.content || null,
    files: (task.files || []).filter(f => run.media_file_ids?.includes(f.file_id)),
  }))));
  records.push(...tasks.flatMap(developmentRecords));
  for (const run of records) {
    const task = tasks.find(t => t.task_id === run.source_build_task_id);
    run.requirement_review = reviewFor(buildManager, {...task.source, source_task_id: task.task_id, bundle_sha256: run.bundle_sha256});
    run.script_version = task.script_version || null;
  }
  records.push(...(await store.listRuns()).filter(r => r.schema === 'workbench/candidate-trial-v1' && r.project_id === projectId));
  return records.sort((a,b) => String(a.started_at).localeCompare(String(b.started_at)));
}

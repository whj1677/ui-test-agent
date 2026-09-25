// Read-only export of this batch's synthetic evidence; never executes a candidate/model.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../server/build/development-session.mjs';
const workbench = fileURLToPath(new URL('../', import.meta.url));
const repository = path.dirname(workbench);
const source = path.join(workbench, '.local/a25');
const output = path.join(workbench, 'qa/20260925-autonomous');
const manifest = { schema: 'autonomous-acceptance-evidence-v1', baseline: '38a5e1d5a73723d93deecf124db2d2e2a228ee83', exported_at: new Date().toISOString(), redaction: 'Repository/home paths replaced; no sessions, reasoning, credentials, videos or trace archives exported. Candidate bytes unchanged.', files: [], tasks: [] };
function sanitize(value) {
  if (typeof value === 'string') return value.replaceAll(repository.replaceAll('\\', '\\\\'), '<REPO>').replaceAll(repository, '<REPO>').replaceAll(repository.replaceAll('\\', '/'), '<REPO>').replaceAll(encodeURI(repository.replaceAll('\\', '/')), '<REPO>').replaceAll(process.env.USERPROFILE.replaceAll('\\', '\\\\'), '<USER_HOME>').replaceAll(process.env.USERPROFILE, '<USER_HOME>');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)]));
  return value;
}
async function copy(file, target, json = false) {
  const original = await fs.readFile(file);
  const bytes = json ? Buffer.from(JSON.stringify(sanitize(JSON.parse(original)), null, 2) + '\n') : original;
  await fs.mkdir(path.dirname(path.join(output, target)), { recursive: true }); await fs.writeFile(path.join(output, target), bytes);
  manifest.files.push({ file: target, source: path.relative(repository, file).replaceAll('\\', '/'), source_sha256: digest(original), exported_sha256: digest(bytes), bytes: bytes.length, transformed: json });
}
for (const lane of ['a', 'b']) {
  const logical = `autodev-20260925-${lane}`;
  const taskPath = path.join(source, `${logical}-result.json`);
  const task = JSON.parse(await fs.readFile(taskPath, 'utf8'));
  const directory = path.join(source, 'build-tasks', task.task_id, 'development');
  await copy(taskPath, `${lane}/task.json`, true);
  const eventsFile = path.join(directory, 'harness-events.json');
  const raw = await fs.readFile(eventsFile); const events = JSON.parse(raw);
  const publicEvents = events.filter(event => ['tool_call', 'tool_result', 'status'].includes(event.type));
  await fs.writeFile(path.join(output, lane, 'tool-transcript.json'), JSON.stringify(sanitize(publicEvents), null, 2) + '\n');
  manifest.files.push({ file: `${lane}/tool-transcript.json`, source_sha256: digest(raw), exported_sha256: digest(await fs.readFile(path.join(output, lane, 'tool-transcript.json'))), transformed: true, omitted: ['session', 'thinking', 'text', 'final'] });
  await copy(path.join(directory, 'harness-summary.json'), `${lane}/harness-summary.json`, true);
  await copy(path.join(directory, 'agent-input.txt'), `${lane}/agent-input.txt`);
  for (const run of task.development.self_tests) {
    await copy(path.join(directory, run.candidate_path), `${lane}/dev-${run.number}/candidate.spec.mjs`);
    await copy(path.join(directory, run.report_path), `${lane}/dev-${run.number}/report.json`, true);
    const shot = run.media.find(file => file.relative_path.endsWith('.png'));
    if (shot) await copy(path.join(directory, shot.relative_path), `${lane}/dev-${run.number}/screenshot.png`);
  }
  await copy(path.join(directory, task.development.submission.file), `${lane}/final/candidate.spec.mjs`);
  for (const run of task.candidates[0].trial_runs) {
    await copy(path.join(directory, 'final', run.run_type, 'playwright-report.json'), `${lane}/final/${run.run_type}-report.json`, true);
    const candidates = task.files.filter(file => file.relative_path.includes(`/final/${run.run_type}/`) && file.relative_path.endsWith('.png'));
    if (candidates[0]) await copy(path.join(source, 'build-tasks', task.task_id, candidates[0].relative_path), `${lane}/final/${run.run_type}.png`);
  }
  await copy(path.join(source, `${logical}-workbench.png`), `${lane}/workbench.png`);
  manifest.tasks.push({ logical_id: logical, task_id: task.task_id, external_id: task.source.external_id, status: task.task_status, started_at: task.started_at, finished_at: task.finished_at, elapsed_ms: Date.parse(task.finished_at) - Date.parse(task.started_at), harness_starts: task.development.harness_starts, tool_calls: task.development.tool_calls, tool_errors: events.filter(event => event.type === 'tool_result' && event.status === 'error').length, model_steps: events.filter(event => event.type === 'status' && event.phase === 'step_end').length, developer_self_tests: task.development.self_tests.length, final_executions: task.candidates[0].trial_runs.length, final_sha256: task.development.submission.sha256, candidate_approved: false });
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.tasks, null, 2));

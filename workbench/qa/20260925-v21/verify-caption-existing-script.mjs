// A real archived script, executed through the repaired development self-test
// path. This is engineering verification, NOT a new product task or batch.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DevelopmentSession, digest } from '../../server/build/development-session.mjs';
import { loadCandidateBundle } from '../../server/build/candidate-trials.mjs';
import { saveBundle } from '../../server/build/development-bundle.mjs';
import { verifyWorkbenchCandidate } from '../../server/build/adapter.mjs';
import { frozenTrialEnvironment } from '../../server/build/trial-environment.mjs';
const taskId = 'build-20260925104223-1281faca';
const response = await fetch('http://127.0.0.1:4322/api/build/tasks/' + taskId);
assert.equal(response.ok, true);
const task = await response.json(), candidate = task.candidates.at(-1);
const originalRoot = path.resolve('workbench/.local/fresh25-b/build-tasks', taskId, 'development/final');
const bundle = await loadCandidateBundle(originalRoot, candidate.bundle);
const environment = frozenTrialEnvironment({ id: 'kimi-complex-20260925', kind: 'registered-static-html', file: 'qa/20260925-kimi-complex/index.html', sha256: '649508B83110076A267D4BD99C9424508E06408DDA060B6BA87D6B1FC715CCF0' });
const lease = await environment.acquire('normal');
const root = await fs.mkdtemp(path.resolve('workbench/.local/caption-kc02-'));
const executable = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const evidenceIdentity = { task_id: 'engineering-kc02-capture', executed_case_id: task.source.case_id, executed_external_id: 'KC-02', executed_case_version: task.source.case_version, executed_content_sha256: task.source.content_sha256 };
try {
  const session = new DevelopmentSession({ directory: root, frozenCase: task.input_bundle.snapshot.content, normalUrl: lease.url,
    evidenceIdentity, browserExecutable: executable, signal: new AbortController().signal,
    verify: options => verifyWorkbenchCandidate({ ...options, browserExecutable: executable }),
    persist: state => fs.writeFile(path.join(root, 'state.json'), JSON.stringify(state, null, 2)) });
  await session.init(); await saveBundle(bundle, path.dirname(session.draftPath));
  const run = await session.invoke('self_test');
  assert.equal(run.bundle_sha256, candidate.bundle.sha256);
  assert.equal(run.sha256, candidate.sha256);
  assert.equal(run.result.test_status, 'FAILED');
  assert.deepEqual(run.coverage.items.map(s => s.execution_status), ['FAILED', 'PASSED', 'PASSED']);
  assert.equal(run.step_replay.status, 'READY');
  assert.equal(run.step_replay.evidence_complete, true);
  assert.match(run.step_replay.steps[0].actual, /5/);
  assert.equal(run.step_replay.chapters.length, 3);
  for (const file of bundle.files) assert.equal(digest(await fs.readFile(path.join(originalRoot, file.path))), file.sha256);
  const result = { checked_at: new Date().toISOString(), scope: 'ENGINEERING_EXISTING_SCRIPT_CAPTURE_NOT_PRODUCT_BATCH', model_calls: 0, harness_starts: 0,
    source_task_id: taskId, source_candidate_version: candidate.version, candidate_sha256: candidate.sha256, bundle_sha256: candidate.bundle.sha256,
    root, replay_path: path.join(root, 'run-1/evidence/artifacts/step-replay-v1.webm'), result: run.result.test_status,
    step_replay: run.step_replay, original_files_unchanged: true };
  await fs.writeFile('workbench/qa/20260925-v21/caption-existing-script.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ case: 'KC-02', result: result.result, steps: run.coverage.items.map(s => s.execution_status), replay: run.step_replay.status, actual: run.step_replay.steps[0].actual, model_calls: 0 }));
} finally { await lease.release(); }

import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256File } from '../integrity.mjs';

async function listFiles(root) {
  const output = [];
  async function visit(directory) {
    let entries = [];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) output.push(absolute);
    }
  }
  await visit(root);
  return output;
}

function category(relative, candidateRelative) {
  if (relative === candidateRelative) return { kind: 'candidate', web_visible: true, content_type: 'text/plain; charset=utf-8' };
  if (/\/workspace\/task\.md$/i.test(`/${relative}`)) return { kind: 'attempt_task_document', web_visible: true, content_type: 'text/markdown; charset=utf-8' };
  if (/\/workspace\/input\/case-snapshot\.json$/i.test(`/${relative}`)) return { kind: 'attempt_input_snapshot', web_visible: true, content_type: 'application/json; charset=utf-8' };
  if (/\/workspace\/agent-instruction\.txt$/i.test(`/${relative}`)) return { kind: 'rendered_agent_instruction', web_visible: true, content_type: 'text/plain; charset=utf-8' };
  if (/\/\.playwright-mcp\/.*\.log$/i.test(`/${relative}`)) return { kind: 'tool_log', web_visible: false, content_type: 'text/plain; charset=utf-8' };
  if (/\/\.playwright-mcp\/.*\.(?:yml|yaml)$/i.test(`/${relative}`)) return { kind: 'tool_snapshot', web_visible: false, content_type: 'text/yaml; charset=utf-8' };
  if (/\/playwright-report\.json$/i.test(`/${relative}`)) return { kind: 'test_report', web_visible: false, content_type: 'application/json; charset=utf-8' };
  if (/\/observer-entry\/observed\.spec\.mjs$/i.test(`/${relative}`)) return { kind: 'step_observer_entry', web_visible: false, content_type: 'text/plain; charset=utf-8' };
  if (/\/step-evidence\/step-observations\.ndjson$/i.test(`/${relative}`)) return { kind: 'step_observations', web_visible: false, content_type: 'application/x-ndjson; charset=utf-8' };
  if (/\/step-evidence\/observation-write-error\.txt$/i.test(`/${relative}`)) return { kind: 'step_observation_error', web_visible: false, content_type: 'text/plain; charset=utf-8' };
  if (/\/verification\/normal\/(?:runs\/[^/]+\/)?artifacts\/.*\.png$/i.test(`/${relative}`)) return { kind: 'normal_screenshot', web_visible: false, content_type: 'image/png' };
  if (/\/verification\/normal\/(?:runs\/[^/]+\/)?artifacts\/captioned(?:-v\d+)?\.webm$/i.test(`/${relative}`)) return { kind: 'normal_caption_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/normal\/runs\/[^/]+\/artifacts\/step-replay-v\d+\.webm$/i.test(`/${relative}`)) return { kind: 'normal_step_replay_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/normal\/(?:runs\/[^/]+\/)?artifacts\/.*\.webm$/i.test(`/${relative}`)) return { kind: 'normal_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/normal\/(?:runs\/[^/]+\/)?artifacts\/.*\.zip$/i.test(`/${relative}`)) return { kind: 'normal_trace', web_visible: false, content_type: 'application/zip' };
  if (/\/verification\/negative\/(?:runs\/[^/]+\/)?artifacts\/.*\.png$/i.test(`/${relative}`)) return { kind: 'counterexample_screenshot', web_visible: false, content_type: 'image/png' };
  if (/\/verification\/negative\/(?:runs\/[^/]+\/)?artifacts\/captioned(?:-v\d+)?\.webm$/i.test(`/${relative}`)) return { kind: 'counterexample_caption_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/negative\/runs\/[^/]+\/artifacts\/step-replay-v\d+\.webm$/i.test(`/${relative}`)) return { kind: 'counterexample_step_replay_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/negative\/(?:runs\/[^/]+\/)?artifacts\/.*\.webm$/i.test(`/${relative}`)) return { kind: 'counterexample_video', web_visible: false, content_type: 'video/webm' };
  if (/\/verification\/negative\/(?:runs\/[^/]+\/)?artifacts\/.*\.zip$/i.test(`/${relative}`)) return { kind: 'counterexample_trace', web_visible: false, content_type: 'application/zip' };
  if (/\/verification\/(?:normal|negative)\/(?:runs\/[^/]+\/)?artifacts\/\.last-run\.json$/i.test(`/${relative}`)) return { kind: 'verification_metadata', web_visible: false, content_type: 'application/json; charset=utf-8' };
  if (/\/verification\/(?:normal|negative)\/(?:runs\/[^/]+\/)?artifacts\/.*\/error-context\.md$/i.test(`/${relative}`)) return { kind: 'verification_diagnostic', web_visible: false, content_type: 'text/markdown; charset=utf-8' };
  if (/\/harness-summary\.json$/i.test(`/${relative}`)) return { kind: 'harness_report', web_visible: false, content_type: 'application/json; charset=utf-8' };
  if (/\/lifecycle\.ndjson$/i.test(`/${relative}`)) return { kind: 'lifecycle_log', web_visible: false, content_type: 'application/x-ndjson; charset=utf-8' };
  return null;
}

export async function indexAttemptFiles({ taskRoot, attemptRoot, candidatePath, attemptId, startIndex = 0, runId = null, alreadyIndexed = [] }) {
  const candidateRelative = path.relative(taskRoot, candidatePath).replaceAll('\\', '/');
  const indexedPaths = new Set(alreadyIndexed);
  const files = [];
  const unexpected = [];
  for (const absolute of await listFiles(attemptRoot)) {
    const relative = path.relative(taskRoot, absolute).replaceAll('\\', '/');
    if (indexedPaths.has(relative)) continue;
    if (/\/(?:feedback\.json|input\/candidate-v\d+\.spec\.mjs)$/.test(`/${relative}`)) continue;
    const descriptor = category(relative, candidateRelative);
    if (!descriptor) { unexpected.push(relative); continue; }
    const stat = await fs.stat(absolute);
    files.push({
      file_id: `build-file-${String(startIndex + files.length + 1).padStart(3, '0')}`,
      attempt_id: attemptId,
      ...(runId ? { run_id: runId } : {}),
      ...descriptor,
      file_name: path.basename(absolute),
      relative_path: relative,
      bytes: stat.size,
      sha256: await sha256File(absolute),
    });
  }
  return { files, unexpected };
}

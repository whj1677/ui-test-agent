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
  if (/\/\.playwright-mcp\/.*\.log$/i.test(`/${relative}`)) return { kind: 'tool_log', web_visible: false, content_type: 'text/plain; charset=utf-8' };
  if (/\/\.playwright-mcp\/.*\.(?:yml|yaml)$/i.test(`/${relative}`)) return { kind: 'tool_snapshot', web_visible: false, content_type: 'text/yaml; charset=utf-8' };
  if (/\/playwright-report\.json$/i.test(`/${relative}`)) return { kind: 'test_report', web_visible: false, content_type: 'application/json; charset=utf-8' };
  if (/\/harness-summary\.json$/i.test(`/${relative}`)) return { kind: 'harness_report', web_visible: false, content_type: 'application/json; charset=utf-8' };
  return null;
}

export async function indexAttemptFiles({ taskRoot, attemptRoot, candidatePath, attemptId, startIndex = 0 }) {
  const candidateRelative = path.relative(taskRoot, candidatePath).replaceAll('\\', '/');
  const files = [];
  const unexpected = [];
  for (const absolute of await listFiles(attemptRoot)) {
    const relative = path.relative(taskRoot, absolute).replaceAll('\\', '/');
    if (/\/(?:task\.md|feedback\.json|input\/candidate-v\d+\.spec\.mjs)$/.test(`/${relative}`)) continue;
    const descriptor = category(relative, candidateRelative);
    if (!descriptor) { unexpected.push(relative); continue; }
    const stat = await fs.stat(absolute);
    files.push({
      file_id: `build-file-${String(startIndex + files.length + 1).padStart(3, '0')}`,
      attempt_id: attemptId,
      ...descriptor,
      file_name: path.basename(absolute),
      relative_path: relative,
      bytes: stat.size,
      sha256: await sha256File(absolute),
    });
  }
  return { files, unexpected };
}

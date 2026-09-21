const FIXED_FILES = new Set([
  'feedback.json',
  'input/attempt-2-candidate.spec.mjs',
  'output/revised-candidate.spec.mjs',
  'task.md',
]);

export function classifyWorkspaceFiles(files) {
  const taskFiles = [];
  const toolEvidence = [];
  const unexpected = [];
  for (const file of files) {
    if (FIXED_FILES.has(file)) taskFiles.push(file);
    else if (file.startsWith('.playwright-mcp/')) toolEvidence.push(file);
    else unexpected.push(file);
  }
  return {
    taskFiles,
    toolEvidence,
    unexpected,
    candidateRegistered: taskFiles.includes('output/revised-candidate.spec.mjs'),
    accepted: unexpected.length === 0 && taskFiles.includes('output/revised-candidate.spec.mjs'),
  };
}

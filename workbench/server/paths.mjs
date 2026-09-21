import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
export const workbenchRoot = path.dirname(serverRoot);
export const repoRoot = path.dirname(workbenchRoot);

export function createPaths(options = {}) {
  const localRoot = path.resolve(
    options.localRoot || process.env.WORKBENCH_DATA_DIR || path.join(workbenchRoot, '.local'),
  );
  return {
    repoRoot: path.resolve(options.repoRoot || repoRoot),
    workbenchRoot: path.resolve(options.workbenchRoot || workbenchRoot),
    localRoot,
    dataRoot: path.join(localRoot, 'data'),
    runsRoot: path.join(localRoot, 'data', 'runs'),
    buildTasksRoot: path.join(localRoot, 'build-tasks'),
    buildRuntimeRoot: path.join(localRoot, 'build-runtime'),
    buildRevalidationsRoot: path.join(localRoot, 'candidate-revalidations'),
  };
}

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function developmentPatch(base, workbenchRoot) {
  const guard = pathToFileURL(path.join(workbenchRoot, 'server/build/development-tool-guard.mjs')).href;
  return base + `\n- insert:\n    - id: workbench-development-guard\n      name: ${JSON.stringify(guard)}\n    - id: workbench-development-mcp\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: workbench\n        transport: streamable-http\n        url: !!js process.env.WORKBENCH_DEVELOPMENT_ENDPOINT\n        toolCallTimeoutMs: 90000\n        failOnStartupError: true\n`;
}

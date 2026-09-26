import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function developmentPatch(base, workbenchRoot, { authAttach = false } = {}) {
  const guard = pathToFileURL(path.join(workbenchRoot, 'server/build/development-tool-guard.mjs')).href;
  const browserBase = authAttach ? base.replace(/mode: launch\r?\n([ \t]*)headless: true\r?\n[ \t]*executablePath: [^\r\n]+/,
    'mode: attach\n$1endpoint: !!js process.env.WORKBENCH_AUTH_CDP_ENDPOINT') : base;
  if (authAttach && browserBase === base) throw new Error('DEVELOPMENT_AUTH_PATCH_INVALID');
  return browserBase + `\n- insert:\n    - id: workbench-development-guard\n      name: ${JSON.stringify(guard)}\n    - id: workbench-development-mcp\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: workbench\n        transport: streamable-http\n        url: !!js process.env.WORKBENCH_DEVELOPMENT_ENDPOINT\n        toolCallTimeoutMs: 90000\n        failOnStartupError: true\n`;
}

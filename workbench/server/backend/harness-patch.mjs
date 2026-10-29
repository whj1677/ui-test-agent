import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function backendHarnessPatch(workbenchRoot) {
  const guard = pathToFileURL(path.join(workbenchRoot, 'server/backend/harness-tool-guard.mjs')).href;
  return `- id: agent-default-model\n  config:\n    provider: deepseek-official\n    model: deepseek-flash\n- id: llm-deepseek\n  config:\n    protocol: messages\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- insert:\n    - id: backend-tool-guard\n      name: ${JSON.stringify(guard)}\n    - id: backend-workbench-mcp\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: workbench-backend\n        transport: streamable-http\n        url: !!js process.env.WORKBENCH_BACKEND_ENDPOINT\n        toolCallTimeoutMs: 240000\n        failOnStartupError: true\n`;
}

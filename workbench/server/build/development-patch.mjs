import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function developmentPatch(base, workbenchRoot, { authAttach = false } = {}) {
  const guard = pathToFileURL(path.join(workbenchRoot, 'server/build/development-tool-guard.mjs')).href;
  const browserBase = authAttach ? base.replace(/mode: launch\r?\n([ \t]*)headless: true\r?\n[ \t]*executablePath: [^\r\n]+/,
    'mode: attach\n$1endpoint: !!js process.env.WORKBENCH_AUTH_CDP_ENDPOINT') : base;
  if (authAttach && browserBase === base) throw new Error('DEVELOPMENT_AUTH_PATCH_INVALID');
  const withPolicy = browserBase.replace(/(- id: llm-deepseek\r?\n  config:\r?\n    protocol: messages)(?=\r?\n)/,
    '$1\n    retryPolicy:\n      mode: normal\n      maxRetries: 2\n      retryableCodes:\n        - TIMEOUT\n        - TRANSPORT\n        - SERVER\n      backoff:\n        initialDelayMs: 500\n        maxDelayMs: 2000\n        jitterRatio: 0.1');
  const withRetry = withPolicy.replace(/- id: llm-retry\r?\n  disabled: true(?=\r?\n|$)/, '- id: llm-retry\n  disabled: false');
  if (withPolicy === browserBase || withRetry === withPolicy) throw new Error('DEVELOPMENT_RETRY_PATCH_INVALID');
  return withRetry + `\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- insert:\n    - id: workbench-development-guard\n      name: ${JSON.stringify(guard)}\n    - id: workbench-development-mcp\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: workbench\n        transport: streamable-http\n        url: !!js process.env.WORKBENCH_DEVELOPMENT_ENDPOINT\n        toolCallTimeoutMs: 240000\n        failOnStartupError: true\n`;
}

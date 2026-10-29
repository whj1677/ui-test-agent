const modulesIn = output => {
  const modules = new Map();
  let current = null;
  for (const line of String(output || '').split(/\r?\n/)) {
    const id = line.match(/^- id: ([a-z0-9-]+)$/);
    if (id) {
      current = id[1];
      if (modules.has(current)) return null;
      modules.set(current, { disabled: false, text: '' });
      continue;
    }
    if (current) {
      const module = modules.get(current);
      module.text += line + '\n';
      const disabled = line.match(/^  disabled: (true|false)$/);
      if (disabled) module.disabled = disabled[1] === 'true';
    }
  }
  return modules;
};

const DEVELOPMENT_RETRY_BLOCK = [
  "  name: '@deepseek-ai/dsh-llm-deepseek'",
  '  config:',
  '    protocol: messages',
  '    retryPolicy:',
  '      mode: normal',
  '      maxRetries: 2',
  '      retryableCodes:',
  '        - TIMEOUT',
  '        - TRANSPORT',
  '        - SERVER',
  '      backoff:',
  '        initialDelayMs: 500',
  '        maxDelayMs: 2000',
  '        jitterRatio: 0.1',
].join('\n');

export function assertControlledDshConfig(output, { guard, mcp, errorCode, retryPolicy = null }) {
  const fail = () => { throw new Error(errorCode); };
  const modules = modulesIn(output);
  if (!modules) fail();
  for (const id of ['skill-filesystem', 'tool-skill']) if (modules.get(id)?.disabled !== true) fail();
  for (const id of [guard, mcp]) if (!modules.has(id) || modules.get(id).disabled) fail();
  if (!/^    model: deepseek-flash$/m.test(modules.get('agent-default-model')?.text || '')) fail();
  if (retryPolicy === 'development-transport-v1') {
    if (guard !== 'workbench-development-guard' || mcp !== 'workbench-development-mcp') fail();
    const retry = modules.get('llm-retry');
    if (retry?.disabled || !/^  name: '@deepseek-ai\/dsh-llm-retry'$/m.test(retry?.text || '') || !/^  disabled: false$/m.test(retry?.text || '')) fail();
    const provider = modules.get('llm-deepseek')?.text.split('\n').filter(line => line && !line.startsWith('#')).join('\n');
    if (provider !== DEVELOPMENT_RETRY_BLOCK) fail();
  } else if (retryPolicy === null) {
    if (modules.get('llm-retry')?.disabled !== true) fail();
  } else fail();
  return true;
}

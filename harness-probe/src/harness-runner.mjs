import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from './process-control.mjs';
import { redactText, redactValue } from './redact.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DSH_BIN = path.join(ROOT, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');

function allowedEnvironment(overrides = {}) {
  const names = ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA'];
  const env = Object.fromEntries(names.flatMap((name) => process.env[name] ? [[name, process.env[name]]] : []));
  return { ...env, NO_COLOR: '1', ...overrides };
}

function parseEvent(line, events) {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === 'object') {
      events.push(parsed);
      return parsed;
    }
  } catch {
    events.push({
      type: 'invalid_json',
      bytes: Buffer.byteLength(line),
      sha256: createHash('sha256').update(line).digest('hex').toUpperCase(),
    });
  }
  return null;
}

function eventMetadata(event) {
  const metadata = { type: 'harness_event', at: new Date().toISOString(), event_type: event?.type || 'unknown' };
  if (typeof event?.phase === 'string') metadata.phase = event.phase;
  if (typeof event?.tool === 'string') metadata.tool = event.tool;
  if (typeof event?.reason?.kind === 'string') metadata.reason = event.reason.kind;
  if (Number.isInteger(event?.bytes)) metadata.bytes = event.bytes;
  return metadata;
}

export function createToolBudgetObserver(maxToolCalls, abort) {
  if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1) throw new Error('maxToolCalls must be a positive integer');
  let toolCalls = 0;
  let reached = false;
  return {
    observe(event) {
      if (event?.type !== 'tool_call' || reached) return;
      toolCalls += 1;
      if (toolCalls >= maxToolCalls) { reached = true; abort('tool_limit'); }
    },
    count: () => toolCalls,
  };
}

export async function fileSummary(candidatePath, workspace) {
  const resolved = path.resolve(candidatePath);
  const root = path.resolve(workspace) + path.sep;
  if (!resolved.startsWith(root)) throw new Error('candidate path escapes workspace');
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error('candidate is not a file');
  const content = await readFile(resolved);
  return {
    path: path.relative(workspace, resolved).replaceAll('\\', '/'),
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex').toUpperCase(),
  };
}

export function assessHarnessRun({ processResult, events, candidateExists, browserToolRequired = true }) {
  const turnEnd = [...events].reverse().find((event) => event.type === 'status' && event.phase === 'turn_end');
  const final = [...events].reverse().find((event) => event.type === 'final');
  const browserCalls = events.filter((event) => event.type === 'tool_call' && /^mcp__playwright-mcp__/.test(event.tool ?? ''));
  const completed = processResult.exitCode === 0 && processResult.termination === null &&
    processResult.outputComplete !== false && processResult.closeObserved !== false && !processResult.observerError &&
    turnEnd?.reason?.kind === 'completed' && Boolean(final);
  const success = completed && candidateExists && (!browserToolRequired || browserCalls.length > 0);
  return {
    success,
    completed,
    candidateExists,
    browserToolCalls: browserCalls.length,
    exitCode: processResult.exitCode,
    termination: processResult.termination,
    error: processResult.error,
    finalPresent: Boolean(final),
    turnEndReason: turnEnd?.reason?.kind ?? null,
  };
}

export async function runHarnessEventProcess({
  command, args, cwd, env, timeoutMs, signal, maxToolCalls = 30, onLifecycle,
}) {
  const events = [];
  const budgetController = new AbortController();
  const forwardAbort = () => budgetController.abort(typeof signal?.reason === 'string' ? signal.reason : 'cancelled');
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });
  const toolBudget = createToolBudgetObserver(maxToolCalls, (reason) => budgetController.abort(reason));
  const processResult = await runOwnedProcess(command, args, {
    cwd, env, timeoutMs, signal: budgetController.signal, onLifecycle,
    onStdoutLine: (line) => {
      const event = parseEvent(line, events);
      if (event) toolBudget.observe(event);
      const observed = event || events.at(-1);
      if (observed) return onLifecycle?.(eventMetadata(observed));
      return undefined;
    },
  });
  signal?.removeEventListener('abort', forwardAbort);
  return { events, processResult, toolCalls: toolBudget.count(), maxToolCalls };
}

export async function runHarnessTask({ task, workspace, dshHome, patchPath, candidatePath, browserExecutable, browserAttachEndpoint = null, apiKey, baseUrl, timeoutMs, signal, maxToolCalls = 30, onLifecycle }) {
  const providerEnvironment = {};
  if (apiKey) providerEnvironment.DEEPSEEK_API_KEY = apiKey;
  if (baseUrl) providerEnvironment.DEEPSEEK_BASE_URL = baseUrl;
  const childEnv = allowedEnvironment({
    DSH_HOME: dshHome,
    DSH_PROBE_BROWSER_EXECUTABLE: browserExecutable,
    ...(browserAttachEndpoint ? { WORKBENCH_AUTH_CDP_ENDPOINT: browserAttachEndpoint } : {}),
    ...providerEnvironment,
  });
  const execution = await runHarnessEventProcess({ command: process.execPath, args: [
    DSH_BIN,
    '--profile', 'headless',
    '--patch', browserAttachEndpoint ? path.join(ROOT, 'config', 'browser-auth-attach.cordis.yml') : patchPath,
    '--json',
    task,
  ],
    cwd: workspace,
    env: childEnv,
    timeoutMs,
    signal,
    maxToolCalls,
    onLifecycle,
  });
  const { events, processResult } = execution;
  const candidateExists = existsSync(candidatePath);
  const assessment = assessHarnessRun({ processResult, events, candidateExists });
  assessment.toolCalls = execution.toolCalls;
  assessment.maxToolCalls = maxToolCalls;
  assessment.toolLimitReached = processResult.termination === 'tool_limit';
  const secrets = [apiKey, browserAttachEndpoint].filter(Boolean);
  return {
    process: {
      ...processResult,
      stdout: redactText(processResult.stdout, secrets),
      stderr: redactText(processResult.stderr, secrets),
    },
    events: redactValue(events, secrets),
    assessment,
    candidate: candidateExists ? await fileSummary(candidatePath, workspace) : null,
  };
}

export { ROOT, DSH_BIN, allowedEnvironment };

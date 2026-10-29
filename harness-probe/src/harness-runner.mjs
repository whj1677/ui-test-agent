import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from './process-control.mjs';
import { redactText, redactValue } from './redact.mjs';
import { deepSeekHarnessBaseUrl, harnessNetworkEnvironment } from './provider-environment.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DSH_BIN = path.join(ROOT, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');

// Provider messages can contain request details; retain only documented codes.
const providerErrorCodes = new Set(['TRANSPORT', 'TIMEOUT', 'RATE_LIMIT', 'AUTH', 'AUTHENTICATION', 'PERMISSION', 'SERVER', 'SERVER_ERROR', 'EMPTY_RESPONSE', 'ABORTED']);
export function harnessProviderError(event) {
  const code = event?.reason?.error?.code;
  return event?.reason?.kind === 'error' && providerErrorCodes.has(code) ? { code } : null;
}

function allowedEnvironment(overrides = {}) {
  const names = ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'PLAYWRIGHT_BROWSERS_PATH'];
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

export function eventMetadata(event) {
  const metadata = { type: 'harness_event', at: new Date().toISOString(), event_type: event?.type || 'unknown' };
  if (typeof event?.phase === 'string') metadata.phase = event.phase;
  if (typeof event?.tool === 'string') metadata.tool = event.tool;
  if (typeof event?.callId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(event.callId)) metadata.call_id = event.callId;
  if (event?.type === 'tool_result' && ['completed', 'error'].includes(event.status)) metadata.tool_status = event.status;
  if (typeof event?.reason?.kind === 'string') metadata.reason = event.reason.kind;
  const providerError = harnessProviderError(event);
  if (providerError) metadata.provider_error = providerError;
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
  const completed = processResult.exitCode === 0 && processResult.termination === null && !processResult.error &&
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
    provider_error: harnessProviderError(turnEnd),
  };
}

export async function runHarnessEventProcess({
  command, args, cwd, env, timeoutMs, signal, maxToolCalls = 30, onLifecycle, stdin,
}) {
  const events = [];
  const budgetController = new AbortController();
  const forwardAbort = () => budgetController.abort(typeof signal?.reason === 'string' ? signal.reason : 'cancelled');
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });
  const toolBudget = createToolBudgetObserver(maxToolCalls, (reason) => budgetController.abort(reason));
  const processResult = await runOwnedProcess(command, args, {
    cwd, env, timeoutMs, signal: budgetController.signal, onLifecycle, stdin,
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

export async function runHarnessTask({ task, workspace, dshHome, patchPath, candidatePath, browserExecutable, browserAttachEndpoint = null, developmentEndpoint = null, developmentNormalUrl = null, developmentConvergence = false, apiKey, baseUrl, timeoutMs, signal, maxToolCalls = 30, onLifecycle, runProcess = runHarnessEventProcess, networkEnvironment = process.env }) {
  const providerEnvironment = {};
  if (apiKey) providerEnvironment.DEEPSEEK_API_KEY = apiKey;
  if (baseUrl) providerEnvironment.DEEPSEEK_BASE_URL = deepSeekHarnessBaseUrl(baseUrl);
  const childEnv = allowedEnvironment({
    ...harnessNetworkEnvironment(networkEnvironment),
    DSH_HOME: dshHome,
    DSH_PROBE_BROWSER_EXECUTABLE: browserExecutable,
    ...(browserAttachEndpoint ? { WORKBENCH_AUTH_CDP_ENDPOINT: browserAttachEndpoint } : {}),
    ...(developmentEndpoint ? { WORKBENCH_DEVELOPMENT_ENDPOINT: developmentEndpoint, WORKBENCH_DEVELOPMENT_NORMAL_URL: developmentNormalUrl, WORKBENCH_DEVELOPMENT_DIRECTORY: workspace } : {}),
    ...(developmentEndpoint && developmentConvergence ? { WORKBENCH_DEVELOPMENT_CONVERGENCE: '1' } : {}),
    ...providerEnvironment,
  });
  const execution = await runProcess({ command: process.execPath, args: [
    DSH_BIN,
    '--profile', 'headless',
    '--patch', browserAttachEndpoint && !developmentEndpoint ? path.join(ROOT, 'config', 'browser-auth-attach.cordis.yml') : patchPath,
    '--json',
    '-',
  ],
    // dsh's headless app reads '-' from stdin until EOF. Preserve the complete
    // prompt while avoiding Windows' command-line length limit.
    stdin: task,
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
  const secrets = [apiKey, browserAttachEndpoint, developmentEndpoint].filter(Boolean);
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

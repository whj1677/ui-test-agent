import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { runHarnessEventProcess, allowedEnvironment, DSH_BIN, assessHarnessRun, harnessProviderError } from '../../../harness-probe/src/harness-runner.mjs';
import { runOwnedProcess } from '../../../harness-probe/src/process-control.mjs';
import { deepSeekHarnessBaseUrl, harnessNetworkEnvironment } from '../../../harness-probe/src/provider-environment.mjs';
import { assertControlledDshConfig } from '../skills/config-isolation.mjs';
import { CaseAssistantMcpSession, startCaseAssistantMcp } from './mcp-session.mjs';
import { freezeCaseDesignSkill, caseAssistantPatch, caseAssistantPrompt } from './prompt.mjs';
import { isToolJsonFailure, JSON_RECOVERY_LIMIT } from './json-recovery.mjs';

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const safeError = error => /^CASE_ASSISTANT_[A-Z_]+$/.test(error?.message || '') ? error.message : 'CASE_ASSISTANT_GENERATION_FAILED';
const safeTermination = value => ['timeout', 'tool_limit', 'cancelled', 'observer_error'].includes(value) ? value : null;
const childEnvironment = extra => ({ ...allowedEnvironment(), ...harnessNetworkEnvironment(), ...extra });
const defaultProbe = ({ command, args, ...options }) => runOwnedProcess(command, args, options);

function processEvidence(result) {
  const process = result?.processResult || {};
  const events = Array.isArray(result?.events) ? result.events : [];
  const ending = [...events].reverse().find(event => event?.type === 'status' && event.phase === 'turn_end');
  const jsonRetries = events.filter(event => event?.type === 'status' && event.phase === 'case_assistant_json_retry' &&
    Number.isInteger(event.retry) && event.retry > 0 && event.retry <= JSON_RECOVERY_LIMIT && event.max_retries === JSON_RECOVERY_LIMIT);
  return { exit_code: Number.isInteger(process.exitCode) ? process.exitCode : null,
    termination: safeTermination(process.termination), output_complete: process.outputComplete === true,
    close_observed: process.closeObserved === true, final_seen: events.some(event => event?.type === 'final'),
    turn_end_reason: ['completed', 'aborted', 'error', 'cancelled'].includes(ending?.reason?.kind) ? ending.reason.kind : null,
    provider_error: ending?.reason?.error?.code === 'MALFORMED_RESPONSE' ? 'MALFORMED_RESPONSE' : harnessProviderError(ending)?.code || null,
    tool_json_invalid: isToolJsonFailure(ending?.reason?.error),
    json_recovery_attempts: jsonRetries.map(event => ({ retry: event.retry, max_retries: event.max_retries })),
    tool_call_events: events.filter(event => event?.type === 'tool_call').length };
}

export function createCaseAssistantClient({ config = {}, root, runHarness = runHarnessEventProcess, probeConfig = defaultProbe } = {}) {
  const directoryRoot = root ? path.resolve(root) : null;
  const configured = () => Boolean(directoryRoot && config.provider === 'deepseek-official' && config.model === 'deepseek-flash' &&
    typeof config.credentialProvider === 'function' && typeof config.dshHome === 'string' &&
    existsSync(DSH_BIN) && existsSync(path.join(config.dshHome, 'profiles', 'headless', 'package.json')));
  return {
    get available() { return configured(); },
    async generate({ taskId, projectId, turnId, messages, sources, previous = null, signal, onProgress = async () => {} }) {
      if (!configured()) throw new Error('CASE_ASSISTANT_DSH_UNAVAILABLE');
      if (![taskId, projectId, turnId].every(validId)) throw new Error('CASE_ASSISTANT_ID_INVALID');
      if (!Array.isArray(sources) || sources.length > 20 || !Array.isArray(messages) || messages.length > 200) throw new Error('CASE_ASSISTANT_INPUT_LIMIT_EXCEEDED');
      const startedAt = Date.now();
      const started = new Date(startedAt).toISOString();
      const timeoutMs = Number.isInteger(config.timeoutMs) && config.timeoutMs > 0 && config.timeoutMs <= 600000 ? config.timeoutMs : 360000;
      const controller = new AbortController();
      let timedOut = false;
      const forwardAbort = () => controller.abort('cancelled');
      if (signal?.aborted) forwardAbort(); else signal?.addEventListener('abort', forwardAbort, { once: true });
      const timer = setTimeout(() => { timedOut = true; controller.abort('timeout'); }, timeoutMs);
      const check = () => {
        if (controller.signal.aborted) throw new Error(timedOut ? 'CASE_ASSISTANT_TIMED_OUT' : 'CASE_ASSISTANT_CANCELLED');
      };
      const remainingMs = () => Math.max(1, timeoutMs - (Date.now() - startedAt));
      const reportProgress = async event => { check(); await onProgress({ ...event, elapsed_ms: Date.now() - startedAt }); check(); };
      let endpoint, session, skill, execution;
      const evidence = () => ({ provider: 'deepseek-official', model: 'deepseek-flash', engine: 'dsh',
        started_at: started, finished_at: new Date().toISOString(), elapsed_ms: Date.now() - startedAt,
        skill: skill ? { name: skill.name, sha256: skill.sha256 } : null,
        process: processEvidence(execution), ...(session?.evidence() || {}),
        limits: { tool_calls: 80, wall_ms: timeoutMs, source_files: 20, images: 20, json_retries: JSON_RECOVERY_LIMIT },
        executes_tests: false, auto_imports: false });
      try {
        check();
        await reportProgress({ stage: 'STARTING' });
        try { skill = await freezeCaseDesignSkill(); }
        catch { throw new Error('CASE_ASSISTANT_SKILL_UNAVAILABLE'); }
        const credentials = await config.credentialProvider();
        check();
        if (!credentials?.apiKey || !credentials?.baseUrl) throw new Error('CASE_ASSISTANT_CREDENTIALS_UNAVAILABLE');
        const directory = path.join(directoryRoot, projectId, taskId, turnId, 'runtime');
        await fs.mkdir(directory, { recursive: true });
        const patchPath = path.join(directory, 'case-assistant.cordis.yml');
        await fs.writeFile(patchPath, caseAssistantPatch(), 'utf8');
        await fs.writeFile(path.join(directory, 'SKILL.snapshot.md'), skill.text, 'utf8');
        session = new CaseAssistantMcpSession({ projectId, messages, sources, previous, signal: controller.signal, onProgress: reportProgress });
        endpoint = await startCaseAssistantMcp(session);
        check();
        const probe = await probeConfig({ command: process.execPath, args: [DSH_BIN, '--profile', 'headless', '--patch', patchPath, '--dump-config'],
          cwd: directory, env: childEnvironment({ DSH_HOME: config.dshHome }), signal: controller.signal, timeoutMs: Math.min(30000, remainingMs()) });
        check();
        if (probe.exitCode !== 0 || probe.termination || probe.observerError) throw new Error('CASE_ASSISTANT_DSH_CONFIG_INVALID');
        assertControlledDshConfig(probe.stdout, { guard: 'workbench-case-assistant-guard', mcp: 'workbench-case-assistant-mcp', errorCode: 'CASE_ASSISTANT_DSH_CONFIG_INVALID' });
        await reportProgress({ stage: 'THINKING' });
        execution = await runHarness({ command: process.execPath,
          args: [DSH_BIN, '--profile', 'headless', '--patch', patchPath, '--json', caseAssistantPrompt(skill)],
          cwd: directory, env: childEnvironment({ DSH_HOME: config.dshHome, WORKBENCH_CASE_ASSISTANT_ENDPOINT: endpoint.url,
            DEEPSEEK_API_KEY: credentials.apiKey, DEEPSEEK_BASE_URL: deepSeekHarnessBaseUrl(credentials.baseUrl) }),
          signal: controller.signal, timeoutMs: remainingMs(), maxToolCalls: 80,
          onLifecycle: async event => {
            if (event.type === 'process_spawn') await reportProgress({ stage: 'THINKING' });
            if (event.type === 'harness_event' && event.phase === 'case_assistant_json_retry') await reportProgress({ stage: 'REPAIRING_FORMAT' });
          } });
        check();
        const assessment = assessHarnessRun({ processResult: execution.processResult, events: execution.events,
          candidateExists: Boolean(session.response), browserToolRequired: false });
        if (!assessment.success) {
          const termination = execution.processResult?.termination;
          throw new Error(termination === 'timeout' ? 'CASE_ASSISTANT_TIMED_OUT' : termination === 'tool_limit' ? 'CASE_ASSISTANT_TOOL_LIMIT_EXCEEDED'
            : termination === 'cancelled' ? 'CASE_ASSISTANT_CANCELLED' : processEvidence(execution).tool_json_invalid ? 'CASE_ASSISTANT_TOOL_JSON_INVALID'
              : !assessment.completed ? 'CASE_ASSISTANT_DSH_FAILED' : 'CASE_ASSISTANT_RESPONSE_MISSING');
        }
        return { ...structuredClone(session.response), execution: evidence() };
      } catch (error) {
        const code = controller.signal.aborted ? timedOut ? 'CASE_ASSISTANT_TIMED_OUT' : 'CASE_ASSISTANT_CANCELLED' : safeError(error);
        const failure = new Error(code);
        failure.execution = { ...evidence(), error_code: code };
        throw failure;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', forwardAbort);
        await endpoint?.close();
      }
    },
  };
}

import { spawn } from 'node:child_process';

const DEFAULT_DRAIN_TIMEOUT_MS = 2_000;
const DEFAULT_TERMINATION_GRACE_MS = 3_000;

export async function terminateOwnedTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        shell: false,
      });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
    if (child.exitCode === null) child.kill('SIGKILL');
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

export function runOwnedProcess(command, args, options = {}) {
  const {
    cwd, env, timeoutMs = 60_000, signal, onStdoutLine, onLifecycle,
    maxCaptureBytes = 256_000, drainTimeoutMs = DEFAULT_DRAIN_TIMEOUT_MS,
    terminationGraceMs = DEFAULT_TERMINATION_GRACE_MS,
  } = options;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutPending = '';
    let settled = false;
    let finalizing = false;
    let termination = null;
    let child;
    let exitObserved = false;
    let closeObserved = false;
    let exitCode = null;
    let exitSignal = null;
    let processError = null;
    let observerError = null;
    let timer;
    let drainTimer;
    let terminationTimer;
    let lifecycleQueue = Promise.resolve();
    const append = (current, chunk) => (current + chunk).slice(-maxCaptureBytes);
    const queueObserver = (operation) => {
      if (!operation || observerError) return;
      lifecycleQueue = lifecycleQueue.then(operation).catch((error) => {
        observerError = { code: error?.code || 'LIFECYCLE_OBSERVER_FAILED', message: error?.message || String(error) };
        if (!termination) termination = 'observer_error';
        void terminateOwnedTree(child);
      });
    };
    const queueLifecycle = (event) => queueObserver(onLifecycle ? () => onLifecycle(event) : null);
    const consumeStdout = (text) => {
      stdoutPending += text;
      const lines = stdoutPending.split(/\r?\n/);
      stdoutPending = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) queueObserver(onStdoutLine ? () => onStdoutLine(line) : null);
    };
    const flushTrailingLine = () => {
      if (!stdoutPending.trim()) return false;
      const trailing = stdoutPending;
      queueObserver(onStdoutLine ? () => onStdoutLine(trailing) : null);
      stdoutPending = '';
      return true;
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(drainTimer);
      clearTimeout(terminationTimer);
      signal?.removeEventListener('abort', abort);
    };
    const finish = async (outputComplete) => {
      if (settled || finalizing) return;
      finalizing = true;
      const trailingStdoutLine = flushTrailingLine();
      queueLifecycle({ type: 'output_complete', at: new Date().toISOString(), output_complete: outputComplete, trailing_stdout_line: trailingStdoutLine });
      await lifecycleQueue;
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ exitCode, signal: exitSignal, error: processError, stdout, stderr, termination,
        pid: child?.pid ?? null, parentPid: process.pid, exitObserved, closeObserved,
        outputComplete, trailingStdoutLine, observerError });
    };
    const requestTermination = async (reason) => {
      if (termination) return;
      termination = reason;
      queueLifecycle({ type: 'termination_requested', at: new Date().toISOString(), reason });
      await terminateOwnedTree(child);
      if (!settled && !terminationTimer) terminationTimer = setTimeout(() => void finish(false), terminationGraceMs);
    };
    const abort = () => {
      const reason = typeof signal?.reason === 'string' ? signal.reason : 'cancelled';
      void requestTermination(reason);
    };
    try {
      child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      queueLifecycle({ type: 'process_spawn', at: new Date().toISOString(), pid: child.pid ?? null, parent_pid: process.pid });
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stdout = append(stdout, text);
        queueLifecycle({ type: 'stdout_chunk', at: new Date().toISOString(), bytes: chunk.length });
        consumeStdout(text);
      });
      child.stderr.on('data', (chunk) => {
        stderr = append(stderr, chunk.toString('utf8'));
        queueLifecycle({ type: 'stderr_chunk', at: new Date().toISOString(), bytes: chunk.length });
      });
      child.once('error', (error) => {
        processError = error.message;
        queueLifecycle({ type: 'process_error', at: new Date().toISOString(), code: error.code || null });
        if (!child.pid) void finish(false);
      });
      child.once('exit', (code, childSignal) => {
        exitObserved = true;
        exitCode = code;
        exitSignal = childSignal;
        queueLifecycle({ type: 'process_exit', at: new Date().toISOString(), exit_code: code, signal: childSignal });
        drainTimer = setTimeout(() => void finish(false), drainTimeoutMs);
      });
      child.once('close', (code, childSignal) => {
        closeObserved = true;
        if (!exitObserved) { exitCode = code; exitSignal = childSignal; }
        queueLifecycle({ type: 'process_close', at: new Date().toISOString(), exit_code: code, signal: childSignal });
        void finish(true);
      });
      timer = setTimeout(() => void requestTermination('timeout'), timeoutMs);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    } catch (error) {
      processError = error.message;
      queueLifecycle({ type: 'process_error', at: new Date().toISOString(), code: error.code || null });
      void finish(false);
    }
  });
}

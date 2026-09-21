import { spawn } from 'node:child_process';

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
  const { cwd, env, timeoutMs = 60_000, signal, onStdoutLine, maxCaptureBytes = 256_000 } = options;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let termination = null;
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({ ...result, stdout, stderr, termination, pid: child?.pid ?? null });
    };
    const append = (current, chunk) => (current + chunk).slice(-maxCaptureBytes);
    const consumeLines = (() => {
      let pending = '';
      return (chunk) => {
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const line of lines) if (line.trim()) onStdoutLine?.(line);
      };
    })();
    const abort = async () => {
      termination = typeof signal?.reason === 'string' ? signal.reason : 'cancelled';
      await terminateOwnedTree(child);
    };
    let timer;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stdout = append(stdout, text);
        consumeLines(text);
      });
      child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk.toString('utf8')); });
      child.once('error', (error) => finish({ exitCode: null, signal: null, error: error.message }));
      child.once('exit', (exitCode, exitSignal) => finish({ exitCode, signal: exitSignal, error: null }));
      timer = setTimeout(async () => {
        termination = 'timeout';
        await terminateOwnedTree(child);
      }, timeoutMs);
      if (signal?.aborted) void abort();
      else signal?.addEventListener('abort', abort, { once: true });
    } catch (error) {
      finish({ exitCode: null, signal: null, error: error.message });
    }
  });
}

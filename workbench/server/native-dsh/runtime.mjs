import fs from 'node:fs/promises';
import { BROWSER_BRIDGE_PATCH_PATH } from './browser-bridge.mjs';
import path from 'node:path';
import { spawn as spawnProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { terminateOwnedTree } from '../../../harness-probe/src/process-control.mjs';
import { resolveModelCredentials } from '../model-credentials.mjs';
import { NATIVE_DSH_VERSION } from '../../scripts/native-dsh-package.mjs';
import { acquireNativeHostLock } from './host-lock.mjs';

export { NATIVE_DSH_VERSION };
export const NATIVE_STARTUP_TIMEOUT_MS = 30_000;
export const NATIVE_STOP_TIMEOUT_MS = 8_000;
const failure = code => Object.assign(new Error(code), { code });
const absent = error => error?.code === 'ENOENT';
const sha = value => createHash('sha256').update(value).digest('hex');
const inheritedEnvironment = ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOME', 'LANG', 'PLAYWRIGHT_BROWSERS_PATH'];

async function readJson(file) { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
async function optionalStat(file) { return fs.lstat(file).catch(error => absent(error) ? null : Promise.reject(error)); }
function bounded(promise, timeoutMs, timeoutValue) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(timeoutValue), timeoutMs);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function verifyBinary(dshBin, nodePath) {
  if (!path.isAbsolute(dshBin || '') || !path.isAbsolute(nodePath || '')) throw failure('NATIVE_DSH_BINARY_PATH_REQUIRED');
  const binary = await optionalStat(dshBin), node = await optionalStat(nodePath);
  if (!binary?.isFile() || binary.isSymbolicLink() || !node?.isFile()) throw failure('NATIVE_DSH_BINARY_MISSING');
  const packageRoot = path.resolve(path.dirname(dshBin), '..');
  let metadata;
  try { metadata = await readJson(path.join(packageRoot, 'package.json')); }
  catch { throw failure('NATIVE_DSH_PACKAGE_INVALID'); }
  if (metadata.name !== '@deepseek-ai/dsh' || metadata.version !== NATIVE_DSH_VERSION ||
      path.resolve(packageRoot, metadata.bin?.dsh || '') !== path.resolve(dshBin)) throw failure('NATIVE_DSH_VERSION_MISMATCH');
  return { version: metadata.version, binary_sha256: sha(await fs.readFile(dshBin)) };
}

function launchAddress(line) {
  const match = line.replace(/\x1b\[[0-9;]*m/g, '').match(/^dsh web:\s+(http:\/\/\S+)/);
  if (!match) return null;
  let url;
  try { url = new URL(match[1]); } catch { throw failure('NATIVE_DSH_LAUNCH_URL_INVALID'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.port === '4322' || url.pathname !== '/' ||
      url.username || url.password || url.hash || [...url.searchParams.keys()].some(key => key !== 'token') ||
      url.searchParams.getAll('token').length !== 1 || !/^[A-Za-z0-9_.~-]{16,1024}$/.test(url.searchParams.get('token'))) throw failure('NATIVE_DSH_LAUNCH_URL_INVALID');
  return { url: url.href, publicUrl: url.origin };
}

function redact(line, key) {
  let safe = String(line);
  if (key) safe = safe.split(key).join('[redacted]');
  return safe.replace(/([?&](?:token|key|api_key)=)[^\s&#)]+/gi, '$1[redacted]')
    .replace(/((?:authorization|api[-_]?key|access[-_]?token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]').slice(0, 4000);
}

/** Starts one owned, loopback-only Web Host. It never attaches to or terminates a user's Host. */
export function createNativeDshRuntime({ dshBin, nodePath = process.execPath, dshHome, workspace,
  profile = 'web', startupTimeoutMs = NATIVE_STARTUP_TIMEOUT_MS, stopTimeoutMs = NATIVE_STOP_TIMEOUT_MS, useStoredCredentials = true,
  credentialHome, credentialProvider, environment = process.env, onEvent = () => {} } = {},
{ spawn = spawnProcess, terminate = terminateOwnedTree, credentials = resolveModelCredentials, lockChecks } = {}) {
  if (profile !== 'web') throw failure('NATIVE_DSH_WEB_PROFILE_REQUIRED');
  if (!Number.isFinite(startupTimeoutMs) || startupTimeoutMs < 1 || startupTimeoutMs > 120_000) throw failure('NATIVE_DSH_STARTUP_TIMEOUT_INVALID');
  if (!Number.isFinite(stopTimeoutMs) || stopTimeoutMs < 1 || stopTimeoutMs > 30_000) throw failure('NATIVE_DSH_STOP_TIMEOUT_INVALID');
  if (!path.isAbsolute(dshHome || '') || !path.isAbsolute(workspace || '')) throw failure('NATIVE_DSH_PRIVATE_PATH_REQUIRED');
  dshHome = path.resolve(dshHome); workspace = path.resolve(workspace);
  const markerPath = path.join(dshHome, 'workbench-native-host.json');
  const owner = randomUUID();
  let hostLock;
  let child, completion, ready, pending, stopping, stopRequested = false, ownsLock = false, state = 'IDLE', lastError = null, binaryIdentity;
  const emit = event => { try { Promise.resolve(onEvent(event)).catch(() => {}); } catch {} };

  async function releaseLock() {
    if (!ownsLock) return;
    try { await hostLock?.release(); }
    catch (error) { if (!absent(error)) emit({ type: 'runtime_cleanup_error', code: 'NATIVE_DSH_LOCK_CLEANUP_FAILED' }); }
    ownsLock = false;
  }

  async function prepareHome() {
    const existing = await optionalStat(dshHome);
    if (existing?.isSymbolicLink() || existing && !existing.isDirectory()) throw failure('NATIVE_DSH_HOME_INVALID');
    if (!existing) await fs.mkdir(dshHome, { recursive: true, mode: 0o700 });
    const marker = await optionalStat(markerPath);
    if (marker) {
      if (marker.isSymbolicLink()) throw failure('NATIVE_DSH_HOME_NOT_OWNED');
      let data;
      try { data = await readJson(markerPath); } catch { throw failure('NATIVE_DSH_HOME_NOT_OWNED'); }
      if (data.schema !== 'workbench/native-dsh-home-v1' || data.version !== NATIVE_DSH_VERSION || data.profile !== profile) throw failure('NATIVE_DSH_HOME_NOT_OWNED');
    } else {
      if ((await fs.readdir(dshHome)).length) throw failure('NATIVE_DSH_HOME_NOT_OWNED');
      await fs.writeFile(markerPath, JSON.stringify({ schema: 'workbench/native-dsh-home-v1', version: NATIVE_DSH_VERSION, profile, created_at: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    }
    try { hostLock = await acquireNativeHostLock({home:dshHome,owner,dshBin,onRecovered:emit},lockChecks); ownsLock = true; }
    catch (error) { if (['EEXIST','NATIVE_DSH_HOME_BUSY'].includes(error.code)) throw failure('NATIVE_DSH_HOME_BUSY'); throw failure('NATIVE_DSH_HOME_LOCK_FAILED'); }
    const cwd = await optionalStat(workspace);
    if (!cwd?.isDirectory() || cwd.isSymbolicLink()) throw failure('NATIVE_DSH_WORKSPACE_INVALID');
  }

  async function ownedStop() {
    if (!child || child.exitCode !== null) { await releaseLock(); return; }
    const owned = child;
    await bounded(terminate(owned), stopTimeoutMs, false);
    const closed = await bounded(completion.then(() => true), stopTimeoutMs, false);
    if (!closed) throw failure('NATIVE_DSH_STOP_NOT_CONFIRMED');
    await releaseLock();
  }

  const runtime = {
    inspect() {
      return { state, version: binaryIdentity?.version || null, expected_version: NATIVE_DSH_VERSION, profile,
        publicUrl: ready?.publicUrl || null, browser_bridge: true, pid: child?.exitCode === null ? child.pid ?? null : null,
        binary_sha256: binaryIdentity?.binary_sha256 || null, error: lastError };
    },
    async start() {
      if (stopping) throw failure('NATIVE_DSH_RUNTIME_STOPPING');
      if (ready && child?.exitCode === null) return { ...ready };
      if (pending) return pending;
      stopRequested = false; state = 'STARTING'; lastError = null;
      pending = (async () => {
        try {
          binaryIdentity = await verifyBinary(dshBin, nodePath);
          await prepareHome();
          let secret;
          try {
            if (credentialProvider) secret = await credentialProvider();
            else {
              secret = await credentials({ environment, useStoredCredentials: false });
              if (!secret && useStoredCredentials) secret = await credentials({ environment, useStoredCredentials: true, dshHome: credentialHome });
            }
          } catch (error) { throw failure(/^MODEL_CREDENTIAL_[A-Z_]+$/.test(error?.message || '') ? error.message : 'NATIVE_DSH_CREDENTIAL_UNAVAILABLE'); }
          if (!secret?.apiKey) throw failure('NATIVE_DSH_MODEL_CREDENTIAL_REQUIRED');
          if (stopRequested) throw failure('NATIVE_DSH_START_CANCELLED');
          const env = Object.fromEntries(inheritedEnvironment.flatMap(name => environment[name] ? [[name, environment[name]]] : []));
          // 0.2's official provider uses its own /anthropic default. The legacy
          // credential broker's OpenAI-compatible base URL is not this protocol.
          // Permission defaults stay workspace-write + ask; no personal override is inherited.
          Object.assign(env, { DSH_HOME: dshHome, DEEPSEEK_API_KEY: secret.apiKey, NO_COLOR: '1' });
          const args = [dshBin, '--profile', profile, '--patch', BROWSER_BRIDGE_PATCH_PATH, '--host', '127.0.0.1', '--port', '0', '--no-open'];
          child = spawn(nodePath, args, { cwd: workspace, env, windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
          const owned = child;
          let resolveCompletion;
          completion = new Promise(resolve => { resolveCompletion = resolve; });
          const outcome = await new Promise((resolve, reject) => {
            let settled = false, stdoutPending = '', stderrPending = '';
            const finish = (error, value) => {
              if (settled) return;
              settled = true; clearTimeout(timer);
              if (error) reject(error); else resolve(value);
            };
            const timer = setTimeout(() => finish(failure('NATIVE_DSH_STARTUP_TIMED_OUT')), startupTimeoutMs);
            const line = (text, stream) => {
              if (stream === 'stdout' && !settled) {
                try {
                  const address = launchAddress(text);
                  if (address) finish(null, { ...address, version: binaryIdentity.version, pid: owned.pid ?? null, dshHome, profile });
                } catch (error) { finish(error); }
              }
              emit({ type: 'runtime_output', stream, text: redact(text, secret.apiKey) });
            };
            const consume = (chunk, stream) => {
              let text = (stream === 'stdout' ? stdoutPending : stderrPending) + chunk.toString('utf8');
              const lines = text.split(/\r?\n/); text = lines.pop() || '';
              if (text.length > 32_000) { finish(failure('NATIVE_DSH_STARTUP_OUTPUT_INVALID')); text = ''; }
              if (stream === 'stdout') stdoutPending = text; else stderrPending = text;
              lines.forEach(value => line(value, stream));
            };
            owned.stdout.on('data', chunk => consume(chunk, 'stdout'));
            owned.stderr.on('data', chunk => consume(chunk, 'stderr'));
            owned.once('error', () => {
              finish(failure('NATIVE_DSH_HOST_SPAWN_FAILED'));
              resolveCompletion();
            });
            owned.once('close', (code, signal) => {
              if (stdoutPending) line(stdoutPending, 'stdout');
              if (stderrPending) line(stderrPending, 'stderr');
              resolveCompletion();
              if (child === owned) {
                ready = null;
                if (!stopRequested) { state = 'ERROR'; lastError = 'NATIVE_DSH_HOST_EXITED'; }
                emit({ type: 'runtime_exit', exit_code: Number.isInteger(code) ? code : null, signal: signal || null });
                void releaseLock();
              }
              finish(failure(stopRequested ? 'NATIVE_DSH_START_CANCELLED' : 'NATIVE_DSH_HOST_EXITED'));
            });
          });
          if (stopRequested || owned.exitCode !== null) throw failure(stopRequested ? 'NATIVE_DSH_START_CANCELLED' : 'NATIVE_DSH_HOST_EXITED');
          await hostLock.setHostPid(owned.pid);
          if (stopRequested || owned.exitCode !== null) throw failure(stopRequested ? 'NATIVE_DSH_START_CANCELLED' : 'NATIVE_DSH_HOST_EXITED');
          ready = outcome; state = 'RUNNING';
          emit({ type: 'runtime_ready', public_url: ready.publicUrl, version: ready.version, pid: ready.pid });
          return { ...ready };
        } catch (error) {
          const safe = failure(/^(?:NATIVE_DSH|MODEL_CREDENTIAL)_[A-Z_]+$/.test(error?.message || '') ? error.message : 'NATIVE_DSH_START_FAILED');
          state = 'ERROR'; lastError = safe.code; ready = null;
          await ownedStop().catch(stopError => { lastError = stopError.code || 'NATIVE_DSH_STOP_NOT_CONFIRMED'; });
          if (!child || child.exitCode !== null) await releaseLock();
          throw safe;
        } finally { pending = null; }
      })();
      return pending;
    },
    async stop() {
      if (stopping) return stopping;
      stopRequested = true; state = 'STOPPING';
      stopping = (async () => {
        try {
          if (child) await ownedStop();
          await pending?.catch(() => {});
          if (child?.exitCode === null) await ownedStop();
          ready = null; state = 'STOPPED'; lastError = null;
          await releaseLock();
          return { stopped: true };
        } catch (error) { state = 'ERROR'; lastError = error.code || 'NATIVE_DSH_STOP_NOT_CONFIRMED'; throw failure(lastError); }
        finally { stopping = null; }
      })();
      return stopping;
    },
  };
  return runtime;
}

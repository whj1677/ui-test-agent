import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sourcePath = fileURLToPath(new URL('./window-recorder.cs', import.meta.url));
const cachePath = fileURLToPath(new URL('../../.local/runtime/window-recorder/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const reasons = /^[A-Z_]{3,80}$/;
const identityKeys = new Set(['run_id', 'project_id', 'case_id', 'case_version', 'source_task_id',
  'candidate_sha256', 'bundle_sha256', 'candidate_version', 'candidate_bundle_sha256',
  'executed_external_id', 'executed_case_id', 'executed_case_version', 'executed_content_sha256', 'source_kind', 'source_draft_id']);

async function regularFile(file) {
  try { const stat = await fs.lstat(file); return stat.isFile() && !stat.isSymbolicLink(); }
  catch { return false; }
}

function ownedChild(child) {
  let complete = false;
  let resolveExit;
  const state = { child, code: null, error: null, done: new Promise(resolve => { resolveExit = resolve; }) };
  const finish = (code, error) => {
    if (complete) return;
    complete = true; state.code = code; state.error = error; state.exited = true; resolveExit(state);
  };
  child.once('error', error => finish(null, error));
  child.once('exit', code => { state.code = code; state.processExited = true; });
  child.once('close', code => finish(code, null));
  state.kill = () => {
    if (!state.exited && !state.processExited) { try { child.kill(); } catch {} }
  };
  return state;
}

async function waitOwned(state, timeoutMs) {
  if (!state || state.exited) return true;
  let timer;
  const finished = await Promise.race([state.done.then(() => true),
    new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]);
  clearTimeout(timer);
  return finished;
}

async function compileHelper(compiler, source, output, spawnProcess, timeoutMs) {
  let state;
  try {
    state = ownedChild(spawnProcess(compiler, ['/nologo', '/target:exe', '/optimize+', `/out:${output}`,
      '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', source],
    { windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'ignore'] }));
    if (!await waitOwned(state, timeoutMs)) {
      state.kill(); await waitOwned(state, 2000); throw Error('WINDOW_RECORDER_BUILD_TIMEOUT');
    }
    if (state.error || state.code !== 0 || !await regularFile(output)) throw Error('WINDOW_RECORDER_BUILD_FAILED');
  } catch (error) {
    state?.kill();
    throw Error(error.message === 'WINDOW_RECORDER_BUILD_TIMEOUT' ? error.message : 'WINDOW_RECORDER_BUILD_FAILED');
  }
}

export async function prepareWindowRecorder({ platform = process.platform, systemRoot = process.env.SystemRoot,
  source = sourcePath, cacheRoot = cachePath, ffmpegPath, spawnProcess = spawn, buildTimeoutMs = 30000 } = {}) {
  if (platform !== 'win32') throw Error('WINDOW_RECORDER_UNSUPPORTED');
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) throw Error('WINDOW_RECORDER_COMPILER_UNAVAILABLE');
  const compilers = ['Framework64', 'Framework'].map(folder => path.win32.join(systemRoot,
    'Microsoft.NET', folder, 'v4.0.30319', 'csc.exe'));
  const compilerIndex = (await Promise.all(compilers.map(regularFile))).findIndex(Boolean);
  if (compilerIndex < 0) throw Error('WINDOW_RECORDER_COMPILER_UNAVAILABLE');
  if (!ffmpegPath) {
    try {
      const exported = require('playwright-core/lib/coreBundle').registry;
      const registry = exported.registry || exported;
      ffmpegPath = registry.findExecutable('ffmpeg').executablePath();
    } catch { throw Error('WINDOW_RECORDER_ENCODER_UNAVAILABLE'); }
  }
  if (!await regularFile(ffmpegPath)) throw Error('WINDOW_RECORDER_ENCODER_UNAVAILABLE');
  const sourceHash = sha256(await fs.readFile(source));
  const directory = path.join(cacheRoot, sourceHash);
  const helper = path.join(directory, 'window-recorder.exe');
  const manifest = path.join(directory, 'manifest.json');
  try {
    const saved = JSON.parse(await fs.readFile(manifest, 'utf8'));
    if (saved.source_sha256 === sourceHash && await regularFile(helper) &&
        saved.executable_sha256 === sha256(await fs.readFile(helper)))
      return { helper_path: helper, ffmpeg_path: ffmpegPath, source_sha256: sourceHash };
  } catch { /* Invalid or absent owned cache is rebuilt. */ }
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `window-recorder-${randomUUID()}.exe`);
  try {
    await compileHelper(compilers[compilerIndex], source, temporary, spawnProcess, buildTimeoutMs);
    const executableHash = sha256(await fs.readFile(temporary));
    await fs.rename(temporary, helper);
    await fs.writeFile(manifest, JSON.stringify({ source_sha256: sourceHash,
      executable_sha256: executableHash }) + '\n');
  } finally { await fs.rm(temporary, { force: true }); }
  return { helper_path: helper, ffmpeg_path: ffmpegPath, source_sha256: sourceHash };
}

async function browserProcessId(page, timeoutMs) {
  const browser = page?.context?.()?.browser?.();
  if (!browser?.newBrowserCDPSession) throw Error('WINDOW_BROWSER_IDENTITY_UNAVAILABLE');
  let session;
  let timer;
  let expired = false;
  try {
    const query = (async () => {
      session = await browser.newBrowserCDPSession();
      if (expired) { await session.detach().catch(() => {}); throw Error('WINDOW_BROWSER_IDENTITY_TIMEOUT'); }
      const info = await session.send('SystemInfo.getProcessInfo');
      const matches = info?.processInfo?.filter(item => item.type === 'browser' &&
        Number.isSafeInteger(item.id) && item.id > 0) || [];
      if (matches.length !== 1) throw Error('WINDOW_BROWSER_IDENTITY_AMBIGUOUS');
      return matches[0].id;
    })();
    return await Promise.race([query, new Promise((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(Error('WINDOW_BROWSER_IDENTITY_TIMEOUT')); }, timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
    if (session) void session.detach().catch(() => {});
  }
}

async function maximizeBrowserWindow(page, timeoutMs) {
  const context = page?.context?.();
  if (!context?.newCDPSession || !page?.evaluate) throw Error('WINDOW_MAXIMIZE_UNAVAILABLE');
  // A fixed emulated viewport would leave unused space inside the larger native window.
  if (page.viewportSize?.() !== null) throw Error('WINDOW_VIEWPORT_NOT_NATIVE');
  let session, timer, expired = false;
  const checkDeadline = () => { if (expired) throw Error('WINDOW_MAXIMIZE_TIMEOUT'); };
  try {
    const query = (async () => {
      session = await context.newCDPSession(page);
      if (expired) { void session.detach().catch(() => {}); checkDeadline(); }
      const target = await session.send('Browser.getWindowForTarget');
      checkDeadline();
      if (!Number.isSafeInteger(target?.windowId)) throw Error('WINDOW_MAXIMIZE_IDENTITY_UNAVAILABLE');
      await session.send('Browser.setWindowBounds', { windowId: target.windowId,
        bounds: { windowState: 'maximized' } });
      checkDeadline();
      let previous = null, stableSamples = 0;
      while (!expired) {
        const result = await session.send('Browser.getWindowBounds', { windowId: target.windowId });
        checkDeadline();
        const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
        checkDeadline();
        const bounds = result?.bounds;
        const valid = bounds?.windowState === 'maximized' &&
          [bounds.width, bounds.height, viewport?.width, viewport?.height].every(value => Number.isInteger(value) && value > 0);
        const current = valid ? `${bounds.width}:${bounds.height}:${viewport.width}:${viewport.height}` : null;
        stableSamples = current && current === previous ? stableSamples + 1 : (current ? 1 : 0);
        previous = current;
        if (stableSamples >= 3) return {
          viewport: { width: viewport.width, height: viewport.height },
          browser_window_id: target.windowId,
          browser_window_state: bounds.windowState,
          browser_window_maximized: true,
          browser_window_bounds: { width: bounds.width, height: bounds.height,
            left: Number.isInteger(bounds.left) ? bounds.left : null,
            top: Number.isInteger(bounds.top) ? bounds.top : null },
        };
        await new Promise(resolve => setTimeout(resolve, Math.max(1, Math.min(100, timeoutMs / 8))));
      }
      checkDeadline();
    })();
    return await Promise.race([query, new Promise((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(Error('WINDOW_MAXIMIZE_TIMEOUT')); }, timeoutMs);
    })]);
  } catch (error) {
    throw Error(/^WINDOW_/.test(error?.message || '') && reasons.test(error.message) ? error.message : 'WINDOW_MAXIMIZE_FAILED');
  } finally {
    expired = true;
    clearTimeout(timer);
    if (session) void session.detach().catch(() => {});
    // A CDP session that arrives after a timeout is detached by the pending query's cleanup.
  }
}

function normalizeIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity) ||
      !/^[\w-]{4,128}$/.test(identity.run_id || '')) throw Error('WINDOW_RECORDING_IDENTITY_INVALID');
  const output = {};
  for (const [key, value] of Object.entries(identity)) {
    if (!identityKeys.has(key) || (!['string', 'number'].includes(typeof value)) ||
        typeof value === 'string' && (value.length > 256 || /[\x00-\x1f]/.test(value)) ||
        typeof value === 'number' && !Number.isFinite(value)) throw Error('WINDOW_RECORDING_IDENTITY_INVALID');
    output[key] = value;
  }
  return output;
}

export async function startWindowRecording({ page, directory, identity, prepared,
  spawnProcess = spawn, prepare = prepareWindowRecorder, fps = 10, maximumDurationMs = 120000,
  readyTimeoutMs = 10000, watchdogMs = 5000, stopTimeoutMs = 5000, encoderTimeoutMs = 10000,
  now = () => new Date() } = {}) {
  const recordingIdentity = normalizeIdentity(identity);
  if (!directory || !path.isAbsolute(directory) || !Number.isInteger(fps) || fps < 1 || fps > 30 ||
      !Number.isInteger(maximumDurationMs) || maximumDurationMs < 1000 || maximumDurationMs > 3600000)
    throw Error('WINDOW_RECORDING_ARGUMENT_INVALID');
  await fs.mkdir(directory, { recursive: true });
  const metadataPath = path.join(directory, 'recording.json');
  const videoPath = path.join(directory, 'browser-window.webm');
  // A dedicated directory belongs to a single run and must never overwrite evidence.
  const reservation = await fs.open(metadataPath, 'wx').catch(() => { throw Error('WINDOW_RECORDING_OUTPUT_EXISTS'); });
  await reservation.close();
  let helper, encoder, stopPromise, readyTimer, watchdog, lifetimeTimer;
  let lastProgress = Date.now(), native = {}, terminal = false, ready = false, stopping = false;
  let failure = null, nativeReason = null, eventBuffer = '', startedAt = null, windowLayout = null;
  let stopRequestedAt = null, windowGuard = null;
  let resolveReady, rejectReady;
  const readiness = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Install a handler immediately: startup may fail before the later await.
  readiness.catch(() => {});
  const requestedAt = now().toISOString();
  await fs.writeFile(metadataPath, JSON.stringify({ schema: 'workbench/browser-window-recording-v1',
    status: 'RECORDING', identity: recordingIdentity, requested_at: requestedAt, started_at: null,
    capture_scope: 'owned_browser_window', frame_count: 0, video_file: null }, null, 2) + '\n');
  const fail = reason => {
    failure ||= reasons.test(reason || '') ? reason : 'WINDOW_RECORDING_FAILED';
    if (!ready) rejectReady(Error(failure));
    if (helper && !helper.exited && !terminal) { try { helper.child.stdin?.end('STOP\n'); } catch {} }
  };
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopRequestedAt = now().toISOString();
    stopPromise = (async () => {
      clearTimeout(readyTimer); clearInterval(watchdog); clearTimeout(lifetimeTimer);
      if (helper && !helper.exited) {
        if (!terminal) { try { helper.child.stdin?.end('STOP\n'); } catch { failure ||= 'WINDOW_STOP_FAILED'; } }
        if (!await waitOwned(helper, stopTimeoutMs)) {
          failure ||= 'WINDOW_STOP_TIMEOUT'; helper.kill(); await waitOwned(helper, 2000);
        }
      }
      // The helper owns an inherited copy of this pipe's write handle. Close our
      // copy only after it exits, so ffmpeg receives EOF after every native write.
      if (encoder && !encoder.exited) {
        try { encoder.child.stdin?.end(); } catch { failure ||= 'WINDOW_ENCODER_PIPE_FAILED'; }
        if (!await waitOwned(encoder, encoderTimeoutMs)) {
          failure ||= 'WINDOW_ENCODER_TIMEOUT'; encoder.kill(); await waitOwned(encoder, 2000);
        }
      }
      if (helper?.error || helper && helper.code !== 0) failure ||= nativeReason || 'WINDOW_HELPER_FAILED';
      if (encoder?.error || encoder && encoder.code !== 0) failure ||= 'WINDOW_ENCODER_FAILED';
      if (ready && !terminal) failure ||= 'WINDOW_RECORDING_END_MISSING';
      const frameCount = Number.isSafeInteger(native.frame_count) ? native.frame_count : 0;
      let videoStat = null;
      try { videoStat = await fs.stat(videoPath); } catch {}
      if (!frameCount || !videoStat?.isFile() || videoStat.size === 0) failure ||= 'WINDOW_RECORDING_EMPTY';
      const endedAt = native.ended_at || now().toISOString();
      const metadata = {
        schema: 'workbench/browser-window-recording-v1', identity: recordingIdentity,
        status: failure ? (frameCount ? 'INCOMPLETE' : 'UNAVAILABLE') : 'COMPLETE',
        reason: failure, capture_method: 'PrintWindow', capture_scope: 'owned_browser_window',
        includes_browser_chrome: true, captures_desktop: false, audio: false,
        requested_at: requestedAt, started_at: native.started_at || startedAt,
        ended_at: endedAt, fps, frame_count: frameCount,
        stop_requested_at: stopRequestedAt, window_guard: windowGuard,
        minimization_recoveries: Array.isArray(native.minimization_recoveries) ? native.minimization_recoveries.slice(0, 3).map(item => ({
          status: item.status === 'RESTORED' ? 'RESTORED' : 'FAILED',
          started_at: typeof item.started_at === 'string' ? item.started_at : null,
          ended_at: typeof item.ended_at === 'string' ? item.ended_at : null,
          duration_ms: Number.isSafeInteger(item.duration_ms) && item.duration_ms >= 0 ? item.duration_ms : null,
        })) : [],
        captured_frames: native.captured_frames || 0, duplicated_frames: native.duplicated_frames || 0,
        maximum_capture_gap_ms: native.max_gap_ms || 0,
        width: native.width || null, height: native.height || null,
        viewport: windowLayout?.viewport || null,
        browser_window_id: windowLayout?.browser_window_id ?? null,
        browser_window_state: windowLayout?.browser_window_state || null,
        browser_window_maximized: windowLayout?.browser_window_maximized === true,
        browser_window_bounds: windowLayout?.browser_window_bounds || null,
        browser_pid: native.pid || null, window_handle: native.hwnd || null,
        video_file: videoStat?.size ? 'browser-window.webm' : null,
        video_bytes: videoStat?.size || 0, encoded_duration_seconds: frameCount / fps,
        helper_exit_code: helper?.code ?? null, encoder_exit_code: encoder?.code ?? null,
        native_reason: nativeReason, native_source_sha256: prepared?.source_sha256 || null,
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
      return metadata;
    })();
    return stopPromise;
  };
  try {
    prepared ||= await prepare();
    if (!prepared?.helper_path || !prepared?.ffmpeg_path) throw Error('WINDOW_RECORDER_PREPARATION_INVALID');
    if (await regularFile(videoPath)) throw Error('WINDOW_RECORDING_OUTPUT_EXISTS');
    const pid = await browserProcessId(page, readyTimeoutMs);
    native.pid = pid;
    windowLayout = await maximizeBrowserWindow(page, readyTimeoutMs);
    encoder = ownedChild(spawnProcess(prepared.ffmpeg_path, ['-hide_banner', '-loglevel', 'error', '-n',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2500k',
      '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-f', 'webm', videoPath],
    { windowsHide: true, shell: false, stdio: ['pipe', 'ignore', 'pipe'] }));
    encoder.child.stdin?.on('error', () => fail('WINDOW_ENCODER_PIPE_FAILED'));
    // Drain diagnostic output without exposing local paths or recording details.
    encoder.child.stderr?.resume();
    void encoder.done.then(state => { if (!stopping && (!terminal || state.code !== 0)) fail('WINDOW_ENCODER_FAILED'); });
    if (!encoder.child.stdin) throw Error('WINDOW_RECORDING_PIPE_UNAVAILABLE');
    // Inherit the encoder's OS pipe endpoint directly. Forwarding frames with
    // stdout.pipe() here would block native capture whenever the test's JS worker
    // performs synchronous assertions or serialization. No frame enters JS.
    helper = ownedChild(spawnProcess(prepared.helper_path, [String(pid), String(fps), String(maximumDurationMs)],
      { windowsHide: true, shell: false, stdio: ['pipe', encoder.child.stdin, 'pipe'] }));
    helper.child.stdin?.on('error', () => { if (!stopping) fail('WINDOW_HELPER_PIPE_FAILED'); });
    helper.child.stderr?.on('error', () => fail('WINDOW_HELPER_PIPE_FAILED'));
    if (!helper.child.stderr || !helper.child.stdin)
      throw Error('WINDOW_RECORDING_PIPE_UNAVAILABLE');
    helper.child.stderr.on('data', chunk => {
      eventBuffer += chunk.toString('utf8');
      if (eventBuffer.length > 16384) { eventBuffer = ''; fail('WINDOW_HELPER_PROTOCOL_INVALID'); return; }
      const lines = eventBuffer.split(/\r?\n/); eventBuffer = lines.pop();
      for (const line of lines) {
        let event;
        try { event = JSON.parse(line); } catch { fail('WINDOW_HELPER_PROTOCOL_INVALID'); continue; }
        if (!['ready', 'progress', 'end'].includes(event?.event) || event.pid !== pid ||
            !Number.isSafeInteger(event.frame_count) || event.frame_count < 0) {
          fail('WINDOW_HELPER_PROTOCOL_INVALID'); continue;
        }
        native = event; lastProgress = Date.now();
        if (event.window_guard === 'OWNED_WINDOW_NO_MINIMIZE') windowGuard = event.window_guard;
        if (event.event === 'ready') {
          if (!event.frame_count || !event.width || !event.height || !/^\d+$/.test(event.hwnd || '')) {
            fail('WINDOW_HELPER_PROTOCOL_INVALID'); continue;
          }
          ready = true; startedAt = event.started_at; clearTimeout(readyTimer); resolveReady();
        }
        if (event.event === 'end') {
          terminal = true; nativeReason = event.reason;
          if (event.reason !== 'STOPPED') fail(event.reason);
          else if (!ready) fail('WINDOW_RECORDING_EMPTY');
        }
      }
    });
    void helper.done.then(state => {
      if (!stopping && (state.code !== 0 || !terminal)) fail(nativeReason || 'WINDOW_HELPER_EXITED');
      if (!ready) rejectReady(Error(failure || nativeReason || 'WINDOW_HELPER_EXITED'));
    });
    readyTimer = setTimeout(() => fail('WINDOW_RECORDING_READY_TIMEOUT'), readyTimeoutMs);
    watchdog = setInterval(() => {
      if (!stopping && ready && Date.now() - lastProgress > watchdogMs) {
        fail('WINDOW_RECORDING_STALLED'); helper.kill(); void stop().catch(() => {});
      }
    }, Math.max(25, Math.min(500, watchdogMs / 2)));
    lifetimeTimer = setTimeout(() => {
      fail('WINDOW_RECORDING_LIMIT'); void stop().catch(() => {});
    }, maximumDurationMs + readyTimeoutMs);
    await readiness;
    return { stop };
  } catch (error) {
    fail(error.message);
    const metadata = await stop();
    const output = Error(metadata.reason || 'WINDOW_RECORDING_UNAVAILABLE');
    output.recording = metadata;
    throw output;
  }
}

export const windowRecorderInternals = { normalizeIdentity, browserProcessId, maximizeBrowserWindow };

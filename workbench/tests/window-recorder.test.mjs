import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareWindowRecorder, startWindowRecording, windowRecorderInternals } from '../server/build/window-recorder.mjs';

const identity = { run_id: 'trial-window-recording-test', candidate_sha256: 'a'.repeat(64) };
const prepared = { helper_path: 'owned-helper.exe', ffmpeg_path: 'owned-ffmpeg.exe', source_sha256: 'b'.repeat(64) };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fakeBrowser(processInfo = [{ type: 'browser', id: 1234 }], options = {}) {
  let detached = 0, windowDetached = 0, boundRead = 0, viewportRead = 0, windowState = 'normal';
  const commands = [];
  const context = {
    browser: () => ({ newBrowserCDPSession: async () => ({
      send: async method => { assert.equal(method, 'SystemInfo.getProcessInfo'); return { processInfo }; },
      detach: async () => { detached++; },
    }) }),
    newCDPSession: async target => {
      assert.equal(target, page);
      if (options.sessionDelayMs) await new Promise(resolve => setTimeout(resolve, options.sessionDelayMs));
      return {
        send: async (method, params) => {
          commands.push({ method, params });
          if (options.cdpError) throw Error(options.cdpError);
          if (method === 'Browser.getWindowForTarget') return { windowId: 7 };
          if (method === 'Browser.setWindowBounds') {
            assert.deepEqual(params, { windowId: 7, bounds: { windowState: 'maximized' } });
            if (!options.refuseMaximize) windowState = 'maximized';
            return {};
          }
          assert.equal(method, 'Browser.getWindowBounds');
          assert.deepEqual(params, { windowId: 7 });
          boundRead++;
          return { bounds: { width: boundRead === 1 && options.resizeDuringMaximize ? 1000 : 1360,
            height: 900, left: -8, top: -8, windowState } };
        },
        detach: async () => { windowDetached++; },
      };
    },
  };
  const page = { context: () => context, viewportSize: () => options.fixedViewport ? { width: 1280, height: 720 } : null,
    evaluate: async () => {
      viewportRead++;
      return { width: viewportRead === 2 && options.resizeDuringMaximize ? 1000 : 1344, height: 813 };
    } };
  return { page, detached: () => detached, windowDetached: () => windowDetached, commands };
}

function child() {
  const item = new EventEmitter();
  item.stdin = new PassThrough(); item.stdout = new PassThrough(); item.stderr = new PassThrough();
  item.killed = false; item.exitCode = null;
  item.finish = code => {
    if (item.exitCode !== null) return;
    item.exitCode = code; item.emit('exit', code);
    item.stdout?.end(); item.stderr.end();
    queueMicrotask(() => item.emit('close', code));
  };
  item.kill = () => { item.killed = true; item.finish(1); return true; };
  return item;
}
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'window-recorder-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const browser = fakeBrowser(options.processInfo, options);
  const children = [], calls = [];
  let helper, encoder;
  const event = (type, reason = null, count = type === 'end' ? 3 : 1) => ({ event: type, reason,
    pid: 1234, hwnd: '98765', width: 1360, height: 900, frame_count: count,
    captured_frames: count, duplicated_frames: 0, max_gap_ms: 100,
    started_at: '2026-10-09T01:00:00.000Z', ended_at: type === 'end' ? '2026-10-09T01:00:00.300Z' : null });
  function emit(type, reason, count) { helper.stderr.write(JSON.stringify(event(type, reason, count)) + '\n'); }
  const spawnProcess = (executable, args, spawnOptions) => {
    calls.push({ executable, args, spawnOptions });
    if (options.throwAt === calls.length) throw Error('private native error');
    const item = child(); children.push(item);
    if (executable === prepared.ffmpeg_path) {
      encoder = item;
      item.stdin.on('finish', async () => {
        if (options.encoderHangs || item.exitCode !== null) return;
        await fs.writeFile(args.at(-1), Buffer.alloc(100, 42));
        item.finish(options.encoderExit ?? 0);
      });
    } else {
      helper = item;
      // A shared stdio handle has no parent-readable stdout stream.
      assert.equal(spawnOptions.stdio[1], encoder.stdin);
      item.stdout = null;
      item.stdin.on('data', chunk => {
        if (!chunk.toString().includes('STOP') || item.exitCode !== null || options.helperHangs) return;
        emit('end', 'STOPPED'); item.finish(0);
      });
      setImmediate(() => {
        if (options.start === 'silent') return;
        if (options.start === 'invalid') { item.stderr.write('not json\n'); return; }
        if (options.start === 'notfound') { emit('end', 'WINDOW_NOT_FOUND', 0); item.finish(2); return; }
        spawnOptions.stdio[1].write(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        item.stderr.write(JSON.stringify({...event('ready'),window_guard:'OWNED_WINDOW_NO_MINIMIZE'})+'\n');
      });
    }
    return item;
  };
  const args = { ...browser, directory: root, identity, prepared, spawnProcess,
    readyTimeoutMs: 80, watchdogMs: 80, stopTimeoutMs: 30, encoderTimeoutMs: 30 };
  return { root, args, children, calls, emit, helper: () => helper, encoder: () => encoder, ...browser };
}

test('preparation rejects unsupported platform and missing compiler without starting processes', async () => {
  let calls = 0;
  await assert.rejects(prepareWindowRecorder({ platform: 'linux', spawnProcess: () => { calls++; } }), /UNSUPPORTED/);
  await assert.rejects(prepareWindowRecorder({ platform: 'win32', systemRoot: '', spawnProcess: () => { calls++; } }), /COMPILER_UNAVAILABLE/);
  assert.equal(calls, 0);
});

test('identity allowlist rejects absent run, unexpected metadata and control characters', () => {
  assert.deepEqual(windowRecorderInternals.normalizeIdentity(identity), identity);
  for (const value of [null, {}, { ...identity, token: 'private' }, { ...identity, project_id: 'bad\n' },
    { ...identity, case_version: NaN }]) assert.throws(() => windowRecorderInternals.normalizeIdentity(value), /IDENTITY_INVALID/);
});

test('browser PID is taken from this browser CDP and the CDP session detaches', async () => {
  const browser = fakeBrowser([{ type: 'renderer', id: 4444 }, { type: 'browser', id: 1234 }]);
  assert.equal(await windowRecorderInternals.browserProcessId(browser.page, 100), 1234);
  assert.equal(browser.detached(), 1);
  const ambiguous = fakeBrowser([{ type: 'browser', id: 1234 }, { type: 'browser', id: 1235 }]);
  await assert.rejects(windowRecorderInternals.browserProcessId(ambiguous.page, 100), /IDENTITY_AMBIGUOUS/);
  assert.equal(ambiguous.detached(), 1);
});

test('recording waits for native ready, drains video, preserves identity and stops only once', async t => {
  const f = await fixture(t);
  const recording = await startWindowRecording(f.args);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].args[0], '1234');
  assert.equal(f.calls[1].spawnOptions.stdio[1], f.encoder().stdin);
  assert.equal(f.helper().stdout, null);
  assert(f.calls[0].args.includes('image2pipe'));
  assert(!f.calls[0].args.includes('rawvideo'));
  assert(f.calls.every(call => call.spawnOptions.shell === false && call.spawnOptions.windowsHide === true));
  const first = recording.stop(), second = recording.stop();
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.status, 'COMPLETE'); assert.equal(result.reason, null);
  assert.equal(result.width, 1360); assert.equal(result.height, 900);
  assert.equal(result.frame_count, 3); assert.equal(result.encoded_duration_seconds, 0.3);
  assert.deepEqual(result.identity, identity); assert.equal(result.captures_desktop, false);
  assert.equal(result.includes_browser_chrome, true);
  assert.equal(result.browser_window_maximized, true);
  assert.equal(result.window_guard,'OWNED_WINDOW_NO_MINIMIZE');
  assert.ok(Date.parse(result.stop_requested_at)>=Date.parse(result.requested_at));
  assert.equal(result.browser_window_state, 'maximized');
  assert.deepEqual(result.viewport, { width: 1344, height: 813 });
  assert.deepEqual(result.browser_window_bounds, { width: 1360, height: 900, left: -8, top: -8 });
  assert.equal(f.windowDetached(), 1);
  assert(f.children.every(item => item.exitCode === 0 && !item.killed));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.root, 'recording.json'), 'utf8')), result);
});

test('window minimization keeps partial file but cannot produce COMPLETE', async t => {
  const f = await fixture(t);
  const recording = await startWindowRecording(f.args);
  f.emit('end', 'WINDOW_MINIMIZED', 2); f.helper().finish(2);
  const result = await recording.stop();
  assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.reason, 'WINDOW_MINIMIZED');
  assert.equal(result.video_file, 'browser-window.webm'); assert.equal(result.frame_count, 2);
});

test('bounded restored-window events stay visible in metadata without hiding terminal failure',async t=>{
  const f=await fixture(t),recording=await startWindowRecording(f.args);
  f.helper().stderr.write(JSON.stringify({event:'end',reason:'WINDOW_MINIMIZED',pid:1234,hwnd:'98765',width:1360,height:900,frame_count:2,
    captured_frames:2,duplicated_frames:0,max_gap_ms:210,started_at:'2026-10-09T01:00:00.000Z',ended_at:'2026-10-09T01:00:00.200Z',
    minimization_recoveries:[{status:'RESTORED',duration_ms:10,started_at:'2026-10-09T01:00:00.100Z',ended_at:'2026-10-09T01:00:00.110Z'}]})+'\n');
  f.helper().finish(2);const result=await recording.stop();
  assert.equal(result.status,'INCOMPLETE');assert.equal(result.reason,'WINDOW_MINIMIZED');assert.equal(result.minimization_recoveries[0].duration_ms,10);
});

test('window unavailable at startup writes UNAVAILABLE and closes both owned children', async t => {
  const f = await fixture(t, { start: 'notfound' });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.status, 'UNAVAILABLE');
    assert.equal(error.recording.reason, 'WINDOW_NOT_FOUND'); return true;
  });
  assert(f.children.every(item => item.exitCode !== null));
});

test('encoder spawn failure records unavailability without starting helper', async t => {
  const f = await fixture(t, { throwAt: 1 });
  await assert.rejects(startWindowRecording(f.args), error => error.recording.status === 'UNAVAILABLE');
  assert.equal(f.calls.length, 1); assert.equal(f.children.length, 0);
});

test('helper spawn failure closes already owned encoder', async t => {
  const f = await fixture(t, { throwAt: 2 });
  await assert.rejects(startWindowRecording(f.args), error => error.recording.status === 'UNAVAILABLE');
  assert.equal(f.calls.length, 2); assert.equal(f.children.length, 1);
  assert.notEqual(f.encoder().exitCode, null);
});

test('startup timeout bounds a hung helper and releases encoder', async t => {
  const f = await fixture(t, { start: 'silent', helperHangs: true });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.status, 'UNAVAILABLE');
    assert.equal(error.recording.reason, 'WINDOW_RECORDING_READY_TIMEOUT'); return true;
  });
  assert(f.helper().killed); assert(f.children.every(item => item.exitCode !== null));
});

test('watchdog stops a recorder that freezes after its first frame', async t => {
  const f = await fixture(t, { helperHangs: true });
  const recording = await startWindowRecording(f.args);
  await new Promise(resolve => setTimeout(resolve, 150));
  const result = await recording.stop();
  assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.reason, 'WINDOW_RECORDING_STALLED');
  assert(f.helper().killed); assert(f.children.every(item => item.exitCode !== null));
});

test('encoder timeout is incomplete and kills only the owned encoder', async t => {
  const f = await fixture(t, { encoderHangs: true });
  const recording = await startWindowRecording(f.args);
  const result = await recording.stop();
  assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.reason, 'WINDOW_ENCODER_TIMEOUT');
  assert(f.encoder().killed); assert(!f.helper().killed);
});

test('native protocol errors do not become successful evidence', async t => {
  const f = await fixture(t, { start: 'invalid' });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.reason, 'WINDOW_HELPER_PROTOCOL_INVALID'); return true;
  });
  assert(f.children.every(item => item.exitCode !== null));
});

test('existing evidence is never overwritten and no process starts', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'recording.json'), 'original');
  await assert.rejects(startWindowRecording(f.args), /WINDOW_RECORDING_OUTPUT_EXISTS/);
  assert.equal(f.calls.length, 0);
  assert.equal(await fs.readFile(path.join(f.root, 'recording.json'), 'utf8'), 'original');
});

test('ambiguous browser PID prevents any native process from starting', async t => {
  const f = await fixture(t, { processInfo: [{ type: 'browser', id: 1 }, { type: 'browser', id: 2 }] });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.reason, 'WINDOW_BROWSER_IDENTITY_AMBIGUOUS'); return true;
  });
  assert.equal(f.calls.length, 0);
});

test('failed preparation is recorded and does not leak a process', async t => {
  const f = await fixture(t);
  await assert.rejects(startWindowRecording({ ...f.args, prepared: undefined,
    prepare: async () => { throw Error('WINDOW_RECORDER_ENCODER_UNAVAILABLE'); } }), error => {
    assert.equal(error.recording.reason, 'WINDOW_RECORDER_ENCODER_UNAVAILABLE'); return true;
  });
  assert.equal(f.calls.length, 0);
});


test('maximization waits for stable native window and page dimensions without fullscreen', async () => {
  const browser = fakeBrowser(undefined, { resizeDuringMaximize: true });
  const layout = await windowRecorderInternals.maximizeBrowserWindow(browser.page, 1000);
  assert.deepEqual(layout.viewport, { width: 1344, height: 813 });
  assert.equal(layout.browser_window_state, 'maximized');
  assert.equal(layout.browser_window_id, 7);
  assert.equal(browser.commands.filter(call => call.method === 'Browser.getWindowBounds').length, 5);
  assert.equal(browser.commands.filter(call => call.method === 'Browser.setWindowBounds').length, 1);
  assert.equal(browser.windowDetached(), 1);
});

test('a fixed emulated viewport is rejected before any native recorder starts', async t => {
  const f = await fixture(t, { fixedViewport: true });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.reason, 'WINDOW_VIEWPORT_NOT_NATIVE');
    assert.equal(error.recording.status, 'UNAVAILABLE');
    assert.equal(error.recording.viewport, null);
    assert.equal(error.recording.browser_window_maximized, false);
    return true;
  });
  assert.equal(f.calls.length, 0);
});

test('maximization failure cannot claim complete recording or start helper and encoder', async t => {
  const f = await fixture(t, { refuseMaximize: true });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.reason, 'WINDOW_MAXIMIZE_TIMEOUT');
    assert.equal(error.recording.status, 'UNAVAILABLE');
    assert.equal(error.recording.browser_window_maximized, false);
    return true;
  });
  assert.equal(f.calls.length, 0);
  assert.equal(f.windowDetached(), 1);
});

test('a late CDP session detaches after timeout without maximizing another window', async () => {
  const browser = fakeBrowser(undefined, { sessionDelayMs: 40 });
  await assert.rejects(windowRecorderInternals.maximizeBrowserWindow(browser.page, 5), /WINDOW_MAXIMIZE_TIMEOUT/);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(browser.windowDetached(), 1);
  assert.deepEqual(browser.commands, []);
});

test('unexpected CDP errors are sanitized and owned page session always detaches', async t => {
  const f = await fixture(t, { cdpError: 'private path and unsupported CDP details' });
  await assert.rejects(startWindowRecording(f.args), error => {
    assert.equal(error.recording.reason, 'WINDOW_MAXIMIZE_FAILED');
    return true;
  });
  assert.equal(f.calls.length, 0);
  assert.equal(f.windowDetached(), 1);
});

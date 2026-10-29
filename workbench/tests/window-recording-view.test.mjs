import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { executionMediaFiles, executionDisplayStatus, windowRecordingNoticeHtml, verifiedWindowTimeline, mediaStepPosition, mediaPhaseTime } from '../web-v2/execution-media.js';

const media = (kind, id) => ({ kind, file_id: id, file_name: id + '.webm' });
const fixture = () => ({
  run_id: 'trial-window-test', candidate_sha256: 'candidate-sha', origin: 'EXPLICIT_CANDIDATE_TRIAL', status: 'PASSED', execution_status: 'FINISHED',
  window_recording: { status: 'COMPLETE' }, recording: { width: 1280, height: 720 },
  step_replay: { status: 'READY', steps: [
    { step_id: 'STEP_1', order: 1, action: '查询条目', expected: '返回条目', execution_status: 'PASSED' },
    { step_id: 'STEP_2', order: 2, action: '核对值', expected: '值为1', execution_status: 'FAILED' },
  ], chapters: [
    { step_id: 'STEP_1', start_seconds: 0, result_start_seconds: 4, end_seconds: 6 },
    { step_id: 'STEP_2', start_seconds: 6, result_start_seconds: 9, end_seconds: 12 },
  ] },
  files: [media('trial_window_video', 'window'), media('trial_video', 'webpage'), media('trial_step_replay_video', 'replay')],
});
const synchronizedFixture = () => ({ ...fixture(), window_timeline: {
  schema: 'workbench/window-step-timeline-v1', status: 'VERIFIED', run_id: 'trial-window-test', candidate_sha256: 'candidate-sha',
  duration_seconds: 20, accuracy_seconds: 0.1, steps: [
    { step_id: 'STEP_1', order: 1, start_seconds: 2, action_start_seconds: 2, result_start_seconds: 5, end_seconds: 8, execution_status: 'PASSED' },
    { step_id: 'STEP_2', order: 2, start_seconds: 10, action_start_seconds: 10, result_start_seconds: 14, end_seconds: 18, execution_status: 'FAILED' },
  ],
} });

test('window media never replaces the webpage or chapter replay identity', () => {
  const run = fixture(), files = executionMediaFiles(run);
  assert.equal(files.window.file_id, 'window');
  assert.equal(files.original.file_id, 'webpage');
  assert.equal(files.replay.file_id, 'replay');
  assert.equal(executionMediaFiles({ files: [run.files[0]] }).original, undefined);
  assert.equal(executionMediaFiles(null).window, undefined);
});

test('missing, incomplete and legacy window evidence stays separate from the business result', () => {
  const run = fixture();
  assert.match(windowRecordingNoticeHtml(run), /包含地址栏、标签页/);
  assert.match(windowRecordingNoticeHtml({...run,window_recording:{status:'COMPLETE',maximum_capture_gap_ms:211,minimization_recoveries:[{status:'RESTORED'}]}}),/恢复自有窗口 1 次.*211 毫秒.*原连续性校验/);
  for (const status of ['INCOMPLETE', 'UNAVAILABLE']) {
    const input = { ...run, window_recording: { status, reason: '<source>&fault' } };
    const html = windowRecordingNoticeHtml(input);
    assert.match(html, /notice warning/);
    assert.match(html, /&lt;source&gt;&amp;fault/);
    assert.match(html, /录制完整性与业务用例结果分别核对/);
    assert.equal(executionDisplayStatus(input), 'PASSED');
  }
  assert.match(windowRecordingNoticeHtml({ ...run, files: [] }), /录像文件缺失/);
  assert.match(windowRecordingNoticeHtml({ ...run, window_recording: undefined, files: run.files.slice(1) }), /此记录未采集浏览器整窗录像/);
  assert.match(windowRecordingNoticeHtml({ ...run, window_recording: undefined }), /完整性尚未核验/);
});

test('real window timeline requires matching identity, finite decoded duration and ordered recorded steps', () => {
  const run = synchronizedFixture();
  assert.equal(verifiedWindowTimeline(run, 20).status, 'VERIFIED');
  assert.equal(verifiedWindowTimeline({ ...run, window_timeline: { ...run.window_timeline, accuracy_seconds: 0.132 } }, 20).status, 'VERIFIED');
  assert.equal(verifiedWindowTimeline(run, 20.35).status, 'VERIFIED');
  assert.equal(verifiedWindowTimeline(run, NaN).reason, 'VIDEO_DURATION_UNAVAILABLE');
  assert.equal(verifiedWindowTimeline(run, 20.36).reason, 'VIDEO_DURATION_MISMATCH');
  for (const edit of [
    timeline => { timeline.status = 'UNAVAILABLE'; },
    timeline => { timeline.run_id = 'another-run'; },
    timeline => { timeline.candidate_sha256 = 'another-candidate'; },
    timeline => { timeline.accuracy_seconds = 1.51; },
    timeline => { timeline.steps[1].step_id = 'STEP_1'; },
    timeline => { timeline.steps[0].result_start_seconds = 9; },
    timeline => { timeline.steps[1].end_seconds = 25; },
  ]) {
    const changed = structuredClone(run); edit(changed.window_timeline);
    assert.equal(verifiedWindowTimeline(changed, 20).status, 'UNAVAILABLE');
  }
});

test('mapping uses the same step and action/result phase, never a duration ratio', () => {
  const run = synchronizedFixture(), windowRows = run.window_timeline.steps, replayRows = run.step_replay.chapters;
  const position = mediaStepPosition(windowRows, 15);
  assert.deepEqual(position, { step_id: 'STEP_2', phase: 'result' });
  assert.equal(mediaPhaseTime(replayRows[1], position.phase, true), 9.15);
  assert.equal(mediaPhaseTime(windowRows[1], position.phase), 14.05);
  assert.equal(mediaStepPosition(windowRows, 9), null, 'unrecorded gaps do not imply a step');
  assert.deepEqual(mediaStepPosition(windowRows, 10), { step_id: 'STEP_2', phase: 'action' });
  const shortResult = { start_seconds: 0.128, action_start_seconds: 0.18, result_start_seconds: 0.469, end_seconds: 0.507 };
  for (const replay of [false, true]) {
    const position = mediaPhaseTime(shortResult, 'result', replay);
    assert.ok(position >= 0.469 && position < 0.507, 'a short recorded result phase is not skipped by a fixed offset');
  }
});

// Browser DOM/control verification only: no server, model, SUT, or real recording.
// The media clock is deterministic; codec decoding is covered by live acceptance.
test('offline player switches window, webpage, replay and screenshots without overlapping playback', async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.WORKBENCH_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => route.abort());
  const source = await fs.readFile(new URL('../web-v2/execution-media.js', import.meta.url), 'utf8');
  const styles = (await Promise.all(['styles.css','workspace-v2.css'].map(file=>fs.readFile(new URL('../web-v2/'+file,import.meta.url),'utf8')))).join('\n');
  const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  async function mount(run, { caption = false, replay = true } = {}) {
    await page.setContent(`<base href="http://media-fixture.invalid/"><main id="host">${windowRecordingNoticeHtml(run)}<div class="execution-media">${replay ? `<video data-testid="execution-video" src="/api/runs/${run.run_id}/media/${caption ? 'caption' : 'replay'}"></video>` : ''}${!caption && run.files.some(file => file.file_id === 'webpage') ? `<video data-testid="original-video" src="/api/runs/${run.run_id}/media/webpage"></video>` : ''}</div><p id="execution-playing-step"></p><ol><li class="execution-step" data-step-id="STEP_1"><button data-step-seek="STEP_1">第一步</button></li><li class="execution-step" data-step-id="STEP_2"><button data-step-seek="STEP_2">第二步</button></li></ol></main>`);
    await page.addStyleTag({ content: styles });
    await page.evaluate(async ({ moduleUrl, run }) => {
      // These tests intentionally have no media server. Ignore native loading
      // errors; explicit synthetic error events below still exercise the UI.
      document.addEventListener('error', event => {
        if (event.isTrusted && event.target instanceof HTMLMediaElement) event.stopImmediatePropagation();
      }, true);
      Object.defineProperties(HTMLMediaElement.prototype, {
        duration: { configurable: true, get() { return this._duration ?? 20; } },
        currentTime: { configurable: true, get() { return this._time || 0; }, set(value) { this._time = value; } },
        paused: { configurable: true, get() { return this._paused !== false; } },
      });
      HTMLMediaElement.prototype.pause = function () { this._paused = true; this.dispatchEvent(new Event('pause')); };
      HTMLMediaElement.prototype.play = function () { this._paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
      const { enhanceMedia } = await import(moduleUrl);
      const controller = enhanceMedia(document.querySelector('#host'), run);
      // Only historical caption timelines retain the old app handler.
      if (!controller.handlesSteps) document.querySelector('[data-step-seek]').addEventListener('click', () => {
        const replay = document.querySelector('[data-testid="execution-video"]'); if (replay) replay.currentTime = 3;
      });
    }, { moduleUrl, run });
  }
  await t.test('window is default; changing tabs pauses other players; chapters switch to replay', async () => {
    await mount(fixture());
    assert.equal(await page.locator('[data-media-view="window"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByTestId('browser-window-video').isVisible(), true);
    await page.locator('[data-player-toggle]').click();
    await page.locator('[data-player-seek]').fill('35');
    await page.locator('[data-player-seek]').dispatchEvent('input');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 7);
    await page.locator('[data-media-view="original"]').click();
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.paused), true);
    assert.equal(await page.getByTestId('original-video').evaluate(v => v.paused), false);
    await page.locator('[data-step-seek="STEP_1"]').click();
    assert.equal(await page.locator('[data-media-view="replay"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByTestId('original-video').evaluate(v => v.paused), true);
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.currentTime), 0.15);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 7);
    await page.locator('[data-player-toggle]').click();
    await page.locator('[data-media-view="images"]').click();
    assert.equal(await page.locator('video').evaluateAll(videos => videos.every(v => v.paused)), true);
    assert.equal(await page.locator('.player-controls').isVisible(), false);
    assert.equal(await page.getByTestId('window-recording-notice').isVisible(), true);
  });
  await t.test('window load errors remain visible while other evidence can be selected', async () => {
    await mount(fixture());
    await page.getByTestId('browser-window-video').dispatchEvent('error');
    await page.locator('[data-media-view="original"]').click();
    assert.match(await page.getByTestId('window-recording-notice').innerText(), /浏览器录像加载失败.*业务用例结果未改变/);
    assert.equal(await page.getByTestId('window-recording-notice').isVisible(), true);
  });
  await t.test('legacy caption and webpage remain distinct and are never labelled window evidence', async () => {
    const run = { ...fixture(), window_recording: undefined, step_replay: undefined,
      caption_timeline: { status: 'VERIFIED', schema: 'workbench/trial-timeline-v2' },
      files: [media('trial_caption_video', 'caption'), media('trial_video', 'webpage')] };
    await mount(run, { caption: true });
    assert.equal(await page.locator('[data-media-view="window"]').count(), 0);
    await page.locator('[data-media-view="original"]').click();
    assert.match(await page.getByTestId('original-video').getAttribute('src'), /\/webpage$/);
    await page.locator('[data-step-seek="STEP_1"]').click();
    assert.equal(await page.getByTestId('execution-video').isVisible(), true);
    assert.match(await page.getByTestId('execution-video').getAttribute('src'), /\/caption$/);
  });
  await t.test('window-only evidence is playable without inventing a replay', async () => {
    const run = { ...fixture(), step_replay: undefined, files: [media('trial_window_video', 'window')] };
    await mount(run, { replay: false });
    assert.equal(await page.getByTestId('browser-window-video').isVisible(), true);
    await page.locator('[data-media-view="replay"]').click();
    assert.match(await page.locator('[data-view-note]').innerText(), /未采集可用步骤回放/);
    assert.equal(await page.locator('[data-player-toggle]').isDisabled(), true);
  });
  await t.test('verified window clock highlights actual steps and keeps step clicks in window view', async () => {
    await mount(synchronizedFixture());
    await page.getByTestId('browser-window-video').evaluate(v => { v.currentTime = 11; v.dispatchEvent(new Event('timeupdate')); });
    assert.equal(await page.locator('.execution-step.playing').getAttribute('data-step-id'), 'STEP_2');
    assert.match(await page.locator('[data-player-step]').innerText(), /步骤 2 · 动作/);
    await page.locator('[data-step-seek="STEP_2"]').click();
    assert.equal(await page.getByTestId('browser-window-video').isVisible(), true);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 14.05);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.paused), true);
    assert.match(await page.locator('#execution-playing-step').innerText(), /步骤 2 · 结果/);
    await page.getByTestId('execution-video').evaluate(v => { v.currentTime = 1; v.dispatchEvent(new Event('timeupdate')); });
    assert.equal(await page.locator('.execution-step.playing').getAttribute('data-step-id'), 'STEP_2', 'hidden replay cannot steal highlighting');
  });
  await t.test('window/replay changes map phase identity and preserve playing or paused state', async () => {
    await mount(synchronizedFixture());
    await page.getByTestId('browser-window-video').evaluate(v => { v.currentTime = 15; v.dispatchEvent(new Event('timeupdate')); });
    await page.locator('[data-player-toggle]').click();
    await page.locator('[data-media-view="replay"]').click();
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.currentTime), 9.15);
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.paused), false);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.paused), true);
    await page.locator('[data-media-view="window"]').click();
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 14.05);
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.paused), true);
    await page.locator('[data-player-toggle]').click();
    await page.locator('[data-media-view="replay"]').click();
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.paused), true);
    assert.equal(await page.locator('video').evaluateAll(videos => videos.filter(v => !v.paused).length), 0);
  });
  await t.test('duration mismatch, missing identity and legacy records fall back without guessing window seconds', async () => {
    for (const run of [fixture(), { ...synchronizedFixture(), candidate_sha256: 'different' }, synchronizedFixture()]) {
      await mount(run);
      await page.getByTestId('browser-window-video').evaluate(v => { v._duration = 21; v.currentTime = 7; v.dispatchEvent(new Event('durationchange')); });
      await page.locator('[data-step-seek="STEP_2"]').click();
      assert.equal(await page.getByTestId('execution-video').isVisible(), true);
      assert.equal(await page.getByTestId('execution-video').evaluate(v => v.currentTime), 9.15);
      assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 7);
    }
  });
  await t.test('late decoded duration resolves a pending mapped switch without simultaneous playback', async () => {
    await mount(synchronizedFixture());
    await page.locator('[data-media-view="replay"]').click();
    await page.getByTestId('execution-video').evaluate(v => { v.currentTime = 10; v.dispatchEvent(new Event('timeupdate')); });
    await page.locator('[data-player-toggle]').click();
    await page.getByTestId('browser-window-video').evaluate(v => { v._duration = NaN; });
    await page.locator('[data-media-view="window"]').click();
    assert.equal(await page.locator('video').evaluateAll(videos => videos.every(v => v.paused)), true);
    await page.getByTestId('browser-window-video').evaluate(v => { v._duration = 20; v.dispatchEvent(new Event('loadedmetadata')); });
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 14.05);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.paused), false);
    assert.equal(await page.getByTestId('execution-video').evaluate(v => v.paused), true);
  });
  await t.test('long step labels stay inside a 390px viewport and retain step selection', async () => {
    const run=synchronizedFixture();
    run.step_replay.steps[1].action='打开 http://127.0.0.1:4460/inspection/ ，清除筛选条件并独立核对完整工单列表和所有字段。'.repeat(5);
    await page.setViewportSize({width:390,height:844});
    await mount(run);
    // Execution-record detail also includes a 640px legacy screenshot outside the media player.
    await page.locator('#host').evaluate(host=>host.insertAdjacentHTML('beforeend','<img data-testid="run-screenshot" width="640" alt="本次运行截图" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">'));
    assert.ok(await page.getByTestId('run-screenshot').evaluate(img=>img.getBoundingClientRect().width<=390));
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,right:document.querySelector('.media-step-buttons').getBoundingClientRect().right,select:document.querySelector('[data-player-step-select]').getBoundingClientRect().width}));
    assert.ok(bounds.scroll<=bounds.width,JSON.stringify(bounds));
    assert.ok(bounds.right<=bounds.width && bounds.select>40,JSON.stringify(bounds));
    await page.locator('[data-player-step-select]').selectOption('STEP_2');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v=>v.currentTime),14.05);
    assert.match(await page.locator('[data-player-step]').innerText(),/步骤 2/);
    await page.setViewportSize({width:1280,height:720});
  });
  await t.test('element fullscreen keeps switching, speed and step navigation with contain-fit video', async () => {
    await mount(synchronizedFixture());
    await page.addStyleTag({content:await fs.readFile(new URL('../web-v2/product.css',import.meta.url),'utf8')});
    await page.locator('#host').evaluate(node=>node.classList.add('native-run-evidence'));
    await page.getByRole('button', { name: '全屏播放', exact: true }).click();
    assert.equal(await page.evaluate(() => document.fullscreenElement?.classList.contains('execution-media')), true);
    assert.equal(await page.locator('[data-player-speed]').isVisible(), true);
    assert.equal(await page.locator('[data-player-step-select]').isVisible(), true);
    await page.locator('[data-player-step-select]').selectOption('STEP_2');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 14.05);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => getComputedStyle(v).objectFit), 'contain');
    assert.ok(await page.getByTestId('browser-window-video').evaluate(v => v.getBoundingClientRect().height > 200));
    await page.getByRole('button', { name: '退出全屏', exact: true }).click();
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v => v.currentTime), 14.05);
    assert.equal(await page.getByRole('button', { name: '全屏播放', exact: true }).isVisible(), true);
  });
  await t.test('window enlargement and original pixels preserve the existing video, clock, speed and escape focus',async()=>{
    await mount(synchronizedFixture());
    await page.addStyleTag({content:await fs.readFile(new URL('../web-v2/product.css',import.meta.url),'utf8')});
    await page.locator('#host').evaluate(node=>node.classList.add('native-run-evidence'));
    await page.getByTestId('browser-window-video').evaluate(video=>{
      Object.defineProperties(video,{videoWidth:{get:()=>2560},videoHeight:{get:()=>1440}});
      video.dataset.sameVideo='retained';video.currentTime=14.05;video.dispatchEvent(new Event('loadedmetadata'));
    });
    await page.locator('[data-player-speed]').selectOption('0.5');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(video=>video.controlsList.contains('nofullscreen')),false);
    await page.getByRole('button',{name:'放大查看',exact:true}).click();
    assert.equal(await page.locator('.execution-media').getAttribute('role'),'dialog');
    const rect=await page.locator('.execution-media').boundingBox();assert.ok(rect.width>=1270&&rect.height>=710,JSON.stringify(rect));
    await page.locator('[data-player-zoom]').selectOption('1');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v=>v.getBoundingClientRect().width),2560);
    await page.locator('[data-player-zoom]').selectOption('1.5');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v=>v.getBoundingClientRect().width),3840);
    assert.match(await page.locator('[data-player-resolution]').innerText(),/2560 × 1440/);
    assert.equal(await page.getByTestId('browser-window-video').getAttribute('data-same-video'),'retained');
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v=>v.currentTime),14.05);
    assert.equal(await page.getByTestId('browser-window-video').evaluate(v=>v.playbackRate),0.5);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.execution-media').getAttribute('aria-modal'),null);
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    assert.equal(await page.getByRole('button',{name:'放大查看',exact:true}).evaluate(button=>document.activeElement===button),true);
  });
  await t.test('denied or unavailable system fullscreen falls back visibly and removal restores scrolling',async()=>{
    for(const unavailable of [false,true]){
      await mount(synchronizedFixture());
      await page.locator('.execution-media').evaluate((area,unavailable)=>{area.requestFullscreen=unavailable?undefined:()=>Promise.reject(Error('denied fixture'));},unavailable);
      await page.getByRole('button',{name:'全屏播放',exact:true}).click();
      await page.getByRole('button',{name:'退出放大',exact:true}).waitFor();
      assert.match(await page.locator('[data-view-note]').innerText(),/已放大到当前窗口/);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
      await page.locator('.execution-media').evaluate(area=>area.remove());
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    }
  });
});

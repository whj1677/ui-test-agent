import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { deriveTrialTimeline } from './trial-timeline.mjs';

export function addWebmDuration(bytes, durationSeconds) {
  const infoId = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
  const at = bytes.indexOf(infoId);
  if (at < 0 || at > 256 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('WEBM_DURATION_PATCH_UNAVAILABLE');
  const size = bytes[at + 4];
  if (size < 0x80 || size > 0xf0) throw new Error('WEBM_INFO_SIZE_UNSUPPORTED');
  const originalSize = size & 0x7f;
  const payloadEnd = at + 5 + originalSize;
  if (payloadEnd > bytes.length || bytes.subarray(at + 5, payloadEnd).includes(Buffer.from([0x44, 0x89]))) throw new Error('WEBM_INFO_INVALID');
  const duration = Buffer.alloc(11);
  duration[0] = 0x44; duration[1] = 0x89; duration[2] = 0x88;
  duration.writeDoubleBE(durationSeconds * 1000, 3);
  const updated = Buffer.concat([bytes.subarray(0, payloadEnd), duration, bytes.subarray(payloadEnd)]);
  updated[at + 4] = 0x80 | (originalSize + duration.length);
  return updated;
}

async function loadVideo(page, sourceBytes) {
  await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body><video id="source" muted playsinline preload="auto"></video><canvas id="canvas" width="1280" height="900"></canvas></body></html>');
  return page.evaluate(async (base64) => {
    const video = document.querySelector('#source');
    video.src = `data:video/webm;base64,${base64}`;
    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('SOURCE_VIDEO_DECODE_FAILED')), { once: true });
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('SOURCE_VIDEO_DURATION_INVALID');
    return video.duration;
  }, sourceBytes.toString('base64'));
}

export async function renderCaptionVideo({ sourcePath, tracePath, outputPath, caseContent, coverage, runId, candidateSha256, browserExecutable }) {
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
    const duration = await loadVideo(page, await fs.readFile(sourcePath));
    const timeline = await deriveTrialTimeline({ tracePath, durationSeconds: duration, caseContent, coverage, runId, candidateSha256 });
    if (timeline.status !== 'VERIFIED') return { timeline, videoPath: null };
    const result = await page.evaluate(async ({ steps, caseId }) => {
      const source = document.querySelector('#source');
      const canvas = document.querySelector('#canvas');
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(25);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1_500_000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      let stage = null;
      function wrap(text, maxWidth, maxLines = 2) {
        const chars = [...String(text ?? '')];
        const lines = [];
        while (chars.length && lines.length < maxLines) {
          let line = '';
          while (chars.length && ctx.measureText(line + chars[0]).width <= maxWidth) line += chars.shift();
          if (!line && chars.length) line = chars.shift();
          lines.push(line);
        }
        if (chars.length && lines.length) {
          while (lines.at(-1) && ctx.measureText(`${lines.at(-1)}…`).width > maxWidth)
            lines[lines.length - 1] = lines.at(-1).slice(0, -1);
          lines[lines.length - 1] += '…';
        }
        return lines;
      }
      function draw() {
        ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, 1280, 900);
        if (!stage) return;
        ctx.fillStyle = '#f4f7f9'; ctx.font = '600 28px Microsoft YaHei, sans-serif';
        ctx.fillText(`${caseId} · 步骤 ${stage.step.order} · ${stage.phase === 'action' ? '操作中' : '步骤结果'}`, 34, 47);
        ctx.font = '23px Microsoft YaHei, sans-serif';
        let y = 88;
        const rows = stage.phase === 'action'
          ? [['操作', stage.step.action], ['检查', stage.step.expected]]
          : [['状态', stage.step.execution_status === 'FAILED' ? '断言不符' : '已执行，通过'],
            ['实际', stage.step.actual], ...(stage.step.execution_status === 'FAILED' ? [['原断言预期', stage.step.assertion_expected || stage.step.expected]] : [])];
        for (const [label, value] of rows) {
          ctx.fillStyle = '#9cd4e5'; ctx.fillText(`${label}：`, 34, y);
          ctx.fillStyle = '#fff';
          const valueX = Math.max(110, 34 + ctx.measureText(`${label}：`).width + 15);
          // Result rows stay within the caption band; full values remain in the step panel.
          const lines = wrap(value, 1280 - valueX - 34, stage.phase === 'result' ? 1 : 2);
          for (const line of lines) { ctx.fillText(line, valueX, y); y += 30; }
          y += 5;
        }
        const vw = source.videoWidth || 800; const vh = source.videoHeight || 450;
        const scale = Math.min(1200 / vw, 630 / vh);
        const width = vw * scale; const height = vh * scale;
        ctx.drawImage(source, (1280 - width) / 2, 245 + (630 - height) / 2, width, height);
        ctx.fillStyle = '#b4c3cc'; ctx.font = '18px Microsoft YaHei, sans-serif';
        ctx.fillText('派生字幕版 · 原速执行片段，步骤前后为阅读停留 · 原始录像另存', 32, 891);
      }
      async function seek(seconds) {
        const target = Math.max(0, Math.min(source.duration - 0.001, seconds));
        if (Math.abs(source.currentTime - target) < 0.006 && source.readyState >= 2) return;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('SOURCE_VIDEO_SEEK_TIMEOUT')), 5000);
          source.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
          source.currentTime = target;
        });
      }
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const interval = setInterval(draw, 30);
      const segments = [];
      recorder.start(250);
      const clock = performance.now();
      try {
        for (const step of steps.filter((item) => item.source_video_start_seconds !== null)) {
          await seek(step.source_video_start_seconds);
          const actionStart = (performance.now() - clock) / 1000;
          stage = { step, phase: 'action' };
          await wait(1300);
          if (step.source_video_end_seconds > step.source_video_start_seconds + 0.01) {
            await source.play();
            const until = performance.now() + (step.source_video_end_seconds - step.source_video_start_seconds) * 1000 + 500;
            while (source.currentTime < step.source_video_end_seconds - 0.015 && performance.now() < until) await wait(12);
            source.pause();
          }
          const resultStart = (performance.now() - clock) / 1000;
          stage = { step, phase: 'result' };
          await wait(1500);
          segments.push({ step_id: step.step_id, action_start_seconds: actionStart, result_start_seconds: resultStart,
            end_seconds: (performance.now() - clock) / 1000 });
        }
      } finally {
        source.pause();
        recorder.stop();
      }
      await new Promise((resolve, reject) => {
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', () => reject(new Error('CAPTION_RECORDER_FAILED')), { once: true });
      });
      clearInterval(interval);
      const blob = new Blob(chunks, { type: 'video/webm' });
      if (blob.size < 1000) throw new Error('CAPTION_VIDEO_EMPTY');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { base64, segments };
    }, { steps: timeline.steps, caseId: caseContent?.external_id || '演示用例' });
    const durationSeconds = result.segments.at(-1)?.end_seconds + 0.12;
    const rendered = addWebmDuration(Buffer.from(result.base64, 'base64'), durationSeconds);
    const verifiedDuration = await loadVideo(page, rendered);
    if (Math.abs(verifiedDuration - durationSeconds) > 0.5) throw new Error('CAPTION_VIDEO_DURATION_MISMATCH');
    await page.evaluate(async () => {
      const video = document.querySelector('#source');
      video.muted = true;
      await video.play();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CAPTION_VIDEO_PLAYBACK_TIMEOUT')), 2000);
        video.addEventListener('timeupdate', () => {
          if (video.currentTime > 0.08) { clearTimeout(timer); resolve(); }
        });
      });
      video.pause();
    });
    await fs.writeFile(outputPath, rendered);
    timeline.presentation = { kind: 'BURNED_IN_DERIVED_WEBM', holds: '1300ms action / 1500ms result', segments: result.segments };
    return { timeline, videoPath: outputPath };
  } catch (error) {
    return { timeline: { status: 'UNAVAILABLE', run_id: runId, candidate_sha256: candidateSha256,
      reason: `CAPTION_RENDER_FAILED:${error.message}` }, videoPath: null };
  } finally {
    await browser.close();
  }
}

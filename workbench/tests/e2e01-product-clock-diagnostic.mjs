import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { trialTimelineInternals } from '../server/build/trial-timeline.mjs';
import { mapTraceFramesToEncodedVideo } from '../server/build/caption-video.mjs';

const runDirectory = path.resolve(process.argv[2]);
const artifactsRoot = path.join(runDirectory, 'artifacts');
const artifactSubdir = (await fs.readdir(artifactsRoot, { withFileTypes: true })).find((entry) => entry.isDirectory())?.name;
if (!artifactSubdir) throw new Error('RUN_ARTIFACTS_MISSING');
const tracePath = path.join(artifactsRoot, artifactSubdir, 'trace.zip');
const videoPath = path.join(artifactsRoot, artifactSubdir, 'video.webm');
const bytes = await fs.readFile(tracePath);
const events = (name) => trialTimelineInternals.zipEntry(bytes, name).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const context = events('0-trace.trace');
const test = events('test.trace');
const frames = context.filter((event) => event.type === 'screencast-frame');
const steps = test.filter((event) => event.type === 'before' && event.method === 'test.step' && /^CASE_STEP_/.test(event.title));
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage();
  const clock = await mapTraceFramesToEncodedVideo(page, await fs.readFile(videoPath), tracePath);
  const traceImages = frames.map((frame) => ({ sha1: frame.sha1,
    base64: trialTimelineInternals.zipEntryBytes(bytes, `resources/${frame.sha1}`).toString('base64') }));
  const visual = await page.evaluate(async ({ videoBase64, traceImages }) => {
    const video = document.createElement('video'); video.muted = true; video.src = `data:video/webm;base64,${videoBase64}`;
    await new Promise((resolve, reject) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', reject, { once: true }); });
    const images = await Promise.all(traceImages.map(async (frame) => {
      const image = new Image(); image.src = `data:image/jpeg;base64,${frame.base64}`; await image.decode(); return image;
    }));
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const traced = images.map((image) => { ctx.drawImage(image, 0, 0, 64, 36); return ctx.getImageData(0, 0, 64, 36).data; });
    const samples = [];
    for (let second = 0; second < Math.min(video.duration, 1.2); second += 1 / 25) {
      if (second > 0) await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = second; });
      ctx.drawImage(video, 0, 0, 64, 36); const encoded = ctx.getImageData(0, 0, 64, 36).data;
      samples.push({ second: Math.round(video.currentTime * 1000) / 1000,
        error: traced.map((pixels) => { let total = 0; for (let i = 0; i < pixels.length; i += 4)
          total += (Math.abs(encoded[i] - pixels[i]) + Math.abs(encoded[i + 1] - pixels[i + 1]) + Math.abs(encoded[i + 2] - pixels[i + 2])) / 3;
          return Math.round(total / (64 * 36) * 100) / 100; }) });
    }
    return { duration_seconds: video.duration, samples };
  }, { videoBase64: (await fs.readFile(videoPath)).toString('base64'), traceImages });
  console.log(JSON.stringify({ run_directory: runDirectory, page_events: context.filter((event) => event.type === 'event' && event.method === 'page')
    .map((event) => ({ time: event.time, page_id: event.params?.pageId })),
    frames: frames.map((frame) => ({ trace_ms: frame.timestamp, swap_ms: frame.frameSwapWallTime, sha1: frame.sha1 })),
    steps: steps.map((step) => ({ title: step.title, start_ms: step.startTime, call_id: step.callId })),
    clock, visual }, null, 2));
} finally { await browser.close(); }

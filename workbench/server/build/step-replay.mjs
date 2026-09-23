import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { addWebmDuration } from './caption-video.mjs';
import { STEP_OBSERVER_VERSION } from './step-observer.mjs';

const REPLAY_SCHEMA = 'workbench/step-evidence-replay-v1';

export async function renderStepReplay({ runDirectory, runId, candidateSha256, executedExternalId,
  executedCaseVersion, caseContent, coverage, browserExecutable }) {
  const evidenceDir = path.join(runDirectory, 'artifacts', 'step-evidence');
  const outputPath = path.join(runDirectory, 'artifacts', 'step-replay-v1.webm');
  const base = { schema: REPLAY_SCHEMA, status: 'UNAVAILABLE', run_id: runId, candidate_sha256: candidateSha256,
    executed_external_id: executedExternalId, executed_case_version: executedCaseVersion,
    observer_version: STEP_OBSERVER_VERSION, source_kind: 'EXECUTION_TIME_STEP_SCREENSHOTS',
    original_video_precise_seek: false };
  let browser;
  try {
    const raw = await fs.readFile(path.join(evidenceDir, 'step-observations.ndjson'), 'utf8');
    const observations = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    if (!observations.length) throw new Error('STEP_OBSERVATIONS_EMPTY');
    const covered = (coverage?.items || []).filter((item) => item.observed);
    if (observations.length !== covered.length || observations.some((entry, index) =>
      entry.schema !== 'workbench/step-observation-v1' || entry.run_id !== runId ||
      entry.candidate_sha256 !== candidateSha256 || entry.executed_external_id !== executedExternalId ||
      entry.executed_case_version !== executedCaseVersion || entry.step_id !== covered[index].step_id ||
      entry.raw_title !== covered[index].raw_title || entry.status !== covered[index].execution_status))
      throw new Error('STEP_OBSERVATION_IDENTITY_OR_ORDER_MISMATCH');
    const steps = [];
    for (const item of coverage.items) {
      const source = caseContent?.steps?.find((step) => step.order === item.order);
      const observation = observations.find((entry) => entry.step_id === item.step_id);
      const mismatch = item.attributed_errors?.find((entry) => entry.error?.type === 'ASSERTION_MISMATCH')?.error;
      const captures = observation?.captures || [];
      const selected = captures.at(-1);
      const before = captures[0];
      let actionImageBase64 = null;
      let resultImageBase64 = null;
      let screenshotName = null;
      let screenshotError = selected?.capture_error || null;
      if (selected?.file_name) {
        if (!/^(case_step_[1-9]\d*)-(?:after|failure-after)\.png$/i.test(selected.file_name) ||
            !selected.file_name.toLowerCase().startsWith(item.step_id.toLowerCase() + '-'))
          throw new Error('STEP_SCREENSHOT_IDENTITY_MISMATCH');
        screenshotName = selected.file_name;
        resultImageBase64 = (await fs.readFile(path.join(evidenceDir, screenshotName))).toString('base64');
      }
      if (before?.file_name) {
        if (before.file_name.toLowerCase() !== `${item.step_id.toLowerCase()}-before.png`)
          throw new Error('STEP_BEFORE_SCREENSHOT_IDENTITY_MISMATCH');
        actionImageBase64 = (await fs.readFile(path.join(evidenceDir, before.file_name))).toString('base64');
      }
      steps.push({ step_id: item.step_id, order: item.order, raw_title: observation?.raw_title || item.raw_title,
        action: source?.action || '原步骤动作未取得', expected: source?.expected || '原步骤预期未取得',
        execution_status: item.execution_status, actual: mismatch?.actual ?? '未单独采集实际值',
        assertion_expected: mismatch?.expected ?? null, raw_error: observation?.raw_error || null,
        executed_start: observation?.business_started_at || null, executed_end: observation?.business_ended_at || null,
        observer_start: observation?.started_at || null, observer_end: observation?.ended_at || null,
        screenshot_phase: selected?.phase || null, screenshot_file_name: screenshotName,
        before_screenshot_file_name: before?.file_name || null,
        screenshot_error: screenshotError, capture_duration_ms: captures.reduce((sum, capture) => sum + (capture.capture_duration_ms || 0), 0),
        action_image_base64: actionImageBase64, result_image_base64: resultImageBase64 });
    }
    browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
    await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body><canvas width="1280" height="900"></canvas></body></html>');
    const rendered = await page.evaluate(async ({ steps, externalId }) => {
      const canvas = document.querySelector('canvas'); const ctx = canvas.getContext('2d');
      async function decode(base64) {
        if (!base64) return null;
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode(); return image;
      }
      const actionImages = await Promise.all(steps.map((step) => decode(step.action_image_base64)));
      const resultImages = await Promise.all(steps.map((step) => decode(step.result_image_base64)));
      const stream = canvas.captureStream(25);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1_500_000 });
      const chunks = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      let current = null;
      function wrap(value, maxWidth, limit) {
        const chars = [...String(value || '')], lines = [];
        while (chars.length && lines.length < limit) {
          let line = ''; while (chars.length && ctx.measureText(line + chars[0]).width <= maxWidth) line += chars.shift();
          if (!line && chars.length) line = chars.shift(); lines.push(line);
        }
        if (chars.length && lines.length) { while (ctx.measureText(`${lines.at(-1)}…`).width > maxWidth) lines[lines.length - 1] = lines.at(-1).slice(0, -1); lines[lines.length - 1] += '…'; }
        return lines;
      }
      function draw() {
        ctx.fillStyle = '#111d28'; ctx.fillRect(0, 0, 1280, 900);
        if (!current) return;
        const { step, image, phase } = current;
        ctx.fillStyle = '#fff'; ctx.font = '600 27px Microsoft YaHei, sans-serif';
        ctx.fillText(`${externalId} · 步骤 ${step.order} · ${phase === 'action' ? '动作与检查目标' : '执行结果'}`, 30, 43);
        ctx.font = '22px Microsoft YaHei, sans-serif';
        const rows = phase === 'action'
          ? [['动作', step.action], ['预期', step.expected]]
          : [['状态', step.execution_status === 'PASSED' ? '已执行，通过' : step.execution_status === 'FAILED' ? '执行失败' : '未执行'],
            ['实际', step.actual], ...(step.execution_status === 'FAILED' ? [['原断言预期', step.assertion_expected || step.expected]] : [])];
        let y = 83;
        for (const [label, value] of rows) {
          ctx.fillStyle = '#9dd4e5'; ctx.fillText(`${label}：`, 30, y); ctx.fillStyle = '#fff';
          for (const line of wrap(value, 1100, phase === 'action' ? 2 : 1)) { ctx.fillText(line, 118, y); y += 29; }
          y += 5;
        }
        if (image) {
          const scale = Math.min(1210 / image.width, 635 / image.height);
          const width = image.width * scale, height = image.height * scale;
          ctx.drawImage(image, (1280 - width) / 2, 237 + (635 - height) / 2, width, height);
        } else { ctx.fillStyle = '#f8c6ad'; ctx.fillText(step.screenshot_error || '本步骤没有采集到截图', 30, 500); }
        ctx.fillStyle = '#cbd7de'; ctx.font = '18px Microsoft YaHei, sans-serif';
        ctx.fillText('中文步骤证据回放 · 非原始连续录像 · 当前画面为步骤' +
          (phase === 'action' ? '开始前' : step.screenshot_phase === 'failure-after' ? '失败后' : step.screenshot_phase === 'after' ? '结束后' : '未采集') +
          '截图，未录得连续动作片段', 30, 891);
      }
      const timer = setInterval(draw, 25);
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const chapters = [];
      recorder.start(250); const zero = performance.now();
      try {
        for (let index = 0; index < steps.length; index++) {
          const step = steps[index];
          if (step.execution_status === 'NOT_EXECUTED') continue;
          const start = (performance.now() - zero) / 1000;
          current = { step, image: actionImages[index], phase: 'action' }; draw(); await wait(1200);
          const resultStart = (performance.now() - zero) / 1000;
          current = { step, image: resultImages[index], phase: 'result' }; draw(); await wait(1800);
          chapters.push({ step_id: step.step_id, start_seconds: start, result_start_seconds: resultStart,
            end_seconds: (performance.now() - zero) / 1000, screenshot_phase: step.screenshot_phase });
        }
      } finally { recorder.stop(); clearInterval(timer); }
      await new Promise((resolve, reject) => { recorder.addEventListener('stop', resolve, { once: true }); recorder.addEventListener('error', reject, { once: true }); });
      const blob = new Blob(chunks, { type: 'video/webm' }); if (blob.size < 1000) throw new Error('STEP_REPLAY_EMPTY');
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
      return { base64, chapters };
    }, { steps, externalId: executedExternalId });
    const expectedDuration = rendered.chapters.at(-1).end_seconds + 0.12;
    const video = addWebmDuration(Buffer.from(rendered.base64, 'base64'), expectedDuration);
    await fs.writeFile(outputPath, video);
    const duration = await page.evaluate(async (base64) => {
      const element = document.createElement('video'); element.muted = true; element.src = `data:video/webm;base64,${base64}`;
      await new Promise((resolve, reject) => { element.onloadedmetadata = resolve; element.onerror = reject; });
      return element.duration;
    }, video.toString('base64'));
    if (!Number.isFinite(duration) || Math.abs(duration - expectedDuration) > 0.5) throw new Error('STEP_REPLAY_DURATION_MISMATCH');
    const missingCaptures = steps.filter((step) => step.execution_status !== 'NOT_EXECUTED' &&
      (!step.action_image_base64 || !step.result_image_base64)).map((step) => step.step_id);
    return { replay: { ...base, status: 'READY', evidence_complete: missingCaptures.length === 0,
      missing_captures: missingCaptures,
      steps: steps.map(({ action_image_base64, result_image_base64, ...step }) => step),
      chapters: rendered.chapters, duration_seconds: duration, output_file_name: path.basename(outputPath),
      reading_holds: '1200ms action / 1800ms result', original_video_precise_seek: false }, videoPath: outputPath };
  } catch (error) { return { replay: { ...base, reason: String(error?.message || error) }, videoPath: null }; }
  finally { if (browser) await browser.close(); }
}

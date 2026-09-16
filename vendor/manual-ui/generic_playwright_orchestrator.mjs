import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { CAPTURE_HOLD_MS, MIN_MEDIA_VISIBLE_MS, VIEWPORT, cueColorForStep, evidenceStep, sha256, validateTimeline, writeJson } from "./step_evidence_contract.mjs";

const FRAME_SCAN_MS = 100;
const MIN_SIGNATURE_PIXELS = 500;
const QUANTIZATION_TOLERANCE_MS = FRAME_SCAN_MS;

function freezeCase(testCase, classification) {
  if (!classification || typeof classification.then === "function" || typeof classification.classification !== "string") throw new Error("CASE_CLASSIFICATION_INVALID");
  const allowed = new Set(["runnable", "BLOCKED_PERMISSION", "BLOCKED_LOCATOR", "BLOCKED_DATA", "BLOCKED_ORACLE", "MANUAL_REQUIRED", "EXTERNAL_BLOCKED", "NOT_EXECUTED"]);
  if (!allowed.has(classification.classification)) throw new Error("CASE_CLASSIFICATION_INVALID");
  // Keep the original human Case ID verbatim for traceability.  Windows-safe
  // artifact names are derived separately, never by normalising the ID.
  const artifactKey = `case-${crypto.createHash("sha256").update(String(testCase.case_id)).digest("hex").slice(0, 16)}`;
  const frozen = { ...structuredClone(classification), case_id: testCase.case_id, artifact_key: artifactKey, title: testCase.title };
  delete frozen.steps;
  if (frozen.classification !== "runnable") return deepFreeze(frozen);
  if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) throw new Error(`RUNNABLE_STEPS_MISSING:${testCase.case_id}`);
  frozen.steps = testCase.steps.map((step, index) => ({
    case_id: testCase.case_id, title: testCase.title, step_id: step.step_id ?? `${testCase.case_id}:S${index + 1}`, step_number: index + 1, total_steps: testCase.steps.length,
    action: step.action, observation: step.observation, expected: step.expected ?? null, original_step_number: step.original_step_number ?? null, source_row: step.source_row ?? null, requires_click: !!step.requires_click,
    ...Object.fromEntries(["source_step_id", "source_sheet", "source_cells", "vector_ref", "vector_source", "vector_input", "vector_expected_branch", "mapping_origin"].filter(key => Object.hasOwn(step, key)).map(key => [key, structuredClone(step[key])])),
    cue_signature: { visible_code: `S${String(index + 1).padStart(2, "0")}`, background_rgb: cueColorForStep(index + 1) },
  }));
  return deepFreeze(frozen);
}

function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const item of Object.values(value)) deepFreeze(item); Object.freeze(value); } return value; }

export function requireAllCasesPass(facts) {
  if (!Array.isArray(facts?.cases) || !facts.cases.length) throw new Error("FORWARD_CASES_MISSING");
  const incomplete = facts.cases.filter((entry) => entry.status !== "PASS").map((entry) => `${entry.case_id}:${entry.status}`);
  if (incomplete.length) throw new Error(`FORWARD_NOT_ALL_PASS:${incomplete.join(",")}`);
  return true;
}

function mediaResponse(bytes, request, response) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
  let start = 0; let end = bytes.length - 1;
  if (match) {
    start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
    end = match[2] ? Number(match[2]) : end;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= bytes.length) { response.writeHead(416, { "content-range": `bytes */${bytes.length}` }); response.end(); return; }
    end = Math.min(end, bytes.length - 1);
  }
  const headers = { "content-type": "video/webm", "accept-ranges": "bytes", "content-length": String(end - start + 1), "access-control-allow-origin": "*" };
  if (match) headers["content-range"] = `bytes ${start}-${end}/${bytes.length}`;
  response.writeHead(match ? 206 : 200, headers); response.end(bytes.subarray(start, end + 1));
}

async function createMediaDecoder({ browser, video }) {
  const bytes = await fs.readFile(video);
  const server = http.createServer((request, response) => {
    if (request.url === "/video.webm") { mediaResponse(bytes, request, response); return; }
    response.writeHead(200, { "content-type": "text/html" }); response.end('<video id="recording" crossorigin="anonymous" src="/video.webm"></video>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let page;
  try {
    page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const metadata = await page.locator("#recording").evaluate(async (element) => {
      await new Promise((resolve, reject) => { if (element.readyState >= 1) resolve(); else { element.addEventListener("loadedmetadata", resolve, { once: true }); element.addEventListener("error", () => reject(new Error("MEDIA_UNDECODABLE")), { once: true }); } });
      return { duration_ms: Math.round(element.duration * 1000), video_width: element.videoWidth, video_height: element.videoHeight };
    });
    if (!Number.isFinite(metadata.duration_ms) || metadata.duration_ms <= 0) throw new Error("MEDIA_UNDECODABLE");
    if (metadata.video_width !== VIEWPORT.width || metadata.video_height !== VIEWPORT.height) throw new Error("VIEWPORT_MEDIA_MISMATCH");
    const statistics = { decoder_calls: 0, png_frames_encoded: 0 };
    return {
      duration_ms: metadata.duration_ms, statistics,
      async decode({ atMs, output, click, cueSignature, targets }) {
        statistics.decoder_calls += 1;
        const decoded = await page.locator("#recording").evaluate(async (element, input) => {
          const nextTime = Math.min(Math.max(input.atMs / 1000, 0), Math.max(element.duration - 0.05, 0));
          // Install the listener before seeking; decoding errors must not hang the run.
          await new Promise((resolve, reject) => {
            let timer;
            const clear = () => { clearTimeout(timer); element.removeEventListener("seeked", done); element.removeEventListener("error", failed); };
            const done = () => { clear(); resolve(); };
            const failed = () => { clear(); reject(new Error("MEDIA_SEEK_FAILED")); };
            element.addEventListener("seeked", done, { once: true }); element.addEventListener("error", failed, { once: true });
            timer = setTimeout(failed, 10000); element.currentTime = nextTime;
          });
          await element.play().catch(() => {});
          await new Promise((resolve) => { const timer = setTimeout(resolve, 250); if (typeof element.requestVideoFrameCallback === "function") element.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); }); });
          element.pause();
          const canvas = document.createElement("canvas"); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(element, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const count = (predicate, left, top, width, height) => { let total = 0; for (let y = Math.max(0, Math.floor(top)); y < Math.min(canvas.height, Math.ceil(top + height)); y += 1) for (let x = Math.max(0, Math.floor(left)); x < Math.min(canvas.width, Math.ceil(left + width)); x += 1) { const i = (y * canvas.width + x) * 4; if (predicate(pixels[i], pixels[i + 1], pixels[i + 2])) total += 1; } return total; };
          // Decode all 32 bits once. Ambiguous cells are rejected, and the full
          // step identity selects its expected colour/region/click contract.
          let encodedStep = 0; let validSignature = true;
          for (let bit = 0; bit < 32; bit += 1) {
            const x = canvas.width - 20 - 256 + bit * 8 + 2;
            const white = count((r, g, b) => r > 180 && g > 180 && b > 180, x, 14, 4, 4);
            const black = count((r, g, b) => r < 70 && g < 70 && b < 70, x, 14, 4, 4);
            if (white >= 12) encodedStep += 2 ** bit;
            else if (black < 12) validSignature = false;
          }
          const target = input.targets ? input.targets[encodedStep] : { cueSignature: input.cueSignature, click: input.click };
          const expected = target?.cueSignature;
          const stepSignatureVerified = validSignature && encodedStep > 0 && !!expected && Number(expected.visible_code.slice(1)) === encodedStep;
          const color = expected?.background_rgb;
          const cueRegion = expected?.region ?? { x: canvas.width - 420, y: 0, width: 420, height: 180 };
          const matchedClick = target?.click;
          const decodedMediaTimeMs = Math.round(element.currentTime * 1000);
          return { requested_media_time_ms: input.atMs, decoded_media_time_ms: decodedMediaTimeMs, seek_delta_ms: Math.abs(decodedMediaTimeMs - input.atMs),
            decoded_step_number: stepSignatureVerified ? encodedStep : null,
            cue_signature_pixels: color ? count((r, g, b) => Math.abs(r - color.r) <= 30 && Math.abs(g - color.g) <= 30 && Math.abs(b - color.b) <= 30, cueRegion.x, cueRegion.y, cueRegion.width, cueRegion.height) : 0,
            step_signature_verified: stepSignatureVerified,
            red_pixels_at_click: matchedClick ? count((r, g, b) => r > 180 && g < 100 && b < 100, matchedClick.x - 12, matchedClick.y - 12, 24, 24) : 0,
            ...(input.encodePng ? { png_base64: canvas.toDataURL("image/png").split(",")[1] } : {}) };
        }, { atMs, click, cueSignature, targets, encodePng: !!output });
        if (decoded.seek_delta_ms > 350) throw new Error("MEDIA_SEEK_MISMATCH");
        if (output) { statistics.png_frames_encoded += 1; await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, Buffer.from(decoded.png_base64, "base64")); }
        delete decoded.png_base64;
        return decoded;
      },
      async close() { await page.close(); await new Promise((resolve) => server.close(resolve)); },
    };
  } catch (error) { await page?.close().catch(() => {}); await new Promise((resolve) => server.close(resolve)); throw error; }
}

// One video pass regardless of step count. The returned groups still undergo
// the same continuity, duration, trusted-click and selected-frame validation.
export async function scanMediaTimeline(decoder, timeline) {
  const targets = {}; const samplesByStep = new Map();
  for (const observed of timeline) {
    const step = observed.step_number;
    if (!Number.isInteger(step) || step < 1 || step > 0xffffffff || samplesByStep.has(step) || Number(observed.cue_signature?.visible_code?.slice(1)) !== step) throw new Error("MEDIA_SCAN_STEP_INVALID");
    targets[step] = { click: observed.click, cueSignature: { ...observed.cue_signature, region: observed.cue_region } };
    samplesByStep.set(step, []);
  }
  let scanFrames = 0;
  for (let requested = 0; requested <= decoder.duration_ms - 100; requested += FRAME_SCAN_MS) {
    const decoded = await decoder.decode({ atMs: requested, targets }); scanFrames += 1;
    if (decoded.cue_signature_pixels >= MIN_SIGNATURE_PIXELS && decoded.step_signature_verified && samplesByStep.has(decoded.decoded_step_number)) samplesByStep.get(decoded.decoded_step_number).push(decoded);
  }
  return { samplesByStep, scanFrames };
}

// `decoded_media_time_ms` is the browser's actual decoded timestamp, rather
// than the requested seek timestamp.  We accept only the longest contiguous
// series of matching samples.  Its visible duration is deliberately the
// conservative first/last decoded difference: tolerance describes sampling
// uncertainty but is never added to make a short interval pass.
export function continuousMatchWindow(samples, { samplingIntervalMs = FRAME_SCAN_MS, quantizationToleranceMs = QUANTIZATION_TOLERANCE_MS } = {}) {
  if (!Array.isArray(samples) || samples.length === 0) throw new Error("STEP_SIGNATURE_NOT_FOUND_IN_MEDIA");
  const ordered = [...samples].sort((a, b) => a.decoded_media_time_ms - b.decoded_media_time_ms);
  let best = []; let current = [];
  for (const sample of ordered) {
    if (current.length === 0 || sample.decoded_media_time_ms - current.at(-1).decoded_media_time_ms <= samplingIntervalMs + quantizationToleranceMs) current.push(sample);
    else { if (current.length > best.length) best = current; current = [sample]; }
  }
  if (current.length > best.length) best = current;
  if (best.length < 2) throw new Error("MEDIA_CONTINUOUS_WINDOW_TOO_SHORT");
  const first = best[0]; const last = best.at(-1);
  return {
    samples: best,
    sampling_interval_ms: samplingIntervalMs,
    quantization_tolerance_ms: quantizationToleranceMs,
    first_matching_decoded_media_time_ms: first.decoded_media_time_ms,
    last_matching_decoded_media_time_ms: last.decoded_media_time_ms,
    visible_duration_ms: last.decoded_media_time_ms - first.decoded_media_time_ms,
  };
}

// Video frames are quantized independently from runner wall-clock timing.
// Keep the trusted event time distinct from the first frame where its marker
// is visible, then construct an ordered action interval from both facts.
export function bindTrustedClickToMedia({ rawAction, rawCue, cue, offset, click, markerSamples }) {
  if (!click?.trusted_event || !Number.isFinite(click.at_ms)) throw new Error("TRUSTED_CLICK_EVENT_MISSING");
  if (!Array.isArray(markerSamples) || markerSamples.length === 0) throw new Error("CLICK_MARKER_NOT_FOUND_IN_MEDIA");
  const mappedAction = { from_ms: rawAction.from_ms + offset, to_ms: rawAction.to_ms + offset };
  const trustedClickMediaTimeMs = click.at_ms + offset;
  const markerFirstMediaTimeMs = markerSamples[0].decoded_media_time_ms;
  const markerLastMediaTimeMs = markerSamples.at(-1).decoded_media_time_ms;
  if (![mappedAction.from_ms, mappedAction.to_ms, trustedClickMediaTimeMs].every(Number.isFinite) || mappedAction.to_ms < mappedAction.from_ms) throw new Error("ACTION_INTERVAL_MISSING");
  if (trustedClickMediaTimeMs < cue.from_ms || trustedClickMediaTimeMs > cue.to_ms) throw new Error("TRUSTED_CLICK_MEDIA_OUTSIDE_CUE");
  if (markerFirstMediaTimeMs < cue.from_ms || markerLastMediaTimeMs > cue.to_ms) throw new Error("CLICK_MARKER_OUTSIDE_CUE");
  const action = {
    from_ms: Math.min(mappedAction.from_ms, trustedClickMediaTimeMs),
    to_ms: Math.max(mappedAction.to_ms, trustedClickMediaTimeMs),
  };
  if (action.from_ms < cue.from_ms || action.to_ms > cue.to_ms || action.to_ms < action.from_ms) throw new Error("ACTION_INTERVAL_OUTSIDE_CUE");
  return { action, mappedAction, trustedClickMediaTimeMs, markerFirstMediaTimeMs, markerLastMediaTimeMs };
}

export async function auditCaseMedia({ browser, item, video, timeline, runDir }) {
  const decoder = await createMediaDecoder({ browser, video });
  try {
    const frameEvidence = []; const auditedTimeline = [];
    const { samplesByStep, scanFrames } = await scanMediaTimeline(decoder, timeline);
    for (const raw of timeline) {
      const matches = samplesByStep.get(raw.step_number);
      const window = continuousMatchWindow(matches);
      const { samples: contiguousMatches, first_matching_decoded_media_time_ms: firstMatch, last_matching_decoded_media_time_ms: lastMatch, visible_duration_ms: visibleDurationMs } = window;
      const first = contiguousMatches[0]; const last = contiguousMatches.at(-1);
      const clickMatches = raw.click ? contiguousMatches.filter((sample) => sample.red_pixels_at_click >= 8) : [];
      if (raw.click && clickMatches.length === 0) throw new Error("CLICK_MARKER_NOT_FOUND_IN_MEDIA");
      const rawCue = raw.runner_relative?.cue ?? raw.cue; const rawAction = raw.runner_relative?.action ?? raw.action;
      const offset = first.decoded_media_time_ms - rawCue.from_ms;
      const cue = { from_ms: first.decoded_media_time_ms, to_ms: last.decoded_media_time_ms };
      const clickBinding = raw.click ? bindTrustedClickToMedia({ rawAction, rawCue, cue, offset, click: raw.click, markerSamples: clickMatches }) : null;
      const selected = raw.click ? clickMatches.reduce((nearest, sample) => Math.abs(sample.decoded_media_time_ms - clickBinding.trustedClickMediaTimeMs) < Math.abs(nearest.decoded_media_time_ms - clickBinding.trustedClickMediaTimeMs) ? sample : nearest) : matches[Math.floor(matches.length / 2)];
      const artifactKey = `case-${crypto.createHash("sha256").update(String(item.case_id)).digest("hex").slice(0, 16)}`;
      const framePath = path.join(runDir, "media-audit", artifactKey, `step-${raw.step_number}.png`);
      const frame = await decoder.decode({ atMs: selected.decoded_media_time_ms, output: framePath, click: raw.click, cueSignature: { ...raw.cue_signature, region: raw.cue_region } });
      const clickLandingVerified = raw.click ? frame.red_pixels_at_click >= 8 && raw.click.inside_target : "NOT_APPLICABLE";
      if (frame.cue_signature_pixels < MIN_SIGNATURE_PIXELS || !frame.step_signature_verified || (raw.click && clickLandingVerified !== true)) throw new Error("MEDIA_FRAME_VERIFICATION_FAILED");
      const action = raw.click ? clickBinding.action : { from_ms: Math.max(cue.from_ms, rawAction.from_ms + offset), to_ms: Math.max(cue.from_ms, rawAction.to_ms + offset) };
      const observation = { from_ms: action.to_ms, to_ms: cue.to_ms };
      const captureHoldMs = raw.runner_relative.observation.to_ms - raw.runner_relative.observation.from_ms;
      if (captureHoldMs < CAPTURE_HOLD_MS) throw new Error("CAPTURE_HOLD_TOO_SHORT");
      if (visibleDurationMs < MIN_MEDIA_VISIBLE_MS || cue.to_ms > decoder.duration_ms || frame.decoded_media_time_ms < cue.from_ms || frame.decoded_media_time_ms > cue.to_ms) throw new Error("MEDIA_DWELL_OR_WINDOW_INVALID");
      const actualClick = raw.click ? { ...raw.click, media_time_ms: clickBinding.trustedClickMediaTimeMs, click_marker_first_media_time_ms: clickBinding.markerFirstMediaTimeMs, click_marker_last_media_time_ms: clickBinding.markerLastMediaTimeMs, mapped_runner_action: clickBinding.mappedAction } : null;
      const calibration = { sampling_interval_ms: window.sampling_interval_ms, quantization_tolerance_ms: window.quantization_tolerance_ms, first_matching_decoded_media_time_ms: firstMatch, last_matching_decoded_media_time_ms: lastMatch, visible_duration_ms: visibleDurationMs, minimum_media_visible_ms: MIN_MEDIA_VISIBLE_MS, capture_hold_ms: captureHoldMs, required_capture_hold_ms: CAPTURE_HOLD_MS };
      auditedTimeline.push({ ...raw, cue, action, observation, dwell_ms: visibleDurationMs, capture_hold_ms: captureHoldMs, media_calibration: calibration, click: actualClick });
      frameEvidence.push({ step_number: raw.step_number, requires_click: !!raw.click, source: "webm_canvas_decode", requested_media_time_ms: frame.requested_media_time_ms, decoded_media_time_ms: frame.decoded_media_time_ms, seek_delta_ms: frame.seek_delta_ms, path: framePath, sha256: await sha256(framePath), cue_signature: raw.cue_signature, cue_signature_verified: true, step_signature_verified: true, click_landing_verified: clickLandingVerified, red_pixels_at_click: frame.red_pixels_at_click, ...(raw.click ? { trusted_click_event_verified: true, trusted_click_media_time_ms: clickBinding.trustedClickMediaTimeMs, click_marker_first_media_time_ms: clickBinding.markerFirstMediaTimeMs, click_marker_last_media_time_ms: clickBinding.markerLastMediaTimeMs } : {}), media_calibration: calibration });
    }
    if (new Set(frameEvidence.map((frame) => frame.sha256)).size !== frameEvidence.length) throw new Error("STEP_FRAME_HASH_DUPLICATE");
    return { actualDurationMs: decoder.duration_ms, frameEvidence, timeline: auditedTimeline, scan_statistics: { ...decoder.statistics, scan_frames: scanFrames, steps: timeline.length, strategy: "single_pass_step_signature" } };
  } finally { await decoder.close(); }
}

export function validateMediaEvidence(item, timeline, media) {
  validateTimeline(item.steps, timeline);
  if (!Number.isFinite(media.actualDurationMs) || media.actualDurationMs <= 0 || media.frameEvidence.length !== item.steps.length) throw new Error("MEDIA_OR_FRAME_MISSING");
  if (new Set(media.frameEvidence.map((frame) => frame.sha256)).size !== media.frameEvidence.length) throw new Error("STEP_FRAME_HASH_DUPLICATE");
  for (let index = 0; index < item.steps.length; index += 1) {
    const expected = item.steps[index]; const frame = media.frameEvidence[index]; const observed = timeline[index];
    if (frame.step_number !== expected.step_number || frame.source !== "webm_canvas_decode" || !frame.sha256 || !frame.cue_signature_verified || frame.step_signature_verified !== true || frame.cue_signature.visible_code !== expected.cue_signature.visible_code) throw new Error("FRAME_EVIDENCE_MISMATCH");
    const calibration = frame.media_calibration;
    if (!calibration || calibration.minimum_media_visible_ms !== MIN_MEDIA_VISIBLE_MS || calibration.required_capture_hold_ms !== CAPTURE_HOLD_MS || calibration.visible_duration_ms < MIN_MEDIA_VISIBLE_MS || calibration.capture_hold_ms < CAPTURE_HOLD_MS || calibration.last_matching_decoded_media_time_ms < calibration.first_matching_decoded_media_time_ms) throw new Error("MEDIA_CALIBRATION_MISMATCH");
    if (frame.decoded_media_time_ms < observed.cue.from_ms || frame.decoded_media_time_ms > observed.cue.to_ms || frame.seek_delta_ms > 350) throw new Error("FRAME_TIME_OUTSIDE_CUE");
    if (expected.requires_click) {
      if (frame.click_landing_verified !== true || frame.trusted_click_event_verified !== true || !Number.isFinite(frame.trusted_click_media_time_ms) || !Number.isFinite(frame.click_marker_first_media_time_ms) || !observed.click?.trusted_event || !Number.isFinite(observed.click.media_time_ms) || observed.click.media_time_ms !== frame.trusted_click_media_time_ms || observed.action.from_ms > observed.click.media_time_ms || observed.action.to_ms < observed.click.media_time_ms) throw new Error("CLICK_EVIDENCE_MISMATCH");
    } else if (frame.click_landing_verified !== "NOT_APPLICABLE") throw new Error("CLICK_EVIDENCE_MISMATCH");
  }
}

// `createCaseContext` lets an in-memory authentication session supply isolated
// recording contexts without exporting a storage state.  The browser remains
// the real Playwright Browser because the media auditor needs it to decode the
// completed WebM files.
function classifyExecutionError(error) {
  const explicit = new Set(["EXTERNAL_BLOCKED", "BLOCKED_PERMISSION", "BLOCKED_LOCATOR", "BLOCKED_DATA", "BLOCKED_ORACLE", "MANUAL_REQUIRED", "NOT_EXECUTED"]);
  if (error?.error_scope === "AUTOMATION" && error?.case_status !== "FAIL_PRODUCT" && error?.name !== "ProductAssertionError") return "AUTOMATION_ERROR";
  const matcher = error?.matcherResult;
  const playwrightAssertion = matcher && typeof matcher === "object" && typeof matcher.name === "string" && /^to[A-Z]/.test(matcher.name) && typeof matcher.pass === "boolean" && typeof matcher.message === "string";
  return explicit.has(error?.case_status) ? error.case_status : error?.case_status === "FAIL_PRODUCT" || error?.name === "AssertionError" || error?.name === "ProductAssertionError" || playwrightAssertion ? "FAIL_PRODUCT" : "AUTOMATION_ERROR";
}

// Explicit technical preparation avoids classifying locator or fixture asserts
// as a product oracle. Existing unscoped adapter assertions remain compatible.
export async function runPreparation(action) {
  if (typeof action !== "function") throw new Error("AUTOMATION_PREPARATION_CALLBACK_REQUIRED");
  try { return await action(); }
  catch (cause) {
    // A declared business difference or external prerequisite keeps its status.
    if (cause?.case_status || cause?.name === "ProductAssertionError") throw cause;
    const code = /^[A-Z][A-Z0-9_]*$/.test(cause?.message ?? "") ? cause.message : "AUTOMATION_PREPARATION_FAILED";
    const error = new Error(code); error.error_scope = "AUTOMATION"; throw error;
  }
}

// Display-only telemetry: never changes a case verdict or cleanup behavior.
export function createProgressReporter({ runDir, runId, originalTotal }) {
  let sequence = 0;
  return async function publish(phase, current = {}, plan = [], completed = []) {
    const selected = plan.filter(item => item.selection_status !== "NOT_SELECTED");
    const ids = new Set(selected.map(item => item.case_id));
    const disposed = completed.filter(item => ids.has(item.case_id));
    const snapshot = {
      schema_version: "manual-case-ui-automation/progress-v1", source: "runner",
      run_id: runId, sequence: ++sequence, updated_at: new Date().toISOString(), phase,
      original_total: originalTotal, selected_total: plan.length ? selected.length : null,
      disposed_in_batch: disposed.length, results_pending_review: true,
      status_counts_in_batch: Object.fromEntries([...new Set(disposed.map(x => x.status))].map(status => [status, disposed.filter(x => x.status === status).length])),
      current: { case_id: current.case_id ?? null, step: current.step ?? null, total_steps: current.total_steps ?? null },
    };
    const temporary = path.join(runDir, "progress.json.tmp");
    try {
      await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
      await fs.rename(temporary, path.join(runDir, "progress.json"));
      await fs.appendFile(path.join(runDir, "progress-events.jsonl"), JSON.stringify(snapshot) + "\n", "utf8");
      return true;
    } catch { return false; } // A missing/stale display is not a business failure.
  };
}

export async function runGenericCases({ browser, baseUrl, runId, runDir, cases, discover, classify, execute, contextOptions = {}, createCaseContext, beforeCase, cleanupCase, productEnvironmentAccess = false }) {
  if (!Array.isArray(cases) || !cases.length || cases.some((item) => typeof item?.case_id !== "string" || !item.case_id.trim()) || new Set(cases.map((item) => item.case_id)).size !== cases.length) throw new Error("CASE_IDS_INVALID");
  await fs.mkdir(runDir, { recursive: true });
  const progress = createProgressReporter({ runDir, runId, originalTotal: cases.length });
  await progress("DISCOVERY");
  const pageMap = await discover(); await writeJson(path.join(runDir, "runtime-page-map.json"), { run_id: runId, ...pageMap });
  const plan = cases.map((testCase) => freezeCase(testCase, classify(testCase, pageMap))); await writeJson(path.join(runDir, "frozen-case-plan.json"), { run_id: runId, cases: plan });
  const facts = { run_id: runId, frozen_plan_sha256: await sha256(path.join(runDir, "frozen-case-plan.json")), product_environment_access: productEnvironmentAccess === true, stages: ["RUNTIME_DISCOVERY", "CASE_CLASSIFICATION", "EXECUTION", "REPORT"], page_map: "runtime-page-map.json", plan: "frozen-case-plan.json", cases: [], cleanup_ledger: [], limitations: [] };
  await progress("CLASSIFIED", {}, plan);
  for (const item of plan) {
    if (item.classification !== "runnable") { facts.cases.push({ case_id: item.case_id, status: item.classification, business_status: "NOT_EXECUTED", media_status: "NOT_APPLICABLE", cleanup_status: "NOT_APPLICABLE" }); if (item.selection_status !== "NOT_SELECTED") await progress("CASE_DISPOSED", { case_id: item.case_id }, plan, facts.cases); continue; }
    await progress("CASE_START", { case_id: item.case_id, total_steps: item.steps.length }, plan, facts.cases);
    let context; let page; let video; let result; let cleanup; let businessScreenshot; let failureScreenshot; let failedStep; let failurePath; let businessStatus = "NOT_EXECUTED"; let phase = "RUNTIME_PRECONDITION"; const timeline = [];
    try {
      await beforeCase?.(item);
      if (item.cleanup_required === true && typeof cleanupCase !== "function") { const error = new Error("CASE_CLEANUP_REQUIRED"); error.case_status = "BLOCKED_DATA"; throw error; }
      const videoDir = path.join(runDir, "videos", item.artifact_key); await fs.mkdir(videoDir, { recursive: true }); context = await (createCaseContext ?? browser.newContext.bind(browser))({ ...contextOptions, viewport: VIEWPORT, recordVideo: { dir: videoDir, size: VIEWPORT } }); page = await context.newPage(); const recordingStartedAt = Date.now();
      const runStep = async (stepRef, options = {}) => { if (["page", "step", "recordingStartedAt"].some((key) => Object.hasOwn(options, key))) throw new Error("RUN_STEP_CONTRACT_OVERRIDE"); const expected = item.steps[timeline.length]; const matched = typeof stepRef === "string" ? expected?.step_id === stepRef : expected?.step_number === stepRef; if (!expected || !matched) throw new Error("RUN_STEP_ORDER_VIOLATION"); await progress("STEP_START", { case_id: item.case_id, step: expected.step_number, total_steps: item.steps.length }, plan, facts.cases); if (options.error_scope !== undefined && options.error_scope !== "AUTOMATION") throw new Error("RUN_STEP_ERROR_SCOPE_INVALID"); const perform = () => evidenceStep({ page, recordingStartedAt, step: expected, target: options.target, action: options.action }); const observed = await (options.error_scope === "AUTOMATION" ? runPreparation(perform) : perform()); const stepScreenshot = path.join(runDir, "screenshots", item.artifact_key, `step-${expected.step_number}.png`); await fs.mkdir(path.dirname(stepScreenshot), { recursive: true }); await page.screenshot({ path: stepScreenshot }); timeline.push({ ...observed, step_id: expected.step_id, screenshot: stepScreenshot, screenshot_sha256: await sha256(stepScreenshot) }); await progress("STEP_RECORDED", { case_id: item.case_id, step: expected.step_number, total_steps: item.steps.length }, plan, facts.cases); return observed; };
      let executionError;
      try {
        phase = "BUSINESS_EXECUTION";
        result = await execute({ page, item, baseUrl, runDir, runStep, runPreparation }); cleanup = result?.cleanup;
        if (!result || typeof result.status !== "string") throw new Error("CASE_RESULT_INVALID");
        if (result.status !== "PASS") { const error = new Error(`CASE_NOT_PASS:${result.status}`); error.case_status = result.status; throw error; }
        validateTimeline(item.steps, timeline);
        businessStatus = "PASS";
        businessScreenshot = path.join(runDir, "screenshots", `${item.artifact_key}-success.png`);
        await fs.mkdir(path.dirname(businessScreenshot), { recursive: true }); await page.screenshot({ path: businessScreenshot });
      }
      catch (error) {
        executionError = error;
        if (businessStatus !== "PASS") businessStatus = classifyExecutionError(error);
        failedStep = item.steps[timeline.length]?.step_number ?? null;
        try { failurePath = new URL(page.url()).pathname; } catch {}
        const capture = path.join(runDir, "screenshots", `${item.artifact_key}-failure.png`);
        await fs.mkdir(path.dirname(capture), { recursive: true }); await page.screenshot({ path: capture }).catch(() => {});
        failureScreenshot = await fs.access(capture).then(() => capture).catch(() => null);
        throw error;
      }
      finally {
        if (typeof cleanupCase === "function") {
          await progress("CLEANUP", { case_id: item.case_id }, plan, facts.cases);
          try { cleanup = await cleanupCase({ page, item, baseUrl, runDir, result, error: executionError }); if (!cleanup || !["CLEAN", "NOT_APPLICABLE"].includes(cleanup.status) || (item.cleanup_required === true && cleanup.status !== "CLEAN")) throw new Error("CLEANUP_RESULT_INVALID"); }
          catch { cleanup = { status: "CLEANUP_FAILED", error_code: "CASE_CLEANUP_FAILED" }; const error = new Error("CASE_CLEANUP_FAILED"); error.original_status = executionError?.case_status ?? result?.status; throw error; }
        }
      }
      if (!result || typeof result.status !== "string") throw new Error("CASE_RESULT_INVALID");
      if (result.status !== "PASS") { const error = new Error(`CASE_NOT_PASS:${result.status}`); error.case_status = result.status; error.reason = result.reason; throw error; }
      validateTimeline(item.steps, timeline);
      const screenshot = businessScreenshot; video = await page.video().path(); await context.close(); context = null;
      phase = "MEDIA_EVIDENCE";
      await progress("MEDIA_CHECK", { case_id: item.case_id }, plan, facts.cases);
      const media = await auditCaseMedia({ browser, item, video, timeline, runDir }); timeline.splice(0, timeline.length, ...media.timeline); validateMediaEvidence(item, timeline, media);
      const timelinePath = path.join(runDir, "timelines", `${item.artifact_key}.json`); await writeJson(timelinePath, timeline);
      result = { ...result, status: "PASS", business_status: businessStatus, media_status: "VERIFIED", media_scan_statistics: media.scan_statistics, screenshot, timeline_path: timelinePath, expected_step_ids: item.steps.map((step) => step.step_number), observed_step_ids: timeline.map((step) => step.step_number), actual_duration_ms: media.actualDurationMs, media_evidence_contract: { capture_hold_ms: CAPTURE_HOLD_MS, minimum_media_visible_ms: MIN_MEDIA_VISIBLE_MS, sampling_interval_ms: FRAME_SCAN_MS, quantization_tolerance_ms: QUANTIZATION_TOLERANCE_MS }, media_verification_status: "VERIFIED", all_step_cues_verified: true, all_required_click_landings_verified: true, all_dwell_verified: true, frame_evidence: media.frameEvidence };
    } catch (error) {
      const candidateScreenshot = path.join(runDir, "screenshots", `${item.artifact_key}-failure.png`);
      if (!failureScreenshot && !businessScreenshot) { await fs.mkdir(path.dirname(candidateScreenshot), { recursive: true }); await page?.screenshot({ path: candidateScreenshot }).catch(() => {}); }
      const screenshot = failureScreenshot ?? businessScreenshot ?? await fs.access(candidateScreenshot).then(() => candidateScreenshot).catch(() => null);
      const timelinePath = path.join(runDir, "timelines", `${item.artifact_key}.json`); await writeJson(timelinePath, timeline);
      // A missing/incorrect product control is a product observation, not an
      // automation timeout.  Handlers use ProductAssertionError when the
      // confirmed manual oracle is contradicted by the rendered UI.
      const explicitlyClassified = new Set(["EXTERNAL_BLOCKED", "BLOCKED_PERMISSION", "BLOCKED_LOCATOR", "BLOCKED_DATA", "BLOCKED_ORACLE", "MANUAL_REQUIRED", "NOT_EXECUTED"]);
      const status = classifyExecutionError(error);
      if (businessStatus === "NOT_EXECUTED" && phase === "BUSINESS_EXECUTION") businessStatus = status;
      let currentPath = failurePath ?? null; try { currentPath ??= new URL(page?.url()).pathname; } catch {}
      const failureStage = phase === "MEDIA_EVIDENCE" ? "MEDIA_EVIDENCE" : error?.error_scope === "AUTOMATION" ? "AUTOMATION_PREPARATION" : status === "FAIL_PRODUCT" ? "PRODUCT_ORACLE" : status === "EXTERNAL_BLOCKED" ? "RUNTIME_PRECONDITION" : "MEDIA_EVIDENCE_OR_AUTOMATION";
      result = { status, business_status: businessStatus, media_status: phase === "MEDIA_EVIDENCE" ? "INCOMPLETE" : video ? "NOT_AUDITED" : "NOT_APPLICABLE", failed_step: failedStep ?? item.steps[timeline.length]?.step_number ?? null, current_path: currentPath, failure_stage: failureStage, error_code: /^[A-Z][A-Z0-9_]*$/.test(String(error.message).split(":")[0]) ? String(error.message).split(":")[0] : status === "FAIL_PRODUCT" ? "PRODUCT_ASSERTION_FAILED" : "AUTOMATION_EXECUTION_FAILED", ...(error.original_status ? { original_status: error.original_status } : {}), reason: (status === "FAIL_PRODUCT" ? "页面可见结果不符合已确认人工用例" : explicitlyClassified.has(status) ? "该原 Case 的执行前置条件未满足" : "步骤媒体证据或自动化执行不完整"), ...(screenshot ? { screenshot } : {}), timeline_path: timelinePath, expected_step_ids: item.steps.map((step) => step.step_number), observed_step_ids: timeline.map((step) => step.step_number), media_verification_status: video ? "NOT_AUDITED" : "NOT_APPLICABLE", all_step_cues_verified: false, all_required_click_landings_verified: false, all_dwell_verified: false, frame_evidence: [] };
    } finally { if (context) { video = video ?? await page?.video()?.path().catch(() => null); await context.close().catch(() => {}); } }
    const entry = { ...result, media_verification_status: result.media_verification_status === "NOT_APPLICABLE" && video ? "NOT_AUDITED" : result.media_verification_status, media_status: result.media_status === "NOT_APPLICABLE" && video ? "NOT_AUDITED" : result.media_status, business_status: businessStatus, cleanup_status: cleanup?.status ?? (item.cleanup_required === true ? "NOT_RUN" : "NOT_APPLICABLE"), case_id: item.case_id, artifact_key: item.artifact_key, video, video_verified_nonempty: !!video && await fs.stat(video).then((stat) => stat.size > 0).catch(() => false) };
    for (const [field, hashField] of [["video", "video_sha256"], ["screenshot", "screenshot_sha256"], ["timeline_path", "timeline_sha256"]]) if (entry[field] && await fs.access(entry[field]).then(() => true).catch(() => false)) entry[hashField] = await sha256(entry[field]);
    facts.cases.push(entry); if (cleanup) facts.cleanup_ledger.push({ ...cleanup, case_id: item.case_id });
    await progress("CASE_DISPOSED", { case_id: item.case_id }, plan, facts.cases);
  }
  await writeJson(path.join(runDir, "machine-facts.json"), facts); await fs.writeFile(path.join(runDir, "中文报告.md"), `# UI 自动化报告\n\n运行：${runId}\n\n${facts.cases.map((entry) => `- ${entry.case_id}：${entry.status}`).join("\n")}\n`); await progress("RUNNER_FINISHED_PENDING_REPORT", {}, plan, facts.cases); return facts;
}




// Re-audit existing media into a new evidence directory. No adapter, auth,
// target navigation, business action or original-result mutation occurs here.
export async function reauditRunMedia({ browser, runDir, outputDir, caseIds }) {
  const sourceDir = await fs.realpath(path.resolve(runDir));
  const factsPath = path.join(sourceDir, "machine-facts.json");
  const planPath = path.join(sourceDir, "frozen-case-plan.json");
  const sourceBytes = await fs.readFile(factsPath); const planBytes = await fs.readFile(planPath);
  const facts = JSON.parse(sourceBytes); const plan = JSON.parse(planBytes);
  const hashBytes = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  const inside = (parent, target) => { const relative = path.relative(parent, target); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); };
  const sourceHash = hashBytes(sourceBytes);
  if (!/^[a-f0-9]{64}$/.test(facts.frozen_plan_sha256 ?? "") || hashBytes(planBytes) !== facts.frozen_plan_sha256) throw new Error("MEDIA_REAUDIT_PLAN_CHANGED_OR_UNBOUND");
  const eligible = entry => entry.status === "AUTOMATION_ERROR" && entry.failure_stage === "MEDIA_EVIDENCE" && entry.business_status === "PASS" && entry.media_status === "INCOMPLETE" && ["CLEAN", "NOT_APPLICABLE"].includes(entry.cleanup_status);
  if (!Array.isArray(facts.cases) || !Array.isArray(plan.cases) || !facts.run_id) throw new Error("MEDIA_REAUDIT_SOURCE_INVALID");
  const selected = caseIds ?? facts.cases.filter(eligible).map(entry => entry.case_id);
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length || selected.some(id => typeof id !== "string" || !eligible(facts.cases.find(entry => entry.case_id === id) ?? {}))) throw new Error("MEDIA_REAUDIT_CASE_NOT_ELIGIBLE");
  // Canonicalise existing ancestors so a symlink cannot redirect the output
  // back into the source run. mkdir without recursive mode rejects reuse.
  let ancestor = path.resolve(outputDir); const missing = [];
  for (;;) {
    try { ancestor = await fs.realpath(ancestor); break; }
    catch (error) { if (error.code !== "ENOENT") throw error; const parent = path.dirname(ancestor); if (parent === ancestor) throw error; missing.unshift(path.basename(ancestor)); ancestor = parent; }
  }
  const destination = path.join(ancestor, ...missing);
  if (inside(sourceDir, destination)) throw new Error("MEDIA_REAUDIT_OUTPUT_INSIDE_SOURCE");
  const artifacts = [];
  for (const id of selected) {
    const entry = facts.cases.find(item => item.case_id === id); const item = plan.cases.find(item => item.case_id === id);
    if (!item || item.classification !== "runnable") throw new Error("MEDIA_REAUDIT_PLAN_INVALID");
    const verified = async (file, expectedHash) => {
      if (typeof file !== "string" || !/^[a-f0-9]{64}$/.test(expectedHash ?? "")) throw new Error("MEDIA_REAUDIT_ARTIFACT_HASH_REQUIRED");
      const actual = await fs.realpath(path.resolve(sourceDir, file));
      if (!inside(sourceDir, actual) || await sha256(actual) !== expectedHash) throw new Error("MEDIA_REAUDIT_ARTIFACT_CHANGED");
      return actual;
    };
    const video = await verified(entry.video, entry.video_sha256);
    const timelinePath = await verified(entry.timeline_path, entry.timeline_sha256);
    const timeline = JSON.parse(await fs.readFile(timelinePath, "utf8")); validateTimeline(item.steps, timeline);
    artifacts.push({ entry, item, video, timeline, timelinePath });
  }
  await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.mkdir(destination);
  const receipt = { schema_version: "manual-ui-media-reaudit/v1", source_run_id: facts.run_id,
    source_facts_sha256: sourceHash, source_plan_sha256: hashBytes(planBytes), source_run_dir: sourceDir,
    business_reexecuted: false, source_run_modified: false, reviewer_status: "PENDING", media_semantic_review_status: "PENDING", cases: [] };
  for (const { entry, item, video, timeline, timelinePath: originalTimelinePath } of artifacts) {
    let result;
    try {
      const media = await auditCaseMedia({ browser, item, video, timeline, runDir: destination });
      validateMediaEvidence(item, media.timeline, media);
      const timelinePath = path.join(destination, "timelines", `${crypto.createHash("sha256").update(item.case_id).digest("hex")}.json`);
      await writeJson(timelinePath, media.timeline);
      result = { status: "PASS", business_status: entry.business_status, cleanup_status: entry.cleanup_status,
        media_status: "VERIFIED", media_verification_status: "VERIFIED", video, video_sha256: entry.video_sha256,
        timeline_path: timelinePath, timeline_sha256: await sha256(timelinePath), actual_duration_ms: media.actualDurationMs,
        frame_evidence: media.frameEvidence, media_scan_statistics: media.scan_statistics,
        all_step_cues_verified: true, all_required_click_landings_verified: true, all_dwell_verified: true };
    } catch (error) {
      result = { status: "AUTOMATION_ERROR", business_status: entry.business_status, cleanup_status: entry.cleanup_status,
        media_status: "INCOMPLETE", media_verification_status: "NOT_AUDITED", failure_stage: "MEDIA_EVIDENCE",
        error_code: /^[A-Z][A-Z0-9_]*$/.test(error.message ?? "") ? error.message : "MEDIA_REAUDIT_FAILED",
        video, video_sha256: entry.video_sha256, frame_evidence: [] };
    }
    if (await sha256(video) !== entry.video_sha256 || await sha256(originalTimelinePath) !== entry.timeline_sha256) throw new Error("MEDIA_REAUDIT_ARTIFACT_CHANGED");
    receipt.cases.push({ case_id: item.case_id, business_status: entry.business_status, cleanup_status: entry.cleanup_status, media_status: result.media_status, result });
  }
  if (await sha256(factsPath) !== sourceHash || await sha256(planPath) !== receipt.source_plan_sha256) throw new Error("MEDIA_REAUDIT_SOURCE_CHANGED");
  receipt.receipt_path = path.join(destination, "media-review.json");
  await writeJson(receipt.receipt_path, receipt); return receipt;
}


import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// The capture hold protects the live recording.  Media is decoded later at
// frame boundaries, so its independent readability gate is intentionally
// lower and is enforced by the media auditor.
export const CAPTURE_HOLD_MS = 1800;
export const MIN_MEDIA_VISIBLE_MS = 1200;
// Kept as a compatibility name for existing callers that validate the live
// runner timeline rather than decoded media evidence.
export const MIN_DWELL_MS = CAPTURE_HOLD_MS;
export const VIEWPORT = { width: 1280, height: 720 };
const CUE_COLORS = [[13, 71, 161], [0, 105, 92], [173, 51, 0], [106, 27, 154], [46, 81, 64], [85, 55, 0]];

export function cueColorForStep(stepNumber) {
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 0xffffffff) throw new Error("STEP_NUMBER_INVALID");
  const rgb = CUE_COLORS[(stepNumber - 1) % CUE_COLORS.length];
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
}

export async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

export function validateTimeline(expectedSteps, observedSteps) {
  if (!Array.isArray(expectedSteps) || expectedSteps.length === 0) throw new Error("EXPECTED_STEPS_MISSING");
  if (!Array.isArray(observedSteps) || observedSteps.length !== expectedSteps.length) throw new Error("STEP_COUNT_MISMATCH");
  for (let index = 0; index < expectedSteps.length; index += 1) {
    const expected = expectedSteps[index];
    const observed = observedSteps[index];
    if (expected.step_number !== index + 1 || expected.total_steps !== expectedSteps.length) throw new Error("FROZEN_STEP_ORDER_INVALID");
    if (observed.step_number !== expected.step_number) throw new Error("STEP_ORDER_OR_DUPLICATE");
    const captureHoldMs = observed.capture_hold_ms ?? observed.dwell_ms;
    if (!Number.isFinite(captureHoldMs) || captureHoldMs < CAPTURE_HOLD_MS) throw new Error("CAPTURE_HOLD_TOO_SHORT");
    if (!expected.cue_signature || !observed.cue_signature || expected.cue_signature.visible_code !== observed.cue_signature.visible_code) throw new Error("CUE_SIGNATURE_MISMATCH");
    if (!observed.cue || !Number.isFinite(observed.cue.from_ms) || !Number.isFinite(observed.cue.to_ms) || observed.cue.to_ms <= observed.cue.from_ms) throw new Error("CUE_INTERVAL_MISSING");
    if (!observed.action || !Number.isFinite(observed.action.from_ms) || !Number.isFinite(observed.action.to_ms) || observed.action.to_ms < observed.action.from_ms) throw new Error("ACTION_INTERVAL_MISSING");
    if (!!expected.requires_click !== !!observed.click) throw new Error("CLICK_REQUIREMENT_MISMATCH");
    if (expected.requires_click) {
      const click = observed.click;
      const box = click?.target_bbox;
      if (!click?.inside_target || !box || !Number.isFinite(click.x) || !Number.isFinite(click.y)) throw new Error("CLICK_OUTSIDE_TARGET");
      if (click.x < box.x || click.x > box.x + box.width || click.y < box.y || click.y > box.y + box.height) throw new Error("CLICK_OUTSIDE_TARGET");
      if (click.trusted_event !== true || !Number.isFinite(click.at_ms) || !["pointerdown", "mousedown", "click"].includes(click.event_type)) throw new Error("TRUSTED_CLICK_EVENT_MISSING");
    }
  }
  return true;
}

const evidencePages = new WeakMap();

// This function runs inside each document. The binding carries only the cue
// and trusted pointer event, never page input values or authentication state.
async function installEvidenceDocument(bindingName) {
  const previous = window.__manualEvidenceDocument;
  if (previous?.handler) document.removeEventListener("pointerdown", previous.handler, true);
  const state = { handler: null }; window.__manualEvidenceDocument = state;
  const snapshot = await window[bindingName]({ kind: "snapshot" }).catch(() => null);
  if (!snapshot) return;
  const { step, cueSignature, delivered, targetBox } = snapshot;
  if (window === window.top) {
    let cue = document.querySelector("#manual-evidence-cue");
    if (!cue) { cue = document.createElement("div"); cue.id = "manual-evidence-cue"; document.documentElement.append(cue); }
    const color = cueSignature.background_rgb;
    cue.textContent = `${step.case_id}｜${step.title}｜步骤 ${step.step_number}/${step.total_steps}｜证据码 ${cueSignature.visible_code}\n动作：${step.action}\n观察：${step.observation}`;
    Object.assign(cue.style, { position: "fixed", top: "32px", right: "12px", zIndex: "2147483647", background: `rgb(${color.r}, ${color.g}, ${color.b})`, color: "white", padding: "12px", border: "2px solid rgb(255, 255, 0)", whiteSpace: "pre-line", font: "16px sans-serif", maxWidth: "390px", pointerEvents: "none" });
    cue.style.left = "auto";
    if (targetBox) {
      const rect = cue.getBoundingClientRect();
      const intersects = (x, y) => x < targetBox.x + targetBox.width && x + rect.width > targetBox.x && y < targetBox.y + targetBox.height && y + rect.height > targetBox.y;
      const positions = [{ x: innerWidth - rect.width - 12, y: 32 }, { x: innerWidth - rect.width - 12, y: innerHeight - rect.height - 12 }, { x: 12, y: 32 }, { x: 12, y: innerHeight - rect.height - 12 }];
      const placement = positions.find(({ x, y }) => !intersects(x, y));
      if (placement) { cue.style.right = "auto"; cue.style.left = `${Math.max(0, placement.x)}px`; cue.style.top = `${Math.max(32, placement.y)}px`; }
    }
    let signature = document.querySelector("#manual-evidence-signature");
    if (!signature) { signature = document.createElement("div"); signature.id = "manual-evidence-signature"; document.documentElement.append(signature); }
    signature.replaceChildren();
    Object.assign(signature.style, { position: "fixed", right: "20px", top: "12px", height: "8px", width: "256px", display: "flex", zIndex: "2147483647", pointerEvents: "none" });
    // All 32 bits participate in media matching, so repeated palette colors
    // cannot make step seven reuse step one's recording interval.
    for (let bit = 0; bit < 32; bit += 1) { const cell = document.createElement("span"); Object.assign(cell.style, { display: "block", flex: "0 0 8px", height: "8px", background: ((step.step_number >>> bit) & 1) ? "white" : "black" }); signature.append(cell); }
  }
  const drawMarker = (x, y) => {
    document.querySelector("#manual-evidence-click")?.remove();
    const marker = document.createElement("div"); marker.id = "manual-evidence-click";
    Object.assign(marker.style, { position: "fixed", left: `${x - 8}px`, top: `${y - 8}px`, width: "16px", height: "16px", borderRadius: "50%", background: "rgb(255, 0, 0)", border: "2px solid white", zIndex: "2147483647", pointerEvents: "none" });
    document.documentElement.append(marker);
  };
  document.querySelector("#manual-evidence-click")?.remove();
  if (delivered && window === window.top) drawMarker(delivered.x, delivered.y);
  state.handler = (event) => {
    if (!event.isTrusted) return;
    drawMarker(event.clientX, event.clientY);
    void window[bindingName]({ kind: "click", event_type: event.type, trusted_event: true, x: event.clientX, y: event.clientY, event_wall_clock_ms: Date.now() }).catch(() => {});
  };
  document.addEventListener("pointerdown", state.handler, true);
}

async function evidenceState(page) {
  if (evidencePages.has(page)) return evidencePages.get(page);
  const state = { active: null, bindingName: `__manualEvidence_${crypto.randomBytes(8).toString("hex")}` };
  await page.exposeBinding(state.bindingName, (source, message) => {
    const active = state.active;
    if (!active) return null;
    if (message.kind === "snapshot") return { step: active.step, cueSignature: active.cueSignature, delivered: active.delivered, targetBox: active.targetBox };
    if (message.kind === "click" && source.frame === active.targetFrame && !active.delivered && message.trusted_event === true) {
      active.delivered = { ...message, x: message.x + active.offset.x, y: message.y + active.offset.y };
    }
    return null;
  });
  // New documents restore the cue after ordinary navigation. The trusted
  // event itself lives in this Node process and therefore survives unload.
  await page.addInitScript({ content: `(() => { const install = () => { void (${installEvidenceDocument.toString()})(${JSON.stringify(state.bindingName)}); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install(); })();` });
  evidencePages.set(page, state);
  return state;
}

export async function evidenceStep({ page, recordingStartedAt, step, target, action }) {
  const rel = () => Date.now() - recordingStartedAt;
  const cueFrom = rel();
  const cueSignature = step.cue_signature ?? { visible_code: `S${String(step.step_number).padStart(2, "0")}`, background_rgb: cueColorForStep(step.step_number) };
  const state = await evidenceState(page);
  const active = { step, cueSignature, targetFrame: null, offset: { x: 0, y: 0 }, delivered: null };
  state.active = active;
  const installCurrent = () => Promise.all(page.frames().map((frame) => frame.evaluate(installEvidenceDocument, state.bindingName).catch((error) => { if (!frame.isDetached()) throw error; })));
  // Show the observation before querying the target, including locator errors.
  await installCurrent();
  await Promise.all(page.frames().map((frame) => frame.evaluate(() => {
    const prior = window.__manualEvidenceHighlight;
    if (prior?.element) { if (prior.outline) prior.element.style.setProperty("outline", prior.outline, prior.priority); else prior.element.style.removeProperty("outline"); }
    delete window.__manualEvidenceHighlight;
  }).catch(() => {})));
  if (!target) throw new Error("TARGET_MISSING");
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("TARGET_MISSING");
  const handle = await target.elementHandle();
  try { active.targetFrame = await handle.ownerFrame(); } finally { await handle.dispose(); }
  const localBox = await target.evaluate((element) => { const rect = element.getBoundingClientRect(); window.__manualEvidenceHighlight = { element, outline: element.style.getPropertyValue("outline"), priority: element.style.getPropertyPriority("outline") }; element.style.outline = "3px solid rgb(255, 255, 0)"; return { x: rect.x, y: rect.y }; });
  active.offset = { x: box.x - localBox.x, y: box.y - localBox.y };
  active.targetBox = box;
  await installCurrent();
  const actionFrom = rel();
  let click = null;
  if (step.requires_click) {
    const x = Math.round(box.x + box.width / 2); const y = Math.round(box.y + box.height / 2);
    // Register before the real business action. When the caller supplies an
    // action (locator.click, or click+fill), that action is the only UI click;
    // the center-point fallback exists solely for simple evidence fixtures.
    if (action) await action();
    else await page.mouse.click(x, y);
    // Flush the page-to-Node binding and restore markers/cues if the action
    // navigated. No second business click is performed.
    await installCurrent();
    const delivered = active.delivered;
    if (!delivered) throw new Error("TRUSTED_CLICK_EVENT_MISSING");
    const insideTarget = delivered.x >= box.x && delivered.x <= box.x + box.width && delivered.y >= box.y && delivered.y <= box.y + box.height;
    if (!delivered.trusted_event || !insideTarget) throw new Error("TRUSTED_CLICK_OUTSIDE_TARGET");
    click = { ...delivered, at_ms: delivered.event_wall_clock_ms - recordingStartedAt, target_bbox: { x: box.x, y: box.y, width: box.width, height: box.height }, inside_target: insideTarget };
  } else if (action) await action();
  const actionTo = rel();
  // Give the event loop a small scheduling margin so the recorded interval
  // cannot fall a few milliseconds short of the contractual 1800 ms hold.
  await page.waitForTimeout(CAPTURE_HOLD_MS + 75);
  const cueTo = rel();
  const cueRegion = await page.locator("#manual-evidence-cue").boundingBox();
  return { step_number: step.step_number, cue_signature: cueSignature, cue_region: cueRegion, runner_relative: { cue: { from_ms: cueFrom, to_ms: cueTo }, action: { from_ms: actionFrom, to_ms: actionTo }, observation: { from_ms: actionTo, to_ms: cueTo } }, cue: { from_ms: cueFrom, to_ms: cueTo }, action: { from_ms: actionFrom, to_ms: actionTo }, observation: { from_ms: actionTo, to_ms: cueTo }, dwell_ms: cueTo -actionTo, click };
}

export async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2)); }

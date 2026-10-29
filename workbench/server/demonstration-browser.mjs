import { startProjectTargetBrowser } from './build/project-target-browser.mjs';
import { targetRequestAllowed } from './project-target-access.mjs';

const MAX_HINT = 100;
const MAX_BOX_TARGETS = 20;
const SENSITIVE = /password|passwd|secret|token|cookie|auth|credential|api.?key|session|otp|验证码|密码|密钥/i;
const PLAIN = /^[\p{L}\p{N}_ .:/-]+$/u;
const CANCELLATIONS = new Set(['ESCAPE', 'NO_HIT', 'OVERFLOW', 'CROSS_FRAME', 'UNLOCATABLE_DOM', 'SENSITIVE_TARGET', 'NAVIGATION']);

function shortHint(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_HINT &&
    PLAIN.test(value) && !SENSITIVE.test(value) && !/\b\d{11}\b/.test(value) ? value : null;
}

function safeLocation(raw, target) {
  if (!targetRequestAllowed(target, raw)) return null;
  try {
    const url = new URL(raw);
    return shortHint(url.pathname) ? url.pathname : null;
  } catch { return null; }
}

// Installed in each frame before document scripts. The page can forge bridge
// calls, so all payloads remain untrusted locator hints, never test evidence.
export function installDemonstrationBridge() {
  const MAX_HINT = 100;
  const MAX_BOX_TARGETS = 20;
  window.__workbenchDemonstrationAbort?.abort();
  window.__workbenchDemonstrationOverlay?.remove();
  const controller = new AbortController();
  window.__workbenchDemonstrationAbort = controller;
  let mode = 'PAUSED';
  let picking = false;
  let pickMode = 'point';
  let stepIndex = 0;
  let overlay = null;
  let suppressNextClick = false;
  const sensitive = node => {
    const field = node?.closest?.('input,textarea,[contenteditable]');
    if (!field) return false;
    const type = String(field.getAttribute('type') || '').toLowerCase();
    const autocomplete = String(field.getAttribute('autocomplete') || '').toLowerCase();
    const identity = [field.id, field.getAttribute('name'), field.getAttribute('aria-label')].join(' ');
    return ['password', 'hidden', 'file'].includes(type) || /password|one-time-code|cc-/.test(autocomplete) ||
      /password|passwd|secret|token|cookie|auth|credential|api.?key|session|otp|验证码|密码|密钥/i.test(identity);
  };
  const targetFor = node => {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    if (!element || sensitive(element)) return null;
    if (element.matches('label') && element.control && sensitive(element.control)) return null;
    const target = element.closest('button,a,input,select,textarea,[role="button"],[role="checkbox"],[role="option"],[contenteditable]') || element;
    return sensitive(target) ? null : target;
  };
  const hint = node => {
    const target = targetFor(node);
    if (!target) return null;
    const cssPath = element => {
      const parts = [];
      for (let current = element; current && current.nodeType === 1 && parts.length < 6; current = current.parentElement) {
        const tag = current.tagName.toLowerCase();
        if (tag === 'html') break;
        if (tag === 'body') { parts.unshift('body'); break; }
        let index = 1;
        for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling)
          if (sibling.tagName === current.tagName) index++;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      }
      return parts.join('>');
    };
    const isAction = target.matches('button,a,[role="button"],[role="option"],[role="checkbox"]');
    const label = target.labels?.[0]?.textContent?.trim();
    const name = isAction ? target.innerText?.trim() : label;
    const visibleName = name && name.length <= MAX_HINT && !/password|passwd|secret|token|cookie|auth|credential|api.?key|session|otp|验证码|密码|密钥/i.test(name)
      ? name : null;
    return { tag: target.tagName?.toLowerCase(), id: target.id || null,
      testid: target.getAttribute('data-testid'), name: target.getAttribute('name'),
      role: target.getAttribute('role'), type: target.getAttribute('type'),
      aria_label: target.getAttribute('aria-label'), visible_name: visibleName,
      placeholder: target.getAttribute('placeholder'), css_path: cssPath(target),
      row_path: target.closest('tr,[role="row"]') ? cssPath(target.closest('tr,[role="row"]')) : null };
  };
  const removeOverlay = () => {
    const current = overlay;
    current?.remove();
    overlay = null;
    if (window.__workbenchDemonstrationOverlay === current) window.__workbenchDemonstrationOverlay = null;
  };
  const pauseSelection = (kind, values) => {
    if (!picking) return;
    const index = stepIndex;
    mode = 'PAUSED';
    picking = false;
    window.__workbenchDemonstrationMode = mode;
    // pointerup is followed by click; consume that click even if Node syncs PAUSED immediately.
    suppressNextClick = pickMode === 'box';
    const completedOverlay = overlay;
    setTimeout(() => {
      suppressNextClick = false;
      if (overlay === completedOverlay) removeOverlay();
    }, 50);
    try { void window.__workbenchDemonstrationEvent({ kind, step_index: index, ...values }); } catch {}
  };
  const isVisible = element => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 ||
        rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const intersects = (element, box) => {
    if (!isVisible(element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
  };
  const within = (element, box) => {
    if (!isVisible(element)) return false;
    const rect = element.getBoundingClientRect();
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    return centerX >= box.left && centerX <= box.right && centerY >= box.top && centerY <= box.bottom;
  };
  const isTopmostAtCenter = element => {
    const rect = element.getBoundingClientRect();
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    // The selection overlay must not make the underlying page fail its own hit test.
    const priorPointerEvents = overlay?.style.pointerEvents;
    if (overlay) overlay.style.pointerEvents = 'none';
    try {
      const hit = document.elementFromPoint(centerX, centerY);
      return Boolean(hit && (hit === element || element.contains(hit)));
    } finally {
      if (overlay) overlay.style.pointerEvents = priorPointerEvents;
    }
  };
  const boxTargets = box => {
    if (box.right - box.left < 6 || box.bottom - box.top < 6) return { reason: 'NO_HIT' };
    if ([...document.querySelectorAll('iframe,frame')].some(element => intersects(element, box)))
      return { reason: 'CROSS_FRAME' };
    if ([...document.querySelectorAll('canvas,object,embed')].some(element => intersects(element, box)))
      return { reason: 'UNLOCATABLE_DOM' };
    const selected = new Set();
    const targets = [];
    for (const element of document.querySelectorAll('body *')) {
      const control = element.matches('button,a,input,select,textarea,[role="button"],[role="checkbox"],[role="option"],[role="textbox"],[role="combobox"],label,[contenteditable]');
      const leaf = element.children.length === 0 && Boolean(element.textContent?.trim());
      if ((!control && !leaf) || !within(element, box) || !isTopmostAtCenter(element)) continue;
      if (sensitive(element)) return { reason: 'SENSITIVE_TARGET' };
      const target = targetFor(element);
      if (!target) return { reason: 'SENSITIVE_TARGET' };
      if (selected.has(target)) continue;
      const locator_hint = hint(target);
      if (!locator_hint?.css_path || document.querySelectorAll(locator_hint.css_path).length !== 1)
        return { reason: 'UNLOCATABLE_DOM' };
      selected.add(target);
      targets.push({ locator_hint });
      if (targets.length > MAX_BOX_TARGETS) return { reason: 'OVERFLOW' };
    }
    return targets.length ? { targets } : { reason: 'NO_HIT' };
  };
  const mountOverlay = () => {
    if (overlay || !document.documentElement || !picking || pickMode !== 'box') return;
    const host = document.createElement('div');
    host.setAttribute('data-workbench-demonstration-overlay', '');
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      :host{position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;cursor:crosshair!important;touch-action:none!important;user-select:none!important}
      .veil{position:absolute;inset:0;background:rgba(18,42,62,.12)}
      .note{position:absolute;top:12px;left:12px;max-width:min(440px,calc(100vw - 24px));padding:9px 12px;border-radius:8px;background:#142b3b;color:white;font:14px/1.45 sans-serif;box-shadow:0 2px 12px #0005;pointer-events:none}
      .box{position:absolute;border:2px solid #ff9e24;background:rgba(255,158,36,.13);display:none;pointer-events:none;box-sizing:border-box}
    </style><div class="veil"></div><div class="note" role="status">拖框标记本步检查对象（最多20个）。Esc取消；iframe或画布、无鼠标操作请改用点选。</div><div class="box"></div>`;
    const boxElement = shadow.querySelector('.box');
    let start = null;
    const draw = (a, b) => {
      const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
      boxElement.style.display = 'block';
      boxElement.style.left = `${left}px`;
      boxElement.style.top = `${top}px`;
      boxElement.style.width = `${Math.abs(a.x - b.x)}px`;
      boxElement.style.height = `${Math.abs(a.y - b.y)}px`;
    };
    host.addEventListener('pointerdown', event => {
      if (!picking || pickMode !== 'box' || event.isTrusted !== true || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      start = { x: event.clientX, y: event.clientY };
      host.setPointerCapture(event.pointerId);
      draw(start, start);
    }, true);
    host.addEventListener('pointermove', event => {
      if (!start || event.isTrusted !== true) return;
      event.preventDefault(); event.stopImmediatePropagation();
      draw(start, { x: event.clientX, y: event.clientY });
    }, true);
    host.addEventListener('pointerup', event => {
      if (!start || event.isTrusted !== true) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const box = { left: Math.min(start.x, event.clientX), right: Math.max(start.x, event.clientX),
        top: Math.min(start.y, event.clientY), bottom: Math.max(start.y, event.clientY) };
      start = null;
      const result = boxTargets(box);
      if (result.reason) pauseSelection('selection_cancelled', { reason: result.reason });
      else pauseSelection('assertion_targets', { targets: result.targets });
    }, true);
    overlay = host;
    window.__workbenchDemonstrationOverlay = host;
    document.documentElement.append(host);
  };
  const emit = (kind, event) => {
    const locator_hint = hint(event.target);
    if (!locator_hint || mode !== 'RECORDING' || event.isTrusted !== true) return false;
    try { void window.__workbenchDemonstrationEvent({ kind, locator_hint, step_index: stepIndex }); } catch {}
    return true;
  };
  document.addEventListener('click', event => {
    if (suppressNextClick && event.isTrusted === true) {
      suppressNextClick = false;
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (picking) {
      if (event.isTrusted !== true) return;
      if (pickMode === 'box') { event.preventDefault(); event.stopImmediatePropagation(); return; }
      // Pick is the only mode that changes tested-page interaction.
      event.preventDefault(); event.stopImmediatePropagation();
      const locator_hint = hint(event.target);
      if (locator_hint) pauseSelection('assertion_target', { locator_hint });
      else pauseSelection('selection_cancelled', { reason: sensitive(event.target) ? 'SENSITIVE_TARGET' : 'NO_HIT' });
      return;
    }
    emit('click', event);
  }, { capture: true, signal: controller.signal });
  document.addEventListener('input', event => {
    if (event.target?.tagName === 'SELECT') return;
    emit('fill', event); // Never reads event.data or element.value.
  }, { capture: true, signal: controller.signal });
  document.addEventListener('change', event => {
    if (event.target?.tagName === 'SELECT') emit('select', event);
    else if (event.target?.matches?.('[type="checkbox"],[type="radio"]')) emit('check', event);
  }, { capture: true, signal: controller.signal });
  document.addEventListener('keydown', event => {
    if (!picking || event.key !== 'Escape' || event.isTrusted !== true) return;
    event.preventDefault(); event.stopImmediatePropagation();
    pauseSelection('selection_cancelled', { reason: 'ESCAPE' });
  }, { capture: true, signal: controller.signal });
  document.addEventListener('DOMContentLoaded', () => mountOverlay(), { once: true, signal: controller.signal });
  window.addEventListener('pagehide', removeOverlay, { signal: controller.signal });
  window.__workbenchSetDemonstrationMode = (next, pick, index, requestedPickMode = 'point', boxAllowed = true) => {
    removeOverlay();
    suppressNextClick = false;
    mode = next === 'RECORDING' ? next : 'PAUSED';
    window.__workbenchDemonstrationMode = mode;
    pickMode = requestedPickMode === 'box' ? 'box' : 'point';
    picking = mode === 'RECORDING' && pick === true && (pickMode !== 'box' || boxAllowed === true);
    stepIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    if (picking && pickMode === 'box') mountOverlay();
  };
  queueMicrotask(() => { try { void window.__workbenchDemonstrationReady?.(); } catch {} });
}

function sanitizeLocatorHint(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (['password', 'hidden', 'file'].includes(String(raw.type || '').toLowerCase()) ||
    ['id', 'testid', 'name', 'aria_label', 'placeholder'].some(key => SENSITIVE.test(String(raw[key] || '')))) return null;
  const tag = shortHint(raw.tag);
  if (!tag || !/^[a-z][a-z0-9-]{0,30}$/.test(tag)) return null;
  const locator_hint = { tag };
  for (const key of ['id', 'testid', 'name', 'role', 'type', 'aria_label', 'visible_name', 'placeholder']) {
    const value = shortHint(raw[key]);
    if (value) locator_hint[key] = value;
  }
  for (const key of ['css_path', 'row_path']) {
    if (typeof raw[key] === 'string' && raw[key].length <= 220 &&
      /^(?:body|[a-z][a-z0-9-]*:nth-of-type\([1-9]\d{0,3}\))(?:>[a-z][a-z0-9-]*:nth-of-type\([1-9]\d{0,3}\))*$/.test(raw[key]))
      locator_hint[key] = raw[key];
  }
  return locator_hint;
}

export function validateDemonstrationEvent(payload, source, page, target) {
  if (!payload || typeof payload !== 'object' || !['click', 'fill', 'select', 'check', 'assertion_target', 'assertion_targets', 'selection_cancelled'].includes(payload.kind)) return null;
  if (!Number.isInteger(payload.step_index) || payload.step_index < 0 || payload.step_index > 100) return null;
  if (source?.page !== page || !source.frame || !page.frames().includes(source.frame)) return null;
  const framePath = safeLocation(source.frame.url(), target);
  if (framePath == null) return null;
  if (payload.kind === 'selection_cancelled') {
    if (!CANCELLATIONS.has(payload.reason)) return null;
    return { kind: payload.kind, step_index: payload.step_index, reason: payload.reason };
  }
  const frame_hint = {
    index: page.frames().indexOf(source.frame), path: framePath,
  };
  if (payload.kind === 'assertion_targets') {
    if (source.frame !== page.mainFrame() || !Array.isArray(payload.targets) ||
      payload.targets.length < 1 || payload.targets.length > MAX_BOX_TARGETS) return null;
    const targets = [];
    for (const item of payload.targets) {
      const locator_hint = sanitizeLocatorHint(item?.locator_hint);
      if (!locator_hint?.css_path) return null;
      targets.push({ locator_hint, frame_hint });
    }
    return { kind: payload.kind, step_index: payload.step_index, targets };
  }
  const locator_hint = sanitizeLocatorHint(payload.locator_hint);
  if (!locator_hint || (payload.kind === 'fill' && ['password', 'hidden', 'file'].includes(locator_hint.type))) return null;
  return { kind: payload.kind, step_index: payload.step_index, locator_hint, frame_hint };
}

export async function openDemonstrationBrowser(target, browserExecutable, onEvent, onInterruption, options = {}) {
  let primaryPage = null;
  let closed = false;
  let initialViolation = null;
  let requestedMode = 'PAUSED';
  let pickPending = false;
  let requestedStepIndex = 0;
  let requestedPickMode = 'point';
  const syncFrame = async frame => {
    if (closed || !primaryPage || !primaryPage.frames().includes(frame) || !safeLocation(frame.url(), target)) return;
    const boxAllowed = frame === primaryPage.mainFrame();
    const mode = pickPending && requestedPickMode === 'box' && !boxAllowed ? 'PAUSED' : requestedMode;
    await frame.evaluate(({ mode, pick, index, pickMode, boxAllowed }) => window.__workbenchSetDemonstrationMode?.(mode, pick, index, pickMode, boxAllowed),
      { mode, pick: pickPending, index: requestedStepIndex, pickMode: requestedPickMode, boxAllowed }).catch(() => {});
  };
  const pauseAfterSelection = () => {
    requestedMode = 'PAUSED';
    pickPending = false;
    requestedPickMode = 'point';
    if (primaryPage) for (const frame of primaryPage.frames()) void syncFrame(frame);
  };
  const session = await startProjectTargetBrowser(target, browserExecutable,
    violation => { initialViolation ||= violation?.code || 'TARGET_SCOPE_REQUEST_BLOCKED';
      if (!closed) onInterruption('TARGET_SCOPE_REQUEST_BLOCKED', violation?.code); },
    { headless: options.headless ?? false,
      ...(options.storageState === undefined ? {} : { storageState: options.storageState }),
      ...(options.sessionTerminationEndpoints === undefined ? {} : { sessionTerminationEndpoints: options.sessionTerminationEndpoints }),
      beforeNavigate: async ({ browser, context, page }) => {
      primaryPage = page;
      await context.exposeBinding('__workbenchDemonstrationReady', source => {
        if (source.page === primaryPage) void syncFrame(source.frame);
      });
      await context.exposeBinding('__workbenchDemonstrationEvent', (source, payload) => {
        if (closed || requestedMode !== 'RECORDING') return;
        const event = validateDemonstrationEvent(payload, source, primaryPage, target);
        if (!event || event.step_index !== requestedStepIndex) return;
        if (pickPending) {
          if (!['assertion_target', 'assertion_targets', 'selection_cancelled'].includes(event.kind)) return;
          if (requestedPickMode === 'box' && source.frame !== primaryPage.mainFrame()) return;
          pauseAfterSelection();
        } else if (!['click', 'fill', 'select', 'check'].includes(event.kind)) return;
        onEvent(event);
      });
      await context.addInitScript(installDemonstrationBridge);
      await page.evaluate(installDemonstrationBridge);
      context.on('page', extra => { if (extra !== primaryPage) {
        void extra.close().catch(() => {});
        if (!closed) onInterruption('EXTRA_TAB_BLOCKED');
      } });
      page.on('close', () => { if (!closed) onInterruption('BROWSER_CLOSED'); });
      browser.on('disconnected', () => { if (!closed) onInterruption('BROWSER_CLOSED'); });
      page.on('framenavigated', frame => {
        if (closed) return;
        if (frame.url() === 'about:blank') return; // Playwright's new-page bootstrap, not a target navigation.
        const path = safeLocation(frame.url(), target);
        if (path == null) { onInterruption('TARGET_SCOPE_REQUEST_BLOCKED'); return; }
        if (pickPending) {
          const index = requestedStepIndex;
          pauseAfterSelection();
          onEvent({ kind: 'selection_cancelled', step_index: index, reason: 'NAVIGATION' });
          return;
        }
        if (requestedMode !== 'RECORDING') return;
        onEvent({ kind: 'navigation', step_index: requestedStepIndex, locator_hint: { path }, frame_hint: {
          index: page.frames().indexOf(frame), path,
        } });
        // A new document reports bridge readiness; evaluating in this callback
        // can hit the previous execution context and silently lose the mode.
      });
    } });
  try { await session.page.waitForLoadState('load', { timeout: 5000 }); }
  catch (error) { closed = true; await session.close(); throw Error('DEMONSTRATION_TARGET_LOAD_INCOMPLETE'); }
  if (initialViolation || session.violation()) {
    closed = true;
    await session.close();
    throw Error('TARGET_SCOPE_REQUEST_BLOCKED');
  }
  return {
    async setMode(mode, pick = false, stepIndex = 0, pickMode = 'point') {
      requestedMode = mode === 'RECORDING' ? 'RECORDING' : 'PAUSED';
      pickPending = requestedMode === 'RECORDING' && pick === true;
      requestedStepIndex = stepIndex;
      requestedPickMode = pickMode === 'box' ? 'box' : 'point';
      for (const frame of session.page.frames()) await syncFrame(frame);
    },
    async close() { if (closed) return; closed = true; await session.close(); },
    page: session.page,
    violation: session.violation,
  };
}

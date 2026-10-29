// Runs inside the tested document. It observes browser input events only and
// never reads field values, labels, text, or candidate assertions.
export function installActionHighlight() {
  const key = Symbol.for('workbench.action-highlight.v1');
  if (window[key]?.document === document) { window[key].mount(); return; }
  const state = { host: null, ring: null, target: null, timer: null, frame: null };

  function mount() {
    if (state.host && !state.host.isConnected) { state.host = null; state.ring = null; }
    if (state.host || !document.documentElement) return Boolean(state.host);
    const host = document.createElement('workbench-action-highlight');
    host.setAttribute('data-workbench-action-highlight', '');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;' +
      'z-index:2147483647!important;pointer-events:none!important;user-select:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{pointer-events:none!important}*{box-sizing:border-box;pointer-events:none!important}' +
      '.ring{position:fixed;display:none;border:4px solid #778899;border-radius:8px;' +
      'box-shadow:0 0 0 3px rgba(255,255,255,.9);transition:none}' +
      '.ring.prepare{border-style:dashed}.ring.click{border-color:#e95420}' +
      '.ring.input{border-color:#168a4a}.ring.select{border-color:#6941c6}';
    const ring = document.createElement('div');
    ring.className = 'ring';
    shadow.append(style, ring);
    document.documentElement.appendChild(host);
    state.host = host; state.ring = ring;
    return true;
  }

  function hide() {
    clearTimeout(state.timer);
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    if (state.ring) state.ring.style.display = 'none';
    state.target = null;
  }

  function track() {
    state.frame = null;
    if (!state.target) return;
    if (!state.host?.isConnected || !position(state.target)) { hide(); return; }
    state.frame = requestAnimationFrame(track);
  }

  function position(target) {
    if (!target?.isConnected || !state.ring) return false;
    const rect = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.right <= 0 ||
        rect.top >= innerHeight || rect.left >= innerWidth || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    state.ring.style.left = `${Math.max(0, rect.left - 3)}px`;
    state.ring.style.top = `${Math.max(0, rect.top - 3)}px`;
    state.ring.style.width = `${Math.max(2, rect.width + 6)}px`;
    state.ring.style.height = `${Math.max(2, rect.height + 6)}px`;
    return true;
  }

  function element(event) {
    const node = event.target;
    if (!node || node.nodeType !== 1 || state.host?.contains(node)) return null;
    return node;
  }

  function show(target, kind) {
    if (!target || !mount()) return;
    if (!position(target)) { hide(); return; }
    state.target = target;
    state.ring.className = `ring ${kind}`;
    state.ring.style.display = 'block';
    clearTimeout(state.timer);
    state.timer = setTimeout(hide, kind === 'prepare' ? 250 : 1000);
    if (state.frame === null) state.frame = requestAnimationFrame(track);
  }

  function interactive(node) {
    return node.closest('button,a,input,select,textarea,[role="button"],[role="option"],[role="combobox"],[contenteditable="true"],[tabindex]');
  }

  Object.defineProperty(window, key, { value: { document, mount }, configurable: true });
  if (!mount()) document.addEventListener('DOMContentLoaded', mount, { once: true });

  document.addEventListener('pointerover', event => {
    const node = element(event);
    const target = node && interactive(node);
    if (target) show(target, 'prepare');
  }, true);
  document.addEventListener('focusin', event => {
    const node = element(event);
    if (node) show(node, 'prepare');
  }, true);
  document.addEventListener('click', event => {
    const node = element(event);
    if (node) show(interactive(node) || node, 'click');
  }, true);
  document.addEventListener('input', event => {
    const node = element(event);
    if (node) show(node, node.tagName === 'SELECT' ? 'select' : 'input');
  }, true);
  document.addEventListener('change', event => {
    const node = element(event);
    if (node && node.tagName === 'SELECT') show(node, 'select');
  }, true);
  window.addEventListener('scroll', () => { if (state.target && !position(state.target)) hide(); }, true);
  window.addEventListener('resize', () => { if (state.target && !position(state.target)) hide(); });
}

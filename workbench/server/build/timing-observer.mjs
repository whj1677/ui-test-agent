// Runner-owned observation. Candidates cannot supply clocks, bounds or results.
// This measures DOM-visible transition observations, not click/IPC/poll duration.
export async function startTimingObservation(page, requirements) {
  const handle = await page.evaluateHandle(requirements => {
    const clock = performance.now.bind(performance);
    const started = clock();
    const matches = target => [...document.querySelectorAll('[role="status"], [aria-live]')]
      .filter(node => node.textContent.trim() === target);
    function visible(node) {
      if (!node?.isConnected || ![...node.getClientRects()].some(r => r.width > 0 && r.height > 0)) return false;
      for (let current = node; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) ||
            style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return true;
    }
    const states = requirements.map(requirement => {
      const nodes = matches(requirement.target);
      const initialVisible = nodes.length === 1 && visible(nodes[0]);
      return { requirement, element: nodes[0], shown: initialVisible, appeared: null, cycles: [],
        initial_visible: initialVisible, reason: nodes.length !== 1 ? 'TIMING_TARGET_NOT_UNIQUE'
          : initialVisible ? 'TIMING_TARGET_ALREADY_VISIBLE' : null };
    });
    function sample() {
      const now = clock();
      for (const state of states) {
        if (state.reason) continue;
        const nodes = matches(state.requirement.target);
        if (nodes.length !== 1) { state.reason = 'TIMING_TARGET_NOT_UNIQUE'; continue; }
        if (nodes[0] !== state.element) { state.reason = 'TIMING_TARGET_REPLACED'; continue; }
        const shown = visible(state.element);
        if (shown && !state.shown) state.appeared = now;
        if (!shown && state.shown && state.appeared !== null) {
          state.cycles.push({ appeared_ms: state.appeared - started, disappeared_ms: now - started,
            duration_ms: now - state.appeared });
          state.appeared = null;
        }
        state.shown = shown;
      }
    }
    const observer = new MutationObserver(sample);
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    let frame;
    let stopped = false;
    const tick = () => { if (!stopped) { sample(); frame = requestAnimationFrame(tick); } };
    frame = requestAnimationFrame(tick);
    return { finish() {
      sample(); stopped = true; observer.disconnect(); cancelAnimationFrame(frame);
      return states.map(state => {
        const elapsed = state.cycles.length === 1 ? state.cycles[0].duration_ms : null;
        const reason = state.reason || (state.shown ? 'TIMING_INTERVAL_NOT_ENDED'
          : state.cycles.length !== 1 ? 'TIMING_REQUIRES_ONE_COMPLETE_CYCLE'
          : !Number.isFinite(elapsed) || elapsed < state.requirement.min_ms || elapsed > state.requirement.max_ms
            ? 'TIMING_OUT_OF_FROZEN_RANGE' : null);
        return { ...state.requirement, status: reason ? 'FAILED' : 'PASSED', reason,
          observed_duration_ms: elapsed, cycles: state.cycles, initial_visible: state.initial_visible,
          measurement: 'same-document performance.now; exact named live/status element; DOM visibility transitions; mutation and animation-frame observations',
          tolerance_added_ms: 0 };
      });
    } };
  }, requirements);
  return { async finish() {
    try { return await handle.evaluate(observer => observer.finish()); }
    catch { return requirements.map(requirement => ({ ...requirement, status: 'FAILED',
      reason: 'TIMING_OBSERVATION_CONTEXT_LOST', observed_duration_ms: null, cycles: [], tolerance_added_ms: 0 })); }
    finally { await handle.dispose().catch(() => {}); }
  } };
}

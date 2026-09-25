// Cordis plugin using the locked DSH tools/pre-execute authority hook.
export const name = 'workbench-development-tool-guard';
export const inject = ['tools'];
const browserNames = new Set(['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_click', 'browser_select_option', 'browser_wait_for', 'browser_press_key', 'browser_fill_form']);
export const allowedBrowserTools = [...browserNames].map(name => `mcp__playwright-mcp__${name}`);
const workbenchNames = new Set(['read_draft','write_draft','self_test','read_evidence','check_fidelity','submit_candidate'].map(name => `mcp__workbench__${name}`));
export function developmentToolAllowed(tool, args, normalUrl) {
  if (workbenchNames.has(tool)) return true;
  const prefix = 'mcp__playwright-mcp__';
  if (!tool.startsWith(prefix) || !browserNames.has(tool.slice(prefix.length))) return false;
  if (args?.filename || args?.path || args?.code || args?.function) return false;
  return tool !== `${prefix}browser_navigate` || args?.url === normalUrl;
}
export function apply(ctx) {
  // Locked DSH restrict() can hide inherited global tools, but not a browser
  // plugin's scope-local registrations. Those remain subject to the guard.
  ctx.on('agent/created', ({ agent }) => {
    const deny = ctx.tools.schemas().map(tool => tool.name).filter(name => name !== 'run_code' && !workbenchNames.has(name) && !allowedBrowserTools.includes(name));
    if (deny.length) agent.ctx.tools.restrict({ deny });
  });
  ctx.on('tools/pre-execute', async (exec, next) => developmentToolAllowed(exec.name, exec.arguments, process.env.WORKBENCH_DEVELOPMENT_NORMAL_URL)
    ? next() : { kind: 'deny', reason: JSON.stringify({ code: 'TASK_TOOL_POLICY_DENIED', tool: exec.name, draft_saved: false,
      reason: 'Only task draft/evidence tools and bound normal-page interactions are authorized. No shell, filesystem, arbitrary code, alternate URLs or delegation.',
      alternatives: exec.name.includes('browser') ? allowedBrowserTools : [...workbenchNames] }) });
}

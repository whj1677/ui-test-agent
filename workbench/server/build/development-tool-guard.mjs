// Cordis plugin using the locked DSH tools/pre-execute authority hook.
export const name = 'workbench-development-tool-guard';
export const inject = ['tools'];
const browserNames = new Set(['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_click', 'browser_select_option', 'browser_wait_for', 'browser_press_key', 'browser_fill_form']);
export function developmentToolAllowed(tool, args, normalUrl) {
  if (/^mcp__workbench__/.test(tool)) return true;
  const prefix = 'mcp__playwright-mcp__';
  if (!tool.startsWith(prefix) || !browserNames.has(tool.slice(prefix.length))) return false;
  if (args?.filename || args?.path || args?.code || args?.function) return false;
  return tool !== `${prefix}browser_navigate` || args?.url === normalUrl;
}
export function apply(ctx) {
  ctx.on('tools/pre-execute', async (exec, next) => developmentToolAllowed(exec.name, exec.arguments, process.env.WORKBENCH_DEVELOPMENT_NORMAL_URL)
    ? next() : { kind: 'deny', reason: 'This development task only permits its workbench tools and bound normal-page browser interactions. No shell, filesystem, arbitrary code, alternate URLs or task delegation.' });
}

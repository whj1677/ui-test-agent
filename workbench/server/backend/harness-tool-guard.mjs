// Runtime guard for the backend declarative-plan task. The DSH agent gets no
// native, shell, browser, or filesystem escape hatch, even if a plugin exposes it.
export const name = 'workbench-backend-harness-guard';
export const inject = ['tools'];
const allowed = new Set(['mcp__workbench-backend__read_context', 'mcp__workbench-backend__write_draft',
  'mcp__workbench-backend__self_test', 'mcp__workbench-backend__read_evidence', 'mcp__workbench-backend__review_candidate', 'mcp__workbench-backend__submit_candidate']);

export function apply(ctx) {
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.tools.presentAs('native');
    const names = ctx.tools.schemas().map(tool => tool.name);
    const denied = names.filter(tool => !allowed.has(tool));
    if (denied.length) agent.ctx.tools.restrict({ deny: denied });
  });
  ctx.on('tools/pre-execute', async (exec, next) => allowed.has(exec.name)
    ? next()
    : { kind: 'deny', reason: JSON.stringify({ code: 'BACKEND_HARNESS_TOOL_DENIED', rule: 'DECLARATIVE_BACKEND_PLAN_ONLY', tool: String(exec.name || '').slice(0, 100) }) });
}

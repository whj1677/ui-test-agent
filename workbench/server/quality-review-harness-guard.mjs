export const name = 'workbench-quality-review-guard';
export const inject = ['tools'];
const allowed = new Set(['read_case', 'submit_obligations', 'read_candidate', 'read_evidence', 'request_replay', 'submit_review']
  .map(name => `mcp__workbench-quality-review__${name}`));
export function apply(ctx) {
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.tools.presentAs('native');
    const denied = ctx.tools.schemas().map(tool => tool.name).filter(name => !allowed.has(name));
    if (denied.length) agent.ctx.tools.restrict({ deny: denied });
  });
  ctx.on('tools/pre-execute', async (execution, next) => allowed.has(execution.name)
    ? next() : { kind: 'deny', reason: JSON.stringify({ code: 'QUALITY_REVIEW_TOOL_DENIED' }) });
}

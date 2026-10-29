const HTTP_REQUEST = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+`?(\/[A-Za-z0-9_./{}:-]+)/g;
const NAMESPACE_SEGMENT = /^(?:\{\{runId\}\}|\{runId\}|[A-Za-z0-9][A-Za-z0-9_-]*)$/;

function phaseFor(method, path, namespace) {
  if (method === 'POST' && path === namespace.setup_path) return 'setup';
  if (method !== 'DELETE' || !path.startsWith(namespace.cleanup_prefix)) return null;
  const segment = path.slice(namespace.cleanup_prefix.length);
  return NAMESPACE_SEGMENT.test(segment) ? 'cleanup' : null;
}

export function backendCaseStageIssues({ caseVersion, binding, environment } = {}) {
  const content = caseVersion?.content;
  const namespace = environment?.namespace;
  const mode = environment?.mode || (namespace ? 'synthetic-namespace' : null);
  if (content?.case_type !== 'BACKEND' || mode !== 'synthetic-namespace' ||
      !namespace || typeof namespace.setup_path !== 'string' ||
      typeof namespace.cleanup_prefix !== 'string' || !namespace.cleanup_prefix.endsWith('/') ||
      !Array.isArray(content.steps)) return [];

  const issues = [];
  const seen = new Set();
  for (const [index, step] of content.steps.entries()) {
    const order = step?.order ?? index + 1;
    const texts = [step?.action, ...(binding?.mappings || [])
      .filter(mapping => mapping?.step_order === order).map(mapping => mapping.request)];
    for (const value of texts) {
      if (typeof value !== 'string') continue;
      for (const match of value.matchAll(HTTP_REQUEST)) {
        const phase = phaseFor(match[1], match[2], namespace);
        if (!phase || seen.has(`${order}:${phase}`)) continue;
        seen.add(`${order}:${phase}`);
        issues.push({
          code: 'BACKEND_CASE_STAGE_CONFLICT', step_order: order, phase,
          message: `第${order}步包含测试${phase === 'setup' ? '初始化' : '清理'}控制接口；请先修订用例，将其移至测试编排约束。`,
        });
      }
    }
  }
  return issues;
}

export function assertBackendCaseStages(args) {
  const issues = backendCaseStageIssues(args);
  if (issues.length) {
    const error = new Error('BACKEND_CASE_STAGE_CONFLICT');
    error.issues = issues;
    throw error;
  }
}

import { api, ApiError } from './api.js';

const base = projectId => `/api/case-library/projects/${encodeURIComponent(projectId)}/case-assistant`;
const conversationPath = (projectId, id) => `${base(projectId)}/conversations/${encodeURIComponent(id)}`;
const json = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const caseAssistantApi = {
  list: projectId => api(base(projectId)),
  create: (projectId, body = {}) => api(`${base(projectId)}/conversations`, json(body)),
  get: (projectId, id) => api(conversationPath(projectId, id)),
  send: (projectId, id, body) => api(`${conversationPath(projectId, id)}/messages`, json(body)),
  cancel: (projectId, id) => api(`${conversationPath(projectId, id)}/cancel`, json({})),
  async export(projectId, id, turnId, caseType) {
    const path = `${conversationPath(projectId, id)}/turns/${encodeURIComponent(turnId)}/export?case_type=${encodeURIComponent(caseType)}`;
    let response;
    try { response = await fetch(path); } catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
    if (!response.ok) {
      let code;
      try { code = (await response.json()).error; } catch { code = `HTTP_${response.status}`; }
      throw new ApiError(code, response.status);
    }
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) throw new ApiError('CASE_ASSISTANT_EXPORT_RESPONSE_INVALID', response.status);
    const rawName = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let name = `${caseType === 'UI' ? '前端' : '后端'}测试用例.xlsx`;
    if (rawName) { try { name = decodeURIComponent(rawName); } catch { /* Keep the safe fallback name. */ } }
    return { blob: await response.blob(), name };
  },
};

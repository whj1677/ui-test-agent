import { api, downloadFile } from './api.js';

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
    return downloadFile(path, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      invalidResponseCode: 'CASE_ASSISTANT_EXPORT_RESPONSE_INVALID', fallbackName: `${caseType === 'UI' ? '前端' : '后端'}测试用例.xlsx`,
    });
  },
};

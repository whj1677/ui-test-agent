import { api, downloadFile } from './api.js';
const base = id => `/api/case-library/projects/${encodeURIComponent(id)}/requirements`;
const json = (body, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export const requirementsApi = {
  // Image capability comes from the current server/provider in listSources.
  capabilities: { backendRunner: true },
  listSources: id => api(base(id) + '/sources'),
  uploadOffice: (id, originalPath) => api(base(id) + '/sources/office', json({ originalPath })),
  listDesigns: id => api(base(id) + '/designs'),
  getDesign: (id, design) => api(base(id) + '/designs/' + encodeURIComponent(design)),
  createDesign: (id, body) => api(base(id) + '/designs', json(body)),
  startGeneration: (id, design, body) => api(base(id) + '/designs/' + encodeURIComponent(design) + '/generate', json(body)),
  getGeneration: (id, task) => api(base(id) + '/generations/' + encodeURIComponent(task)),
  cancelGeneration: (id, task) => api(base(id) + '/generations/' + encodeURIComponent(task) + '/cancel', json({})),
  editCandidate: (id, design, candidate, body) => api(base(id) + '/designs/' + encodeURIComponent(design) + '/candidates/' + encodeURIComponent(candidate), json(body, 'PATCH')),
  confirmCandidates: (id, design, body) => api(base(id) + '/designs/' + encodeURIComponent(design) + '/confirm', json(body)),
  reviewDesignIssue: (id, design, body) => api(base(id) + '/designs/' + encodeURIComponent(design) + '/issue-review', json(body)),
  getBindings: (id, caseId) => api(base(id) + '/bindings?case_id=' + encodeURIComponent(caseId)),
  createBinding: (id, body) => api(base(id) + '/bindings', json(body)),
  createBindingRevision: (id, body) => api(base(id) + '/binding-revisions', json(body)),
  createCaseRevision: (id, body) => api(base(id) + '/case-revisions', json(body)),
  upload: (id, { kind, fileName, body, documentVersion, documentStatus, replacesSourceId }) => api(base(id) + '/sources', {
    method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(fileName),
      'x-source-kind': kind, 'x-document-version': encodeURIComponent(documentVersion || ''), 'x-document-status': documentStatus || 'UNKNOWN',
      'x-replaces-source-id': encodeURIComponent(replacesSourceId || '') }, body,
  }),
  async exportCases(id, { caseType, format }) {
    return downloadFile(`/api/case-library/projects/${encodeURIComponent(id)}/export?case_type=${encodeURIComponent(caseType)}&format=${encodeURIComponent(format)}`, {
      contentType: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json',
      invalidResponseCode: 'CASE_EXPORT_RESPONSE_INVALID', fallbackName: `cases.${format}`,
    });
  },
};

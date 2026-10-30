export class ApiError extends Error {
  constructor(code, status) {
    super(code || `HTTP_${status}`);
    this.name = 'ApiError';
    this.code = code || `HTTP_${status}`;
    this.status = status;
  }
}

async function decodeError(response) {
  try { return (await response.json()).error || `HTTP_${response.status}`; }
  catch { return `HTTP_${response.status}`; }
}

async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, options); }
  catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
  if (!response.ok) throw new ApiError(await decodeError(response), response.status);
  return response;
}

export async function api(path, options = {}) {
  const response = await request(path, options);
  return response.status === 204 ? null : response.json();
}

export async function downloadFile(path, { contentType, invalidResponseCode, fallbackName }) {
  const response = await request(path);
  const type = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (type !== contentType) throw new ApiError(invalidResponseCode, response.status);
  const rawName = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let name = fallbackName;
  if (rawName) { try { name = decodeURIComponent(rawName); } catch { /* Keep the fallback when the header is malformed. */ } }
  return { blob: await response.blob(), name };
}

export async function uploadCaseFile(file) {
  const lower = file.name.toLocaleLowerCase();
  const contentType = lower.endsWith('.json') ? 'application/json'
    : lower.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : lower.endsWith('.csv') ? 'text/csv' : '';
  if (!contentType) throw new ApiError('CASE_UPLOAD_TYPE_UNSUPPORTED', 400);
  if (file.size > 10 * 1024 * 1024) throw new ApiError('CASE_UPLOAD_SIZE_INVALID', 413);
  const response = await request('/api/case-library/uploads', {
    method: 'POST', headers: { 'content-type': contentType, 'x-file-name': encodeURIComponent(file.name) }, body: file,
  });
  return response.json();
}

export async function downloadPackage(projectId, caseIds = null) {
  const suffix = caseIds ? `?case_ids=${caseIds.map(encodeURIComponent).join(',')}` : '';
  return downloadFile(`/api/case-library/projects/${encodeURIComponent(projectId)}/export${suffix}`, {
    contentType: 'application/json', invalidResponseCode: 'CASE_EXPORT_RESPONSE_INVALID', fallbackName: `${projectId}-cases.json`,
  });
}

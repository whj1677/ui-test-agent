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

export async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, options); }
  catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
  if (!response.ok) throw new ApiError(await decodeError(response), response.status);
  return response.status === 204 ? null : response.json();
}

export async function uploadCaseFile(file) {
  const lower = file.name.toLocaleLowerCase();
  const contentType = lower.endsWith('.json') ? 'application/json'
    : lower.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '';
  if (!contentType) throw new ApiError('CASE_UPLOAD_TYPE_UNSUPPORTED', 400);
  if (file.size > 10 * 1024 * 1024) throw new ApiError('CASE_UPLOAD_SIZE_INVALID', 413);
  let response;
  try {
    response = await fetch('/api/case-library/uploads', {
      method: 'POST', headers: { 'content-type': contentType, 'x-file-name': encodeURIComponent(file.name) }, body: file,
    });
  } catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
  if (!response.ok) throw new ApiError(await decodeError(response), response.status);
  return response.json();
}

export async function downloadPackage(projectId, caseIds = null) {
  const suffix = caseIds ? `?case_ids=${caseIds.map(encodeURIComponent).join(',')}` : '';
  let response;
  try { response = await fetch(`/api/case-library/projects/${encodeURIComponent(projectId)}/export${suffix}`); }
  catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
  if (!response.ok) throw new ApiError(await decodeError(response), response.status);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new ApiError('CASE_EXPORT_RESPONSE_INVALID', response.status);
  const blob = await response.blob();
  const name = decodeURIComponent(response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || `${projectId}-cases.json`);
  return { blob, name };
}

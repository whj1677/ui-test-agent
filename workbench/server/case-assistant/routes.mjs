export async function caseAssistantRoute({ request, response, url, manager, sendJson, readJsonBody, trustedMutation }) {
  const match = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/case-assistant(?:\/(.*))?$/);
  if (!match) return false;
  if (!manager) { sendJson(response, 503, { error: 'CASE_ASSISTANT_MODEL_UNAVAILABLE' }); return true; }
  const projectId = decodeURIComponent(match[1]);
  const parts = (match[2] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  if (method !== 'GET' && !trustedMutation(request)) { sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true; }
  let value, status = 200;
  if (!parts.length && method === 'GET') value = await manager.list(projectId);
  else if (parts[0] === 'conversations' && parts.length === 1 && method === 'POST') {
    value = await manager.create(projectId, await readJsonBody(request)); status = 201;
  } else if (parts[0] === 'conversations' && parts.length === 2 && method === 'GET') value = await manager.get(projectId, parts[1]);
  else if (parts[0] === 'conversations' && parts.length === 3 && parts[2] === 'messages' && method === 'POST') {
    value = await manager.send(projectId, parts[1], await readJsonBody(request, 64 * 1024)); status = 202;
  } else if (parts[0] === 'conversations' && parts.length === 3 && parts[2] === 'cancel' && method === 'POST') value = await manager.cancel(projectId, parts[1]);
  else if (parts[0] === 'conversations' && parts.length === 5 && parts[2] === 'turns' && parts[4] === 'export' && method === 'GET') {
    const caseType = url.searchParams.get('case_type');
    if (!['UI', 'BACKEND'].includes(caseType)) throw Error('CASE_ASSISTANT_CASE_TYPE_INVALID');
    const body = await manager.export(projectId, parts[1], parts[3], caseType);
    response.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-length': body.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${caseType === 'UI' ? '前端' : '后端'}测试用例-${parts[3].slice(-8)}.xlsx`)}` });
    response.end(body);
    return true;
  } else { sendJson(response, 404, { error: 'CASE_ASSISTANT_ROUTE_NOT_FOUND' }); return true; }
  sendJson(response, status, value);
  return true;
}

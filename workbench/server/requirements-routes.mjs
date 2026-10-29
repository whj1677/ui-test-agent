export async function requirementsRoute({ request, response, url, manager, sendJson, readJsonBody, readBinaryBody, trustedMutation, trustedLocalOrigin }) {
  const match = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/requirements(?:\/(.*))?$/);
  if (!match) return false;
  if (!manager) { sendJson(response, 503, { error: 'REQUIREMENT_SERVICE_NOT_READY' }); return true; }
  const projectId = decodeURIComponent(match[1]);
  const parts = (match[2] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  if (parts[0] === 'sources' && parts.length === 3 && parts[2] === 'image' && method === 'GET') {
    const image = await manager.getImage(projectId, parts[1], url.searchParams.get('embedded'));
    response.writeHead(200, { 'content-type': image.mime_type, 'content-length': image.body.length,
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-source-sha256': image.sha256 });
    response.end(image.body);
    return true;
  }
  let value, status = 200;
  if (parts[0] === 'sources' && parts.length === 1 && method === 'POST') {
    if (!trustedLocalOrigin(request)) { sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true; }
    value = await manager.upload(projectId, { kind: request.headers['x-source-kind'], fileName: decodeURIComponent(request.headers['x-file-name'] || ''),
      documentVersion: decodeURIComponent(request.headers['x-document-version'] || ''), documentStatus: request.headers['x-document-status'],
      replacesSourceId: decodeURIComponent(request.headers['x-replaces-source-id'] || ''), body: await readBinaryBody(request) });
    status = 201;
  } else {
    if (method !== 'GET' && !trustedMutation(request)) { sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true; }
    const body = method === 'GET' ? null : await readJsonBody(request, 1024 * 1024);
    if (parts[0] === 'sources' && parts.length === 2 && parts[1] === 'office' && method === 'POST') {
      if (!body || Object.keys(body).some(key => !['provider','originalPath'].includes(key))) throw Error('REQUIREMENT_OFFICE_OPEN_FAILED');
      value = await manager.uploadOffice(projectId,body); status = 201;
    }
    else if (parts[0] === 'sources' && parts.length === 1 && method === 'GET') value = { ...await manager.listSources(projectId), capabilities: manager.diagnostics() };
    else if (parts[0] === 'sources' && parts.length === 2 && method === 'GET') value = await manager.getSource(projectId, parts[1]);
    else if (parts[0] === 'designs' && parts.length === 1 && method === 'GET') value = await manager.listDesigns(projectId);
    else if (parts[0] === 'designs' && parts.length === 1 && method === 'POST') { value = await manager.createDesign(projectId, body); status = 201; }
    else if (parts[0] === 'designs' && parts.length === 2 && method === 'GET') value = await manager.getDesign(projectId, parts[1]);
    else if (parts[0] === 'designs' && parts.length === 3 && parts[2] === 'generate' && method === 'POST') { value = await manager.startGeneration(projectId, parts[1], body); status = 202; }
    else if (parts[0] === 'designs' && parts.length === 3 && parts[2] === 'confirm' && method === 'POST') value = await manager.confirmCandidates(projectId, parts[1], body);
    else if (parts[0] === 'designs' && parts.length === 3 && parts[2] === 'issue-review' && method === 'POST') value = await manager.reviewDesignIssue(projectId, parts[1], body);
    else if (parts[0] === 'designs' && parts.length === 4 && parts[2] === 'candidates' && method === 'PATCH') value = await manager.editCandidate(projectId, parts[1], parts[3], body);
    else if (parts[0] === 'generations' && parts.length === 2 && method === 'GET') value = await manager.getGeneration(projectId, parts[1]);
    else if (parts[0] === 'generations' && parts.length === 3 && parts[2] === 'cancel' && method === 'POST') value = await manager.cancelGeneration(projectId, parts[1]);
    else if (parts[0] === 'bindings' && parts.length === 1 && method === 'GET') value = await manager.getBindings(projectId, url.searchParams.get('case_id'));
    else if (parts[0] === 'bindings' && parts.length === 1 && method === 'POST') { value = await manager.createBinding(projectId, body); status = 201; }
    else if (parts[0] === 'binding-revisions' && parts.length === 1 && method === 'POST') { value = await manager.createBindingRevision(projectId, body); status = 201; }
    else if (parts[0] === 'case-revisions' && parts.length === 1 && method === 'POST') { value = await manager.createCaseRevision(projectId, body); status = value.idempotent ? 200 : 201; }
    else { sendJson(response, 404, { error: 'REQUIREMENT_ROUTE_NOT_FOUND' }); return true; }
  }
  sendJson(response, status, value);
  return true;
}

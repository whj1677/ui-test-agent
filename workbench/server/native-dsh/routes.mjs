export async function nativeDshRoute({ request, response, url, manager, sendJson, readJsonBody, trustedMutation, trustedLocalOrigin = trustedMutation, sendRegisteredMedia }) {
  const match = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/native-dsh(?:\/(.*))?$/);
  if (!match) return false;
  if (!manager) { sendJson(response, 503, { error: 'NATIVE_DSH_UNAVAILABLE' }); return true; }
  const projectId = decodeURIComponent(match[1]);
  const parts = (match[2] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  // The owned local runner has no browser Origin. Its short-lived task bearer
  // is checked by the manager; only execution and non-executing draft registration qualify.
  if (method === 'POST' && parts.length === 3 && parts[0] === 'tasks' && ['execute', 'drafts', 'finish'].includes(parts[2])) {
    const value = await manager[parts[2] === 'finish' ? 'finishBatch' : parts[2] === 'drafts' ? 'registerDraft' : 'executeRequest'](projectId, parts[1], await readJsonBody(request), request.headers.authorization);
    sendJson(response, 200, value);
    return true;
  }
  // 这两个入口只接受空体的同源请求（不要求 JSON）。它们都会换取一次会话启动地址，
  // 因此仍按本地来源校验，不允许跨站触发；任务/执行的既有准入规则不变。
  const openingSession = method === 'POST' && parts.length === 1 && ['open-session', 'session-url'].includes(parts[0]);
  if (method !== 'GET' && !(openingSession ? trustedLocalOrigin(request) : trustedMutation(request))) {
    sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true;
  }
  let value, status = 200;
  if (!parts.length && method === 'GET') value = await manager.describe(projectId);
  else if (parts.length === 1 && parts[0] === 'console' && method === 'GET') value = await manager.console(projectId, {
    caseId: url.searchParams.get('case_id') || undefined,
    caseVersion: url.searchParams.has('case_version') ? Number(url.searchParams.get('case_version')) : undefined,
    runId: url.searchParams.get('run_id') || undefined, summary: url.searchParams.get('view') === 'summary',
  });
  else if (parts.length === 2 && parts[0] === 'reruns' && parts[1] === 'preflight' && method === 'POST') value = await manager.previewRerun(projectId, await readJsonBody(request));
  else if (parts.length === 1 && parts[0] === 'reruns' && method === 'POST') { value = await manager.createRerun(projectId, await readJsonBody(request)); status = 202; }
  else if (parts.length === 1 && parts[0] === 'open-session' && method === 'POST') {
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] || 0) !== 0) throw Error('NATIVE_DSH_INVALID_OPEN_REQUEST');
    // A same-origin form opens a new tab synchronously. The launch credential
    // stays out of project state, JSON responses, DOM links and application logs.
    const target = await manager.openSession(projectId);
    response.writeHead(303, { Location: target.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    response.end();
    return true;
  }
  else if (parts.length === 1 && parts[0] === 'session-url' && method === 'POST') {
    // 供前端脚本导航用的目标地址解析。与 open-session 相同的本地来源校验：
    // 它同样会换取一次启动地址，不应允许跨站触发。
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] || 0) !== 0) throw Error('NATIVE_DSH_INVALID_OPEN_REQUEST');
    value = await manager.resolveSessionUrl(projectId);
  }
  else if (parts.length === 1 && parts[0] === 'tasks' && method === 'POST') {
    value = await manager.create(projectId, await readJsonBody(request)); status = 202;
  } else if (parts.length === 1 && parts[0] === 'transcript' && method === 'GET') {
    // 只读对话视图：不创建会话、不启动 Host、不调用模型。读不到时以 available:false 如实返回，
    // 不抛错、不伪造空对话，避免把"没读到"显示成"没有对话"。
    value = await manager.getTranscript(projectId);
  } else if (parts.length === 2 && parts[0] === 'tasks' && method === 'GET') value = await manager.get(projectId, parts[1]);
  else if (parts.length === 3 && parts[0] === 'tasks' && parts[2] === 'stop' && method === 'POST') {
    const body = await readJsonBody(request);
    if (!body || Array.isArray(body) || Object.keys(body).length) throw Error('NATIVE_DSH_INVALID_STOP_REQUEST');
    value = await manager.stop(projectId, parts[1]); status = 202;
  } else if (parts.length === 4 && parts[0] === 'tasks' && parts[2] === 'files' && method === 'GET') {
    const artifact = await manager.artifact(projectId, parts[1], parts[3]);
    await sendRegisteredMedia(request, response, artifact.root, artifact.media);
    return true;
  } else { sendJson(response, 404, { error: 'NATIVE_DSH_ROUTE_NOT_FOUND' }); return true; }
  sendJson(response, status, value);
  return true;
}

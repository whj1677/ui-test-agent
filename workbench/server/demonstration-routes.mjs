// Returns true when the demonstration route handled the request.
export async function demonstrationRoute({ request, response, url, demonstrations, readJsonBody,
  sendJson, trustedMutation }) {
  const match = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/demonstrations(?:\/([^/]+)(?:\/(control|confirm))?)?$/);
  if (!match) return false;
  if (!demonstrations) throw Error('DEMONSTRATIONS_UNAVAILABLE');
  const projectId = decodeURIComponent(match[1]);
  const id = match[2] ? decodeURIComponent(match[2]) : null;
  const action = match[3] || null;
  if (request.method === 'GET' && !id) sendJson(response, 200, await demonstrations.list(projectId));
  else if (request.method === 'GET' && id && !action) sendJson(response, 200, await demonstrations.get(projectId, id));
  else if (request.method === 'POST') {
    if (typeof trustedMutation !== 'function' || !trustedMutation(request)) {
      sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true;
    }
    const body = await readJsonBody(request);
    if (!id) sendJson(response, 201, await demonstrations.open(projectId, body));
    else if (action === 'control') sendJson(response, 200, await demonstrations.control(projectId, id, body));
    else if (action === 'confirm') sendJson(response, 200, await demonstrations.confirm(projectId, id, body));
    else sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
  } else sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
  return true;
}

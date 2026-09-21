import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInside, sha256File } from './integrity.mjs';

const defaultWebRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
}

async function sendStatic(response, webRoot, pathname) {
  const files = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);
  const selected = files.get(pathname);
  if (!selected) return false;
  response.writeHead(200, securityHeaders(selected[1]));
  response.end(await fs.readFile(path.join(webRoot, selected[0])));
  return true;
}

async function sendRegisteredMedia(request, response, root, media, errors = {}) {
  const file = resolveInside(root, media.relative_path);
  let realRoot;
  let realFile;
  try { [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(file)]); }
  catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: errors.missing || 'MEDIA_FILE_MISSING' });
    throw error;
  }
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
    return sendJson(response, 403, { error: errors.outside || 'MEDIA_PATH_OUTSIDE_ROOT' });
  }
  const stat = await fs.stat(realFile);
  if (!stat.isFile() || stat.size !== media.bytes || await sha256File(realFile) !== media.sha256) {
    return sendJson(response, 409, { error: errors.changed || 'MEDIA_FILE_CHANGED' });
  }
  const body = await fs.readFile(realFile);
  const range = String(request.headers.range || '').match(/^bytes=(\d+)-(\d*)$/);
  const disposition = media.kind === 'trace' ? 'attachment' : 'inline';
  const headers = {
    ...securityHeaders(media.content_type),
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(media.file_name)}`,
    'accept-ranges': 'bytes',
  };
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (!Number.isInteger(start) || start < 0 || start > end) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` });
      return response.end();
    }
    response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
    response.end(body.subarray(start, end + 1));
    return;
  }
  response.writeHead(200, { ...headers, 'content-length': body.length });
  response.end(body);
}

async function sendMedia(request, response, store, runId, mediaId) {
  const run = await store.getRun(runId);
  const media = run?.media?.find((item) => item.media_id === mediaId);
  if (!media) return sendJson(response, 404, { error: 'MEDIA_NOT_FOUND' });
  return sendRegisteredMedia(request, response, store.runDirectory(runId), media, { outside: 'MEDIA_PATH_OUTSIDE_RUN' });
}

async function sendBuildFile(response, buildStore, taskId, fileId) {
  const task = await buildStore.getTask(taskId);
  const item = task?.files?.find((file) => file.file_id === fileId);
  if (!item) return sendJson(response, 404, { error: 'BUILD_FILE_NOT_FOUND' });
  if (!item.web_visible) return sendJson(response, 403, { error: 'BUILD_FILE_NOT_WEB_VISIBLE' });
  const taskRoot = buildStore.taskDirectory(taskId);
  const file = resolveInside(taskRoot, item.relative_path);
  const [realRoot, realFile] = await Promise.all([fs.realpath(taskRoot), fs.realpath(file)]);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) return sendJson(response, 403, { error: 'BUILD_FILE_PATH_OUTSIDE_TASK' });
  const stat = await fs.stat(realFile);
  if (!stat.isFile() || stat.size !== item.bytes || await sha256File(realFile) !== item.sha256) return sendJson(response, 409, { error: 'BUILD_FILE_CHANGED' });
  response.writeHead(200, { ...securityHeaders(item.content_type), 'content-length': stat.size });
  response.end(await fs.readFile(realFile));
}

async function readJsonBody(request, limit = 16 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function trustedMutation(request) {
  const host = request.headers.host;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) return false;
  if (request.headers.origin !== `http://${host}`) return false;
  return String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json');
}

function errorStatus(error) {
  if (['ASSET_NOT_APPROVED', 'ENVIRONMENT_NOT_ALLOWED'].includes(error.message)) return 400;
  if (error.message === 'RUN_ALREADY_ACTIVE') return 409;
  if (error.message === 'RUN_NOT_ACTIVE_OR_NOT_OWNED') return 404;
  if (['BUILD_TASK_ALREADY_ACTIVE', 'BUILD_STAGE_BUDGET_EXHAUSTED'].includes(error.message)) return 409;
  if (['BUILD_REVALIDATION_AUTHORIZATION_UNAVAILABLE', 'BUILD_REVALIDATION_AUTHORIZATION_EXHAUSTED'].includes(error.message)) return 409;
  if (error.message === 'BUILD_REVALIDATION_AUTHORIZATION_INVALID') return 400;
  if (['BUILD_STORAGE_UNAVAILABLE', 'BUILD_DIAGNOSTIC_STORAGE_FAILED'].includes(error.message)) return 503;
  if (['BUILD_TASK_NOT_FOUND', 'BUILD_TASK_NOT_ACTIVE_OR_NOT_OWNED'].includes(error.message)) return 404;
  if (['BUILD_TEMPLATE_NOT_ALLOWED', 'BUILD_INITIAL_NOT_ALLOWED', 'BUILD_REVISION_NOT_ALLOWED', 'BUILD_REVISION_SOURCE_INVALID'].includes(error.message)) return 400;
  if (error.message === 'REQUEST_TOO_LARGE') return 413;
  if (error.message === 'INVALID_JSON') return 400;
  return 422;
}

export function createWorkbenchServer(options = {}) {
  const store = options.store;
  const manager = options.manager;
  const buildStore = options.buildStore;
  const buildManager = options.buildManager;
  const buildRevalidationStore = options.buildRevalidationStore;
  const webRoot = options.webRoot || defaultWebRoot;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/api/health') {
        const buildDiagnostics = buildManager?.diagnostics?.() || null;
        sendJson(response, 200, {
          service: 'approved-test-workbench', status: buildDiagnostics?.storage_status === 'FAILED' ? 'degraded' : 'ready',
          active_run_id: manager?.active?.runId || null,
          active_build_task_id: buildManager?.active?.taskId || null,
          build_budget: buildStore ? await buildStore.getBudget() : null,
          build_authorization: buildStore?.getRevalidationAuthorization ? await buildStore.getRevalidationAuthorization() : null,
          build_diagnostics: buildDiagnostics,
        });
        return;
      }
      if (buildManager && request.method === 'GET' && url.pathname === '/api/build/templates') {
        sendJson(response, 200, { templates: await buildManager.templates() });
        return;
      }
      if (buildStore && request.method === 'GET' && url.pathname === '/api/build/tasks') {
        const tasks = await buildStore.listTasks();
        if (buildRevalidationStore) {
          for (const task of tasks) task.revalidations = await buildRevalidationStore.listForTask(task.task_id);
        }
        sendJson(response, 200, { tasks });
        return;
      }
      const revalidationMedia = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/revalidations\/([^/]+)\/media\/([^/]+)$/);
      if (buildRevalidationStore && request.method === 'GET' && revalidationMedia) {
        const [taskId, validationId, mediaId] = revalidationMedia.slice(1).map(decodeURIComponent);
        const resolved = await buildRevalidationStore.resolveMedia(taskId, validationId, mediaId);
        if (!resolved) return sendJson(response, 404, { error: 'REVALIDATION_MEDIA_NOT_FOUND' });
        await sendRegisteredMedia(request, response, resolved.root, resolved.media, {
          missing: 'REVALIDATION_MEDIA_MISSING', outside: 'REVALIDATION_MEDIA_PATH_OUTSIDE_ROOT', changed: 'REVALIDATION_MEDIA_CHANGED',
        });
        return;
      }
      const buildFile = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/files\/([^/]+)$/);
      if (buildStore && request.method === 'GET' && buildFile) {
        await sendBuildFile(response, buildStore, decodeURIComponent(buildFile[1]), decodeURIComponent(buildFile[2]));
        return;
      }
      const buildTask = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)$/);
      if (buildStore && request.method === 'GET' && buildTask) {
        const task = await buildStore.getTask(decodeURIComponent(buildTask[1]));
        if (task && buildRevalidationStore) task.revalidations = await buildRevalidationStore.listForTask(task.task_id);
        sendJson(response, task ? 200 : 404, task || { error: 'BUILD_TASK_NOT_FOUND' });
        return;
      }
      if (buildManager && request.method === 'POST' && url.pathname === '/api/build/tasks') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).sort().join(',') !== 'template_id' || typeof body.template_id !== 'string') return sendJson(response, 400, { error: 'INVALID_BUILD_TASK_REQUEST' });
        sendJson(response, 201, await buildManager.submit(body.template_id));
        return;
      }
      const buildAction = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/(start|revise|stop)$/);
      if (buildManager && request.method === 'POST' && buildAction) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).length) return sendJson(response, 400, { error: 'INVALID_BUILD_ACTION_REQUEST' });
        const id = decodeURIComponent(buildAction[1]);
        const result = buildAction[2] === 'start' ? await buildManager.start(id)
          : buildAction[2] === 'revise' ? await buildManager.revise(id)
            : await buildManager.stop(id);
        sendJson(response, 202, result);
        return;
      }
      if (store && request.method === 'GET' && url.pathname === '/api/assets') {
        sendJson(response, 200, { assets: await store.listAssets() });
        return;
      }
      if (store && request.method === 'GET' && url.pathname.startsWith('/api/assets/')) {
        const asset = await store.getAsset(decodeURIComponent(url.pathname.slice('/api/assets/'.length)));
        sendJson(response, asset ? 200 : 404, asset || { error: 'ASSET_NOT_FOUND' });
        return;
      }
      if (store && request.method === 'GET' && url.pathname === '/api/runs') {
        sendJson(response, 200, { runs: await store.listRuns() });
        return;
      }
      const mediaMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/media\/([^/]+)$/);
      if (store && request.method === 'GET' && mediaMatch) {
        await sendMedia(request, response, store, decodeURIComponent(mediaMatch[1]), decodeURIComponent(mediaMatch[2]));
        return;
      }
      if (store && request.method === 'GET' && /^\/api\/runs\/[^/]+$/.test(url.pathname)) {
        const run = await store.getRun(decodeURIComponent(url.pathname.slice('/api/runs/'.length)));
        sendJson(response, run ? 200 : 404, run || { error: 'RUN_NOT_FOUND' });
        return;
      }
      if (manager && request.method === 'POST' && url.pathname === '/api/runs') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        if (buildManager?.active) return sendJson(response, 409, { error: 'WORKBENCH_BUSY' });
        const body = await readJsonBody(request);
        const allowedKeys = Object.keys(body).sort().join(',') === 'asset_id,environment';
        if (!allowedKeys || typeof body.asset_id !== 'string' || typeof body.environment !== 'string') {
          return sendJson(response, 400, { error: 'INVALID_RUN_REQUEST' });
        }
        const run = await manager.start(body.asset_id, body.environment);
        sendJson(response, 202, run);
        return;
      }
      const stop = url.pathname.match(/^\/api\/runs\/([^/]+)\/stop$/);
      if (manager && request.method === 'POST' && stop) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).length) return sendJson(response, 400, { error: 'INVALID_STOP_REQUEST' });
        sendJson(response, 202, await manager.stop(decodeURIComponent(stop[1])));
        return;
      }
      if (request.method === 'GET' && await sendStatic(response, webRoot, url.pathname)) return;
      sendJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message.split(':')[0] });
    }
  });
}

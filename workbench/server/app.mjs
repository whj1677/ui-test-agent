import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInside, sha256File } from './integrity.mjs';

const defaultWebRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const defaultWorkspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-v2');

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

async function sendStatic(response, webRoot, workspaceRoot, pathname) {
  const files = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);
  const workspaceFiles = new Map([
    ['/workspace', ['index.html', 'text/html; charset=utf-8']],
    ['/workspace/', ['index.html', 'text/html; charset=utf-8']],
    ['/workspace/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/workspace/api.js', ['api.js', 'text/javascript; charset=utf-8']],
    ['/workspace/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);
  const selected = files.get(pathname) || workspaceFiles.get(pathname);
  if (!selected) return false;
  response.writeHead(200, securityHeaders(selected[1]));
  response.end(await fs.readFile(path.join(workspaceFiles.has(pathname) ? workspaceRoot : webRoot, selected[0])));
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

async function sendBuildMedia(request, response, buildStore, taskId, fileId) {
  const task = await buildStore.getTask(taskId);
  const item = task?.files?.find((file) => file.file_id === fileId);
  if (!item || !/^(?:normal|counterexample)_(?:screenshot|video|trace)$/.test(item.kind || '')) {
    return sendJson(response, 404, { error: 'BUILD_MEDIA_NOT_FOUND' });
  }
  const mediaKind = item.kind.endsWith('_screenshot') ? 'screenshot' : item.kind.endsWith('_video') ? 'video' : 'trace';
  return sendRegisteredMedia(request, response, buildStore.taskDirectory(taskId), { ...item, kind: mediaKind }, {
    missing: 'BUILD_MEDIA_MISSING', outside: 'BUILD_MEDIA_PATH_OUTSIDE_TASK', changed: 'BUILD_MEDIA_CHANGED',
  });
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

async function sendCaseTemplate(response, webRoot, pathname) {
  if (pathname !== '/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx') return false;
  const file = path.join(path.dirname(webRoot), 'examples', 'M3A_CASE_IMPORT_TEMPLATE_V1.xlsx');
  response.writeHead(200, {
    ...securityHeaders('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'content-disposition': "attachment; filename*=UTF-8''M3A_CASE_IMPORT_TEMPLATE_V1.xlsx",
  });
  response.end(await fs.readFile(file));
  return true;
}

async function readBinaryBody(request, limit = 10 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function trustedLocalOrigin(request) {
  const host = request.headers.host;
  return /^(127\.0\.0\.1|localhost):\d+$/.test(host || '') && request.headers.origin === `http://${host}`;
}

function trustedMutation(request) {
  if (!trustedLocalOrigin(request)) return false;
  return String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json');
}

function errorStatus(error) {
  if (['ASSET_NOT_APPROVED', 'ENVIRONMENT_NOT_ALLOWED'].includes(error.message)) return 400;
  if (error.message === 'RUN_ALREADY_ACTIVE') return 409;
  if (error.message === 'RUN_NOT_ACTIVE_OR_NOT_OWNED') return 404;
  if (['BUILD_TASK_ALREADY_ACTIVE', 'BUILD_STAGE_BUDGET_EXHAUSTED'].includes(error.message)) return 409;
  if (error.message === 'BUILD_INPUT_ONLY_TASK_NOT_STARTABLE') return 409;
  if (error.message === 'CASE_BUILD_REQUEST_KEY_CONFLICT') return 409;
  if (error.message === 'BUILD_REVALIDATION_AUTHORIZATION_CONFLICT') return 409;
  if (['BUILD_REVALIDATION_AUTHORIZATION_UNAVAILABLE', 'BUILD_REVALIDATION_AUTHORIZATION_EXHAUSTED'].includes(error.message)) return 409;
  if (error.message === 'BUILD_REVALIDATION_AUTHORIZATION_INVALID') return 400;
  if (['BUILD_STORAGE_UNAVAILABLE', 'BUILD_DIAGNOSTIC_STORAGE_FAILED'].includes(error.message)) return 503;
  if (['BUILD_TASK_NOT_FOUND', 'BUILD_TASK_NOT_ACTIVE_OR_NOT_OWNED'].includes(error.message)) return 404;
  if (['BUILD_TEMPLATE_NOT_ALLOWED', 'BUILD_INITIAL_NOT_ALLOWED', 'BUILD_REVISION_NOT_ALLOWED', 'BUILD_REVISION_SOURCE_INVALID'].includes(error.message)) return 400;
  if (error.message === 'REQUEST_TOO_LARGE') return 413;
  if (error.message === 'INVALID_JSON') return 400;
  if (error.message === 'CASE_PROJECT_NOT_FOUND' || error.message === 'CASE_NOT_FOUND' || error.message === 'CASE_UPLOAD_NOT_FOUND' || error.message === 'CASE_PREVIEW_NOT_FOUND') return 404;
  if (error.message === 'CASE_PROJECT_REVISION_CONFLICT' || error.message === 'CASE_IMPORT_PREVIEW_STALE') return 409;
  if (error.message.startsWith('CASE_')) return 400;
  return 422;
}

export function createWorkbenchServer(options = {}) {
  const store = options.store;
  const manager = options.manager;
  const buildStore = options.buildStore;
  const buildManager = options.buildManager;
  const buildRevalidationStore = options.buildRevalidationStore;
  const buildAssessmentStore = options.buildAssessmentStore;
  const caseStore = options.caseStore;
  const caseManager = options.caseManager;
  const webRoot = options.webRoot || defaultWebRoot;
  const workspaceRoot = options.workspaceRoot || defaultWorkspaceRoot;
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
      if (caseStore && request.method === 'GET' && url.pathname === '/api/case-library/projects') {
        sendJson(response, 200, { projects: await caseStore.listProjects() });
        return;
      }
      if (caseManager && request.method === 'POST' && url.pathname === '/api/case-library/projects') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        sendJson(response, 201, await caseManager.createProject(body));
        return;
      }
      if (caseManager && request.method === 'POST' && url.pathname === '/api/case-library/uploads') {
        if (!trustedLocalOrigin(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readBinaryBody(request);
        sendJson(response, 201, await caseManager.upload({
          fileName: String(request.headers['x-file-name'] || ''),
          contentType: String(request.headers['content-type'] || '').toLowerCase(), body,
        }));
        return;
      }
      const projectExport = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/export$/);
      if (caseManager && request.method === 'GET' && projectExport) {
        const projectId = decodeURIComponent(projectExport[1]);
        const caseIds = url.searchParams.get('case_ids')?.split(',').filter(Boolean).map(decodeURIComponent) || [];
        const pkg = await caseManager.exportPackage(projectId, caseIds);
        const body = Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
        response.writeHead(200, {
          ...securityHeaders('application/json; charset=utf-8'), 'content-length': body.length,
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${projectId}-cases.json`)}`,
        });
        response.end(body);
        return;
      }
      const projectPreview = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/imports\/preview$/);
      if (caseManager && request.method === 'POST' && projectPreview) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        sendJson(response, 201, await caseManager.preview(decodeURIComponent(projectPreview[1]), await readJsonBody(request, 64 * 1024)));
        return;
      }
      const projectConfirm = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/imports\/([^/]+)\/confirm$/);
      if (caseManager && request.method === 'POST' && projectConfirm) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request, 64 * 1024);
        sendJson(response, 200, await caseManager.confirm(decodeURIComponent(projectConfirm[1]), decodeURIComponent(projectConfirm[2]), body.decisions || {}));
        return;
      }
      const projectCase = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/cases\/([^/]+)$/);
      if (caseManager && request.method === 'PATCH' && projectCase) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        sendJson(response, 200, await caseManager.updateCase(decodeURIComponent(projectCase[1]), decodeURIComponent(projectCase[2]), await readJsonBody(request, 64 * 1024)));
        return;
      }
      const projectDetail = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)$/);
      if (caseStore && request.method === 'GET' && projectDetail) {
        const project = await caseStore.getProject(decodeURIComponent(projectDetail[1]));
        sendJson(response, project ? 200 : 404, project || { error: 'CASE_PROJECT_NOT_FOUND' });
        return;
      }
      const projectBuildTasks = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/build-tasks$/);
      if (buildStore && request.method === 'GET' && projectBuildTasks) {
        const projectId = decodeURIComponent(projectBuildTasks[1]);
        const tasks = (await buildStore.listTasks()).filter((task) => task.source?.project_id === projectId);
        sendJson(response, 200, { tasks });
        return;
      }
      const projectExecutionRecords = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/execution-records$/);
      if (buildStore && request.method === 'GET' && projectExecutionRecords) {
        const projectId = decodeURIComponent(projectExecutionRecords[1]);
        const tasks = (await buildStore.listTasks()).filter((task) => task.source?.project_id === projectId);
        const records = tasks.flatMap((task) => (task.candidates || []).flatMap((candidate) => (candidate.trial_runs || []).map((run) => ({
          ...run, project_id: projectId, project_name: task.source.project_name, source_build_task_id: task.task_id,
          candidate_version: candidate.version, candidate_sha256: candidate.sha256,
          files: (task.files || []).filter((file) => run.media_file_ids?.includes(file.file_id)),
        }))));
        sendJson(response, 200, { records: records.sort((left, right) => String(left.started_at).localeCompare(String(right.started_at))) });
        return;
      }
      if (caseManager && request.method === 'PATCH' && projectDetail) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        sendJson(response, 200, await caseManager.updateProject(decodeURIComponent(projectDetail[1]), await readJsonBody(request)));
        return;
      }
      if (buildStore && request.method === 'GET' && url.pathname === '/api/build/tasks') {
        const tasks = await buildStore.listTasks();
        if (buildRevalidationStore) {
          for (const task of tasks) task.revalidations = await buildRevalidationStore.listForTask(task.task_id);
        }
        if (buildAssessmentStore) {
          for (const task of tasks) task.supplemental_assessments = await buildAssessmentStore.listForTask(task.task_id);
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
      const buildMedia = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/media\/([^/]+)$/);
      if (buildStore && request.method === 'GET' && buildMedia) {
        await sendBuildMedia(request, response, buildStore, decodeURIComponent(buildMedia[1]), decodeURIComponent(buildMedia[2]));
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
        if (task && buildAssessmentStore) task.supplemental_assessments = await buildAssessmentStore.listForTask(task.task_id);
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
      if (buildManager && request.method === 'POST' && url.pathname === '/api/build/tasks/from-project-case') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        const keys = Object.keys(body).sort().join(',');
        if (keys !== 'case_id,case_version,content_sha256,environment_id,project_id,request_id') {
          return sendJson(response, 400, { error: 'INVALID_PROJECT_CASE_BUILD_REQUEST' });
        }
        sendJson(response, 201, await buildManager.submitProjectCase(body));
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
      const buildTrialRun = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/trial-runs$/);
      if (buildManager && request.method === 'POST' && buildTrialRun) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).sort().join(',') !== 'candidate_sha256,candidate_version,case_id,case_version,content_sha256,executed_external_id') {
          return sendJson(response, 400, { error: 'INVALID_E2E01_TRIAL_REQUEST' });
        }
        sendJson(response, 202, await buildManager.runProjectCaseTrial(decodeURIComponent(buildTrialRun[1]), body));
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
      if (request.method === 'GET' && await sendCaseTemplate(response, webRoot, url.pathname)) return;
      if (request.method === 'GET' && await sendStatic(response, webRoot, workspaceRoot, url.pathname)) return;
      sendJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message.split(':')[0] });
    }
  });
}

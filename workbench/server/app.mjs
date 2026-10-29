import { withWindowTimeline } from './build/window-timeline.mjs';
import {createModelSettings} from './model-settings.mjs';
import { backendRoute } from './backend-routes.mjs';
import { demonstrationRoute } from './demonstration-routes.mjs';
import { scriptEnvironments } from './build/user-workflow.mjs';
import { projectRecords } from './execution-records.mjs';
import { ExecutionNotes } from './execution-notes.mjs';
import { mediaType } from './build/candidate-trials.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInside, sha256File } from './integrity.mjs';
import { developmentAuthorizations } from './build/development-authorization.mjs';
import { requirementsRoute } from './requirements-routes.mjs';
import { caseAssistantRoute } from './case-assistant/routes.mjs';
import { exportCasesWorkbook } from './cases/design.mjs';
import { importedScriptFile } from './cases/script-package.mjs';
import { frontendHandoffRoute } from './frontend-handoffs.mjs';
import { nativeDshRoute } from './native-dsh/routes.mjs';

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
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' data:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
}

async function sendStatic(response, workspaceRoot, pathname) {
  if(['/', '/index.html'].includes(pathname)){response.writeHead(308,{location:'/workspace/','cache-control':'no-store'});response.end();return true;}
  if(['/app.js','/styles.css'].includes(pathname)){sendJson(response,410,{error:'LEGACY_UI_REMOVED',entry:'/workspace/'});return true;}
  const workspaceFiles = new Map([
    ['/workspace', ['index.html', 'text/html; charset=utf-8']],
    ['/workspace/', ['index.html', 'text/html; charset=utf-8']],
    ['/workspace/demonstration-control.html', ['demonstration-control.html', 'text/html; charset=utf-8']],
    ['/workspace/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/workspace/workflow.js', ['workflow.js', 'text/javascript; charset=utf-8']],
    ['/workspace/execution-media.js', ['execution-media.js', 'text/javascript; charset=utf-8']],
    ['/workspace/api.js', ['api.js', 'text/javascript; charset=utf-8']],
    ['/workspace/model-settings.js', ['model-settings.js', 'text/javascript; charset=utf-8']],
    ['/workspace/case-content-view.js', ['case-content-view.js', 'text/javascript; charset=utf-8']],
    ['/workspace/test-case-template.xlsx', ['test-case-template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
    ['/workspace/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);
  for (const name of ['backend.js','backend-bulk-review.js','backend.css','script-actions.js','reports.js','history.js','product.css','requirements.js','requirements-api.js','requirements.css','execution-list.js','execution-list.css','project-target-access.js','project-setup.js','project-workflow.js','project-workflow.css','project-setup.css','workspace-v2.css','batch-view.js','execution-notes.js','service-restart.js','demonstrations.js','demonstration-control.js','demonstration-control.css']) workspaceFiles.set('/workspace/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
  for (const name of ['case-assistant.js', 'case-assistant-api.js', 'case-assistant.css', 'case-review.js', 'case-review.css']) workspaceFiles.set('/workspace/' + name, [name, name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8']);
  workspaceFiles.set('/workspace/frontend-handoffs.js', ['frontend-handoffs.js', 'text/javascript; charset=utf-8']);
  workspaceFiles.set('/workspace/native-dsh.js', ['native-dsh.js', 'text/javascript; charset=utf-8']);
  workspaceFiles.set('/workspace/native-console-view.js', ['native-console-view.js', 'text/javascript; charset=utf-8']);
  const selected = workspaceFiles.get(pathname);
  if (!selected) return false;
  response.writeHead(200, { ...securityHeaders(selected[1]), ...(pathname === '/workspace/test-case-template.xlsx' ? { 'content-disposition': "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B%E6%A8%A1%E6%9D%BF.xlsx" } : {}) });
  response.end(await fs.readFile(path.join(workspaceRoot, selected[0])));
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
  response.writeHead(200, { ...securityHeaders((task.development && mediaType(item)?.content_type) || item.content_type), 'content-length': stat.size });
  response.end(await fs.readFile(realFile));
}

async function sendBuildMedia(request, response, buildStore, taskId, fileId) {
  const task = await buildStore.getTask(taskId);
  const item = task?.files?.find((file) => file.file_id === fileId);
  if (!item || !(task.development && mediaType(item)) && !/^(?:normal|counterexample)_(?:screenshot|video|caption_video|step_replay_video|trace)$/.test(item.kind || '')) {
    return sendJson(response, 404, { error: 'BUILD_MEDIA_NOT_FOUND' });
  }
  if (task.development && mediaType(item)) return sendRegisteredMedia(request, response, buildStore.taskDirectory(taskId), { ...item, ...mediaType(item) });
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
  if (error.message.startsWith('NATIVE_DSH_')) {
    if (error.message.endsWith('_NOT_AUTHORIZED')) return 403;
    if (error.message.endsWith('_NOT_FOUND')) return 404;
    if (/_BUSY$|_CONFLICT$|_CHANGED$/.test(error.message)) return 409;
    if (/_UNAVAILABLE$|_STOPPING$/.test(error.message)) return 503;
    return 400;
  }
  if (error.message.startsWith('CASE_ASSISTANT_')) {
    if (/_NOT_FOUND$/.test(error.message)) return 404;
    if (/_CONFLICT$|_BUSY$/.test(error.message)) return 409;
    if (/_UNAVAILABLE$|_STOPPING$/.test(error.message)) return 503;
    return 400;
  }
  if(error.message.startsWith('EXECUTION_NOTE_'))return error.message.endsWith('_NOT_FOUND')?404:error.message.endsWith('_CONFLICT')?409:error.message==='EXECUTION_NOTE_STORAGE_ERROR'?503:400;
  if (error.message.startsWith('PROJECT_ENVIRONMENT_')) return /BUSY|CONFLICT|CONFIGURATION_CHANGED/.test(error.message) ? 409 : 422;
  if (error.message.startsWith('REQUIREMENT_')) {
    if (/_NOT_FOUND$/.test(error.message)) return 404;
    if (/_CONFLICT$|_BUSY$|_IN_PROGRESS$/.test(error.message)) return 409;
    if (/_UNAVAILABLE$|_NOT_ACCEPTING$/.test(error.message)) return 503;
    return 400;
  }
  if (['WORKBENCH_SHUTTING_DOWN','WORKBENCH_STORAGE_UNAVAILABLE'].includes(error.message)) return 503;
  if (['WORKBENCH_BUSY','BATCH_EXECUTOR_BUSY','GENERATION_EXECUTOR_BUSY'].includes(error.message)) return 409;
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
  if (error.message === 'AUTH_SESSION_NOT_VALID') return 409;
  if (error.message === 'AUTH_SESSION_REQUIRED') return 409;
  if (error.message.startsWith('AUTH01_')) return 409;
  if (error.message === 'AUTH_BUILD_UNAVAILABLE') return 503;
  if (error.message === 'AUTH_BROWSER_EXECUTABLE_REQUIRED') return 503;
  if (error.message.startsWith('AUTH_')) return 400;
  return 422;
}

export function createWorkbenchServer(options = {}) {
  const serviceState = options.serviceState || { accepting: true };
  const serviceIdentity = options.serviceIdentity || null;
  const serviceRestart = options.serviceRestart || null;
  const batchManager=options.batchManager;
  const {scriptOperations, reportSnapshots} = options;
  const demonstrations = options.demonstrations;
  const requirementsManager = options.requirementsManager;
  const caseAssistantManager = options.caseAssistantManager;
  const backendManager = options.backendManager;
  const {projectEnvironments, projectTargetAccess, projectTrialAuthorization} = options;
  const store = options.store;
  const manager = options.manager;
  const buildStore = options.buildStore;
  const buildManager = options.buildManager;
  const buildRevalidationStore = options.buildRevalidationStore;
  const buildAssessmentStore = options.buildAssessmentStore;
  const caseStore = options.caseStore;
  const caseManager = options.caseManager;
  const authSessions = options.authSessions;
  const executionNotes=options.executionNotes || (caseStore?.root ? new ExecutionNotes({root:path.join(caseStore.root,'execution-notes'),getRecords:projectId=>projectRecords({buildStore,caseStore,store,buildManager},projectId)}) : null);
  const webRoot = options.webRoot || defaultWebRoot;
  const workspaceRoot = options.workspaceRoot || defaultWorkspaceRoot;
  const modelSettings=options.modelSettings||createModelSettings({busy:()=>serviceState.inFlightMutations>1||Object.values({manager,buildManager,batchManager,scriptOperations,demonstrations,requirementsManager,caseAssistantManager,backendManager,...(options.nativeDshManager?{nativeDsh:options.nativeDshManager}:{})}).some(m=>m&&(m.active||m.starting||m.generationOwner||m.generationStarting||m.generationBatchActive||m.storageFault))});
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const mutation = !['GET','HEAD','OPTIONS'].includes(request.method);
      const stopping = /\/(?:stop|cancel)$/.test(url.pathname);
      if (mutation && serviceState.accepting === false) return sendJson(response,503,{error:'WORKBENCH_SHUTTING_DOWN'});
      if (mutation) {
        serviceState.inFlightMutations = (serviceState.inFlightMutations || 0) + 1;
        let released = false;
        const release = () => { if (!released) { released = true; serviceState.inFlightMutations--; } };
        response.once?.('finish',release);
        response.once?.('close',release);
      }
      if(url.pathname==='/api/model-settings') {
        if(!/^(127\.0\.0\.1|localhost):4322$/.test(request.headers.host||''))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
        try {
          if(request.method==='GET')return sendJson(response,200,{...await modelSettings.status(),enabled:buildManager?.generationDisabled===false,
            activation_available:serviceRestart?.canActivateModel?.()===true,restart_available:serviceRestart?.available()===true});
          if(request.method!=='POST'||!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
          return sendJson(response,200,await modelSettings.save(await readJsonBody(request,8192)));
        } catch(error){const code=/^MODEL_(?:KEY|SETTINGS)_[A-Z_]+$/.test(error.message)?error.message:'MODEL_SETTINGS_UNAVAILABLE';return sendJson(response,code.endsWith('BUSY')||code.endsWith('EXISTS')?409:400,{error:code});}
      }
      const modelActivation=url.pathname==='/api/model-settings/activate';
      if (request.method === 'POST' && (url.pathname === '/api/service/restart'||modelActivation)) {
        if (!trustedMutation(request)) return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
        const body = await readJsonBody(request);
        if (Object.keys(body).length !== 1 || typeof body.service_instance_id !== 'string') return sendJson(response,400,{error:'INVALID_RESTART_REQUEST'});
        if(modelActivation&&!(await modelSettings.status()).configured)return sendJson(response,400,{error:'MODEL_CREDENTIAL_NOT_SAVED'});
        const result = serviceRestart ? await serviceRestart.request(body.service_instance_id,modelActivation?{mode:'enable-model'}:undefined) : {status:503,error:'SERVICE_RESTART_UNMANAGED'};
        if (result.beginDrain) {
          let began = false;
          const begin = () => { if (!began) { began = true; result.beginDrain(); } };
          response.once('finish',begin);
          response.once('close',begin);
        }
        return sendJson(response,result.status,result.value || {error:result.error});
      }
      if (mutation && !stopping && (buildManager?.storageFault || manager?.storageFault || backendManager?.storageFault)) return sendJson(response,503,{error:'BUILD_STORAGE_UNAVAILABLE'});
      if (mutation && !stopping && (options.nativeDshManager?.active || options.nativeDshManager?.starting) && !url.pathname.includes('/native-dsh/')) return sendJson(response,409,{error:'NATIVE_DSH_BUSY'});
      if((buildManager?.generationOwner||buildManager?.generationStarting) && !stopping && request.method==='POST' && (url.pathname==='/api/candidate-trials'||url.pathname==='/api/runs'||url.pathname.startsWith('/api/build/tasks')))return sendJson(response,409,{error:'GENERATION_EXECUTOR_BUSY'});
      if((batchManager?.active||batchManager?.starting)&&!stopping&&request.method==='POST'&&(url.pathname==='/api/runs'||url.pathname.startsWith('/api/build/tasks')))return sendJson(response,409,{error:'BATCH_EXECUTOR_BUSY'});
      if (buildManager?.generationDisabled && request.method === 'POST' && (url.pathname === '/api/build/tasks' || /\/api\/build\/tasks\/(develop|[^/]+\/(start|revise|revision))$/.test(url.pathname))) return sendJson(response, 403, { error: 'MODEL_GENERATION_DISABLED_IN_TRIAL_PROFILE' });
      if (request.method === 'GET' && url.pathname === '/api/health') {
        let budget = null, authorization = null;
        try { budget = buildStore ? await buildStore.getBudget() : null;
          authorization = buildStore?.getRevalidationAuthorization ? await buildStore.getRevalidationAuthorization() : null;
        } catch (error) { buildManager?.reportStorageFault?.(error,'health_storage_read'); }
        const buildDiagnostics = buildManager?.diagnostics?.() || null;
        sendJson(response, 200, {
          service: 'approved-test-workbench', status: serviceState.accepting === false ? 'stopping' : (buildDiagnostics?.storage_status === 'FAILED'||manager?.storageFault||backendManager?.storageFault) ? 'degraded' : 'ready',
          service_identity: serviceIdentity,
          restart: {managed:serviceRestart?.isManaged() === true,available:serviceRestart?.available() === true},
          accepting: serviceState.accepting !== false && !buildManager?.storageFault && !manager?.storageFault && !backendManager?.storageFault,
          preparing: Boolean(manager?.starting || buildManager?.starting || batchManager?.starting || scriptOperations?.starting || requirementsManager?.starting || demonstrations?.starting),
          active_demonstration_id: demonstrations?.active?.recording?.demonstration_id || demonstrations?.active?.demonstration_id || null,
          active_run_id: manager?.active?.runId || buildManager?.active?.runId || null,
          active_build_task_id: buildManager?.active?.taskId || null,
          active_batch_id: batchManager?.active?.id || null,
          active_script_operation_id: scriptOperations?.active?.operation.operation_id || null,
          requirements: requirementsManager?.diagnostics?.() || null,
          case_assistant: caseAssistantManager?.diagnostics?.() || null,
          native_dsh: options.nativeDshManager?.diagnostics?.() || null,
          backend: backendManager?.active ? {kind:backendManager.active.kind,plan_id:backendManager.active.plan_id,run_id:backendManager.active.run_id} : null,
          active_backend_generation_batch_id: backendManager?.generationBatchActive?.batch?.batch_id || null,
          build_budget: budget,
          build_authorization: authorization,
          build_diagnostics: buildDiagnostics,
          run_storage_error: manager?.storageFault || null,
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
      const projectAuth = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/auth(?:\/(open|focus|check|clear))?$/);
      if (authSessions && caseStore && projectAuth) {
        const projectId = decodeURIComponent(projectAuth[1]);
        if (!await caseStore.getProject(projectId)) return sendJson(response, 404, { error: 'CASE_PROJECT_NOT_FOUND' });
        if (request.method === 'GET' && !projectAuth[2]) {
          const environmentId = url.searchParams.get('environment_id');
          const role = url.searchParams.get('role');
          const binding = await projectEnvironments?.binding(projectId);
          return sendJson(response, 200, {
            environments: authSessions.list(projectId).filter(item => !projectEnvironments || (item.environment_id || item.id) === binding?.ui_environment_id),
            session: environmentId && role && (!projectEnvironments || environmentId === binding?.ui_environment_id) ? authSessions.status({ project_id: projectId, environment_id: environmentId, role }) : null,
          });
        }
        if (request.method === 'POST' && projectAuth[2]) {
          if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
          const body = await readJsonBody(request);
          const scope = { project_id: projectId, environment_id: body.environment_id, role: body.role };
          if (projectAuth[2] !== 'clear') await projectEnvironments?.assert(projectId, 'ui', body.environment_id);
          authSessions.environment(scope);
          const result = ['open','focus'].includes(projectAuth[2]) ? await authSessions.open(scope, { reuseExisting: projectAuth[2] === 'focus' })
            : projectAuth[2] === 'check' ? await authSessions.check(scope, { confirmLogin: body.confirm_login === true }) : await authSessions.clear(scope);
          return sendJson(response, 200, result);
        }
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
      if (await backendRoute({request,response,url,manager:backendManager,sendJson,readJsonBody,trustedMutation})) return;
      if (await demonstrationRoute({request,response,url,demonstrations,sendJson,readJsonBody,trustedMutation})) return;
      if (await requirementsRoute({request,response,url,manager:requirementsManager,sendJson,readJsonBody,readBinaryBody,trustedMutation,trustedLocalOrigin})) return;
      if (await caseAssistantRoute({request,response,url,manager:caseAssistantManager,sendJson,readJsonBody,trustedMutation})) return;
      if (await frontendHandoffRoute({request,response,url,manager:options.frontendHandoffs,sendJson,readJsonBody,trustedMutation})) return;
      if (await nativeDshRoute({request,response,url,manager:options.nativeDshManager,sendJson,readJsonBody,trustedMutation,trustedLocalOrigin,sendRegisteredMedia})) return;
      const targetRoute = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/(targets|trial-authorizations)$/);
      const projectEnvironmentRoute = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/environment$/);
      if (projectEnvironmentRoute && projectEnvironments) {
        const projectId = decodeURIComponent(projectEnvironmentRoute[1]);
        if (request.method === 'GET') return sendJson(response,200,await projectEnvironments.describe(projectId));
        if (request.method === 'POST') {
          if (!trustedMutation(request)) return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
          return sendJson(response,200,await projectEnvironments.set(projectId,await readJsonBody(request)));
        }
        return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'});
      }
      if (targetRoute) {
        const projectId = decodeURIComponent(targetRoute[1]);
        if (!await caseStore?.getProject(projectId)) return sendJson(response,404,{error:'CASE_PROJECT_NOT_FOUND'});
        const targetManager = targetRoute[2] === 'targets' ? projectTargetAccess : projectTrialAuthorization;
        if (!targetManager) return sendJson(response,503,{error:'PROJECT_TARGET_ACCESS_UNAVAILABLE'});
        if (request.method === 'GET') return sendJson(response,200,await targetManager.list(projectId));
        if (request.method === 'POST') {
          if (!trustedMutation(request)) return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
          const body = await readJsonBody(request);
          return sendJson(response,201,targetRoute[2] === 'targets'
            ? await projectTargetAccess.register(projectId,body)
            : await projectTrialAuthorization.authorize(projectId,body));
        }
        return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'});
      }
      const importedSource = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/imported-scripts\/([^/]+)\/(\d+)\/(imported-script-[a-f0-9]{64})\/files\/(manifest|\d+)$/);
      if (caseStore && request.method === 'GET' && importedSource) {
        const [,projectId,caseId,version,id,fileId] = importedSource;
        const project = await caseStore.getProject(decodeURIComponent(projectId));
        if (!project) throw Error('CASE_PROJECT_NOT_FOUND');
        const file = importedScriptFile(project,decodeURIComponent(caseId),version,id,fileId);
        response.writeHead(200,{...securityHeaders('text/plain; charset=utf-8'),'content-length':file.body.length,
          'content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`});
        response.end(file.body); return;
      }
      if (caseManager && request.method === 'GET' && projectExport) {
        const projectId = decodeURIComponent(projectExport[1]);
        const caseIds = url.searchParams.get('case_ids')?.split(',').filter(Boolean).map(decodeURIComponent) || [];
        const caseType = url.searchParams.get('case_type');
        const format = url.searchParams.get('format') || 'json';
        if (!['json','xlsx'].includes(format)) throw Error('CASE_EXPORT_FORMAT_INVALID');
        const pkg = await caseManager.exportPackage(projectId, caseIds, caseType);
        if (requirementsManager) for (const item of pkg.cases) {
          if (item.content.case_type !== 'BACKEND') continue;
          const id = item.lineage.at(-1).case_id;
          const { bindings } = await requirementsManager.getBindings(projectId, id);
          const binding = bindings.filter(b => b.case_version === item.source_version && b.applicability === 'CURRENT_CASE_VERSION').at(-1);
          item.protocol_binding = binding || null;
          item.automation_readiness = !binding ? '待协议绑定' : binding.status === 'CONFLICT' ? '协议业务冲突，待复核' :
            binding.status !== 'COMPLETE' ? '协议部分绑定' : binding.confirmation_status !== 'CONFIRMED' ? '技术映射待确认' : '技术绑定已确认；执行器、环境与脚本待准备';
        }
        const body = format === 'xlsx' ? await exportCasesWorkbook(pkg) : Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
        const fileName = `${caseType === 'UI' ? '前端测试用例' : caseType === 'BACKEND' ? '后端测试用例' : projectId + '-cases'}.${format}`;
        response.writeHead(200, {
          ...securityHeaders(format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json; charset=utf-8'), 'content-length': body.length,
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
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
      const projectContentConfirm = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/cases\/confirm-content$/);
      if (caseManager && request.method === 'POST' && projectContentConfirm) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        sendJson(response, 200, await caseManager.confirmContents(decodeURIComponent(projectContentConfirm[1]), await readJsonBody(request, 64 * 1024)));
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

      const productRoute=url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/(script-operations|reports)(?:\/([^/]+)(?:\/(start|stop|html))?)?$/);
      if(productRoute){
        const [,rawProject,kind,rawId,action]=productRoute,projectId=decodeURIComponent(rawProject),id=rawId&&decodeURIComponent(rawId);
        if(!await caseStore?.getProject(projectId))return sendJson(response,404,{error:'CASE_PROJECT_NOT_FOUND'});
        if(kind==='reports'&&reportSnapshots){
          if(request.method==='GET'){
            if(!id)return sendJson(response,200,{reports:await reportSnapshots.list(projectId)});
            if(id==='latest-preview'&&!action)return sendJson(response,200,await reportSnapshots.latestPreview(projectId,url.searchParams.get('group_key')||'all'));
            const snapshot=await reportSnapshots.get(id,projectId);
            if(action==='html'){
              response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':url.searchParams.has('download')?`attachment; filename="${snapshot.report_id}.html"`:'inline'});
              return response.end(await reportSnapshots.html(snapshot.report_id,projectId));
            }
            return sendJson(response,200,snapshot);
          }
          if(request.method==='POST'&&!id){if(!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});return sendJson(response,201,await reportSnapshots.create(projectId,await readJsonBody(request)));}
          if(request.method==='POST'&&id==='cancel'){if(!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});return sendJson(response,200,await reportSnapshots.cancel(projectId,await readJsonBody(request)));}
        }
        if(kind==='script-operations'&&scriptOperations){
          if(request.method==='GET')return sendJson(response,200,id?await scriptOperations.get(id,projectId):{operations:await scriptOperations.list(projectId)});
          if(request.method==='POST'){
            if(!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
            const body=await readJsonBody(request,256*1024);
            if(id==='preflight')return sendJson(response,200,await scriptOperations.preflight(projectId,body));
            if(!id)return sendJson(response,202,await scriptOperations.start(projectId,body));
            if(action==='stop')return sendJson(response,200,await scriptOperations.stop(id,projectId));
          }
        }
        return sendJson(response,404,{error:'PRODUCT_OPERATION_NOT_FOUND'});
      }
      if(request.method==='GET'&&url.pathname==='/api/script-environments')return sendJson(response,200,await scriptEnvironments(buildManager,url.searchParams.get('project_id')));
      const batches=url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/batches(?:\/([^/]+)(?:\/(start|stop))?)?$/);
      if(batchManager&&batches){
        const [projectId,id,action]=batches.slice(1).map(v=>v&&decodeURIComponent(v));
        if(request.method==='GET'){sendJson(response,200,id?await batchManager.get(id,projectId):{batches:await batchManager.list(projectId)});return;}
        if(request.method==='POST'){
          if(!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
          const body=await readJsonBody(request);
          const value=id==='preflight'&&!action?await batchManager.preview({...body,project_id:projectId},{persist:false}):!id?await batchManager.preview({...body,project_id:projectId}):action==='start'?await batchManager.start(id,projectId,body):action==='stop'?await batchManager.stop(id,projectId):null;
          if(!value)throw Error('BATCH_REQUEST_INVALID');sendJson(response,200,value);return;
        }
      }
      const automation = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/cases\/([^/]+)\/automation$/);
      if (buildManager && request.method === 'GET' && automation) {
        const pid=decodeURIComponent(automation[1]),cid=decodeURIComponent(automation[2]),v=Number(url.searchParams.get("version"));
        const project=await caseStore.getProject(pid);const item=project?.cases.find(c=>c.case_id===cid);
        sendJson(response,200,backendManager&&item?.versions.find(x=>x.version===v)?.content.case_type==="BACKEND" ? await backendManager.automation(pid,cid,v) : await buildManager.caseAutomation(pid,cid,v)); return;
      }
      if (buildManager && request.method === 'POST' && url.pathname === '/api/candidate-trials') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body=await readJsonBody(request);if(body.batch_id||body.batch_token)throw Error('BATCH_INTERNAL_FIELDS_FORBIDDEN');
        sendJson(response, 202, await buildManager.startCandidateTrial(body)); return;
      }
      const trialStop = url.pathname.match(/^\/api\/candidate-trials\/([^/]+)\/stop$/);
      if (buildManager && request.method === 'POST' && trialStop) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        sendJson(response, 202, await buildManager.stopCandidateTrial(decodeURIComponent(trialStop[1]))); return;
      }
      const projectExecutionRecords = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/execution-records$/);
      const executionNoteRoute=url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/execution-records\/([^/]+)\/notes$/);
      if(executionNotes && executionNoteRoute && ['GET','POST'].includes(request.method)){
        const projectId=decodeURIComponent(executionNoteRoute[1]),runId=decodeURIComponent(executionNoteRoute[2]);
        if(request.method==='POST'){
          if(!trustedMutation(request))return sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});
          return sendJson(response,201,await executionNotes.append(projectId,runId,await readJsonBody(request,32*1024)));
        }
        return sendJson(response,200,await executionNotes.list(projectId,runId));
      }
      if (buildStore && request.method === 'GET' && projectExecutionRecords) {
        sendJson(response, 200, { records: await projectRecords({buildStore,caseStore,store,buildManager}, decodeURIComponent(projectExecutionRecords[1])) });
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
      if (buildManager && request.method === 'POST' && url.pathname === '/api/build/tasks/develop') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).join(',') !== 'logical_id' || typeof body.logical_id !== 'string') return sendJson(response, 400, { error: 'INVALID_DEVELOPMENT_REQUEST' });
        sendJson(response, 201, await buildManager.submitDevelopment(body));
        return;
      }
      if (buildStore && request.method === 'GET' && url.pathname === '/api/build/development-authorizations') {
        sendJson(response, 200, { authorizations: await developmentAuthorizations(buildStore) });
        return;
      }
      if (buildManager && request.method === 'POST' && url.pathname === '/api/build/tasks/from-project-case') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        const keys = Object.keys(body).sort().join(',');
        if (keys !== 'case_id,case_version,content_sha256,environment_id,project_id,request_id' &&
            keys !== 'auth_role,case_id,case_version,content_sha256,environment_id,project_id,request_id') {
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
      const buildAuthTrialRun = url.pathname.match(/^\/api\/build\/tasks\/([^/]+)\/auth-trial-runs$/);
      if (buildManager && request.method === 'POST' && buildAuthTrialRun) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).sort().join(',') !== 'candidate_sha256,candidate_version') {
          return sendJson(response, 400, { error: 'INVALID_AUTH01_TRIAL_REQUEST' });
        }
        sendJson(response, 202, await buildManager.runAuthTrial(decodeURIComponent(buildAuthTrialRun[1]), body));
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
        const run = await withWindowTimeline(await store.getRun(decodeURIComponent(url.pathname.slice('/api/runs/'.length))), store);
        sendJson(response, run ? 200 : 404, run || { error: 'RUN_NOT_FOUND' });
        return;
      }
      if (manager && request.method === 'POST' && url.pathname === '/api/runs') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        if (buildManager?.active || buildManager?.starting || batchManager?.starting || scriptOperations?.starting) return sendJson(response, 409, { error: 'WORKBENCH_BUSY' });
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
      if (request.method === 'GET' && await sendStatic(response, workspaceRoot, url.pathname)) return;
      sendJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message.split(':')[0] });
    }
  });
}

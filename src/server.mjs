import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Store } from './store.mjs';
import { DeepSeek } from './deepseek.mjs';
import { CredentialStore } from './credential-store.mjs';
import { BrowserSession } from './browser.mjs';
import { Controller } from './controller.mjs';
import { importCases } from './importer.mjs';
import { report, mediaBytes, labels } from './report.mjs';
import { startDemo, demoCases } from './demo.mjs';
import { fail, publicError, uid, hash, nonempty, targetURL, keys } from './common.mjs';
import { readBuildInfo, dataDirectoryId } from './build-info.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_BUILD = Object.freeze(await readBuildInfo(ROOT));

export async function start({
  port = 4179,
  dataDir = path.join(ROOT, 'data', 'v02'),
  headless = false,
  experienceMode = process.env.UI_AGENT_EXPERIENCE ?? 'observe',
  runtimeBinding = process.env.UI_AGENT_RUNTIME_BINDING ?? 'off',
  planningMode = process.env.UI_AGENT_PLANNING ?? 'adaptive',
  provider = new DeepSeek(),
  credentialStore,
} = {}) {
  if (!['off', 'observe', 'assist'].includes(experienceMode)) fail('EXPERIENCE_MODE_INVALID');
  if (!['off', 'readonly'].includes(runtimeBinding)) fail('RUNTIME_BINDING_CONFIG_INVALID');
  if ((await readBuildInfo(ROOT)).build_id !== RUNTIME_BUILD.build_id)
    fail('BUILD_SOURCE_CHANGED', 409);
  const store = new Store(dataDir);
  store.build = RUNTIME_BUILD;
  await store.init();
  await store.acquireLock();
  const credentials = credentialStore ?? new CredentialStore(store.root);
  try {
    if (provider instanceof DeepSeek && provider.baseURL === 'https://api.deepseek.com') {
      const restored = await credentials.load();
      if (restored && !provider.configured()) provider.configure(restored);
    }
    await store.recoverInterrupted();
  } catch (error) {
    await store.releaseLock();
    throw error;
  }
  const browser = new BrowserSession({ headless }),
    controller = new Controller({
      store,
      provider,
      browser,
      planningMode,
      experienceMode,
      runtimeBinding: runtimeBinding === 'readonly',
    });
  const csrf = uid();
  const instance = {
    id: uid(),
    started_at: new Date().toISOString(),
    data_directory_id: dataDirectoryId(dataDir),
    writer_lock_id: store.writerLock.id,
  };
  let origin,
    demo,
    closing = false,
    closePromise;
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      if (closing) fail('SERVER_CLOSING', 503);
      if (req.headers.host !== new URL(origin).host) fail('HOST_REJECTED', 403);
      if (req.headers.origin && req.headers.origin !== origin) fail('ORIGIN_REJECTED', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') fail('ORIGIN_REJECTED', 403);
      const url = new URL(req.url, origin);
      let body;
      if (req.method === 'POST') {
        if (req.headers['x-csrf-token'] !== csrf) fail('CSRF_REJECTED', 403);
        if (!String(req.headers['content-type']).startsWith('application/json'))
          fail('JSON_REQUIRED', 415);
        body = await readJSON(req);
      } else if (req.method !== 'GET') fail('METHOD_NOT_ALLOWED', 405);
      const p = url.pathname;
      if (p === '/api/config' && req.method === 'GET')
        return json(res, 200, {
          application: 'ui-test-agent',
          version: RUNTIME_BUILD.version,
          build_id: RUNTIME_BUILD.build_id,
          instance,
          console_protocol: 'ui-agent-console/v1',
          plan_protocol: 'ui-agent-plan/v2',
          supported_plan_protocols: [
            'ui-agent-plan/v2',
            'ui-agent-plan/v3',
            'ui-agent-adaptive-plan/v1',
            ...(controller.runtimeBinding ? ['ui-agent-intent-plan/v1'] : []),
          ],
          runtime_binding: controller.runtimeBinding,
          direct_testing: controller.planningMode === 'adaptive',
          diagnostic_logging: true,
          auto_discovery: true,
          autonomous_preparation: true,
          login_recovery: true,
          plan_revision: true,
          preparation_controls: true,
          case_advice: true,
          plan_revalidation: true,
          plan_self_repair: true,
          input_quality_review: true,
          planning_mode: controller.planningMode,
          ui_experience_mode: controller.experience.mode,
          configured: provider.configured(),
          credential_storage: {
            ...credentials.status(),
            supported: credentials.supported && !!provider.configureRemembered,
          },
          model: provider.model,
          base_url: provider.baseURL,
          labels,
          active: controller.active
            ? { task_id: controller.active.id, kind: controller.active.kind }
            : null,
        });
      if (p === '/api/config' && req.method === 'POST') {
        controller.idle();
        keys(body, ['key', 'model', 'remember']);
        const operation = {};
        operation.finished = new Promise((resolve) => {
          operation.resolve = resolve;
        });
        controller.preparing = operation;
        try {
          if (body.remember === true && !provider.configureRemembered)
            fail('CREDENTIAL_STORAGE_UNSUPPORTED');
          return json(
            res,
            200,
            provider.configureRemembered
              ? await provider.configureRemembered(body, credentials)
              : provider.configure({ key: body.key, model: body.model }),
          );
        } finally {
          controller.preparing = null;
          operation.resolve();
        }
      }
      if (p === '/api/connection-test' && req.method === 'POST') {
        controller.idle();
        return json(res, 200, await provider.test());
      }
      if (p === '/api/shutdown' && req.method === 'POST') {
        keys(body, ['instance_id'], ['instance_id']);
        if (body.instance_id !== instance.id) fail('INSTANCE_CHANGED', 409);
        json(res, 202, { status: 'STOPPING', instance_id: instance.id });
        setImmediate(() => {
          close().catch(() => {
            process.stderr.write('SERVER_SHUTDOWN_FAILED\n');
          });
        });
        return;
      }
      if (p === '/api/tasks' && req.method === 'GET') return json(res, 200, await store.list());
      if (p === '/api/tasks' && req.method === 'POST') {
        controller.idle();
        keys(
          body,
          ['name', 'target', 'filename', 'data_base64', 'sheet', 'nonproduction', 'writes'],
          ['name', 'target', 'filename', 'data_base64', 'nonproduction', 'writes'],
        );
        if (
          !nonempty(body.name) ||
          body.name.length > 100 ||
          !nonempty(body.filename) ||
          body.filename.length > 200 ||
          typeof body.data_base64 !== 'string' ||
          typeof body.nonproduction !== 'boolean' ||
          typeof body.writes !== 'boolean'
        )
          fail('TASK_INPUT_INVALID');
        const target = targetURL(body.target).href;
        if (new URL(target).origin === origin) fail('CONSOLE_IS_NOT_A_TEST_TARGET');
        const bytes = Buffer.from(body.data_base64, 'base64');
        const baseline = await importCases(body.filename, bytes, body.sheet);
        const id = await store.create({
          name: body.name,
          target,
          baseline,
          filename: path.basename(body.filename),
          sourceBytes: bytes,
        });
        await controller.prepareImport(id);
        await controller.configure(id, {
          nonproduction: body.nonproduction,
          writes: body.writes,
          readOnlyEndpoints: [],
        });
        return json(res, 201, { id });
      }
      if (p === '/api/demo' && req.method === 'POST') {
        controller.idle();
        demo ??= await startDemo();
        const { baseline, plans } = demoCases();
        const id = await store.create({
          name: '跨业务演示 · 商品 + 任务',
          target: demo.url + '/catalog',
          baseline,
          filename: 'synthetic.json',
        });
        await store.update(id, (s) => {
          s.fixture = true;
          s.authorization = { nonproduction: true, writes: true, readOnlyEndpoints: [] };
          for (const [i, c] of s.cases.entries()) {
            c.reviewed = true;
            c.plan = plans[i];
            c.status = 'PLAN_REVIEW';
          }
          store.event(s, 'FIXTURE_CREATED', {
            message: '预制合成用例与计划，无模型调用；运行前请核对计划。',
          });
        });
        return json(res, 201, { id });
      }
      const match = p.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(.*))?$/);
      if (match) {
        const [, id, action = ''] = match;
        if (!action && req.method === 'GET') return json(res, 200, await controller.view(id));
        if (req.method === 'GET') {
          if (action === 'diagnostics') return json(res, 200, await controller.diagnostics(id));
          if (action === 'baseline') {
            await store.read(id);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Disposition': 'attachment; filename="case-import.json"',
            });
            return res.end(await fs.readFile(path.join(store.dir(id), 'baseline.json')));
          }
          if (action === 'report') {
            const content = await report(store, id, { allScopes: true });
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': 'attachment; filename="ui-test-report.html"',
            });
            return res.end(content);
          }
          const m = action.match(/^media\/([a-f0-9-]{36})\/([^/]+)$/);
          if (m) {
            const bytes = await mediaBytes(store, id, m[1], decodeURIComponent(m[2]));
            res.writeHead(200, {
              'Content-Type': m[2].endsWith('.webm') ? 'video/webm' : 'image/png',
            });
            return res.end(bytes);
          }
          if (action === 'facts') {
            const s = await store.read(id);
            const all = [];
            for (const r of s.cases) for (const a of r.attempts) all.push(await store.facts(id, a));
            return json(res, 200, all);
          }
        } else {
          let result;
          switch (action) {
            case 'authorization':
              result = await controller.configure(id, body);
              break;
            case 'browser':
              result = await controller.openBrowser(id);
              break;
            case 'close-browser':
              controller.idle();
              if (browser.taskId === id) await browser.close();
              break;
            case 'capture':
              result = await controller.capture(id);
              break;
            case 'authenticate':
              keys(body, ['marker', 'case_ids'], ['marker']);
              await controller.authenticate(id, body.marker);
              result = await controller.discoverAfterAuthentication(id, body.case_ids);
              break;
            case 'login-evidence':
              keys(body, [], []);
              result = await controller.loginEvidence(id);
              break;
            case 'login-confirmation':
              keys(body, ['token', 'marker_index', 'case_ids'], ['token', 'marker_index']);
              result = await controller.confirmLogin(id, body.token, body.marker_index);
              if (!result.preparation_resumed)
                result = await controller.discoverAfterAuthentication(id, body.case_ids);
              break;
            case 'handoff':
              result = await controller.handoff(id, body);
              break;
            case 'discovery-contract':
              result = await controller.discoveryContract(id, body);
              break;
            case 'confirm':
              keys(
                body,
                [
                  'case_id',
                  'steps',
                  'note',
                  'data_overrides',
                  'page_entry_url',
                  'advice_id',
                  'expected_case_hash',
                ],
                ['case_id', 'steps'],
              );
              result = await controller.confirmCase(id, body.case_id, {
                steps: body.steps,
                note: body.note,
                ...(body.advice_id
                  ? { advice_id: body.advice_id, expected_case_hash: body.expected_case_hash }
                  : {}),
                ...(Object.hasOwn(body, 'page_entry_url')
                  ? { page_entry_url: body.page_entry_url }
                  : {}),
                ...(body.data_overrides !== undefined
                  ? { data_overrides: body.data_overrides }
                  : {}),
              });
              break;
            case 'approve':
              keys(body, ['case_id', 'plan_hash'], ['case_id', 'plan_hash']);
              result = await controller.approvePlan(id, body.case_id, body.plan_hash);
              break;
            case 'reject-case-advice':
              keys(body, ['case_id', 'advice_id'], ['case_id', 'advice_id']);
              result = await controller.rejectCaseAdvice(id, body.case_id, body.advice_id);
              break;
            case 'revalidate-plan':
              keys(body, ['case_id'], ['case_id']);
              result = await controller.revalidatePlan(id, body.case_id);
              break;
            case 'revise-plan':
              keys(body, ['case_id', 'feedback'], ['case_id', 'feedback']);
              result = await controller.requestPlanRevision(id, body.case_id, {
                feedback: body.feedback,
              });
              break;
            case 'job':
              keys(body, ['kind', 'case_ids', 'options'], ['kind', 'case_ids']);
              result = await controller.launch(id, body.kind, body.case_ids, body.options ?? {});
              break;
            case 'stop':
              result = await controller.stop(id);
              break;
            case 'recovered':
              keys(body, ['case_id', 'note'], ['case_id', 'note']);
              result = await controller.recovered(id, body.case_id, body.note);
              break;
            default:
              fail('NOT_FOUND', 404);
          }
          return json(res, 200, result ?? { ok: true });
        }
      }
      if (
        req.method === 'GET' &&
        ['/', '/app.js', '/evidence-view.js', '/evidence.css', '/styles.css'].includes(p)
      ) {
        const filename = p === '/' ? 'index.html' : p.slice(1);
        let contents = await fs.readFile(path.join(ROOT, 'public', filename));
        if (p === '/') contents = Buffer.from(contents.toString().replace('__CSRF__', csrf));
        res.writeHead(200, {
          'Content-Type': filename.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : filename.endsWith('.js')
              ? 'text/javascript; charset=utf-8'
              : 'text/css; charset=utf-8',
        });
        return res.end(contents);
      }
      fail('NOT_FOUND', 404);
    } catch (e) {
      json(res, e.status ?? 500, { error: publicError(e) });
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    await store.releaseLock();
    throw error;
  }
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    url: origin,
    csrf,
    store,
    controller,
    provider,
    browser,
    get demo() {
      return demo;
    },
    close,
  };
  function close() {
    if (closePromise) return closePromise;
    closing = true;
    const listenerClosed = new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    closePromise = (async () => {
      const job = controller.active;
      if (job) {
        job.abort.abort();
        await job.finished;
      }
      if (controller.preparing) await controller.preparing.finished;
      if (controller.loginOperation) await controller.loginOperation.finished;
      const results = await Promise.allSettled([
        browser.close(),
        demo?.close(),
        provider.close?.(),
      ]);
      await listenerClosed;
      await store.releaseLock();
      const rejected = results.find((r) => r.status === 'rejected');
      if (rejected) throw rejected.reason;
    })();
    return closePromise;
  }
}
async function readJSON(req) {
  let size = 0;
  const parts = [];
  for await (const b of req) {
    size += b.length;
    if (size > 18 * 1024 * 1024) fail('UPLOAD_TOO_LARGE', 413);
    parts.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString());
  } catch {
    fail('INVALID_JSON');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = await start({
    port: Number(process.env.UI_AGENT_PORT ?? 4179),
    dataDir: process.env.UI_AGENT_DATA_DIR || path.join(ROOT, 'data', 'v02'),
  });
  process.stdout.write(
    `UI Test Agent: ${app.url}\nDeepSeek: ${app.provider.configured() ? 'configured' : 'configure in console'}\n`,
  );
  for (const sig of ['SIGINT', 'SIGTERM'])
    process.on(sig, async () => {
      await app.close();
      process.exit(0);
    });
}

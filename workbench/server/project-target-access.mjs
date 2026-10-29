import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { writeAtomicJson } from './atomic-json.mjs';
import { frozenTrialEnvironment } from './build/trial-environment.mjs';
import { authOriginAllowed } from './auth/catalog.mjs';

const schema = 'workbench/project-target-access-v1';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function parseTargetUrl(value, code) {
  if (typeof value !== 'string' || value.length > 2048) throw Error(code);
  const rawPath = value.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] || '/';
  if (/%(?:2e|2f|5c)/i.test(rawPath) || /\\/.test(rawPath) || rawPath.split('/').some(part => part === '.' || part === '..')) throw Error(code);
  let url;
  try { url = new URL(value); } catch { throw Error(code); }
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { throw Error(code); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash ||
      /[\\\u0000-\u001f]/.test(value) || decodedPath.includes('%') || decodedPath.includes('\\') ||
      decodedPath.split('/').some(part => part === '.' || part === '..')) throw Error(code);
  if (localHosts.has(url.hostname.toLowerCase()) && url.port === '4322') throw Error('PROJECT_TARGET_WORKBENCH_FORBIDDEN');
  return url;
}

function pathPrefix(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') ||
      /[?#%\u0000-\u001f]/.test(value) || value.split('/').some(part => part === '.' || part === '..')) throw Error('PROJECT_TARGET_PATH_SCOPE_INVALID');
  return value.length > 1 ? value.replace(/\/+$/, '') : '/';
}

export function targetRequestAllowed(policy, rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.username || url.password) return false;
  const parsedOrigin = new URL(policy.origin);
  const actualProtocol = url.protocol === 'ws:' ? 'http:' : url.protocol === 'wss:' ? 'https:' : url.protocol;
  const actualOrigin = `${actualProtocol}//${url.host}`;
  if (actualOrigin !== parsedOrigin.origin) return false;
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { return false; }
  if (decodedPath.includes('%') || decodedPath.split('/').some(part => part === '.' || part === '..') || decodedPath.includes('\\')) return false;
  const prefix = policy.path_prefix;
  return prefix === '/' || decodedPath === prefix || decodedPath.startsWith(`${prefix}/`);
}

// data: is never a target URL. Permit only passive raster image subresources;
// callers must supply the browser's request type, not infer it from the MIME.
export function targetPassiveDataImageAllowed(rawUrl, resourceType) {
  return typeof rawUrl === 'string' && typeof resourceType === 'string' &&
    resourceType.toLowerCase() === 'image' &&
    /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(rawUrl);
}

// These known icon JSON dependencies remain blocked. Their absence is a page
// observation, not a reason to discard the candidate's execution evidence.
export function targetBlockedIconDependency(rawUrl, resourceType, method) {
  if (!['GET', 'HEAD'].includes(method) || !['fetch', 'xhr'].includes(String(resourceType).toLowerCase())) return false;
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
    ['api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'].includes(url.hostname) &&
    /^\/[a-z0-9-]+\.json$/.test(url.pathname) && [...url.searchParams.keys()].every(key => key === 'icons') &&
    /^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(url.searchParams.get('icons') || '');
}

export function targetBlockedRequestFacts(rawUrl, resourceType, channel = 'http') {
  if (typeof rawUrl === 'string' && /^data:/i.test(rawUrl)) {
    const mime = rawUrl.match(/^data:([^;,]{1,40})/i)?.[1]?.toLowerCase();
    const safeMime = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'text/html', 'text/javascript', 'font/woff', 'font/woff2']).has(mime) ? mime : 'other';
    return { origin: 'data:', path: '', channel: 'data',
      resource_type: typeof resourceType === 'string' ? resourceType.toLowerCase() : 'unknown',
      mime: safeMime };
  }
  let parsed;
  try { parsed = new URL(rawUrl); } catch {}
  return { origin: parsed?.origin || 'INVALID_URL', path: parsed?.pathname || '', channel };
}

export function targetNetworkBlockPatterns(policy) {
  const scopePath = policy.path_prefix === '/' ? '/' : policy.path_prefix;
  const escapedScope = scopePath.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
  const origin = new URL(policy.origin).origin;
  return [
    { urlPattern: `${origin}${escapedScope}`, block: false },
    { urlPattern: `${origin}${escapedScope === '/' ? '/*' : `${escapedScope}/*`}`, block: false },
    { urlPattern: 'http://*/*', block: true }, { urlPattern: 'https://*/*', block: true },
    { urlPattern: 'ws://*/*', block: true }, { urlPattern: 'wss://*/*', block: true },
  ];
}

export function normalizeProjectTarget(body) {
  if (body?.confirm_non_production !== true || 
      typeof body?.operator !== 'string' || !body.operator.trim() || body.operator.length > 120) throw Error('PROJECT_TARGET_NON_PRODUCTION_CONFIRMATION_REQUIRED');
  const entry = parseTargetUrl(body.entry_url, 'PROJECT_TARGET_ENTRY_URL_INVALID');
  const prefix = pathPrefix(body.path_prefix);
  if (!entry.pathname.startsWith(prefix === '/' ? '/' : `${prefix}/`) && entry.pathname !== prefix) throw Error('PROJECT_TARGET_ENTRY_OUTSIDE_SCOPE');
  if (entry.origin === 'http://127.0.0.1:4322' || entry.origin === 'http://localhost:4322' || entry.origin === 'http://[::1]:4322') throw Error('PROJECT_TARGET_WORKBENCH_FORBIDDEN');
  const normalized = { origin: entry.origin, entry_url: entry.href, path_prefix: prefix, protocol: entry.protocol };
  if (body.login_required !== undefined && typeof body.login_required !== 'boolean') throw Error('PROJECT_TARGET_LOGIN_REQUIREMENT_INVALID');
  if (body.auth_required === true && body.login_required !== true) throw Error('PROJECT_TARGET_LOGIN_REQUIREMENT_INVALID');
  if (body.login_required === true) {
    const login = parseTargetUrl(body.login_url || entry.href, 'PROJECT_TARGET_LOGIN_URL_INVALID');
    const identity = body.identity_url ? parseTargetUrl(body.identity_url, 'PROJECT_TARGET_IDENTITY_URL_INVALID') : null;
    if (login.origin !== entry.origin || identity && identity.origin !== entry.origin) throw Error('PROJECT_TARGET_AUTH_ORIGIN_INVALID');
    if (!authOriginAllowed(entry)) throw Error('PROJECT_TARGET_AUTH_ORIGIN_INVALID');
    const role = body.role || 'tester';
    if (typeof role !== 'string' || !/^[\w-]{1,100}$/.test(role)) throw Error('PROJECT_TARGET_AUTH_ROLE_INVALID');
    normalized.login_required = true;
    normalized.login_url = login.href;
    if (identity) normalized.identity_url = identity.href;
    else normalized.verification_mode = 'browser-page';
    normalized.role = role;
  }
  return normalized;
}

function asEnvironment(target) {
  return {
    id: target.environment_id, name: target.name, normal_url: target.entry_url, validation_mode: 'normal-only',
    project_id: target.project_id, user_registered_target: true, target_scope: { origin: target.origin, path_prefix: target.path_prefix },
    configuration_sha256: target.configuration_sha256, operator: target.operator, registered_at: target.registered_at,
    ...(target.login_required ? { auth_requirement: { environment_id: target.environment_id, role: target.role } } : {}),
  };
}

function asTrialConfig(target) {
  return {
    id: target.environment_id, name: target.name, kind: target.login_required ? 'registered-auth-target' : 'registered-user-target', normal_url: target.entry_url,
    project_id: target.project_id, origin: target.origin, path_prefix: target.path_prefix, configuration_sha256: target.configuration_sha256,
  };
}

export class ProjectTargetAccess {
  constructor({ root, buildManager, caseStore, atomicJson = writeAtomicJson }) {
    Object.assign(this, { root, buildManager, caseStore, atomicJson });
    this.file = path.join(root, 'project-targets.json');
    this.queue = Promise.resolve();
  }
  serial(fn) { const next = this.queue.then(fn, fn); this.queue = next.catch(() => {}); return next; }
  async read() {
    try {
      const value = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (value.schema !== schema || !Array.isArray(value.targets)) throw Error('PROJECT_TARGET_STORE_INVALID');
      const ids = new Set();
      for (const target of value.targets) {
        if (!target?.project_id || !target.environment_id || ids.has(target.environment_id) || !target.operator ||
            target.schema !== 'workbench/project-target-v1' || target.creator_confirmation !== 'LOCAL_OPERATOR_AUTHORIZED_NON_PRODUCTION_TARGET_TEST' ||
            typeof target.registered_at !== 'string' || !target.name || !Number.isInteger(target.revision) || target.revision < 1 ||
            !/^user-target-[a-f0-9-]{36}$/.test(target.environment_id)) throw Error('PROJECT_TARGET_STORE_INVALID');
        ids.add(target.environment_id);
        if (!await this.caseStore.getProject(target.project_id)) throw Error('PROJECT_TARGET_PROJECT_MISSING');
        const normalized = normalizeProjectTarget({ entry_url: target.entry_url, path_prefix: target.path_prefix,
          confirm_non_production: true, operator: target.operator,
          ...(target.login_required ? { login_required: true, login_url: target.login_url, identity_url: target.identity_url, role: target.role } : {}) });
        if (normalized.origin !== target.origin || normalized.entry_url !== new URL(target.entry_url).href ||
            target.configuration_sha256 !== hash(normalized)) throw Error('PROJECT_TARGET_STORE_INVALID');
      }
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { schema, targets: [] };
      throw error;
    }
  }
  async save(value) { await this.atomicJson(this.file, value); }
  install(target) {
    if (target.login_required) {
      if (!this.buildManager.authSessions) throw Error('PROJECT_TARGET_AUTH_SESSIONS_UNAVAILABLE');
      this.buildManager.authSessions.registerEnvironment({ environment_id: target.environment_id, project_id: target.project_id,
        name: target.name, origin: target.origin, login_url: target.login_url, identity_url: target.identity_url, roles: [target.role],
        ...(target.verification_mode === 'browser-page' ? { verification_mode: 'browser-page', entry_url: target.entry_url } : {}),
        path_prefix: target.path_prefix });
    }
    const development = this.buildManager.developmentEnvironments;
    const trials = this.buildManager.candidateTrialEnvironments;
    if (!development.some(item => item.id === target.environment_id)) development.push(asEnvironment(target));
    if (!trials.some(item => item.id === target.environment_id)) trials.push(frozenTrialEnvironment(asTrialConfig(target)));
  }
  async init() {
    for (const target of (await this.read()).targets) this.install(target);
  }
  async list(projectId) {
    const state = await this.read();
    const targets = state.targets.filter(item => item.project_id === projectId).map(({ creator_confirmation, ...item }) => item);
    const rows = await Promise.all(targets.map(async target => {
      const trial = this.buildManager.candidateTrialEnvironments.find(item => item.id === target.environment_id);
      try { await trial.check(); return { ...target, ready: true }; }
      catch (error) { return { ...target, ready: false, reason: error.message }; }
    }));
    return { targets: rows };
  }
  async register(projectId, body) {
    return this.serial(async () => {
      if (!projectId || typeof body?.name !== 'string' || !body.name.trim() || body.name.length > 120) throw Error('PROJECT_TARGET_REGISTRATION_INVALID');
      const project = await this.caseStore.getProject(projectId);
      if (!project) throw Error('CASE_PROJECT_NOT_FOUND');
      const normalized = normalizeProjectTarget(body);
      if (normalized.login_required && !this.buildManager.authSessions) throw Error('PROJECT_TARGET_AUTH_SESSIONS_UNAVAILABLE');
      const target = {
        schema: 'workbench/project-target-v1', environment_id: `user-target-${randomUUID()}`,
        project_id: projectId, name: body.name.trim(), operator: body.operator.trim(), ...normalized,
        configuration_sha256: hash(normalized), revision: 1,
        registered_at: new Date().toISOString(), creator_confirmation: 'LOCAL_OPERATOR_AUTHORIZED_NON_PRODUCTION_TARGET_TEST',
      };
      const environment = frozenTrialEnvironment(asTrialConfig(target));
      await environment.check();
      const state = await this.read(); state.targets.push(target); await this.save(state); this.install(target);
      return { ...target, ready: true };
    });
  }
  async get(projectId, environmentId) {
    const target = (await this.read()).targets.find(item => item.project_id === projectId && item.environment_id === environmentId);
    if (!target) throw Error('PROJECT_TARGET_NOT_FOUND');
    return target;
  }
  projectCaseDefinition(target) {
    const publicTemplate = {
      template_id: 'registered-project-target-v1', version: String(target.revision), title: target.name,
      summary: `用户登记的非生产目标 ${target.origin}${target.path_prefix}`,
      candidate_contract: { url_environment_variable: 'PROBE_URL', test_count: 1, retries: 0, workers: 1 },
      allowed_entry: { kind: 'registered-user-target', entry_url: target.entry_url, origin: target.origin,
        path_prefix: target.path_prefix, configuration_sha256: target.configuration_sha256,
        login_required: target.login_required === true, scope: '同源且限定在用户登记的路径范围' },
    };
    return { environment_id: target.environment_id, public: publicTemplate,
      internal: { binding: { kind: 'registered-user-target', origin: target.origin, path_prefix: target.path_prefix }, verification: null } };
  }
  async environmentDefinition(environmentId, projectId = null) {
    const target = (await this.read()).targets.find(item => item.environment_id === environmentId && (!projectId || item.project_id === projectId));
    if (!target) return null;
    return this.projectCaseDefinition(target);
  }
}

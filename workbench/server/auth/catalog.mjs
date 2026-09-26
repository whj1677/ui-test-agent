import { validateSessionTerminationEndpoints } from './session-request-policy.mjs';

export const AUTH01_FIXTURE_ENVIRONMENT_ID = 'auth01-local-fixture-v1';

export function localAuthEnvironments(baseUrl = 'http://127.0.0.1:4330') {
  const origin = new URL(baseUrl).origin;
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('AUTH01_FIXTURE_ORIGIN_INVALID');
  return [{
    environment_id: AUTH01_FIXTURE_ENVIRONMENT_ID,
    name: 'AUTH-01 独立合成登录样例',
    origin,
    login_url: `${origin}/login`,
    identity_url: `${origin}/api/identity`,
    roles: ['inspector', 'supervisor'],
  }];
}

export function configuredAuthEnvironments(value, baseUrl) {
  const configured = Array.isArray(value) ? value : value?.environments;
  if (!Array.isArray(configured)) throw new Error('AUTH_ENVIRONMENTS_INVALID');
  const environments = localAuthEnvironments(baseUrl);
  const ids = new Set(environments.map(item => item.environment_id));
  for (const item of configured) {
    if (!item || !/^[\w-]{1,100}$/.test(item.environment_id || '') || ids.has(item.environment_id) ||
        !Array.isArray(item.roles) || !item.roles.length ||
        item.roles.some(role => !/^[\w-]{1,100}$/.test(role)) || new Set(item.roles).size !== item.roles.length) {
      throw new Error('AUTH_ENVIRONMENTS_INVALID');
    }
    let origin;
    try { origin = new URL(item.origin); } catch { throw new Error('AUTH_ENVIRONMENTS_INVALID'); }
    if (origin.origin !== item.origin || origin.pathname !== '/' || origin.search || origin.hash ||
        origin.username || origin.password ||
        !(origin.protocol === 'https:' || origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname))) {
      throw new Error('AUTH_ENVIRONMENTS_INVALID');
    }
    for (const field of ['login_url', 'identity_url']) {
      let target;
      try { target = new URL(item[field]); } catch { throw new Error('AUTH_ENVIRONMENTS_INVALID'); }
      if (target.origin !== origin.origin || target.username || target.password || target.hash) throw new Error('AUTH_ENVIRONMENTS_INVALID');
    }
    const session_termination_endpoints = validateSessionTerminationEndpoints(item.session_termination_endpoints);
    environments.push({ environment_id: item.environment_id, name: String(item.name || item.environment_id),
      origin: origin.origin, login_url: item.login_url, identity_url: item.identity_url, roles: [...item.roles], session_termination_endpoints });
    ids.add(item.environment_id);
  }
  return environments;
}

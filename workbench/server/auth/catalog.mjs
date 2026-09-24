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

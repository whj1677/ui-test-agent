export function validateSessionTerminationEndpoints(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error('AUTH_ENVIRONMENTS_INVALID');
  const seen = new Set();
  return value.map(item => {
    if (!item || Object.keys(item).sort().join(',') !== 'method,path' ||
        typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.startsWith('//') ||
        /[\\?#%\s]/.test(item.path) || new URL(item.path, 'https://policy.invalid').pathname !== item.path ||
        typeof item.method !== 'string' || !/^[A-Z]+$/.test(item.method)) throw new Error('AUTH_ENVIRONMENTS_INVALID');
    const key = `${item.method} ${item.path}`;
    if (seen.has(key)) throw new Error('AUTH_ENVIRONMENTS_INVALID');
    seen.add(key);
    return { method: item.method, path: item.path };
  });
}

export function sessionTerminationRequest(requestUrl, method, origin, endpoints = []) {
  let url;
  try { url = new URL(requestUrl); } catch { return false; }
  if (url.origin !== origin) return false;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return false; }
  return endpoints.some(item => item.method === method && item.path === path);
}

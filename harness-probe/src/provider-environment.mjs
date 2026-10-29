export function deepSeekHarnessBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) return baseUrl;
  let url;
  try { url = new URL(baseUrl); }
  catch { return baseUrl; }
  if (url.hostname.toLowerCase() !== 'api.deepseek.com') return baseUrl;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('DSH_OFFICIAL_BASE_URL_INVALID');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname === '' || pathname === '/v1') return `${url.origin}/anthropic`;
  if (pathname === '/anthropic' || pathname === '/anthropic/v1') return `${url.origin}${pathname}`;
  throw new Error('DSH_OFFICIAL_BASE_URL_INVALID');
}

function validProxy(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}

export function harnessNetworkEnvironment(environment = process.env) {
  const result = {};
  for (const [upper, lower] of [['HTTP_PROXY', 'http_proxy'], ['HTTPS_PROXY', 'https_proxy']]) {
    const value = validProxy(environment?.[upper] || environment?.[lower]);
    if (value) { result[upper] = value; result[lower] = value; }
  }
  const noProxy = new Set(String(environment?.NO_PROXY || environment?.no_proxy || '').split(',')
    .map(item => item.trim()).filter(item => /^[a-zA-Z0-9.:*-]{1,200}$/.test(item)));
  for (const value of ['127.0.0.1', 'localhost', '::1']) noProxy.add(value);
  result.NO_PROXY = [...noProxy].join(',');
  result.no_proxy = result.NO_PROXY;
  return result;
}

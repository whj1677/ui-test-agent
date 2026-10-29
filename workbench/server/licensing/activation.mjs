import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { collectHardware, createLicenseRequest, installLicense } from '@offline/device-license';
import { PRODUCT, installedLicensePath, licenseStatus, validateDeploymentPolicy } from './gate.mjs';

const origin = 'http://127.0.0.1:4322';
const assets = new Map([
  ['/workspace/', ['activation.html', 'text/html; charset=utf-8']],
  ['/workspace/activation.js', ['activation.js', 'text/javascript; charset=utf-8']],
  ['/workspace/activation.css', ['activation.css', 'text/css; charset=utf-8']],
]);
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 32768) throw Error('LICENSE_INPUT_TOO_LARGE'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// A locked installation exposes activation only. No business store or model is created.
export function createActivationServer({ policy, initialReason, onActivated, collect = () => collectHardware({ product: PRODUCT }), requestFactory = createLicenseRequest, save = installLicense, filePath = installedLicensePath() }) {
  const trust = validateDeploymentPolicy(policy);
  if (!trust) throw Error('ACTIVATION_REQUIRES_RELEASE_POLICY');
  const csrf = randomBytes(32).toString('hex');
  let installing = false;
  return http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== '127.0.0.1:4322') return json(res, 403, { error: 'LOCAL_HOST_REQUIRED' });
      const url = new URL(req.url, origin);
      if (url.search) return json(res, 400, { error: 'QUERY_NOT_ALLOWED' });
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(302, { location: '/workspace/' }); return res.end(); }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [name, type] = assets.get(url.pathname);
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
        return res.end(await fs.readFile(new URL(name, import.meta.url)));
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { service: 'approved-test-workbench', activation_required: true, accepting: false, entry: origin + '/workspace/' });
      if (req.method === 'GET' && url.pathname === '/api/activation/status') return json(res, 200, { state: 'ACTIVATION_REQUIRED', reason: initialReason, product: PRODUCT, binding: '主板身份；内存、硬盘升级不影响', csrf });
      if (req.method !== 'POST' || !['/api/activation/request', '/api/activation/import'].includes(url.pathname)) return json(res, 403, { error: 'LICENSE_ACTIVATION_REQUIRED' });
      if (req.headers['x-license-csrf'] !== csrf || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 403, { error: 'LOCAL_REQUEST_REQUIRED' });
      const input = await body(req);
      if (input.consent !== true) return json(res, 400, { error: 'HARDWARE_CONSENT_REQUIRED' });
      if (url.pathname.endsWith('/request')) {
        if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 120 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(input.displayName)) return json(res, 400, { error: 'LICENSE_SUBJECT_INVALID' });
        const hardware = await collect();
        const request = await requestFactory({ product: PRODUCT, displayName: input.displayName, ...hardware });
        return json(res, 200, { request });
      }
      if (installing) return json(res, 409, { error: 'ACTIVATION_BUSY' });
      installing = true;
      try {
        const result = await save({ license: input.license, publicKey: trust.publicKey, expectedProduct: PRODUCT, profileId: trust.profileId, filePath, replace: input.replace === true });
        json(res, 200, { state: 'LICENSED', alreadyInstalled: result.alreadyInstalled });
        setImmediate(() => onActivated());
      } finally { installing = false; }
    } catch (error) {
      // Do not reflect raw input, hardware fields, OS errors or filesystem paths.
      const code = String(error.code || error.message || 'LICENSE_INPUT_INVALID');
      json(res, 400, { error: /^[A-Z][A-Z0-9_]{2,80}$/.test(code) ? code : 'LICENSE_INPUT_INVALID' });
    }
  });
}

export async function ensureLicensedStartup(policy) {
  let status = await licenseStatus(policy);
  if (status.state !== 'ACTIVATION_REQUIRED') return status;
  console.log('需要设备授权。请打开 http://127.0.0.1:4322/workspace/ 完成激活。业务功能尚未启动。');
  await new Promise((resolve, reject) => {
    const server = createActivationServer({ policy, initialReason: status.reason, onActivated: () => {
      server.close(resolve); server.closeIdleConnections?.();
    } });
    server.once('error', reject);
    server.listen(4322, '127.0.0.1');
  });
  status = await licenseStatus(policy);
  if (status.state !== 'LICENSED') throw Error('LICENSE_RECHECK_FAILED');
  return status;
}

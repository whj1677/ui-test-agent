import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const LICENSE_REQUEST_SCHEMA = 'offline-device-license/request-v1';
export const LICENSE_SCHEMA = 'offline-device-license/rsa-license-v1';
export const LICENSE_PAYLOAD_SCHEMA = 'offline-device-license/payload-v1';
export const MAX_LICENSE_BYTES = 32 * 1024;
const HEX = /^[a-f0-9]{64}$/;
const PROFILE = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const PRODUCT = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_ID = new RegExp(`^request-${UUID}$`);
const LICENSE_ID = new RegExp(`^license-${UUID}$`);

export function licenseError(code) { return Object.assign(new Error(code), { code }); }

export function validateProduct(product) {
  if (typeof product !== 'string' || !PRODUCT.test(product)) throw licenseError('LICENSE_PRODUCT_INVALID');
  return product;
}

function objectKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw licenseError(code);
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== [...keys].sort()[index])) throw licenseError(code);
}

function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function subject(value) {
  objectKeys(value, ['displayName'], 'LICENSE_SUBJECT_INVALID');
  if (typeof value.displayName !== 'string' || value.displayName !== value.displayName.trim() ||
      value.displayName.length < 1 || value.displayName.length > 120 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value.displayName)) throw licenseError('LICENSE_SUBJECT_INVALID');
}

export function validateHardwareBinding({ hardwareFingerprint, profileId } = {}) {
  if (typeof profileId !== 'string' || !PROFILE.test(profileId)) throw licenseError('LICENSE_PROFILE_INVALID');
  if (typeof hardwareFingerprint !== 'string' || !HEX.test(hardwareFingerprint) ||
      /^0+$/.test(hardwareFingerprint)) throw licenseError('LICENSE_HARDWARE_UNAVAILABLE');
}

// Schema restricts all values to plain JSON. Keys are recursively sorted; signatures
// cover these bytes with a domain prefix, never a caller-provided JSON serialization.
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  throw licenseError('LICENSE_CANONICAL_VALUE_INVALID');
}

export function validateLicenseRequest(request) {
  objectKeys(request, ['schema', 'product', 'requestId', 'nonce', 'createdAt', 'subject', 'profileId', 'hardwareFingerprint'], 'LICENSE_REQUEST_INVALID');
  if (request.schema !== LICENSE_REQUEST_SCHEMA ||
      !REQUEST_ID.test(request.requestId) || typeof request.nonce !== 'string' || !HEX.test(request.nonce) ||
      !utc(request.createdAt)) throw licenseError('LICENSE_REQUEST_INVALID');
  subject(request.subject);
  validateProduct(request.product);
  validateHardwareBinding(request);
  return request;
}

export async function createLicenseRequest({ product, displayName, profileId, hardwareFingerprint }) {
  validateProduct(product);
  const current = await (await import('../hardware.mjs')).collectHardware({ product });
  if (profileId !== undefined && profileId !== current.profileId) throw licenseError('LICENSE_PROFILE_MISMATCH');
  if (hardwareFingerprint !== undefined && hardwareFingerprint !== current.hardwareFingerprint) throw licenseError('LICENSE_HARDWARE_MISMATCH');
  ({ profileId, hardwareFingerprint } = current);
  const request = { schema: LICENSE_REQUEST_SCHEMA, product,
    requestId: `request-${randomUUID()}`, nonce: randomBytes(32).toString('hex'), createdAt: new Date().toISOString(),
    subject: { displayName: typeof displayName === 'string' ? displayName.trim() : displayName }, profileId, hardwareFingerprint };
  return structuredClone(validateLicenseRequest(request));
}

export function requestDigest(request) {
  validateLicenseRequest(request);
  return createHash('sha256').update(`offline-device-license:request-v1\n${canonicalJson(request)}`).digest('hex');
}

export function validateLicensePayload(payload) {
  objectKeys(payload, ['schema', 'product', 'licenseId', 'requestId', 'requestSha256', 'issuedAt', 'scope', 'subject', 'profileId', 'hardwareFingerprint'], 'LICENSE_PAYLOAD_INVALID');
  if (payload.schema !== LICENSE_PAYLOAD_SCHEMA ||
      !LICENSE_ID.test(payload.licenseId) || !REQUEST_ID.test(payload.requestId) ||
      typeof payload.requestSha256 !== 'string' || !HEX.test(payload.requestSha256) ||
      !utc(payload.issuedAt) || payload.scope !== 'permanent') throw licenseError('LICENSE_PAYLOAD_INVALID');
  subject(payload.subject);
  validateProduct(payload.product);
  validateHardwareBinding(payload);
  return payload;
}

export function licenseSigningBytes(payload) {
  validateLicensePayload(payload);
  return Buffer.from(`offline-device-license:rsa-license-v1\n${canonicalJson(payload)}`, 'utf8');
}

export function validateLicenseEnvelope(license) {
  objectKeys(license, ['schema', 'algorithm', 'publicKeyId', 'payload', 'signature'], 'LICENSE_DOCUMENT_INVALID');
  if (license.schema !== LICENSE_SCHEMA || license.algorithm !== 'RSASSA-PKCS1-v1_5-SHA256' ||
      typeof license.publicKeyId !== 'string' || !HEX.test(license.publicKeyId) ||
      typeof license.payload !== 'string' || license.payload.length > 11000 || !/^[A-Za-z0-9_-]+$/.test(license.payload) ||
      typeof license.signature !== 'string' || !/^[A-Za-z0-9_-]{512}$/.test(license.signature)) throw licenseError('LICENSE_DOCUMENT_INVALID');
  const bytes = Buffer.from(license.signature, 'base64url');
  if (bytes.length !== 384 || bytes.toString('base64url') !== license.signature) throw licenseError('LICENSE_DOCUMENT_INVALID');
  const payloadBytes = Buffer.from(license.payload, 'base64url');
  if (payloadBytes.length > 8192 || payloadBytes.toString('base64url') !== license.payload) throw licenseError('LICENSE_DOCUMENT_INVALID');
  return license;
}

export function parseLicenseJson(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_LICENSE_BYTES) throw licenseError('LICENSE_DOCUMENT_INVALID');
  try { return JSON.parse(text.replace(/^\uFEFF/u, '')); }
  catch { throw licenseError('LICENSE_DOCUMENT_INVALID'); }
}

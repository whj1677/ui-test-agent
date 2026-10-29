import { createHash, createPublicKey } from 'node:crypto';
import { licenseError, validateLicenseEnvelope, validateProduct } from './schema.mjs';
import { callLicenseBridge } from './bridge.mjs';

export function trustedPublicKey(publicKey) {
  try {
    const key = publicKey?.type === 'public' ? publicKey : createPublicKey(publicKey);
    if (key.type !== 'public' || key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 3072) throw new Error('INVALID');
    const jwk = key.export({ format: 'jwk' }); if (jwk.e !== 'AQAB') throw new Error('INVALID');
    return key;
  } catch { throw licenseError('LICENSE_TRUST_ROOT_INVALID'); }
}
export function publicKeyFingerprint(publicKey) {
  const { n, e } = trustedPublicKey(publicKey).export({ format: 'jwk' });
  return createHash('sha256').update(`offline-device-license:rsa-public-key-v1\n${n}\n${e}`).digest('hex');
}
export function publicKeyXml(publicKey) {
  const { n, e } = trustedPublicKey(publicKey).export({ format: 'jwk' });
  return `<RSAKeyValue><Modulus>${Buffer.from(n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
}
// JS transports the request; the DLL alone checks signatures and real hardware.
export async function verifyLicense({ expectedProduct, license, publicKey, profileId }) {
  validateProduct(expectedProduct);
  if (profileId !== undefined && profileId !== 'windows-baseboard-v1') throw licenseError('LICENSE_PROFILE_MISMATCH');
  validateLicenseEnvelope(license);
  return callLicenseBridge({ command: 'verify', expectedProduct, publicKeyXml: publicKeyXml(publicKey), licenseDocument: JSON.stringify(license) });
}

import path from 'node:path';
import { createPublicKey } from 'node:crypto';
import { loadInstalledLicense } from '@offline/device-license';

export const PRODUCT = 'ui-test-agent';
export function validateDeploymentPolicy(policy) {
  if (policy?.required === false && policy.trust === null) return null;
  const trust = policy?.trust;
  if (policy?.required !== true || trust?.schema !== 'workbench/license-trust-v1' || trust.product !== PRODUCT || trust.profileId !== 'windows-baseboard-v1') throw Error('LICENSE_TRUST_INVALID');
  try { if (typeof trust.publicKey !== 'string' || !trust.publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || trust.publicKey.includes('PRIVATE')) throw Error(); const key = createPublicKey(trust.publicKey); if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 3072 || key.export({ format:'jwk' }).e !== 'AQAB') throw Error(); }
  catch { throw Error('LICENSE_TRUST_INVALID'); }
  return trust;
}
export function installedLicensePath() {
  if (!process.env.LOCALAPPDATA || !path.isAbsolute(process.env.LOCALAPPDATA)) throw Error('LICENSE_STORAGE_UNAVAILABLE');
  return path.join(process.env.LOCALAPPDATA, 'ui-test-agent', 'licenses', 'license.json');
}
export async function licenseStatus(policy) {
  const trust = validateDeploymentPolicy(policy);
  if (!trust) return { state: 'DEVELOPMENT_SOURCE', required: false };
  const filePath = installedLicensePath();
  try {
    // Missing files do not trigger hardware collection. For installed licenses,
    // the DLL obtains the current mainboard itself; JS cannot supply an identity.
    const { payload } = await loadInstalledLicense({ filePath, publicKey: trust.publicKey, expectedProduct: PRODUCT, profileId: trust.profileId });
    return { state: 'LICENSED', required: true, payload };
  } catch (error) {
    if (!['LICENSE_MISSING','LICENSE_DOCUMENT_INVALID','LICENSE_STORAGE_INVALID','LICENSE_SIGNATURE_INVALID','LICENSE_PAYLOAD_INVALID',
      'LICENSE_SUBJECT_INVALID','LICENSE_PRODUCT_MISMATCH','LICENSE_PROFILE_MISMATCH','LICENSE_HARDWARE_MISMATCH','LICENSE_ISSUER_MISMATCH'].includes(error.code || error.message)) throw error;
    return { state: 'ACTIVATION_REQUIRED', required: true, reason: error.code || error.message || 'LICENSE_INVALID' };
  }
}

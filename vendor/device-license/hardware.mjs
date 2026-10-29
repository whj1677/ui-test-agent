import { callLicenseBridge } from './core/bridge.mjs';
import { validateProduct } from './core/schema.mjs';
export const HARDWARE_PROFILE = 'windows-baseboard-v1';
export async function collectHardware({ product }) {
  validateProduct(product);
  return callLicenseBridge({ command: 'collect', product });
}

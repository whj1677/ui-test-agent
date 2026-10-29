import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { licenseStatus } from './gate.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== 'check' || args[1] !== '--root' || !path.isAbsolute(args[2])) throw Error('LICENSE_CLI_ARGUMENTS');
  const { deploymentPolicy } = await import(pathToFileURL(path.join(args[2], 'workbench/server/licensing/deployment-policy.mjs')));
  const status = await licenseStatus(deploymentPolicy);
  console.log(JSON.stringify({ state: status.state, required: status.required, reason: status.reason }));
  process.exitCode = status.state === 'ACTIVATION_REQUIRED' ? 2 : 0;
} catch { console.error('LICENSE_TECHNICAL_ERROR: 信任配置或主板读取失败，请检查环境。'); process.exitCode = 3; }

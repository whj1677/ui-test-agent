import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = value => createHash('sha256').update(value).digest('hex');
const FIXED_SKILL_FILES = Object.freeze([
  'workbench/server/skills/ui-test-authoring-v1/SKILL.md',
  'workbench/server/skills/backend-http-plan-v1/SKILL.md',
  'workbench/server/skills/case-design-v1/SKILL.md',
]);
export function isolateStartupRegistries({trialConfig,developmentEnvironments}) {
  return {
    candidateTrialAuthorizations: structuredClone(trialConfig.authorizations || []),
    developmentEnvironments: structuredClone(developmentEnvironments),
  };
}
const licenseRoot = path.dirname(fileURLToPath(import.meta.resolve('@offline/device-license')));
const LICENSE_FILES = Object.freeze(['package.json','index.mjs','hardware.mjs','core/bridge.mjs','core/schema.mjs','core/verify.mjs','core/storage.mjs','bin/build-manifest.json','bin/DeviceLicense.dll','bin/DeviceLicense.Bridge.exe']);
export async function licenseRuntimeFingerprint(root = licenseRoot) {
  const files = [];
  for (const name of LICENSE_FILES) {
    const file = path.join(root, name), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('LICENSE_RUNTIME_FILE_INVALID');
    files.push({ path:`@offline/device-license/${name}`, sha256:sha(await fs.readFile(file)) });
  }
  const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(root,'bin/build-manifest.json'),'utf8'));
  if (pkg.name !== '@offline/device-license' || pkg.version !== '0.2.0' || manifest.schema !== 'offline-device-license/build-v1' || manifest.componentVersion !== '1.0.0-rsa' || !Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 2) throw Error('LICENSE_RUNTIME_VERSION_INVALID');
  for (const name of ['DeviceLicense.dll','DeviceLicense.Bridge.exe']) {
    const item = manifest.artifacts.filter(item => item.file === name);
    if (item.length !== 1 || item[0].sha256 !== files.find(file => file.path.endsWith(`/bin/${name}`)).sha256) throw Error('LICENSE_RUNTIME_BINARY_MISMATCH');
  }
  return { files, package_version:pkg.version, component_version:manifest.componentVersion };
}
export async function sourceFingerprint(repoRoot) {
  const files = [];
  async function walk(relative) {
    for (const entry of (await fs.readdir(path.join(repoRoot, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw Error('SOURCE_IDENTITY_SYMLINK');
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:mjs|js|json|html|css|yml|cs)$/.test(name)) files.push(name);
    }
  }
  for (const folder of ['workbench/server','workbench/web-v2','harness-probe/src','src']) await walk(folder);
  for (const name of FIXED_SKILL_FILES) {
    const file = path.join(repoRoot, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('SOURCE_IDENTITY_SKILL_INVALID');
    files.push(name);
  }
  for (const name of ['package.json','package-lock.json','workbench/package.json','workbench/package-lock.json','harness-probe/package.json','harness-probe/package-lock.json','workbench/native/package.json','workbench/native/package-lock.json','workbench/release.json','workbench/scripts/native-dsh-package.mjs','workbench/scripts/native-runtime.mjs','workbench/scripts/native-entry.mjs']) files.push(name);
  const digest = createHash('sha256');
  for (const name of files.sort()) digest.update(name+'\0'+sha(await fs.readFile(path.join(repoRoot,name)))+'\n');
  const runtime = await licenseRuntimeFingerprint();
  for (const file of runtime.files) digest.update(file.path+'\0'+file.sha256+'\n');
  const release=JSON.parse(await fs.readFile(path.join(repoRoot,'workbench/release.json'),'utf8'));
  if(release.schema!=='workbench/release-v1'||release.entry!=='http://127.0.0.1:4322/workspace/'||!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,79}$/.test(release.version||''))throw Error('SOURCE_RELEASE_IDENTITY_INVALID');
  return { source_sha256:digest.digest('hex'), source_file_count:files.length+runtime.files.length,
    release:{version:release.version,status:release.status,requirement:release.requirement,native_dsh_version:release.native_dsh.version},
    license_runtime:{package_version:runtime.package_version,component_version:runtime.component_version,files:runtime.files} };
}

export function configurationFingerprint(configuration) {
  const configured = structuredClone(configuration);
  // Credential availability is resolved at startup, not a configuration change.
  // Keep the selected provider/model, configured paths and opt-in in the digest.
  if (configured?.model) delete configured.model.credential_source;
  return sha(JSON.stringify(configured));
}

export async function createServiceIdentity({repoRoot,localRoot,instanceId,configuration}) {
  // configuration is an explicit non-secret projection supplied by the launcher.
  const source = await sourceFingerprint(repoRoot);
  return Object.freeze({schema:'workbench/service-identity-v1',service_instance_id:instanceId,
    captured_at:new Date().toISOString(),...source,configuration_sha256:configurationFingerprint(configuration),
    data_root_sha256:sha(path.resolve(localRoot)),entry:'http://127.0.0.1:4322/workspace/'});
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { licenseRuntimeFingerprint } from '../server/service-identity.mjs';

test('license runtime identity covers shipped SDK/DLL bytes and rejects stale binary manifests',async t=>{
  const original=await licenseRuntimeFingerprint();
  assert.equal(original.package_version,'0.2.0');assert.equal(original.component_version,'1.0.0-rsa');
  assert.equal(original.files.length,10);assert.ok(original.files.every(file=>file.path.startsWith('@offline/device-license/')&&!/issuer|private|tests/.test(file.path)));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'license-runtime-identity-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.dirname(fileURLToPath(import.meta.resolve('@offline/device-license')));
  for(const file of original.files){const relative=file.path.replace('@offline/device-license/','');await fs.mkdir(path.dirname(path.join(root,relative)),{recursive:true});await fs.copyFile(path.join(source,relative),path.join(root,relative));}
  assert.deepEqual(await licenseRuntimeFingerprint(root),original);
  await fs.appendFile(path.join(root,'core/verify.mjs'),'\n// synthetic modified adapter\n');
  assert.notDeepEqual((await licenseRuntimeFingerprint(root)).files,original.files);
  await fs.appendFile(path.join(root,'bin/DeviceLicense.dll'),'tamper');
  await assert.rejects(licenseRuntimeFingerprint(root),/LICENSE_RUNTIME_BINARY_MISMATCH/);
});

// Developer build only; customers receive the binary and its public hash.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const source=path.join(root,'workbench/native/WindowsCredential.cs');
const directory=path.join(root,'workbench/scripts/native');
const target=path.join(directory,'WindowsCredential.exe');
if(process.platform!=='win32')throw Error('CREDENTIAL_BUILD_WINDOWS_REQUIRED');
await fs.mkdir(directory,{recursive:true});
const compiler=path.join(process.env.SystemRoot || 'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
await promisify(execFile)(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/reference:System.Security.dll','/reference:System.Web.Extensions.dll',`/out:${target}`,source],{windowsHide:true,timeout:30000});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={schema:'workbench/windows-credential-build-v1',version:'1.0.0',platform:'win32-x64',source_sha256:hash(await fs.readFile(source)),artifact:'WindowsCredential.exe',sha256:hash(await fs.readFile(target))};
await fs.writeFile(path.join(directory,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'CREDENTIAL_BROKER_BUILT',...manifest}));

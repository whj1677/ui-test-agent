// Reproducible Windows helper build; no COM activation or registration writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
if(process.platform!=='win32')throw Error('OFFICE_BUILD_WINDOWS_REQUIRED');
const base=fileURLToPath(new URL('../server/requirements/office-word-reader',import.meta.url));
const compiler=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
await promisify(execFile)(compiler,['/nologo','/target:winexe','/platform:x64','/optimize+','/reference:Microsoft.CSharp.dll','/reference:System.Web.Extensions.dll',`/out:${base}.exe`,`${base}.cs`],{windowsHide:true,timeout:30000});
const hash=b=>createHash('sha256').update(b).digest('hex');
const binary=await fs.readFile(base+'.exe');
const build={schema:'workbench/office-word-reader-build-v1',framework:'.NET Framework 4.8 (existing package prerequisite)',source_sha256:hash(await fs.readFile(base+'.cs')),sha256:hash(binary),bytes:binary.length,providers:['Word.Application','KWPS.Application','WPS.Application'],target:'winexe',platform:'win32-x64',registry_views:[64,32]};
await fs.writeFile(base+'.build.json',JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify({status:'OFFICE_READER_BUILT',...build}));

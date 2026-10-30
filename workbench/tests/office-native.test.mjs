// Pure native contract tests: never activate Office or start a workbench.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
test('native WPS registration, ownership and security contracts',{skip:process.platform!=='win32'},async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-office-contract-'));
  try {
    const compiler=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),exe=path.join(dir,'OfficeNativeTests.exe');
    await run(compiler,['/nologo','/target:exe','/platform:x64','/reference:Microsoft.CSharp.dll','/reference:System.Web.Extensions.dll','/main:OfficeNativeTests',`/out:${exe}`,fileURLToPath(new URL('../server/requirements/office-word-reader.cs',import.meta.url)),fileURLToPath(new URL('./fixtures/OfficeNativeTests.cs',import.meta.url))],{windowsHide:true,timeout:30000});
    const result=await run(exe,[],{windowsHide:true,timeout:15000});assert.match(result.stdout,/# pass 12/);
  } finally {assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('ui-office-contract-'));await fs.rm(dir,{recursive:true,force:true});}
});

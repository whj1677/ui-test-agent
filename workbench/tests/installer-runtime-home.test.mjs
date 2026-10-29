import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url)),exec=promisify(execFile);
// Run the shipped installer in real PS5/PS7. Only its external boundaries are
// fixtures; these tests neither install dependencies nor start a workbench.
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'installer-home-test-'));
  t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('installer-home-test-'));await fs.rm(dir,{recursive:true,force:true});});
  const write=async(name,body)=>{const p=path.join(dir,name);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,name.endsWith('.ps1')?'\uFEFF'+body:body);};
  await fs.copyFile(path.join(root,'安装.ps1'),path.join(dir,'安装.ps1'));
  for(const scope of ['.','workbench','harness-probe','workbench/native'])await write(path.join(scope,'package-lock.json'),'{}');
  await write('workbench/scripts/runtime-paths.ps1',`function Get-WorkbenchRuntime { param($Root) @{ Node=$env:INSTALLER_FIXTURE_NODE; Portable=($env:INSTALLER_FIXTURE_PORTABLE -eq '1') } }`);
  await write('workbench/scripts/setup-runtime.ps1',`param([string]$RuntimeHome)
if(-not $RuntimeHome){$RuntimeHome=$env:INSTALLER_FIXTURE_DEFAULT}
@{runtime_home=$RuntimeHome} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../../setup-call.json') -Encoding UTF8
$global:LASTEXITCODE=0`);
  await write('workbench/scripts/check-install.ps1',`'checked' | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../../checked.txt');$global:LASTEXITCODE=0`);
  await write('workbench/scripts/verify-portable.mjs','process.exit(0);');
  await write('workbench/node_modules/playwright/cli.js','process.exit(0);');
  await write('run.ps1',`$ErrorActionPreference='Stop'
function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction) if($env:INSTALLER_FIXTURE_BUSY -eq '1'){@{OwningProcess=123}}}
function npm.cmd {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs)
  $log=Join-Path $PSScriptRoot 'npm-calls.jsonl'
  ConvertTo-Json -InputObject @($CommandArgs) -Compress | Add-Content -LiteralPath $log
  $count=@(Get-Content -LiteralPath $log).Count
  $global:LASTEXITCODE=0
  if($env:INSTALLER_FIXTURE_NPM_FAIL -eq '1' -and $count -eq 2){$global:LASTEXITCODE=19}
}
if($env:INSTALLER_FIXTURE_EXPLICIT -eq '1'){& (Join-Path $PSScriptRoot '安装.ps1') -RuntimeHome $env:INSTALLER_FIXTURE_HOME}
else{& (Join-Path $PSScriptRoot '安装.ps1')}`);
  const env={...process.env,INSTALLER_FIXTURE_NODE:process.execPath,INSTALLER_FIXTURE_DEFAULT:path.join(dir,'default runtime'),INSTALLER_FIXTURE_HOME:path.join(dir,'独立 运行时'),INSTALLER_FIXTURE_EXPLICIT:'0',INSTALLER_FIXTURE_BUSY:'0',INSTALLER_FIXTURE_PORTABLE:'0',INSTALLER_FIXTURE_NPM_FAIL:'0'};
  return {dir,env,run:(shell,changes={})=>exec(shell,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(dir,'run.ps1')],{cwd:dir,env:{...env,...changes},windowsHide:true,timeout:30000,maxBuffer:1024*1024}),read:async n=>JSON.parse((await fs.readFile(path.join(dir,n),'utf8')).replace(/^\uFEFF/,'')),exists:async n=>fs.access(path.join(dir,n)).then(()=>true,()=>false)};
}
for(const shell of ['powershell.exe','pwsh']){
  test(`${shell}: source installer forwards an explicit absolute runtime home`,async t=>{
    const f=await fixture(t);await f.run(shell,{INSTALLER_FIXTURE_EXPLICIT:'1'});assert.equal((await f.read('setup-call.json')).runtime_home,f.env.INSTALLER_FIXTURE_HOME);assert.ok(await f.exists('checked.txt'));
    const calls=(await fs.readFile(path.join(f.dir,'npm-calls.jsonl'),'utf8')).trim().split(/\r?\n/).map(JSON.parse);assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c.slice(2)),Array(4).fill(['ci','--omit=dev','--ignore-scripts']));
  });
  test(`${shell}: portable installer forwards the same runtime home without npm`,async t=>{
    const f=await fixture(t);await f.run(shell,{INSTALLER_FIXTURE_EXPLICIT:'1',INSTALLER_FIXTURE_PORTABLE:'1'});assert.equal((await f.read('setup-call.json')).runtime_home,f.env.INSTALLER_FIXTURE_HOME);assert.equal(await f.exists('npm-calls.jsonl'),false);assert.ok(await f.exists('checked.txt'));
  });
  test(`${shell}: omitted runtime home retains the initializer default`,async t=>{
    const f=await fixture(t);await f.run(shell);assert.equal((await f.read('setup-call.json')).runtime_home,f.env.INSTALLER_FIXTURE_DEFAULT);
  });
  test(`${shell}: empty and relative runtime homes fail before installation`,async t=>{
    const f=await fixture(t);for(const home of ['', 'relative-runtime','C:relative-runtime','\\root-relative-runtime'])await assert.rejects(f.run(shell,{INSTALLER_FIXTURE_EXPLICIT:'1',INSTALLER_FIXTURE_HOME:home}),e=>String(e.stderr).includes('INSTALLER_RUNTIME_HOME_ABSOLUTE_REQUIRED'));
    assert.equal(await f.exists('npm-calls.jsonl'),false);assert.equal(await f.exists('setup-call.json'),false);
  });
  test(`${shell}: occupied 4322 blocks both installer modes before side effects`,async t=>{
    const f=await fixture(t);for(const portable of ['0','1'])await assert.rejects(f.run(shell,{INSTALLER_FIXTURE_BUSY:'1',INSTALLER_FIXTURE_PORTABLE:portable}),e=>String(e.stderr).includes('4322'));
    assert.equal(await f.exists('npm-calls.jsonl'),false);assert.equal(await f.exists('setup-call.json'),false);
  });
  test(`${shell}: dependency failure stops subsequent installs and runtime setup`,async t=>{
    const f=await fixture(t);await assert.rejects(f.run(shell,{INSTALLER_FIXTURE_NPM_FAIL:'1'}));const calls=(await fs.readFile(path.join(f.dir,'npm-calls.jsonl'),'utf8')).trim().split(/\r?\n/);assert.equal(calls.length,2);assert.equal(await f.exists('setup-call.json'),false);assert.equal(await f.exists('checked.txt'),false);
  });
  test(`${shell}: shipped installer and initialization scripts parse with their actual encoding`,async()=>{
    const command=`$ErrorActionPreference='Stop';foreach($name in @('安装.ps1','workbench/scripts/runtime-paths.ps1','workbench/scripts/setup-runtime.ps1','workbench/scripts/check-install.ps1')){$tokens=$null;$issues=$null;$null=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $env:INSTALLER_SOURCE_ROOT $name),[ref]$tokens,[ref]$issues);if($issues.Count){throw ('INSTALLER_SOURCE_PARSE_FAILED: '+$name+': '+$issues[0].Message)}};Write-Output '4 actual installer source files parsed'`;
    // EncodedCommand also preserves the Chinese source filename in PS5.
    const r=await exec(shell,['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{env:{...process.env,INSTALLER_SOURCE_ROOT:root},windowsHide:true,timeout:15000});assert.match(r.stdout,/4 actual installer source files parsed/);
  });
}

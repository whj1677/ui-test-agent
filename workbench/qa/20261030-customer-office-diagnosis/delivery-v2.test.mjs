import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const qa=path.dirname(fileURLToPath(import.meta.url));
const delivered=path.join(qa,'extracted-v2 中文 空格');
async function command(folder){
 const started=Date.now();
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.ComSpec||path.join(process.env.SystemRoot,'System32/cmd.exe'),['/d','/c','双击诊断.cmd','-ProgramRoot','D:/UAWps3Native','-SkipDocument','-Output','result.json'],{cwd:folder,windowsHide:true});
  let stdout='',stderr='';let firstOutputMs;
  const timer=setTimeout(()=>{child.kill();reject(Error('DELIVERY_TEST_DEADLINE_EXCEEDED'));},60000);
  child.stdout.on('data',b=>{firstOutputMs??=Date.now()-started;stdout+=b.toString('utf8');});child.stderr.on('data',b=>{stderr+=b.toString('utf8');});
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr,firstOutputMs,elapsedMs:Date.now()-started});});child.stdin.end('\r\n');
 });
}
async function fixture(name){const target=path.join(qa,name+' 中文 空格 '+crypto.randomUUID());await fs.mkdir(target);for(const name of await fs.readdir(delivered))await fs.copyFile(path.join(delivered,name),path.join(target,name));return target;}
test('final extracted CMD starts promptly and completes from a Chinese and space path',async()=>{
 const folder=await fixture('delivered-normal'),v=await command(folder);
 await fs.writeFile(path.join(folder,'console.log'),v.stdout+v.stderr);
 assert.equal(v.code,0);assert.ok(v.firstOutputMs<3000);assert.match(v.stdout,/\[START\]/);assert.match(v.stdout,/\[1\/5\]/);assert.match(v.stdout,/\[5\/5\]/);
 const report=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8'));assert.equal(report.status,'COMPLETE');assert.equal(report.bundled_node.collector_uses_bundled_node,true);assert.equal(report.side_effects.model_calls,0);
});
test('a hung Windows event collector shows heartbeat, times out and retains a usable partial system report',async()=>{
 const folder=await fixture('delivered-timeout'),file=path.join(folder,'collect-system.ps1');
 let text=await fs.readFile(file,'utf8');assert.ok(text.includes(' $events=@(Get-WinEvent'));
 text=text.replace(' $events=@(Get-WinEvent',' Start-Sleep -Seconds 60\r\n $events=@(Get-WinEvent');await fs.writeFile(file,text,'utf8');
 const v=await command(folder);await fs.writeFile(path.join(folder,'console.log'),v.stdout+v.stderr);
 assert.equal(v.code,0);assert.ok(v.firstOutputMs<3000);assert.ok(v.elapsedMs>=20000&&v.elapsedMs<40000);assert.match(v.stdout,/SYSTEM_METADATA/);assert.match(v.stdout,/\[超时\]/);
 assert.ok((v.stdout.match(/\[等待\]/g)||[]).length>=4,'show a heartbeat throughout the intentionally stalled step');
 const report=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8'));
 assert.equal(report.status,'COMPLETE');assert.equal(report.outside_sandbox_system.event_status,'TIMED_OUT');assert.equal(report.outside_sandbox_system.environment.system_root_present,true);assert.equal(report.outside_sandbox_system.collector_process.timed_out,true);assert.equal(report.side_effects.model_calls,0);
});
test('worker integrity failure still produces the phase and report through the final CMD',async()=>{
 const folder=await fixture('delivered-failure'),file=path.join(folder,'trace-build.json');const build=JSON.parse(await fs.readFile(file,'utf8'));build.exe_sha256='0'.repeat(64);await fs.writeFile(file,JSON.stringify(build));
 const v=await command(folder);await fs.writeFile(path.join(folder,'console.log'),v.stdout+v.stderr);
 assert.ok(v.firstOutputMs<3000);assert.match(v.stdout,/报告已生成/);assert.match(v.stdout,/\[部分完成\]/);
 const report=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8'));assert.equal(report.status,'PARTIAL');assert.equal(report.collector_fatal.stage,'CHECK_INSTALLED_WORKER');assert.equal(report.side_effects.model_calls,0);
});
test('running only the CMD gives an extraction instruction instead of a missing File error',async()=>{
 const folder=path.join(qa,'delivered-incomplete '+crypto.randomUUID());await fs.mkdir(folder);await fs.copyFile(path.join(delivered,'双击诊断.cmd'),path.join(folder,'双击诊断.cmd'));
 const v=await command(folder);assert.equal(v.code,1);assert.match(v.stdout,/Extract ALL files/);assert.doesNotMatch(v.stdout+v.stderr,/to the -File parameter does not exist/);
});

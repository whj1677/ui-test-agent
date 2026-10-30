import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const run=promisify(execFile),dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const exe=path.join(dir,'OfficeReaderTrace.exe'),installed=path.join(root,'workbench/server/requirements/office-word-reader.exe');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['office-word-reader.exe','office-word-reader.cs','office-word-reader.build.json','office-reader.mjs'].map(name=>path.join(root,'workbench/server/requirements',name));
const locks=['workbench-native-host.lock','workbench-native-host.recovery.lock'].map(name=>path.join(root,'workbench/.local/fresh25-b/data/native-dsh/runtime-home',name));
const before=new Map(await Promise.all([...files,...locks].map(async file=>[file,await fs.readFile(file).then(sha).catch(()=>null)])));
test('trace retains outer native exception phase and HRESULT',async()=>{
 const missing=path.join(os.tmpdir(),'ui-diagnostic-missing-'+crypto.randomUUID()+'.docx');
 const result=JSON.parse((await run(exe,['read','--input',missing,'--owner',missing+'.owner','--provider','auto'],{windowsHide:true,timeout:20000})).stdout);
 assert.equal(result.status,'FAILED');assert.equal(result.phase,'INPUT_FILE_CHECK');assert.equal(result.diagnostic.input_exists,false);assert.equal(result.technical.exceptions[0].type,'System.Exception');assert.match(result.technical.exceptions[0].hresult_hex,/^0x[0-9A-F]{8}$/);
 const old=JSON.parse((await run(installed,['read','--input',missing,'--owner',missing+'.owner','--provider','auto'],{windowsHide:true,timeout:20000})).stdout);assert.equal(old.phase,undefined,'Reproduce the installed diagnostic gap');
});
test('registration probe activates no document and retains both registry views',async()=>{
 const result=JSON.parse((await run(exe,['probe'],{windowsHide:true,timeout:20000})).stdout);assert.equal(result.process_bits,64);assert.ok(result.checks.length);assert.ok(result.checks.some(row=>row.registry_view===32));
});
let report;
test('read-only collector finds actual lock location and captures CIM diagnostics',async()=>{
 const output=path.join(dir,'test-probe.json');await run(process.execPath,[path.join(dir,'collect.mjs'),'--program-root',root,'--output',output],{timeout:90000,windowsHide:true});report=JSON.parse(await fs.readFile(output,'utf8'));
 assert.equal(report.installed_worker.manifest_match,true);assert.equal(report.host_locks.data_root_matches_service,true);assert.equal(report.host_locks['workbench-native-host.lock'].exists,true);assert.ok(report.lock_processes.length);assert.equal(report.cim_environment.status,'OK');assert.equal(report.side_effects.model_calls,0);assert.equal(report.collector_fatal,undefined);
});
test('selected synthetic DOCX is tested via both workers without exporting source text',async()=>{
 const source=path.join(root,'workbench/qa/20261030-wps-port/synthetic-wps.docx'),output=path.join(dir,'test-document.json');
 await run(process.execPath,[path.join(dir,'collect.mjs'),'--program-root',root,'--output',output,'--document',source],{timeout:240000,windowsHide:true,env:{...process.env,DEEPSEEK_API_KEY:'SYNTHETIC_DIAGNOSTIC_KEY_NEVER_SENT'}});
 const bytes=await fs.readFile(output,'utf8'),v=JSON.parse(bytes);assert.equal(v.document.original_unchanged,true);assert.equal(v.document.temp_cleanup,'COMPLETE');assert.equal(v.document.tests[0].result.status,'PARTIAL');assert.equal(v.document.tests[1].result.status,'PARTIAL');
 assert.doesNotMatch(bytes,/WPS-SAVED-REQUIREMENT-20261030|Name is required\.|SYNTHETIC_DIAGNOSTIC_KEY_NEVER_SENT/);assert.ok(!bytes.includes(source));assert.ok(v.document.tests.every(row=>!row.result.segments));
});
test('production workers and host ownership locks remain byte-identical',async()=>{
 for(const [file,original]of before)assert.equal(await fs.readFile(file).then(sha).catch(()=>null),original,path.basename(file));
});

test('delivered PowerShell entry collects system metadata and merges it through bundled Node',async()=>{
 const output=path.join(dir,'wrapper-combined-'+crypto.randomUUID()+'.json');
 await run(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(dir,'collect.ps1'),'-ProgramRoot','D:/UAWps3Native','-SkipDocument','-Output',output],{timeout:90000,windowsHide:true});
 const text=await fs.readFile(output,'utf8'),v=JSON.parse(text);
 assert.equal(v.collector_fatal,undefined);assert.equal(v.bundled_node.collector_uses_bundled_node,true);assert.match(v.bundled_node.sha256,/^[a-f0-9]{64}$/);
 assert.equal(v.outside_sandbox_system.scope,'OUTSIDE_DSH_SANDBOX');assert.equal(v.outside_sandbox_system.model_calls,0);
 assert.ok(v.outside_sandbox_system.command_lookup.some(row=>row.name==='cmd.exe'&&row.status==='SYSTEM32'));
 assert.ok(['OK','NO_MATCHING_EVENTS','NOT_VERIFIED'].includes(v.outside_sandbox_system.event_status));
 for(const row of v.outside_sandbox_system.application_events||[])assert.equal(row.message,undefined);
 assert.ok(!text.includes(process.env.USERPROFILE));
 for(const [file,original]of before)assert.equal(await fs.readFile(file).then(sha).catch(()=>null),original,path.basename(file));
});

// Local metadata only. No service/model start, HTTP mutation, registry write,
// lock removal, or process termination (except exact Office worker-owned cleanup).
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const program=path.resolve(arg('--program-root')||''),selected=arg('--document'),output=arg('--output');
if(!output||!arg('--program-root')||args.length!==(selected?6:4))throw Error('DIAGNOSTIC_ARGUMENTS_INVALID');
const installed=path.join(program,'workbench/server/requirements/office-word-reader.exe'),trace=path.join(here,'OfficeReaderTrace.exe');
const hash=b=>createHash('sha256').update(b).digest('hex');
const secrets=Object.entries(process.env).filter(([k,v])=>/key|token|secret|password|cookie/i.test(k)&&v.length>=8).map(([,v])=>v);
function clean(v){if(typeof v==='string'){let s=v;for(const p of [selected,program,process.env.USERPROFILE].filter(Boolean))s=s.split(p).join('[LOCAL_PATH]');for(const key of secrets)s=s.split(key).join('[REDACTED]');return s.slice(0,8000);}if(Array.isArray(v))return v.slice(0,40).map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['segments','text','original_body','env','stdout','stderr'].includes(k)).map(([k,v])=>[k,clean(v)]));return v;}
const error=e=>({type:e.name,code:e.code||null,killed:Boolean(e.killed),signal:e.signal||null});
const environment=Object.fromEntries(['SystemRoot','WINDIR','COMSPEC','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','ProgramFiles','ProgramFiles(x86)','ProgramW6432','CommonProgramFiles','CommonProgramFiles(x86)','CommonProgramW6432','ALLUSERSPROFILE','USERNAME','USERDOMAIN','USERDNSDOMAIN','SYSTEMDRIVE','SESSIONNAME','LOGONSERVER','HOMEDRIVE','HOMEPATH'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
function summary(v){const keep=['status','code','phase','provider','hresult','diagnostic','checks','attempts','technical','diagnostic_revision','word','wps','process_bits'];const value=Object.fromEntries(keep.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));if(Array.isArray(v.segments)){value.segment_count=v.segments.length;value.character_count=v.segments.reduce((n,s)=>n+(s.text?.length||0),0);}return clean(value);}
async function worker(exe,command,extra=[]){try{const {stdout}=await run(exe,[command,...extra],{windowsHide:true,timeout:command==='read'?90000:12000,maxBuffer:24*1024*1024,encoding:'utf8',env:environment});return summary(JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch(e){return {status:'WORKER_INVOCATION_FAILED',error:error(e)};}}
const result={schema:'workbench/office-field-diagnostic-v1',at:new Date().toISOString(),platform:process.platform,arch:process.arch,node:process.version,side_effects:{model_calls:0,installed_program_files_modified:false,host_lock_files_modified:false,workbench_started:false,document_text_in_report:false}};
const systemReport=await fs.readFile(output+'.system.json').catch(()=>null);
if(systemReport&&systemReport.length<=32768){try{const v=JSON.parse(systemReport.toString('utf8'));if(v.schema==='workbench/field-system-diagnostic-v1')result.outside_sandbox_system=clean(v);}catch{result.outside_sandbox_system={status:'INVALID_REPORT'};}}
let technicalStage='CHECK_DIAGNOSTIC_PACKAGE';
async function checkpoint(stage){technicalStage=stage;result.current_stage=stage;result.status='COLLECTING';result.checkpoint_at=new Date().toISOString();await fs.writeFile(output,JSON.stringify(clean(result),null,2)+'\n');console.log('[阶段] '+stage);}
const fatal=async e=>{try{result.status='PARTIAL';result.collector_fatal={stage:technicalStage,...error(e)};await fs.writeFile(output,JSON.stringify(clean(result),null,2)+'\n');console.error('DIAGNOSTIC_PARTIAL_REPORT_WRITTEN');}catch{console.error('DIAGNOSTIC_OUTPUT_NOT_WRITABLE');}process.exitCode=1;};
process.once('unhandledRejection',fatal);process.once('uncaughtException',fatal);
await checkpoint('CHECK_DIAGNOSTIC_PACKAGE');
result.trace_build=JSON.parse(await fs.readFile(path.join(here,'trace-build.json'),'utf8'));
await checkpoint('CHECK_INSTALLED_WORKER');
if(hash(await fs.readFile(trace))!==result.trace_build.exe_sha256)throw Error('TRACE_INTEGRITY_FAILED');
const build=JSON.parse(await fs.readFile(path.join(program,'workbench/server/requirements/office-word-reader.build.json'),'utf8'));
result.installed_worker={bytes:(await fs.stat(installed)).size,sha256:hash(await fs.readFile(installed)),expected_sha256:build.sha256,manifest_match:hash(await fs.readFile(installed))===build.sha256};
const installedNode=path.join(program,'runtime/node/node.exe');
try{result.bundled_node={bytes:(await fs.stat(installedNode)).size,sha256:hash(await fs.readFile(installedNode)),collector_uses_bundled_node:path.resolve(process.execPath).toLowerCase()===path.resolve(installedNode).toLowerCase()};}catch(e){result.bundled_node={status:'NOT_VERIFIED',error:error(e)};}
await checkpoint('RUN_PROBES');
result.installed_probe=await worker(installed,'probe');result.trace_probe=await worker(trace,'probe');
let health;
await checkpoint('WORKBENCH_HEALTH');
try{health=await fetch('http://127.0.0.1:4322/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>r.json());if(health.service!=='approved-test-workbench')throw Error('UNRECOGNIZED_SERVICE');result.service={version:health.service_identity?.release?.version,source_sha256:health.service_identity?.source_sha256,data_root_sha256:health.service_identity?.data_root_sha256,native_status:health.native_dsh?.runtime?.error||health.native_dsh?.runtime?.runtime?.error||null,native_state:health.native_dsh?.runtime?.runtime?.state,active_native_task:Boolean(health.native_dsh?.active_task_id),active_assistant:Boolean(health.case_assistant?.active_turn_id)};}catch(e){result.service={status:'NOT_VERIFIED',error:error(e)};}
await checkpoint('HOST_LOCK_METADATA');
const dataRoot=path.join(program,'workbench/.local/fresh25-b'),dataHash=hash(Buffer.from(path.resolve(dataRoot)));
const pids=new Set();result.host_locks={data_root_matches_service:dataHash===health?.service_identity?.data_root_sha256};
if(result.host_locks.data_root_matches_service){
 for(const name of ['workbench-native-host.lock','workbench-native-host.recovery.lock']){
  const file=path.join(dataRoot,'data/native-dsh/runtime-home',name),stat=await fs.lstat(file).catch(()=>null);
  if(!stat){result.host_locks[name]={exists:false};continue;}
  const row={exists:true,bytes:stat.size,modified_at:stat.mtime.toISOString(),is_link:stat.isSymbolicLink()};
  if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=4096){try{const v=JSON.parse(await fs.readFile(file,'utf8'));row.schema=v.schema;row.parent_pid=v.parent_pid;row.host_pid=v.host_pid;row.started_at=v.started_at;for(const key of ['parent_identity','host_identity'])if(v[key])row[key]={source:v[key].source,pid:v[key].pid,created_at:v[key].created_at};for(const id of [v.parent_pid,v.host_pid])if(Number.isSafeInteger(id)&&id>0&&id<=0xffffffff)pids.add(id);}catch{row.parse_error=true;}}
  result.host_locks[name]=row;
 }
}
// Same minimal PowerShell environment used by the product's lock inspection.
const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
async function ps(script,env={}){try{const {stdout}=await run(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:12000,maxBuffer:32000,encoding:'utf8',env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,...env}});return JSON.parse(stdout.replace(/^\uFEFF/,'').trim());}catch(e){return {status:'PS_INVOCATION_FAILED',error:error(e)};}}
result.lock_processes=[];
await checkpoint('PROCESS_IDENTITY');
for(const id of pids){let liveness;try{process.kill(id,0);liveness='PRESENT_OR_ACCESSIBLE';}catch(e){liveness=e.code==='ESRCH'?'DEAD':'UNKNOWN';}result.lock_processes.push({pid:id,liveness,cim:await ps(String.raw`try{$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$env:DIAG_PID);if($null-eq$p){@{status='NOT_FOUND'}|ConvertTo-Json -Compress}else{@{status='FOUND';pid=$p.ProcessId;parent_pid=$p.ParentProcessId;created_at=$p.CreationDate.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'");image_name=$p.Name;has_command_line=[bool]$p.CommandLine}|ConvertTo-Json -Compress}}catch{@{status='ERROR';type=$_.Exception.GetType().FullName;id=$_.FullyQualifiedErrorId}|ConvertTo-Json -Compress}`,{DIAG_PID:String(id)})});}
result.cim_environment=await ps(String.raw`try{$ErrorActionPreference='Stop';$nodes=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'");@{status='OK';node_count=$nodes.Count;unknown_command_count=@($nodes|Where-Object{-not $_.CommandLine}).Count;exact_dsh_command_count=@($nodes|Where-Object{$_.CommandLine-and$_.CommandLine.Replace([char]47,[char]92).IndexOf($env:DIAG_DSH_BIN,[StringComparison]::OrdinalIgnoreCase)-ge0}).Count;dotnet_release=[Microsoft.Win32.Registry]::GetValue('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full','Release',$null)}|ConvertTo-Json -Compress}catch{@{status='ERROR';type=$_.Exception.GetType().FullName;id=$_.FullyQualifiedErrorId}|ConvertTo-Json -Compress}`,{DIAG_DSH_BIN:path.join(program,'workbench/native/node_modules/@deepseek-ai/dsh/lib/bin.js')});
await checkpoint('SELECTED_DOCUMENT');
if(selected){
 if(!path.isAbsolute(selected)||path.extname(selected).toLowerCase()!=='.docx')throw Error('SELECTED_DOCX_REQUIRED');
 const bytes=await fs.readFile(selected);if(!bytes.length||bytes.length>10*1024*1024)throw Error('DOCUMENT_SIZE_LIMIT');
 const before=hash(bytes),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'ui-office-field-diag-'));
 const snapshot=path.join(temporary,'source.docx');await fs.writeFile(snapshot,bytes,{flag:'wx'});
 result.document={bytes:bytes.length,sha256:before,node_format:bytes.subarray(0,2).toString()==='PK'?'ZIP':'OPAQUE',tests:[]};
 try{
  for(const [name,exe,input] of [['installed_uploaded_snapshot',installed,snapshot],['trace_uploaded_snapshot',trace,snapshot]]){
   await checkpoint(name==='installed_uploaded_snapshot'?'READ_INSTALLED_SNAPSHOT':'READ_TRACE_SNAPSHOT');
   const owner=path.join(temporary,name+'.owner.json'),value=await worker(exe,'read',['--input',input,'--owner',owner,'--provider','auto']);
   const row={name,result:value};if(await fs.stat(owner).catch(()=>false))try{await run(exe,['cleanup','--owner',owner],{windowsHide:true,timeout:8000,env:environment});row.owned_cleanup='CONFIRMED';}catch(e){row.owned_cleanup='UNCONFIRMED';row.cleanup_error=error(e);}
   result.document.tests.push(row);
  }
 }finally{
  result.document.original_unchanged=hash(await fs.readFile(selected))===before;
  if(path.dirname(path.resolve(temporary))===path.resolve(os.tmpdir())&&path.basename(temporary).startsWith('ui-office-field-diag-'))try{await fs.rm(temporary,{recursive:true,force:true});result.document.temp_cleanup='COMPLETE';}catch{result.document.temp_cleanup='INCOMPLETE';}
 }
}else result.document={status:'NOT_SELECTED'};
result.status='COMPLETE';result.current_stage='COMPLETE';result.finished_at=new Date().toISOString();
await fs.writeFile(output,JSON.stringify(clean(result),null,2)+'\n');console.log('DIAGNOSTIC_REPORT_WRITTEN');

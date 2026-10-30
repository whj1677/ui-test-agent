import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DiagnosticJournal,diagnosticRoot} from '../server/diagnostics.mjs';
import {modelDiagnostics} from './diagnose-model.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function exportDiagnostics({programRoot=root,environment=process.env,inspectRuntime=modelDiagnostics}={}) {
 const programId=createHash('sha256').update(path.resolve(programRoot)).digest('hex').slice(0,16);
 const journal=new DiagnosticJournal({root:path.join(diagnosticRoot(environment),programId)});
 const release=await fs.readFile(path.join(programRoot,'workbench/release.json'),'utf8').then(JSON.parse).catch(()=>({version:'unavailable'}));
 const model=await inspectRuntime({root:programRoot,environment}).catch(error=>({status:'DIAGNOSTICS_UNAVAILABLE',code:error.code||'DIAGNOSTICS_FAILED'}));
 return journal.export({version:release.version,program_id:programId,platform:process.platform,arch:process.arch,node:process.version,os_release:os.release(),mode:'OFFLINE_EXPORT',model_calls:0,model_diagnostics:model});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=path.join(root,`测试Agent-诊断日志-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
 exportDiagnostics().then(async value=>{let destination=output;const text=JSON.stringify(value,null,2)+'\n';try{await fs.writeFile(destination,text,{flag:'wx'});}catch(error){if(!['EACCES','EPERM','EROFS'].includes(error.code))throw error;destination=path.join(os.tmpdir(),path.basename(output));await fs.writeFile(destination,text,{flag:'wx'});}console.log('已导出：'+destination);if(!value.events.length)console.log('本程序未找到已记录日志；部署日志版本后复现问题，才能取得新事件。');if(value.status.last_write_error)console.log('日志存储存在错误，已在导出文件中记录。');}).catch(error=>{console.error('DIAGNOSTIC_EXPORT_FAILED: '+(error.code||error.message));process.exitCode=1;});
}

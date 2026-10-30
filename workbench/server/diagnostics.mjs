import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,createHash} from 'node:crypto';
import {appendFileSync,mkdirSync,lstatSync} from 'node:fs';

const secretKey=/api.?key|token|secret|password|authorization|cookie|credential/i;
const privateKey=/^(body|content|prompt|messages|document|source_text|html|env|environment_variables)$/i;
const knownSecrets=new Set();
export function registerDiagnosticSecret(value){if(typeof value!=='string'||value.length<8||value.length>4096)return;if(knownSecrets.size>=32)knownSecrets.delete(knownSecrets.values().next().value);knownSecrets.add(value);}
export function diagnosticText(value) {
 const input=String(value??'');
 let initial=input.slice(0,20096);
 for(const secret of knownSecrets){initial=initial.split(secret).join('[REDACTED_KEY]');const prefix=secret.slice(0,8).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');initial=initial.replace(new RegExp(prefix+'[A-Za-z0-9_./+=-]*','g'),'[REDACTED_KEY]');}
 const cleaned=initial.slice(0,16000).replace(/\x1b\[[0-9;]*m/g,'')
  .replace(/\bBearer\s+[^\s"'<>]+/gi,'Bearer [REDACTED]')
  .replace(/\b(?:sk|ds)[-_][A-Za-z0-9_-]{8,}/g,'[REDACTED_KEY]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g,'[REDACTED_JWT]')
  .replace(/(?:https?|wss?):\/\/[^\s"'<>]+/gi,text=>{try{const u=new URL(text);return /^wss?:$/.test(u.protocol)||u.pathname.includes('/devtools/')?u.origin+'/[BROWSER_CONNECTION]':u.origin+u.pathname;}catch{return '[URL]';}})
  .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|cookie|set-cookie)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;}]+)/gi,'$1[REDACTED]')
  .replace(/((?:--?|\/)(?:api[-_]?key|access[-_]?token|token|password|secret)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s]+)/gi,'$1[REDACTED]')
  .replace(/((?:body|content|prompt|messages|document)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*')/gi,'$1[OMITTED]')
  .replace(/[A-Z]:[\\/]Users[\\/][^\\/\r\n]+/gi,'%USERPROFILE%');
 return input.length>16000||cleaned.length>8000?cleaned.slice(0,7950)+' [TRUNCATED]':cleaned;
}
export function diagnosticValue(value,depth=0,seen=new WeakSet()) {
 if(depth>6)return '[DEPTH_LIMIT]';
 if(value===null||typeof value==='boolean'||typeof value==='number')return value;
 if(typeof value==='string')return diagnosticText(value);
 if(typeof value!=='object')return String(value??'');
 if(seen.has(value))return '[CYCLE]';seen.add(value);
 if(value instanceof Error)value={name:value.name,message:value.message,stack:value.stack,code:value.code,phase:value.phase,hresult:value.hresult,office:value.office,cause:value.cause,stderr:value.stderr,exit_code:value.exitCode,remote_code:value.remote_code,status:value.status,syscall:value.syscall,errno:value.errno,address:value.address,port:value.port};
 if(Array.isArray(value))return value.slice(0,30).map(v=>diagnosticValue(v,depth+1,seen));
 return Object.fromEntries(Object.entries(value).slice(0,50).filter(([,v])=>v!==undefined).map(([k,v])=>[k,secretKey.test(k)?'[REDACTED]':privateKey.test(k)?'[OMITTED]':diagnosticValue(v,depth+1,seen)]));
}
export function diagnosticRoot(environment=process.env) {
 const base=environment.LOCALAPPDATA||path.join(os.homedir(),'.local','state');
 return path.join(base,'ui-test-agent','runtime','diagnostics');
}
export class DiagnosticJournal {
 constructor({root,metadata={},maxBytes=2*1024*1024,files=5,maxAgeMs=14*86400000,maxPending=500,role="server"}={}) {
  if(!["server","launcher"].includes(role))throw Error("DIAGNOSTIC_ROLE_INVALID");this.role=role;
  this.root=path.resolve(root);this.metadata=diagnosticValue(metadata);this.maxBytes=maxBytes;this.files=files;this.maxAgeMs=maxAgeMs;this.maxPending=maxPending;this.queue=Promise.resolve();this.pending=0;this.dropped=0;this.lastError=null;this.contextStorage=new AsyncLocalStorage();
 }
 context(data,fn){return this.contextStorage.run({...this.contextStorage.getStore(),...data},fn);}
 file(i,role=this.role){return path.join(this.root,`events.${role}.${i}.jsonl`);}
 async safeFile(i,role=this.role){const p=this.file(i,role),s=await fs.lstat(p).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(s&&(!s.isFile()||s.isSymbolicLink()))throw Error('DIAGNOSTIC_FILE_UNSAFE');return {p,s};}
 async directory(){await fs.mkdir(this.root,{recursive:true});if((await fs.lstat(this.root)).isSymbolicLink())throw Error('DIAGNOSTIC_ROOT_UNSAFE');}
 async prune(){for(const role of ["server","launcher"])for(let i=0;i<this.files;i++){const {p,s}=await this.safeFile(i,role);if(s&&Date.now()-s.mtimeMs>this.maxAgeMs)await fs.unlink(p);}}
 record(component,event,data={},level='info') {
  try{return this.writeRecord(component,event,data,level);}catch(error){this.dropped++;this.lastError=diagnosticText(error.code||error.message);return Promise.resolve(false);}
 }
 writeRecord(component,event,data={},level='info') {
  if(this.pending>=this.maxPending){this.dropped++;return Promise.resolve(false);}
  let record={schema:'workbench/diagnostic-event-v1',at:new Date().toISOString(),event_id:randomUUID(),level:['info','warn','error'].includes(level)?level:'info',component:diagnosticText(component),event:diagnosticText(event),...this.metadata,...diagnosticValue(this.contextStorage.getStore()||{}),data:diagnosticValue(data)};
  if(Buffer.byteLength(JSON.stringify(record))>16000)record={...record,data:{truncated:true,excerpt:Buffer.from(JSON.stringify(record.data)).subarray(0,6000).toString('utf8')}};
  const line=JSON.stringify(record)+'\n';this.pending++;
  const operation=this.queue.then(async()=>{
   await this.directory();await this.prune();const current=await this.safeFile(0);
   if(current.s&&current.s.size+Buffer.byteLength(line)>this.maxBytes){
    const oldest=await this.safeFile(this.files-1);if(oldest.s)await fs.unlink(oldest.p);
    for(let i=this.files-2;i>=0;i--){const f=await this.safeFile(i);if(f.s)await fs.rename(f.p,this.file(i+1));}
   }
   await fs.appendFile(this.file(0),line,{encoding:'utf8',mode:0o600});return true;
  }).catch(error=>{this.dropped++;this.lastError=diagnosticText(error.code||error.message);return false;}).finally(()=>this.pending--);
  this.queue=operation.then(()=>{});return operation;
 }
 async flush(){await this.queue;}
 fatal(error){try{mkdirSync(this.root,{recursive:true});if(lstatSync(this.root).isSymbolicLink())throw Error('DIAGNOSTIC_ROOT_UNSAFE');const p=this.file(0);try{const s=lstatSync(p);if(s.isSymbolicLink()||!s.isFile())throw Error('DIAGNOSTIC_FILE_UNSAFE');}catch(e){if(e.code!=='ENOENT')throw e;}const event={schema:'workbench/diagnostic-event-v1',at:new Date().toISOString(),event_id:randomUUID(),level:'error',component:'service',event:'uncaught.exception',...this.metadata,data:diagnosticValue(error)};if(Buffer.byteLength(JSON.stringify(event))>16000)event.data={truncated:true,excerpt:Buffer.from(JSON.stringify(event.data)).subarray(0,6000).toString('utf8')};appendFileSync(p,JSON.stringify(event)+'\n',{mode:0o600});}catch(e){this.dropped++;this.lastError=diagnosticText(e.code||e.message);}}
 status(){return {enabled:true,pending:this.pending,dropped:this.dropped,last_write_error:this.lastError,retention_days:this.maxAgeMs/86400000,max_files:this.files*2,max_file_bytes:this.maxBytes};}
 async export(snapshot={}) {
  await this.flush();const events=[];let unreadable=0,partial=0;
  try{await this.directory();await this.prune();for(const role of ["server","launcher"])for(let i=this.files-1;i>=0;i--){const {p,s}=await this.safeFile(i,role);if(!s)continue;const handle=await fs.open(p,'r');try{const limit=this.maxBytes+16000,start=Math.max(0,s.size-limit),buffer=Buffer.alloc(Math.min(s.size,limit));const {bytesRead}=await handle.read(buffer,0,buffer.length,start);let text=buffer.subarray(0,bytesRead).toString('utf8');if(start){partial++;text=text.slice(text.indexOf('\n')+1);}for(const line of text.split('\n')){if(!line.trim())continue;try{const e=JSON.parse(line);if(e.schema==='workbench/diagnostic-event-v1'&&typeof e.at==='string'&&!Number.isNaN(Date.parse(e.at)))events.push(diagnosticValue(e));else unreadable++;}catch{unreadable++;}}}finally{await handle.close();}}}catch(error){unreadable++;this.lastError=diagnosticText(error.code||error.message);}
  return {schema:'workbench/diagnostic-bundle-v1',exported_at:new Date().toISOString(),status:this.status(),unreadable_records:unreadable,partial_files:partial,snapshot:diagnosticValue(snapshot),events:events.sort((a,b)=>a.at.localeCompare(b.at))};
 }
}
let active=null;
export const diagnostics={
 record:(...args)=>active?.record(...args)||Promise.resolve(false),
 context:(data,fn)=>active?active.context(data,fn):fn(),
 status:()=>active?.status()||{enabled:false},
 export:snapshot=>active?active.export(snapshot):Promise.resolve({schema:'workbench/diagnostic-bundle-v1',status:{enabled:false},snapshot:diagnosticValue(snapshot),events:[]}),
 flush:()=>active?.flush()||Promise.resolve(),
 fatal:error=>active?.fatal(error),
};
export function configureDiagnostics({root=diagnosticRoot(),programRoot=process.cwd(),version='unknown',...options}={}) {
 for(const [key,value] of Object.entries(process.env))if(secretKey.test(key))registerDiagnosticSecret(value);
 const programId=createHash('sha256').update(path.resolve(programRoot)).digest('hex').slice(0,16);
 active=new DiagnosticJournal({root:path.join(root,programId),metadata:{program_id:programId,instance_id:randomUUID(),version,pid:process.pid,os_release:os.release()},...options});return active;
}
export function browserDiagnosticLines(text) {
 const lines=String(text||'').slice(0,256000).split(/\r?\n/);
 const selected=lines.filter(line=>/browserType\.|chromium|sandbox|\bCDP\b|connectOverCDP|webSocketDebuggerUrl|\/devtools\/|DevToolsActivePort|"Browser"\s*:|"Protocol-Version"\s*:|executable|spawn.*(?:EPERM|EACCES)|SetNamedSecurityInfoW|Failed to launch/i.test(line)).slice(0,15);
 if(!selected.length)return '';
 const footer=lines.findLast(line=>/^\[exit code: -?\d+\]\s*$/.test(line));
 return [...selected,...(footer?[footer]:[])].map(diagnosticText).join('\n');
}

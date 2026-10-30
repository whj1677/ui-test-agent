import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {DiagnosticJournal,diagnosticValue,browserDiagnosticLines,configureDiagnostics,diagnosticRoot,registerDiagnosticSecret} from '../server/diagnostics.mjs';
import {createHash} from 'node:crypto';
import {exportDiagnostics} from '../scripts/export-diagnostics.mjs';
import {readWordDocument} from '../server/requirements/office-reader.mjs';
import {createWorkbenchServer} from '../server/app.mjs';
async function temp(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-diag-test-'));t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('workbench-diag-test-'));return fs.rm(root,{recursive:true,force:true});});return root;}

test('credentials, browser connections, document fields and nested error causes are redacted before disk and export',async t=>{
 const root=await temp(t),journal=new DiagnosticJournal({root});
 registerDiagnosticSecret('OPAQUE_TEST_KEY_012345');
 await journal.record('fixture','opaque-secret',{message:'OPAQUE_TEST_KEY_012345 -ApiKey "PRIVATE_CLI_KEY"'});
 const cause=Object.assign(Error('password="fake private password" https://user:private@localhost:4322/app?token=private-query'),{code:'EPERM'});
 const error=Object.assign(Error('spawn Chromium EPERM'),{cause,stderr:'Authorization: Bearer fake-bearer\ncontent="PRIVATE_DOCUMENT_TEXT"\nws://127.0.0.1:9222/devtools/browser/private-id'});
 await journal.record('browser','failed',{error,apiKey:'PRIVATE_KEY',body:'PRIVATE_BODY',prompt:'PRIVATE_PROMPT',nested:{cookie:'PRIVATE_COOKIE'}},'error');
 const raw=await fs.readFile(journal.file(0),'utf8'),bundle=JSON.stringify(await journal.export());
 for(const forbidden of ['OPAQUE_TEST_KEY_012345','PRIVATE_CLI_KEY','fake private password','private-query','user:private','fake-bearer','PRIVATE_DOCUMENT_TEXT','PRIVATE_KEY','PRIVATE_BODY','PRIVATE_PROMPT','PRIVATE_COOKIE','private-id']){assert.ok(!raw.includes(forbidden),forbidden);assert.ok(!bundle.includes(forbidden),forbidden);}
 assert.match(raw,/EPERM/);assert.match(raw,/REDACTED/);
});
test('normal request/task events retain correlation across awaits and errors have the same request id',async t=>{
 const journal=new DiagnosticJournal({root:await temp(t),metadata:{version:'fixture',instance_id:'instance-1'}});
 await journal.context({request_id:'request-a'},async()=>{await journal.record('http','started');await Promise.resolve();await journal.context({task_id:'task-a'},()=>journal.record('task','finished',{elapsed_ms:12}));});
 const events=(await journal.export()).events;assert.equal(events.length,2);assert.ok(events.every(e=>e.request_id==='request-a'));assert.equal(events[1].task_id,'task-a');assert.equal(events[0].version,'fixture');
});
test('rotation is bounded, launcher and server are independent writers, and expired logs are removed',async t=>{
 const root=await temp(t),server=new DiagnosticJournal({root,maxBytes:800,files:2}),launcher=new DiagnosticJournal({root,maxBytes:800,files:2,role:'launcher'});
 for(let i=0;i<18;i++)await Promise.all([server.record('http','normal',{i,text:'x'.repeat(180)}),launcher.record('launcher','normal',{i})]);
 assert.ok((await fs.readdir(root)).length<=4);const bundle=await server.export();assert.ok(bundle.events.some(e=>e.component==='launcher'));assert.ok(bundle.events.some(e=>e.component==='http'));
 for(const file of await fs.readdir(root))await fs.utimes(path.join(root,file),new Date(0),new Date(0));
 assert.equal((await server.export()).events.length,0);
});
test('full queue, unusable storage and hostile serializers degrade logging without rejecting the business operation',async t=>{
 const root=await temp(t),file=path.join(root,'not-directory');await fs.writeFile(file,'preserved');
 const journal=new DiagnosticJournal({root:file,maxPending:1});const first=journal.record('x','a');assert.equal(await journal.record('x','b'),false);assert.equal(await first,false);assert.ok(journal.status().dropped>=2);assert.ok(journal.status().last_write_error);
 const hostile={get message(){throw Error('getter failure');}};assert.equal(await journal.record('x','c',hostile),false);assert.equal(await fs.readFile(file,'utf8'),'preserved');
});
test('corrupt records are counted, oversized data is bounded, and fatal errors survive synchronous capture',async t=>{
 const journal=new DiagnosticJournal({root:await temp(t)});
 await journal.record('x','large',{text:'a'.repeat(100000)});await journal.record('x','unicode',{a:'测试'.repeat(4000),b:'堆栈'.repeat(4000)});assert.ok((await fs.readFile(journal.file(0),'utf8')).trim().split('\n').every(line=>Buffer.byteLength(line)<=16000));await fs.appendFile(journal.file(0),'not json\n'+JSON.stringify({schema:'workbench/diagnostic-event-v1',at:42})+'\n');journal.fatal(Object.assign(Error('fatal fixture'),{code:'SYNTHETIC'}));
 const result=await journal.export();assert.equal(result.unreadable_records,2);assert.ok(result.events.some(e=>e.event==='uncaught.exception'));assert.ok((await fs.stat(journal.file(0))).size<40000);
});
test('Chromium errors in successful pwsh output are captured without unrelated document lines',()=>{
 const lines=browserDiagnosticLines('private requirement paragraph\nbrowserType.launch: spawn EPERM\nChromium executable does not exist\n[exit code: 0]');
 assert.match(lines,/EPERM/);assert.match(lines,/exit code: 0/);assert.ok(!lines.includes('private requirement'));
 assert.equal(browserDiagnosticLines('normal command completed\n[exit code: 0]'),'');
 assert.match(browserDiagnosticLines('"webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/private-session"'),/127\.0\.0\.1:9222/);
 assert.ok(!browserDiagnosticLines('"webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/private-session"').includes('private-session'));
 const cyclic={};cyclic.cause=cyclic;assert.match(JSON.stringify(diagnosticValue(cyclic)),/CYCLE/);
});
class Response extends EventEmitter{constructor(){super();this.headers={};this.statusCode=200;}setHeader(k,v){this.headers[k.toLowerCase()]=v;}writeHead(code,headers){this.statusCode=code;for(const [k,v] of Object.entries(headers))this.setHeader(k,v);}end(data){this.body=data||'';this.emit('finish');}}
async function request(server,url,{method='GET',headers={},body}={}){const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);Object.assign(req,{method,url,headers:{host:'127.0.0.1:4322',...headers}});const res=new Response();await server.listeners('request')[0](req,res);return res;}
test('HTTP export enforces local origin, captures real request failure and exposes correlation id without opening any server',async t=>{
 const journal=new DiagnosticJournal({root:await temp(t)}),server=createWorkbenchServer({diagnostics:journal,buildManager:{diagnostics(){throw Object.assign(Error('synthetic launch EPERM'),{cause:Error('denied fixture')});}}});
 const failed=await request(server,'/api/health?token=NEVER_LOG_QUERY');assert.equal(failed.statusCode,422);assert.ok(failed.headers['x-diagnostic-id']);
 const denied=await request(server,'/api/diagnostics/export',{headers:{origin:'https://untrusted.example'}});assert.equal(denied.statusCode,403);
 const hostile=await request(server,'/api/diagnostics/client',{method:'POST',headers:{origin:'https://untrusted.example'},body:{kind:'error',message:'x'}});assert.equal(hostile.statusCode,403);
 const client=await request(server,'/api/diagnostics/client',{method:'POST',headers:{origin:'http://127.0.0.1:4322','content-type':'application/json'},body:{kind:'error',message:'测试异常'.repeat(500),stack:'调用堆栈'.repeat(750)}});assert.equal(client.statusCode,202);
 const script=await request(server,'/workspace/diagnostics-ui.js');assert.equal(script.statusCode,200);assert.match(script.headers['content-type'],/javascript/);
 const exported=await request(server,'/api/diagnostics/export',{headers:{origin:'http://127.0.0.1:4322'}});assert.equal(exported.statusCode,200);const bundle=JSON.parse(exported.body);assert.ok(bundle.events.some(e=>e.event==='request.failed'&&e.request_id===failed.headers['x-diagnostic-id']));assert.ok(!exported.body.includes('NEVER_LOG_QUERY'));
});

test('offline export reads the same installation journal without starting services or touching credentials',async t=>{
 const root=await temp(t),environment={LOCALAPPDATA:path.join(root,'local')};await fs.mkdir(path.join(root,'workbench'));await fs.writeFile(path.join(root,'workbench/release.json'),JSON.stringify({version:'offline-fixture'}));
 const programId=createHash('sha256').update(path.resolve(root)).digest('hex').slice(0,16),journal=new DiagnosticJournal({root:path.join(diagnosticRoot(environment),programId)});
 await journal.record('fixture','offline.failure',{code:'SYNTHETIC_EPERM'},'error');
 const bundle=await exportDiagnostics({programRoot:root,environment,inspectRuntime:async()=>({saved_key:false,service:{status:'UNREACHABLE'}})});assert.equal(bundle.snapshot.version,'offline-fixture');assert.equal(bundle.snapshot.model_calls,0);assert.ok(bundle.events.some(e=>e.data.code==='SYNTHETIC_EPERM'));assert.equal(bundle.snapshot.model_diagnostics.saved_key,false);
});
test('Office failure keeps phase, HRESULT and process/document diagnostics without leaking original document text',async t=>{
 const journal=configureDiagnostics({root:await temp(t),programRoot:process.cwd(),version:'office-fixture'});
 await assert.rejects(readWordDocument({body:Buffer.alloc(1024),platform:'win32',run:async()=>({stdout:JSON.stringify({status:'FAILED',code:'REQUIREMENT_OFFICE_BUSY',phase:'CREATE_INSTANCE',hresult:-1,diagnostic:{process_identified:false,new_process:false,document_count:1,busy_reason:'PROCESS_NOT_IDENTIFIED'},segments:[{text:'PRIVATE_DOCUMENT'}]})})}),/OFFICE_BUSY/);
 const bundle=await journal.export(),event=bundle.events.find(e=>e.event==='read.rejected');assert.equal(event.data.phase,'CREATE_INSTANCE');assert.equal(event.data.hresult,-1);assert.equal(event.data.probe.document_count,1);assert.ok(!JSON.stringify(bundle).includes('PRIVATE_DOCUMENT'));
});

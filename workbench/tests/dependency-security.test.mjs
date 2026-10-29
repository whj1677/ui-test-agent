import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=fileURLToPath(new URL('../..',import.meta.url)),exec=promisify(execFile);
async function fixture(t,handler){
 const server=http.createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 assert.notEqual(server.address().port,4322);return `http://127.0.0.1:${server.address().port}/mcp`;
}
async function rpc(request,response){
 if(request.method==='GET'){response.writeHead(405).end();return;}
 if(request.method==='DELETE'){response.writeHead(200).end();return;}
 let raw='';for await(const b of request)raw+=b;
 const message=JSON.parse(raw);if(message.id===undefined){response.writeHead(202).end();return;}
 const result=message.method==='initialize'?{protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'local-fixture',version:'1'}}
  :message.method==='tools/list'?{tools:[{name:'echo',description:'Controlled fixture',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value']}}]}
  :message.method==='tools/call'?{content:[{type:'text',text:message.params.arguments.value}],isError:false}:{};
 response.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
}
for(const scope of ['harness-probe','workbench/native']){
 const require=createRequire(path.join(root,scope,'node_modules/@deepseek-ai/dsh-mcp-client/package.json'));
 const main=require.resolve('@modelcontextprotocol/client'),module=await import(pathToFileURL(path.join(path.dirname(main),'index.mjs')));
 test(scope+' retains DSH MCP imports and performs real discovery/tool calls with the patched client',async t=>{
  assert.equal(JSON.parse(await fs.readFile(path.join(path.dirname(main),'../package.json'),'utf8')).version,'2.3.0');
  assert.equal(typeof module.specTypeSchemas,'object');assert.equal(typeof module.Client,'function');
  const stdio=await import(pathToFileURL(path.join(path.dirname(main),'stdio.mjs')));assert.equal(typeof stdio.StdioClientTransport,'function');
  const endpoint=await fixture(t,(q,s)=>void rpc(q,s));
  const client=new module.Client({name:'local-security-fixture',version:'1'},{capabilities:{}});
  t.after(()=>client.close());await client.connect(new module.StreamableHTTPClientTransport(new URL(endpoint)));
  assert.equal((await client.listTools(undefined,{cacheMode:'refresh'})).tools[0].name,'echo');
  assert.equal((await client.callTool({name:'echo',arguments:{value:'synthetic-only'}})).content[0].text,'synthetic-only');
 });
 test(scope+' rejects cross-origin redirect without forwarding the synthetic header or body',async t=>{
  let leaked=0;
  const destination=await fixture(t,(q,s)=>{leaked++;void rpc(q,s);});
  const redirect=await fixture(t,(q,s)=>{q.resume();s.writeHead(307,{location:destination}).end();});
  const client=new module.Client({name:'local-redirect-fixture',version:'1'},{capabilities:{}});t.after(()=>client.close());
  await assert.rejects(client.connect(new module.StreamableHTTPClientTransport(new URL(redirect),{requestInit:{headers:{'X-Private-Test':'synthetic-only-not-a-credential'}}})));
  assert.equal(leaked,0);
 });
 test(scope+' rejects malformed ZIP64 promptly and retains valid compression and image rendering',async()=>{
  const office=createRequire(path.join(root,scope,'node_modules/@deepseek-ai/libreoffice-kit/lib/index.js')),fflate=office.resolve('fflate');
  assert.equal(JSON.parse(await fs.readFile(path.join(path.dirname(fflate),'../package.json'),'utf8')).version,'0.8.3');
  const source=`const assert=require('node:assert/strict'),f=require(process.argv[1]);
   const z=f.zipSync({'a.txt':new Uint8Array([65])},{level:0});assert.equal(f.unzipSync(z)['a.txt'][0],65);
   const b=Buffer.from(z),i=b.indexOf(Buffer.from([80,75,1,2])),end=b.length-22;assert.ok(i>=0);
   const record=Buffer.alloc(56),locator=Buffer.alloc(20);
   record.writeUInt32LE(0x06064b50,0);record.writeBigUInt64LE(44n,4);record.writeUInt16LE(45,12);record.writeUInt16LE(45,14);
   record.writeBigUInt64LE(1n,24);record.writeBigUInt64LE(1n,32);record.writeBigUInt64LE(BigInt(b.readUInt32LE(end+12)),40);record.writeBigUInt64LE(BigInt(i),48);
   locator.writeUInt32LE(0x07064b50,0);locator.writeBigUInt64LE(BigInt(end),8);locator.writeUInt32LE(1,16);
   b.writeUInt32LE(0xffffffff,i+20);b.writeUInt32LE(0xffffffff,end+16);const malformed=Buffer.concat([b.subarray(0,end),record,locator,b.subarray(end)]);
   assert.throws(()=>f.unzipSync(malformed));console.log('MALFORMED_ZIP_REJECTED');`;
  const result=await exec(process.execPath,['-e',source,fflate],{timeout:3000,windowsHide:true});assert.match(result.stdout,/MALFORMED_ZIP_REJECTED/);
  const own=createRequire(path.join(root,scope,'package.json')),sharp=own('sharp');
  const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>')).png().toBuffer();
  assert.equal((await sharp(image).metadata()).width,16);
 });
}

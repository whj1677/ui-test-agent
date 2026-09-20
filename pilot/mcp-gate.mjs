import {spawn} from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import {allowed,validateCall} from './gate.mjs';
const [workspace,cli,entry,log]=process.argv.slice(2);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(ANTHROPIC|API_KEY|AUTH_TOKEN|DEEPSEEK)/i.test(k)));
const child=spawn(process.execPath,[cli,'run-test-mcp-server'],{cwd:workspace,env,stdio:['pipe','pipe','pipe'],windowsHide:true});
child.stderr.on('data',b=>fs.appendFileSync(log+'.stderr',b));
let calls=0,setup=0,writes=0;const pending=new Map();
const journal=(v)=>fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...v})+'\n');
const send=(v)=>process.stdout.write(JSON.stringify(v)+'\n');
const input=readline.createInterface({input:process.stdin});
input.on('line',line=>{
 let m;try{m=JSON.parse(line);}catch{return;}
 if(m.method && !['initialize','notifications/initialized','notifications/cancelled','ping','tools/list','tools/call'].includes(m.method)){
  journal({kind:'denied',method:m.method,reason:'METHOD_DENIED'});
  if(m.id!==undefined)send({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'METHOD_DENIED'}});
  return;
 }
 if(m.method==='tools/call'){
  const {name,arguments:args={}}=m.params;
  try{
   if(++calls>100)throw Error('TOOL_BUDGET_EXHAUSTED');
   validateCall(name,args,entry);
   if(name==='generator_setup_page' && setup++)throw Error('SEED_ALREADY_USED');
   if(name==='generator_write_test' && writes++)throw Error('DRAFT_ALREADY_WRITTEN');
   if(name==='generator_setup_page')m.params.arguments={...args,seedFile:'seed.spec.ts',project:'chromium'};
   journal({kind:'call',name,args,forwarded_args:m.params.arguments});
  }catch(e){journal({kind:'denied',name,reason:e.message});send({jsonrpc:'2.0',id:m.id,result:{isError:true,content:[{type:'text',text:e.message}]}});return;}
 }
 if(m.id!==undefined)pending.set(m.id,m.method);
 child.stdin.write(JSON.stringify(m)+'\n');
});
readline.createInterface({input:child.stdout}).on('line',line=>{
 try{
  const m=JSON.parse(line),method=pending.get(m.id);pending.delete(m.id);
  if(method==='tools/list' && m.result?.tools)m.result.tools=m.result.tools.filter(t=>allowed.has(t.name));
  if(method==='tools/call')journal({kind:'result',id:m.id,result:m.result,error:m.error});
  send(m);
 }catch{fs.appendFileSync(log+'.stderr',line+'\n');}
});
input.on('close',()=>child.kill());
child.on('exit',code=>process.exit(code??1));
process.on('SIGTERM',()=>child.kill());

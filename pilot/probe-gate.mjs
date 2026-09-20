import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import assert from 'node:assert/strict';
const author=process.argv[2];
const cfg=JSON.parse(await fs.readFile(author+'/mcp.local.json')).mcpServers['playwright-test'];
cfg.args[4]=cfg.args[4].replace('draft-1-tools.jsonl','environment-probe-'+Date.now()+'.jsonl');
const p=spawn(cfg.command,cfg.args,{cwd:author,stdio:['pipe','pipe','pipe'],windowsHide:true});
let n=0;const pending=new Map();
readline.createInterface({input:p.stdout}).on('line',l=>{const r=JSON.parse(l);pending.get(r.id)?.(r);pending.delete(r.id);});
const request=(method,params)=>new Promise(resolve=>{const id=++n;pending.set(id,resolve);p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const timer=setTimeout(()=>{p.kill();process.exitCode=1;},30000);
try{
 await request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pilot-boundary-probe',version:'1'}});
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const list=await request('tools/list',{});
 const names=list.result.tools.map(t=>t.name);
 assert.ok(names.includes('generator_setup_page')&&names.includes('generator_write_test'));
 for(const name of ['browser_evaluate','test_run','test_debug'])assert.ok(!names.includes(name));
 const denied=await request('tools/call',{name:'browser_evaluate',arguments:{function:'()=>document.documentElement.outerHTML'}});
 assert.ok(denied.result.isError);
 if(process.argv.includes('--seed')){
  const setup=await request('tools/call',{name:'generator_setup_page',arguments:{plan:'Environment-only seed check; no business assertions.',seedFile:'seed.spec.ts',project:'chromium'}});
  assert.ok(!setup.result.isError,JSON.stringify(setup));
 }
 console.log(JSON.stringify({official_tools:names,forbidden_call_denied:true}));
}finally{clearTimeout(timer);p.stdin.end();}

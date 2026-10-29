import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReports,bindReportFrame} from '../web-v2/reports.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const response=(value,ok=true)=>({ok,status:ok?200:503,json:async()=>value});
test('report loads without child-frame navigation and keeps style and internal links',async()=>{
 const events=()=>({handlers:new Map(),addEventListener(k,f){this.handlers.set(k,f);},removeEventListener(k){this.handlers.delete(k);}});
 const frame=events(),retry=events(),status={textContent:''},timers=new Map();let seq=0,current=true;
 const doc=events();doc.body={childElementCount:1};doc.querySelectorAll=()=>[{textContent:'body {color:red}'}];doc.adoptedStyleSheets=[];let scrolled=false,written='';
 doc.open=()=>{};doc.write=html=>written=html;doc.close=()=>{};doc.getElementById=id=>id==='case-1'?{scrollIntoView(){scrolled=true;}}:null;
 frame.contentDocument=doc;frame.contentWindow={CSSStyleSheet:class{replaceSync(css){this.css=css;}}};
 const dispose=bindReportFrame({frame,retry,status,url:'/report/html',isCurrent:()=>current,fetchReport:async()=>({ok:true,text:async()=>'<p>report</p>'}),setTimer:fn=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id)});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(written,'<p>report</p>');assert.equal(frame.src,undefined);assert.equal(status.textContent,'报告预览已加载');assert.match(doc.adoptedStyleSheets[0].css,/color:red/);
 let prevented=false;doc.handlers.get('click')({target:{closest:()=>({getAttribute:()=> '#case-1'})},preventDefault(){prevented=true;}});assert.ok(scrolled&&prevented);assert.equal(timers.size,0);
 current=false;await retry.handlers.get('click')();dispose();assert.equal(retry.handlers.size,0);
});
test('failed or timed out report fetch offers retry and ignores stale responses',async()=>{
 const retry={handlers:new Map(),addEventListener(k,f){this.handlers.set(k,f);},removeEventListener(k){this.handlers.delete(k);}},status={},timers=new Map();let seq=0,calls=0,pending;
 const doc={body:{childElementCount:1},querySelectorAll:()=>[],open(){},write(){},close(){},addEventListener(){}};const frame={contentDocument:doc};
 const dispose=bindReportFrame({frame,retry,status,url:'/report/html',fetchReport:()=>{calls++;return calls===1?Promise.resolve({ok:false,status:500}):new Promise(resolve=>{pending=resolve;});},setTimer:fn=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id)});
 await new Promise(resolve=>setImmediate(resolve));assert.match(status.textContent,/加载失败/);assert.equal(retry.hidden,false);const loading=retry.handlers.get('click')();assert.equal(retry.hidden,true);
 timers.get(seq)();assert.match(status.textContent,/加载失败/);assert.equal(retry.hidden,false);pending({ok:true,text:async()=>'<p>late</p>'});await loading;assert.match(status.textContent,/加载失败/);dispose();
});
const preview={group_key:'latest_per_case',case_count:1,entry_count:1,groups:[],group_options:[],counts:{requested:1}};
const makeNodes=()=>{
 const nodes=new Map();
 for(const id of ['scope','group','message','create','cancel','latest-controls','latest-panel','batch-field','run-field','latest-preview','reload-preview','video','trace','batch','run'])nodes.set(`#report-${id}`,{isConnected:true,value:id==='scope'?'run':id==='run'?'run-one':id==='group'?'latest_per_case':'',checked:false,disabled:false,hidden:false,textContent:'',innerHTML:'',handlers:new Map(),addEventListener(name,handler){this.handlers.set(name,handler);}});
 return nodes;
};
function fixture(t,{holdInitial=false,holdPreview=false,detail=false}={}){
 const original={fetch:globalThis.fetch,document:globalThis.document};t.after(()=>Object.assign(globalThis,original));
 const nodes=makeNodes(),replacement=makeNodes(),requests=[],paints=[],navigations=[],initial=[],posts=[],previews=[];
 let current=true,selectedNodes=nodes,initialPhase=holdInitial;
 globalThis.document={querySelector:selector=>selectedNodes.get(selector)};
 const data=url=>url.includes('latest-preview')?preview:url.endsWith('/execution-records')?{records:[{run_id:'run-one',status:'FAILED',executed_external_id:'C1',executed_case_version:1}]}:url.endsWith('/batches')?{batches:[]}:detail?{scope:'run',run_id:'run-one',report_id:'report-one',counts:{requested:1},entry_count:1}:{reports:[]};
 globalThis.fetch=(url,options={})=>{
  requests.push({url,method:options.method||'GET',body:options.body});
  if(options.method==='POST'){const pending=deferred();posts.push({url,...pending});return pending.promise;}
  if(initialPhase){const pending=deferred();initial.push({url,...pending});return pending.promise;}
  if(holdPreview&&url.includes('latest-preview')&&requests.filter(r=>r.url.includes('latest-preview')).length>1){const pending=deferred();previews.push({url,...pending});return pending.promise;}
  return Promise.resolve(response(data(url)));
 };
 return {nodes,replacement,requests,paints,navigations,posts,previews,
  render:()=>renderReports({project:{project_id:'project-one'},query:new URLSearchParams(detail?'report_id=report-one':'run_id=run-one'),showPage:html=>paints.push(html),go:hash=>navigations.push(hash),isCurrent:()=>current}),
  leave:()=>{current=false;selectedNodes=replacement;},
  settleInitial:(fail=false)=>{initialPhase=false;for(const pending of initial)pending.resolve(fail?response({error:'READ_FAILED'},false):response(data(pending.url)));},
 };
}

for(const fail of [false,true]){
 test(`report initial list ${fail?'failure':'success'} after leaving cannot paint or throw into the new route`,async t=>{
  const f=fixture(t,{holdInitial:true});const loading=f.render();f.leave();f.settleInitial(fail);await loading;
  assert.equal(f.paints.length,0);assert.equal(f.navigations.length,0);assert.ok(f.requests.every(r=>r.method==='GET'));
 });
 test(`saved report read ${fail?'failure':'success'} after leaving cannot paint or throw into the new route`,async t=>{
  const f=fixture(t,{holdInitial:true,detail:true});const loading=f.render();f.leave();f.settleInitial(fail);await loading;
  assert.equal(f.paints.length,0);assert.equal(f.requests.length,1);
 });
 test(`report creation ${fail?'failure':'success'} after leaving cannot navigate or edit either page`,async t=>{
  const f=fixture(t);await f.render();const submitting=f.nodes.get('#report-create').onclick();
  const message=f.nodes.get('#report-message').textContent;f.leave();
  f.posts[0].resolve(fail?response({error:'CREATE_FAILED'},false):response({report_id:'report-one'}));await submitting;
  assert.deepEqual(f.navigations,[]);assert.equal(f.nodes.get('#report-message').textContent,message);assert.equal(f.replacement.get('#report-message').textContent,'');assert.equal(f.replacement.get('#report-create').disabled,false);
 });
 test(`latest preview ${fail?'failure':'success'} after leaving cannot touch a replacement control`,async t=>{
  const f=fixture(t,{holdPreview:true});await f.render();const old=f.nodes.get('#report-latest-preview').innerHTML;f.leave();
  f.previews[0].resolve(fail?response({error:'PREVIEW_FAILED'},false):response(preview));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.nodes.get('#report-latest-preview').innerHTML,old);assert.equal(f.replacement.get('#report-latest-preview').innerHTML,'');
 });
 test(`cancel ${fail?'failure':'success'} after leaving cannot show old cancellation status`,async t=>{
  const f=fixture(t);await f.render();const creating=f.nodes.get('#report-create').onclick();const cancelling=f.nodes.get('#report-cancel').onclick();const old=f.nodes.get('#report-message').textContent;f.leave();
  f.posts[1].resolve(fail?response({error:'CANCEL_FAILED'},false):response({state:'STOPPING'}));await cancelling;
  f.posts[0].resolve(response({report_id:'report-one'}));await creating;
  assert.equal(f.nodes.get('#report-message').textContent,old);assert.deepEqual(f.navigations,[]);assert.equal(f.replacement.get('#report-message').textContent,'');
 });
}

test('old DOM handlers cannot submit, reload, or mutate after leaving',async t=>{
 const f=fixture(t);await f.render();f.leave();const before=f.requests.length,message=f.nodes.get('#report-message').textContent;
 await f.nodes.get('#report-create').onclick();await f.nodes.get('#report-cancel').onclick();f.nodes.get('#report-scope').onchange();
 f.nodes.get('#report-group').handlers.get('change')({target:{value:'all'}});
 f.nodes.get('#report-latest-preview').handlers.get('click')({target:{closest:()=>true}});
 f.nodes.get('#report-reload-preview').handlers.get('click')();
 assert.equal(f.requests.length,before);assert.deepEqual(f.navigations,[]);assert.equal(f.nodes.get('#report-message').textContent,message);
});

test('dispose or disconnected page blocks current-looking old handlers',async t=>{
 const f=fixture(t);const dispose=await f.render();dispose();await f.nodes.get('#report-create').onclick();assert.equal(f.posts.length,0);
 const g=fixture(t);await g.render();g.nodes.get('#report-scope').isConnected=false;await g.nodes.get('#report-create').onclick();assert.equal(g.posts.length,0);
});

test('current page preserves retry identity, retries failed cancellation, and navigates only on successful creation',async t=>{
 const f=fixture(t);await f.render();
 const first=f.nodes.get('#report-create').onclick();f.posts[0].resolve(response({error:'CREATE_FAILED'},false));await first;
 assert.match(f.nodes.get('#report-message').textContent,/CREATE_FAILED/);assert.equal(f.nodes.get('#report-create').disabled,false);
 const retry=f.nodes.get('#report-create').onclick();assert.equal(JSON.parse(f.requests.filter(r=>r.method==='POST')[0].body).request_id,JSON.parse(f.requests.filter(r=>r.method==='POST')[1].body).request_id);
 const cancellation=f.nodes.get('#report-cancel').onclick();await f.nodes.get('#report-cancel').onclick();assert.equal(f.posts.length,3);
 f.posts[2].resolve(response({error:'CANCEL_FAILED'},false));await cancellation;assert.equal(f.nodes.get('#report-cancel').disabled,false);
 f.posts[1].resolve(response({report_id:'report-one'}));await retry;assert.deepEqual(f.navigations,['#/projects/project-one/reports?report_id=report-one']);
});

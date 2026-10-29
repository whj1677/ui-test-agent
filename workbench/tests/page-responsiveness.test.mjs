import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {readList} from '../server/read-list.mjs';
import {WorkbenchStore} from '../server/store.mjs';
import {BuildTaskStore} from '../server/build/store.mjs';
import {ReportSnapshots} from '../server/report-snapshots.mjs';
import {renderBatchPage} from '../web-v2/batch-view.js';
import {renderBackendCase} from '../web-v2/backend.js';

async function temp(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-page-read-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}

test('bounded disk reads overlap, retain order and propagate unreadable records',async()=>{
  const releases=[];
  const pending=readList(Array.from({length:12},(_,i)=>i),i=>new Promise(resolve=>releases.push(()=>resolve(i))));
  assert.equal(releases.length,8);
  releases.splice(0).reverse().forEach(release=>release());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(releases.length,4);releases.forEach(release=>release());
  assert.deepEqual(await pending,Array.from({length:12},(_,i)=>i));
  await assert.rejects(readList([1,2],async i=>{if(i===2)throw Error('corrupt');return i;}),/corrupt/);
});

test('late legacy page reads cannot replace a newer route',async()=>{
  const source=await fs.readFile(new URL('../web-v2/app.js',import.meta.url),'utf8');
  for(const name of ['renderBuildTasksRoute','renderProjectEnvironment','renderDevelopmentStart','renderExecutionRecords']){
    const start=source.indexOf(`async function ${name}(`),tail=source.slice(start+1);
    const end=tail.search(/\n(?:async )?function /);
    const definition=source.slice(start,start+1+end);
    let resolve;const response=new Promise(done=>resolve=done);
    const context=vm.createContext({current:true,api:()=>response,loadNativeConsole:()=>response,currentNavigation:()=>()=>context.current,
      showPage:()=>{throw Error('stale render');},renderBuildTasks:()=>{throw Error('stale tasks');},encodeURIComponent,Promise});
    vm.runInContext(definition,context);
    const pending=context[name]({project_id:'p'});context.current=false;
    resolve({tasks:[],authorizations:[],records:[]});await pending;
  }
});

test('run and task lists still observe updates, missing records and malformed JSON',async t=>{
  const root=await temp(t),runs=new WorkbenchStore(path.join(root,'workbench')),tasks=new BuildTaskStore(path.join(root,'tasks'));
  await runs.init();await tasks.init();
  for(const [store,folder,file,list,idKey] of [[runs,runs.runsRoot,'run.json','listRuns','run_id'],[tasks,tasks.root,'task.json','listTasks','task_id']]){
    const prefix=idKey==='run_id'?'run':'build';
    for(const [index,date] of [[1,'2026-01-01'],[2,'2026-02-01']]){const id=`${prefix}-0000000${index}`,dir=path.join(folder,id);await fs.mkdir(dir);await fs.writeFile(path.join(dir,file),JSON.stringify({[idKey]:id,created_at:date,status:'RUNNING'}));}
    await fs.mkdir(path.join(folder,`${prefix}-00000003`));
    assert.deepEqual((await store[list]()).map(r=>r[idKey]),[`${prefix}-00000002`,`${prefix}-00000001`]);
    const changed=path.join(folder,`${prefix}-00000002`,file);
    await fs.writeFile(changed,JSON.stringify({[idKey]:`${prefix}-00000002`,created_at:'2026-02-01',status:'FINISHED'}));
    assert.equal((await store[list]())[0].status,'FINISHED');
    await fs.writeFile(changed,'broken json');await assert.rejects(store[list](),SyntaxError);
  }
});

test('report list reuses metadata only and detects changed, added, removed and corrupt snapshots',async t=>{
  const root=await temp(t),store=new ReportSnapshots({root});
  const file=path.join(root,`report-${'a'.repeat(40)}.json`),other=path.join(root,`report-${'b'.repeat(40)}.json`);
  const report={project:{project_id:'p'},entries:[{media:'large'}],groups:[{entries:[{media:'large'}]}],created_at:'old'};
  await fs.writeFile(file,JSON.stringify(report));
  const read=fs.readFile.bind(fs);let reads=0;
  t.mock.method(fs,'readFile',async(...args)=>{reads++;return read(...args);});
  const first=await store.list('p');assert.equal(first[0].entry_count,1);assert.equal(first[0].entries,undefined);assert.equal(first[0].groups[0].entries,undefined);
  first[0].project.project_id='mutated';await store.list('p');assert.equal(reads,1);
  await fs.writeFile(file,JSON.stringify({...report,created_at:'changed-longer'}));assert.equal((await store.list('p'))[0].created_at,'changed-longer');assert.equal(reads,2);
  await fs.writeFile(other,JSON.stringify({...report,project:{project_id:'other'}}));assert.equal((await store.list('p')).length,1);assert.equal((await store.list('other')).length,1);
  await fs.unlink(file);assert.deepEqual(await store.list('p'),[]);
  await fs.writeFile(other,'broken');await assert.rejects(store.list('other'),SyntaxError);
});

test('batch status filtering renders locally without repeating history requests',async t=>{
  const prior={window:globalThis.window,document:globalThis.document},filter={};let html='',reads=0;
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.document={querySelector:selector=>selector==='#batch-state-filter'?filter:null};
  t.after(()=>{for(const [key,value] of Object.entries(prior))value===undefined?delete globalThis[key]:globalThis[key]=value;});
  const rows=[{case_id:'pass',title:'Passed case',state:'FINISHED',result:'PASSED'},{case_id:'fail',title:'Failed case',state:'FINISHED',result:'FAILED'}];
  const dispose=await renderBatchPage({project:{project_id:'p',cases:[]},query:new URLSearchParams('batch_id=b'),showPage:value=>html=value,api:async()=>{reads++;return {batches:[{batch_id:'b',state:'FINISHED',items:rows}]};}});
  filter.onchange({target:{value:'failed'}});assert.equal(reads,1);
  assert.match(html,/<strong>Failed case<\/strong>/);assert.doesNotMatch(html,/<strong>Passed case<\/strong>/);
  filter.onchange({target:{value:'all'}});assert.match(html,/<strong>Passed case<\/strong>/);assert.equal(reads,1);dispose();
});

test('backend content is available without execution or readiness requests and keeps edit/version behavior',async t=>{
  const prior={document:globalThis.document,location:globalThis.location},nodes=new Map();let html='',edited=false,navigated='';
  globalThis.location={hash:'#/projects/p/cases/c?tab=content'};
  globalThis.document={querySelector:selector=>{if(selector==='.backend-case')return globalThis.document;if(!nodes.has(selector))nodes.set(selector,{addEventListener:(name,fn)=>nodes.get(selector)[name]=fn});return nodes.get(selector);}};
  t.after(()=>{for(const [key,value] of Object.entries(prior))value===undefined?delete globalThis[key]:globalThis[key]=value;});
  const version={version:2,content:{external_id:'API-1',title:'Read',status:'CONFIRMED',steps:[]}},item={case_id:'c',current_version:2,versions:[{version:1},{version:2}]};
  const args={project:{project_id:'p'},item,version,query:new URLSearchParams('tab=content&plan_id=old&run_id=old'),showPage:value=>html=value,go:value=>navigated=value,onEdit:()=>edited=true,api:()=>{throw Error('content must not wait for network');}};
  await renderBackendCase(args);assert.match(html,/已确认业务用例/);nodes.get('#backend-edit-case').click();assert.equal(edited,true);
  nodes.get('#backend-case-version').onchange({target:{value:'1'}});assert.equal(navigated,'#/projects/p/cases/c?tab=content&version=1');
  await renderBackendCase({...args,version:{...version,version:1}});assert.match(html,/历史用例只读/);assert.doesNotMatch(html,/id="backend-edit-case"/);
});

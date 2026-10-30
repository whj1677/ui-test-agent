import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { selectionRouteIdentity } from '../web-v2/case-selection.js';
import { renderCaseContent, loadCaseExecutionContext } from '../web-v2/case-content-view.js';

const project={project_id:'one',name:'项目'},item={case_id:'case',current_version:2,root_source:{row:7},versions:[{version:1},{version:2}]};
const version={version:2,content_sha256:'abc',content:{external_id:'TC-1',title:'正文',status:'CONFIRMED',steps:[{order:1,action:'<click>',expected:'expected'}]}};
const row={project_id:'one',case_id:'case',case_version:2,content_sha256:'ABC'};

test('content renders without any readiness/history request and preserves version/source and edit behavior',t=>{
  const old=globalThis.document,nodes=new Map(),edits=[],navigations=[];let html='';
  globalThis.document={querySelector:s=>{if(!nodes.has(s))nodes.set(s,{addEventListener:(name,fn)=>nodes.get(s)[name]=fn});return nodes.get(s);}};
  t.after(()=>{if(old===undefined)delete globalThis.document;else globalThis.document=old;});
  const input={project,item,version,query:new URLSearchParams('tab=content&native_run=old'),showPage:v=>html=v,go:v=>navigations.push(v),statusText:()=> '内容已确认',sourceHtml:'<p>原始来源</p>',onEdit:()=>edits.push('edit')};
  renderCaseContent(input);
  assert.match(html,/原始用例正文/);assert.match(html,/&lt;click&gt;/);assert.match(html,/原始来源/);assert.match(html,/来源物理行列与版本身份/);
  nodes.get('#edit-case').click();assert.deepEqual(edits,['edit']);
  nodes.get('#content-version').onchange({target:{value:'1'}});assert.equal(navigations[0],'#/projects/one/cases/case?tab=content&version=1');
  renderCaseContent({...input,version:{...version,version:1}});assert.match(html,/历史正文只读/);assert.doesNotMatch(html,/id="edit-case"/);
});

test('native result reads its own summary without unrelated legacy readiness or records',async()=>{
  const calls=[];const result=await loadCaseExecutionContext({project,item,version,query:new URLSearchParams('tab=results'),
    loadNativeConsole:async()=>({records:[row]}),api:async path=>{calls.push(path);return {candidates:[]};}});
  assert.equal(calls.length,0);assert.equal(result[0].deferred,true);assert.deepEqual(result[2],{records:[]});
});

test('legacy links, all-history view, mismatched native source and failed summary keep the real legacy lookup',async()=>{
  for(const [query,data] of [
    ['tab=results&run_id=legacy',{records:[row]}],['tab=results&batch_id=batch',{records:[row]}],
    ['tab=history',{records:[row]}],['tab=scripts',{records:[row]}],['tab=results',{records:[]}],
    ['tab=results',{records:[{...row,content_sha256:'other'}]}],['tab=results',{records:[{...row,project_id:'other'}]}],
    ['tab=results',{records:[row],load_error:'failed'}],
  ]){
    const calls=[];const result=await loadCaseExecutionContext({project,item,version,query:new URLSearchParams(query),loadNativeConsole:async()=>data,
      api:async path=>{calls.push(path);return path.endsWith('/execution-records')?{records:['legacy']}:{candidates:[]};}});
    assert.equal(calls.length,2,query);assert.deepEqual(result[2],{records:['legacy']});
  }
  await assert.rejects(loadCaseExecutionContext({project,item,version,query:new URLSearchParams(),loadNativeConsole:async()=>({records:[]}),api:async path=>{if(path.endsWith('/execution-records'))throw Error('read failed');return {};}}),/read failed/);
});

const appSource=await fs.readFile(new URL('../web-v2/app.js',import.meta.url),'utf8');
const start=appSource.indexOf('async function render(force = false)'),end=appSource.indexOf("window.addEventListener('hashchange'",start);
function routing(){
  const shown=[],loads=[],pending=new Map();const context=vm.createContext({
    renderEpoch:0,activeProjectDispose:null,activeRequirementsRoute:null,loadedRequirementsUi:null,visiblePageRoute:'#/projects/old/cases',
    state:{projects:[],projectsLoaded:false,activeProjectId:'one',selected:new Map()},loading:{hidden:true},app:{hidden:false},location:{hash:'#/projects/one/cases'},
    route:()=>{const parts=context.location.hash.slice(2).split('/');return {parts,query:new URLSearchParams(),projectId:parts[1]};},
    refreshServiceHealth:()=>new Promise(()=>{}),loadProjects:async()=>{throw Error('deep route must not load all projects');},
    loadProject:id=>{loads.push(id);return new Promise(resolve=>pending.set(id,resolve));},
    setSidebarNavigation(){},setBreadcrumb(){},renderCases:p=>shown.push(p.project_id),showFatal:e=>{throw e;},URLSearchParams,selectionRouteIdentity,
  });
  vm.runInContext(appSource.slice(start,end),context);
  return {context,shown,loads,pending};
}
test('navigation shows feedback and paints deep routes without waiting for health or downloading every project',async()=>{
  const f=routing(),loading=f.context.render();
  assert.equal(f.context.loading.hidden,false);assert.equal(f.context.app.hidden,true);assert.deepEqual(f.loads,['one']);
  f.pending.get('one')(project);await loading;assert.deepEqual(f.shown,['one']);
});
test('late project responses do not replace a newer navigation',async()=>{
  const f=routing(),first=f.context.render();f.context.location.hash='#/projects/two/cases';const second=f.context.render();
  f.pending.get('two')({project_id:'two'});await second;f.pending.get('one')(project);await first;assert.deepEqual(f.shown,['two']);
});

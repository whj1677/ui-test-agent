import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BrowserSession,checkAssertionGroup} from '../src/browser.mjs';
import {Controller} from '../src/controller.mjs';
import {Store} from '../src/store.mjs';
import {demoCases,startDemo} from '../src/demo.mjs';
import {validateRepair,planHash,caseHash} from '../src/plans.mjs';
import {uid,semanticHash} from '../src/common.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(ROOT,'validation','reliability-'+Date.now());await fs.mkdir(directory,{recursive:true});
const store=new Store(path.join(directory,'data'));await store.init();
const demo=await startDemo(),browser=new BrowserSession({headless:true}),fixture=demoCases();
const id=await store.create({name:'v0.2 bounded reliability regression',target:demo.url+'/catalog',baseline:fixture.baseline});
await store.update(id,s=>{s.fixture=true;s.authorization={nonproduction:true,writes:true,readOnlyEndpoints:[]};s.cases.forEach((r,i)=>{r.reviewed=true;r.plan=fixture.plans[i];r.plan_approved=true;r.approved_hash=planHash(r.plan);});});
const task=await store.read(id),[catalog,writeCase]=fixture.baseline.cases,[catalogPlan,writePlan]=fixture.plans;
const results=[],counts={input:0,query:0},contextBase=browser.context.bind(browser);let executionPage;
browser.context=async(...args)=>{
  const ctx=await contextBase(...args);await ctx.exposeBinding('__uiTestActionAudit',(_source,kind)=>{counts[kind]=(counts[kind]??0)+1;});
  await ctx.addInitScript(()=>{
    document.addEventListener('input',e=>{if(e.target.dataset.testid==='product-search')window.__uiTestActionAudit('input');},true);
    document.addEventListener('click',e=>{if(e.target.closest('button')?.textContent==='查询')window.__uiTestActionAudit('query');},true);
  });
  if(args[1]?.recordVideo)ctx.on('page',page=>{executionPage=page;});return ctx;
};
function resetCounts(){counts.input=0;counts.query=0;}
async function run(name,c,p,options={}){
  const runId=uid(),dir=path.join(directory,runId),events=[];
  const result=await browser.execute(task,c,p,dir,{...options,onEvent:async e=>{events.push(e);await options.onEvent?.(e);}});
  await fs.writeFile(path.join(dir,'facts.json'),JSON.stringify(result,null,2),{flag:'wx'});
  const summary={name,run_id:runId,status:result.status,error:result.error,repair_requests:result.repair_requests??0,actual_input_events:counts.input,actual_query_clicks:counts.query,actions:result.actions.map(a=>({id:a.action_id,status:a.status,dispatched:a.dispatched})),cleanup_status:result.cleanup_status};
  results.push(summary);return {result,events};
}
try{
  await browser.open(task);await browser.loginPage.getByRole('button',{name:'进入演示'}).click();await browser.authenticate(task,{kind:'testid',value:'signed-in'});

  // F01: fault the real progress projection after an actual input event. The
  // immutable event is already committed, but no model or full-case replay occurs.
  resetCounts();let modelCalls=0,executeCalls=0,injected=false;
  const eventBase=store.event.bind(store),executeBase=browser.execute.bind(browser);
  store.event=(s,type,detail)=>{if(type==='ACTION_EXECUTED'&&!injected){injected=true;throw Object.assign(new Error('fixture disk full'),{code:'ENOSPC'});}return eventBase(s,type,detail);};
  browser.execute=async(...args)=>{executeCalls++;return executeBase(...args);};
  const controller=new Controller({store,browser,provider:{configured:()=>true,json:async()=>{modelCalls++;throw new Error('An evidence failure must not call the model');}}});
  await controller.launch(id,'run',[catalog.case_id]);await controller.active.finished;
  const state=await store.read(id),record=state.cases[0],fact=await store.facts(id,record.attempts[0]);
  assert.equal(fact.error,'ENOSPC');assert.equal(fact.error_phase,'EVIDENCE');assert.equal(fact.status,'TECHNICAL_FAILED');
  assert.equal(executeCalls,1);assert.equal(modelCalls,0);assert.equal(record.attempts.length,1);assert.equal(counts.input,1);assert.equal(counts.query,0);
  assert.equal(fact.actions.filter(a=>a.status==='EXECUTED').length,1);assert.ok(fact.execution_event_receipts.length);
  results.push({name:'F01 real input followed by ENOSPC is not replayed',status:fact.status,execute_calls:executeCalls,model_calls:modelCalls,actual_input_events:counts.input,actual_query_clicks:counts.query,attempts:record.attempts.length});
  store.event=eventBase;browser.execute=executeBase;

  // A stale second locator is repaired in the existing page after exactly one fill.
  resetCounts();const stale=structuredClone(catalogPlan);stale.steps[0].actions[1].target={kind:'testid',value:'stale-query-button'};let repairs=0;
  const patchFor=(failure,target)=>({schema_version:'ui-agent-locator-patch/v1',action_id:failure.action_id,old_target_hash:semanticHash(failure.current_target),target});
  const repaired=await run('one failed action repaired without replay',catalog,stale,{onRepair:async failure=>{repairs++;return validateRepair(patchFor(failure,{kind:'testid',value:'search-products'}),stale,catalog,task.target,failure);}});
  assert.equal(repaired.result.status,'PASS_ASSERTIONS');assert.equal(repairs,1);assert.equal(counts.input,1);assert.equal(counts.query,1);assert.equal(repaired.result.actions.length,2);assert.equal(repaired.result.repairs.length,1);

  // F02: schema-valid locator patch points to a different node; anchor gate stops it.
  resetCounts();const retarget=await run('F02 wrong-object patch rejected',catalog,stale,{onRepair:failure=>validateRepair(patchFor(failure,{kind:'testid',value:'product-search'}),stale,catalog,task.target,failure)});
  assert.equal(retarget.result.error,'REPAIR_TARGET_IDENTITY_MISMATCH');assert.equal(counts.input,1);assert.equal(counts.query,0);

  // The two-request budget is shared across actions. Repeatedly rename the same
  // authorized button after accepted patches to exercise actual resolution failures.
  resetCounts();let version=0,budgetCalls=0;
  const budget=await run('locator repair budget remains two',catalog,stale,{
    onRepair:failure=>{budgetCalls++;return validateRepair(patchFor(failure,{kind:'testid',value:version?'query-version-'+version:'search-products'}),stale,catalog,task.target,failure);},
    onEvent:async e=>{if(e.type==='LOCATOR_REPAIR_ACCEPTED'){version++;await executionPage.getByRole('button',{name:'查询',exact:true}).evaluate((element,n)=>element.dataset.testid='query-version-'+n,version);}}
  });
  assert.equal(budget.result.error,'LOCATOR_NOT_VISIBLE');assert.equal(budgetCalls,2);assert.equal(budget.result.repair_requests,2);assert.equal(counts.input,1);assert.equal(counts.query,0);

  // Pin the exact DOM node across the awaited intent write. Replacing it must not
  // make Playwright auto-resolve the same selector to a different object.
  resetCounts();const replacement=await run('replaced node cannot receive approved action',catalog,catalogPlan,{onEvent:async e=>{
    if(e.type==='ACTION_STARTED'&&e.operation==='click')await executionPage.getByRole('button',{name:'查询',exact:true}).evaluate(element=>{const replacement=element.cloneNode(true);replacement.onclick=()=>window.__uiTestActionAudit('unexpected_replacement');element.replaceWith(replacement);});
  }});
  assert.equal(replacement.result.status,'TECHNICAL_FAILED');assert.equal(counts.query,0);assert.equal(counts.unexpected_replacement??0,0);assert.equal(replacement.result.actions.at(-1).status,'UNKNOWN');

  // F04: A and B alternate but are never simultaneously correct.
  const probe=await browser.loginContext.newPage();await probe.setContent('<div data-testid="a">right</div><div data-testid="b">wrong</div>');
  await probe.evaluate(()=>{setInterval(()=>{const a=document.querySelector('[data-testid=a]'),b=document.querySelector('[data-testid=b]'),first=a.textContent==='right';a.textContent=first?'wrong':'right';b.textContent=first?'right':'wrong';},25);});
  const assertions=['a','b'].map(value=>({target:{kind:'testid',value},check:'text',expected:'right'}));
  const alternating=await checkAssertionGroup(probe,assertions,{timeout:350});assert.equal(alternating.every(o=>o.passed),false);assert.equal(new Set(alternating.map(o=>o.sample_id)).size,1);assert.equal(new Set(alternating.map(o=>o.at)).size,1);
  results.push({name:'F04 alternating states cannot combine into pass',observations:alternating});await probe.close();

  const timed=await browser.loginContext.newPage();await timed.setContent('<div data-testid="ready">right</div>');
  const evalBase=timed.evaluate.bind(timed);let evaluations=0;
  timed.evaluate=async(...args)=>{evaluations++;if(evaluations===3)await new Promise(r=>setTimeout(r,180));return evalBase(...args);};
  const late=await checkAssertionGroup(timed,[{target:{kind:'testid',value:'ready'},check:'text',expected:'right'}],{timeout:100});
  assert.equal(late[0].passed,false);assert.equal(late[0].timed_out,true);results.push({name:'late first observation cannot satisfy deadline',observation:late[0]});await timed.close();

  const shortWindow=structuredClone(catalogPlan);shortWindow.steps[0].within_ms=100;
  const delayedEvidence=await run('action completion anchors assertion deadline',catalog,shortWindow,{onEvent:async e=>{
    if(e.type==='ACTION_EXECUTED'&&e.operation==='click')await new Promise(r=>setTimeout(r,180));
  }});
  assert.equal(delayedEvidence.result.status,'TECHNICAL_FAILED');assert.equal(delayedEvidence.result.error,'ASSERTION_OBSERVATION_LATE');
  assert.ok(delayedEvidence.result.assertions.every(o=>!o.window_observed));

  // No deletion is dispatched if ownership cannot be established.
  const badOwnership=structuredClone(writePlan);badOwnership.cleanup.ownership[0].expected='different-owned-resource';
  const owned=await run('unverified cleanup identity is never deleted',writeCase,badOwnership);
  assert.equal(owned.result.status,'CLEANUP_REQUIRED');assert.equal(owned.result.cleanup_error,'CLEANUP_OWNERSHIP_UNVERIFIED');assert.equal(owned.result.cleanup_actions.length,0);assert.equal(demo.tasks.size,1);
  demo.tasks.clear(); // Direct fixture teardown only; never claimed as app cleanup.

  // A failed immutable cleanup intent must not dispatch its destructive UI action.
  const cleanupIO=await run('cleanup intent persistence failure stops deletion',writeCase,writePlan,{onEvent:e=>{if(e.type==='CLEANUP_ACTION_STARTED')throw Object.assign(new Error('fixture disk full'),{code:'ENOSPC'});}});
  assert.equal(cleanupIO.result.status,'CLEANUP_REQUIRED');assert.equal(cleanupIO.result.cleanup_error,'ENOSPC');assert.equal(cleanupIO.result.cleanup_actions.length,0);assert.equal(demo.tasks.size,1);demo.tasks.clear();

  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({scope:'Real headless Chromium and local synthetic apps, injected storage/DOM faults; no real model or product request',results},null,2));
  process.stdout.write(JSON.stringify({validated:true,directory,scenarios:results.length})+'\n');
}finally{await browser.close();await demo.close();}

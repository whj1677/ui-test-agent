import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {planningInput,scopedHandoff} from '../src/planning-input.mjs';
import {BrowserSession,checkAssertionGroup} from '../src/browser.mjs';
import {DiscoveryBrowser} from '../src/discovery-browser.mjs';
import {validatePlan} from '../src/plans.mjs';
import {demoCases} from '../src/demo.mjs';

test('planning projects referenced anchors and dependencies, keeps original artifact unchanged and removes stale block',()=>{
  const ref=(path,anchor_id)=>({path,anchor_id});
  const handoff={integrity:{sha256:'original'},source:{files:[{path:'a',anchors:[{id:'one'},{id:'unused'}]},{path:'b',anchors:[{id:'two'}]},{path:'auth',anchors:[{id:'login'}]}]},
    authentication:{mode:'none',source_refs:[ref('auth','login')]},case_bindings:[{case_id:'A',steps:[{action_id:'a'}]},{case_id:'B',steps:[{action_id:'b'}]}],
    actions:[{id:'a',entry_path:'/a',controls:[{id:'ready',locator:{kind:'testid',value:'a-ready'}}],source_refs:[ref('a','one')],dependency:{source_refs:[ref('b','two')]}},{id:'b',entry_path:'/b',controls:[{id:'other',locator:{kind:'testid',value:'b-ready'}}],source_refs:[ref('b','two')]}]};
  const original=structuredClone(handoff),projected=scopedHandoff(handoff,'A');
  assert.deepEqual(projected.actions.map(a=>a.id),['a']);assert.deepEqual(projected.source.files.map(f=>[f.path,f.anchors.map(a=>a.id)]),[['a',['one']],['b',['two']],['auth',['login']]]);
  assert.deepEqual(handoff,original);assert.equal(projected.integrity,undefined);
  const state={target:'http://127.0.0.1/',auth_marker:{kind:'testid',value:'landing'},handoff,snapshots:[{discovery_case_id:'A'},{discovery_case_id:'B'}]};
  const input=planningInput(state,{case_id:'A'},{plan:{old:true},mapping_reason:'old missing source',plan_feedback:[{feedback:'new evidence'}]},'hash');
  assert.equal(input.previous_block_reason,undefined);assert.equal(input.previous_candidate,undefined);assert.equal(input.authentication.verified_marker,undefined);
  assert.equal(input.authentication.preflight_url,undefined);assert.equal(input.authentication.preflight_marker,undefined);assert.equal(input.authentication.mode,'none');assert.equal(input.pages.length,1);assert.equal(input.revision_feedback.length,1);
  assert.equal(planningInput({...state,handoff:null},{case_id:'A'},{},'hash').authentication.preflight_url,state.target);
  assert.deepEqual(input.technical_context.entry_paths,['/a']);assert.deepEqual(input.technical_context.source_control_candidates.map(c=>c.locator.value),['a-ready']);assert.equal(input.technical_context.runtime_confirmation_required,true);
});

test('new declarative checks remain bounded and do not accept selectors, code or wrong types',()=>{
  for(const [check,expected,valid] of [['focused',true,true],['focused','true',false],['has_class','status-pending',true],['has_class','.status span',false],['row_sequence',['A','B'],true],['row_sequence',[''],false],['row_sequence',Array(101).fill('A'),false]]){
    const {baseline,plans}=demoCases(),plan=structuredClone(plans[0]);
    plan.preconditions=[{target:{kind:'testid',value:'grid'},check,expected}];
    if(valid)assert.doesNotThrow(()=>validatePlan(plan,baseline.cases[0],'http://127.0.0.1/'));
    else assert.throws(()=>validatePlan(plan,baseline.cases[0],'http://127.0.0.1/'));
  }
});

test('real browser distinguishes focus, exact class and row order from existence',async()=>{
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.setContent('<input id="first"><input id="second"><span id="status" class="status-pending">Pending</span><table id="grid"><tbody id="body"><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>');
    await page.locator('#first').focus();const target=value=>({kind:'css',value:'#'+value});
    const checks=[{target:target('first'),check:'focused',expected:true},{target:target('second'),check:'focused',expected:false},{target:target('status'),check:'has_class',expected:'status-pending'},{target:target('grid'),check:'row_sequence',expected:['A','B']}];
    assert.ok((await checkAssertionGroup(page,checks)).every(o=>o.passed));
    const wrong=[{...checks[0],target:target('second')},{...checks[2],expected:'pending'},{...checks[3],expected:['B','A']},{...checks[3],expected:['A']}];
    assert.ok((await checkAssertionGroup(page,wrong,{timeout:300})).every(o=>!o.passed));
    await assert.rejects(checkAssertionGroup(page,[{...checks[3],target:target('body')}]),e=>e.code==='ASSERTION_TARGET_TYPE');
    await page.locator('#grid').evaluate(e=>e.hidden=true);
    assert.equal((await checkAssertionGroup(page,[checks[3]],{timeout:300}))[0].passed,false);
  }finally{await browser.close();}
});

test('discovery excludes background under modal and rechecks newly added overlays before dispatch',async()=>{
  const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<span data-testid="ready">Ready</span><button type="button" data-testid="new" onclick="document.querySelector('#modal').hidden=false">New</button><div id="modal" role="dialog" aria-modal="true" hidden style="position:fixed;inset:0;background:white;z-index:10"><button type="button" data-testid="close" onclick="document.querySelector('#modal').hidden=true">Close</button></div>`);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const task={id:'modal-test',target:`http://127.0.0.1:${server.address().port}`,authorization:{writes:false,readOnlyEndpoints:[]}},session=new BrowserSession({headless:true});let discovery;
  try{await session.open(task);await session.authenticate(task,{kind:'testid',value:'ready'});discovery=new DiscoveryBrowser(session,task);const initial=await discovery.open();
    const first=initial.candidates.find(c=>c.name==='New');assert.ok(first);
    const opened=await discovery.act({candidate_id:first.candidate_id});
    assert.ok(!opened.candidates.some(c=>c.name==='New'));const close=opened.candidates.find(c=>c.name==='Close');assert.ok(close);
    const closed=await discovery.act({candidate_id:close.candidate_id});const candidate=closed.candidates.find(c=>c.name==='New');assert.ok(candidate);
    await discovery.page.locator('#modal').evaluate(e=>e.hidden=false);
    await assert.rejects(discovery.act({candidate_id:candidate.candidate_id}),e=>e.code==='DISCOVERY_STALE_PAGE');
    assert.equal(discovery.step,2);
    assert.ok(discovery.visits.size>0);discovery.beginCase();assert.equal(discovery.visits.size,0);assert.equal(discovery.step,2);
    await assert.rejects(discovery._run(()=>Promise.reject(Object.assign(new Error('action timed out'),{name:'TimeoutError'}))),e=>e.code==='DISCOVERY_ACTION_TIMEOUT');
    assert.ok((await discovery.observe()).candidates.some(c=>c.name==='Close'));
  }finally{await discovery?.close();await session.close();await new Promise(r=>server.close(r));}
});

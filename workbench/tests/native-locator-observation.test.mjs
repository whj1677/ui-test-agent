import test from 'node:test';
import assert from 'node:assert/strict';
import {observeLocatorActual} from '../server/native-dsh/locator-observation.mjs';
import {nativeStepActualHtml,nativeAssertionCoverage,nativeEvidenceHtml} from '../web-v2/native-console-view.js';

test('enabled and disabled matcher observations retain true and false without changing the matcher',async()=>{
  for(const enabled of [true,false]){
    let calls=0;const locator={evaluateAll:async()=>({label:'Approve',node_count:1}),isEnabled:async()=>{calls++;return enabled;}};
    const a=await observeLocatorActual(locator,'toBeEnabled',[]),b=await observeLocatorActual(locator,'toBeDisabled',[],{not:true});
    assert.equal(a.actual,enabled);assert.equal(b.actual,!enabled);assert.equal(calls,2);
    assert.equal(a.observation_phase,'AFTER_MATCHER');assert.equal(b.value_source,'PLAYWRIGHT_LOCATOR_OBSERVATION');
  }
  const absent=await observeLocatorActual({evaluateAll:async()=>({label:'Approve',node_count:1})},'toBeEnabled',[]);
  assert.equal(absent,null);
});

test('locator observations use actual read results, preserve empty values and never substitute expected values',async()=>{
  let reads=0;
  const locator={evaluateAll:async()=>{reads++;return {actual:'',label:'Field',node_count:1};},toString:()=>"locator('#field')"};
  const observed=await observeLocatorActual(locator,'toHaveValue',['expected']);
  assert.equal(observed.actual,'');assert.equal(observed.value_source,'PLAYWRIGHT_LOCATOR_OBSERVATION');assert.equal(reads,1);
  assert.equal(observed.observation_phase,'AFTER_MATCHER');
  const unavailable=await observeLocatorActual({...locator,evaluateAll:async()=>{throw Error('closed');}},'toHaveValue',['expected']);
  assert.equal(unavailable.reason,'LOCATOR_OBSERVATION_UNAVAILABLE');assert.equal(Object.hasOwn(unavailable,'actual'),false);
});
test('sensitive, unsupported, accessor and timed-out observations stay unavailable without changing execution',async()=>{
  const secret=await observeLocatorActual({evaluateAll:async()=>({sensitive:true})},'toHaveValue',['secret']);
  assert.equal(secret.reason,'SENSITIVE_LOCATOR_VALUE_NOT_CAPTURED');assert.equal(Object.hasOwn(secret,'actual'),false);
  let touched=0;const accessor={get evaluateAll(){touched++;throw Error('getter');}};
  assert.equal(await observeLocatorActual(accessor,'toHaveText',['x']),null);assert.equal(touched,0);
  assert.equal(await observeLocatorActual({evaluateAll:()=>assert.fail()},'unknown',[]),null);
  assert.equal((await observeLocatorActual({evaluateAll:()=>new Promise(()=>{})},'toHaveText',['x'])).reason,'LOCATOR_OBSERVATION_TIMEOUT');
});
test('step summary pairs chronological page values with expectations instead of promoting an arbitrary HTTP code',()=>{
  const dom=(value,expected)=>({matcher_name:'toHaveText',actual:value,assertion_expected:expected,expected_present:true,actual_present:true,actual_recorded:true,value_source:'PLAYWRIGHT_LOCATOR_OBSERVATION',status:'PASSED',target_label:'页面反馈',target:"locator('#feedback')",observed_at:'2026-10-16T03:00:00.000Z'});
  const code={matcher_name:'toBe',actual:409,assertion_expected:409,actual_present:true,value_source:'PLAYWRIGHT_MATCHER_ARGUMENTS',status:'PASSED'};
  const step={order:1,expected:'拒绝重复操作',assertions:[code,dom('已完成，不能重复','已完成，不能重复'),dom('<img>','<img>')]};
  const html=nativeStepActualHtml(step);assert.match(html,/已完成，不能重复/);assert.match(html,/断言预期/);assert.match(html,/实际值/);
  assert.doesNotMatch(html,/>409<|<img>/);assert.match(html,/&lt;img&gt;/);assert.match(html,/3\/3/);
  const message={...code,actual:'重复完成已被拒绝',assertion_expected:'',expected_present:true,is_not:true};
  const textSummary=nativeStepActualHtml({assertions:[code,message]});
  assert.match(textSummary,/重复完成已被拒绝/);assert.match(textSummary,/原断言实参/);assert.doesNotMatch(textSummary,/>409</);
  assert.deepEqual(nativeAssertionCoverage({step_replay:{steps:[step]}}),{total:3,actual:3,missing:0});
  const old={...step,assertions:[code,{matcher_name:'toHaveText',actual_present:false}]};
  assert.match(nativeStepActualHtml(old),/1 条断言实际值未采集/);
  const evidence=nativeEvidenceHtml({project_id:'p',cases:[]},{...old,project_id:'p',files:[],evidence_status:'COMPLETE',step_replay:{steps:[old]}});
  assert.match(evidence,/断言实际 1\/2 · 采集不完整/);
});

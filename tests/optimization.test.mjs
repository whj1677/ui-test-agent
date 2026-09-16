import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,selectDataset} from '../optimization/dataset.mjs';
import {grade,metrics,scoreResponses} from '../optimization/evaluate.mjs';

test('curated v2 synthetic plans and specific unsupported decisions match their fixtures',()=>{
  for(const entry of dataset())assert.equal(grade(entry,entry.gold).reward,1,entry.id+': '+grade(entry,entry.gold).reason);
});
test('train, dev and holdout have disjoint domains and positive/negative outcomes',()=>{
  const domains={};
  for(const split of ['train','dev','holdout']){
    const entries=selectDataset(split);domains[split]=new Set(entries.map(x=>x.domain));
    assert(entries.some(x=>x.expected_outcome==='plan'));assert(entries.some(x=>x.expected_outcome==='blocked'));
  }
  for(const domain of domains.train)assert(!domains.dev.has(domain)&&!domains.holdout.has(domain));
  for(const domain of domains.dev)assert(!domains.holdout.has(domain));
});
test('blocking all supported cases cannot receive plan-quality reward',()=>{
  const rows=dataset().map(x=>grade(x,{blocked:true,reason:'Missing snapshot and unsupported locator.'}));
  assert.equal(metrics(rows).faithful_plan_rate,0);assert.equal(metrics(rows).unnecessary_block_rate,1);
});
test('omitted compound obligation and changed oracle values get no reward',()=>{
  const entry=dataset()[0],missing=structuredClone(entry.gold),wrong=structuredClone(entry.gold);
  missing.plan.steps[0].assertions.pop();wrong.plan.steps[0].assertions[1].expected=42;
  assert.equal(grade(entry,missing).reward,0);assert.equal(grade(entry,wrong).reward,0);
});
test('locator retargeting, sequential sampling and longer timing cannot win',()=>{
  const entry=dataset()[0];
  for(const mutate of [p=>{p.steps[0].actions[0].target.value='other-record'},p=>{p.steps[0].assertion_mode='sequential'},p=>{p.steps[0].within_ms=8000}]){
    const response=structuredClone(entry.gold);mutate(response.plan);assert.equal(grade(entry,response).reward,0);
  }
});
test('arbitrary capability request is a hard safety failure even if it claims blocked',()=>{
  const result=grade(dataset()[0],{blocked:true,reason:'Do not test',command:'run external program'});
  assert.equal(result.reward,0);assert.equal(result.safety_violation,true);
});
test('unknown and duplicate response ids reject; absent samples stay in denominator',()=>{
  assert.throws(()=>scoreResponses([{id:'invented',response:{}}]),/UNKNOWN_OR_DUPLICATE/);
  const id=dataset()[0].id;assert.throws(()=>scoreResponses([{id},{id}]),/UNKNOWN_OR_DUPLICATE/);
  const scored=scoreResponses([], 'holdout');assert.equal(scored.metrics.sample_count,4);assert.equal(scored.metrics.mean_reward,0);
});
test('reordering JSON keys does not change grader decision',()=>{
  const entry=dataset()[0],response=structuredClone(entry.gold);
  response.plan=Object.fromEntries(Object.entries(response.plan).reverse());
  assert.equal(grade(entry,response).reward,1);
});

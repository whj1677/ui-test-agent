import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store,effectiveCase} from '../src/store.mjs';
import {report} from '../src/report.mjs';
import {hash,uid} from '../src/common.mjs';

const baseline={cases:['A','B'].map(case_id=>({case_id,title:'合成 '+case_id,preconditions:'已打开合成页',steps:[{step_id:'S1',action:'读取页面',expected:'名称为苹果且数量为1'}]}))};
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-evidence-v2-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const store=new Store(dir);await store.init();const id=await store.create({name:'证据回归',target:'http://127.0.0.1:1',baseline});return {store,id,dir};
}
async function commit(store,id,{case_id='A',status='PASS_ASSERTIONS',...extra}={}){
  const fact={id:uid(),case_id,status,business_status:status==='PASS_ASSERTIONS'?'ASSERTIONS_PASSED':'ASSERTION_MISMATCH',cleanup_status:'NOT_REQUIRED',started_at:'2026-09-15T00:00:00.000Z',finished_at:'2026-09-15T00:00:01.000Z',media:[],...extra};
  const receipt=await store.fact(id,fact);await store.update(id,s=>{const c=s.cases.find(c=>c.case_id===case_id);c.attempts.push(receipt);c.status=status;});return {fact,receipt};
}
const code=expected=>e=>e.code===expected;

test('unified report keeps supplemental observations out of Agent execution counts',async t=>{
  const {store,id}=await fixture(t);await commit(store,id);
  const state=await store.read(id),input={schema_version:'ui-agent-report-supplement/v1',baseline_sha256:state.baseline_sha256,cases:[{case_id:'B',steps:[{...baseline.cases[1].steps[0],actual:'浏览器观察为苹果且数量为1',passed:true}]}]};
  await fs.writeFile(path.join(store.dir(id),'report-supplement.json'),JSON.stringify(input));
  const html=await report(store,id),manifest=JSON.parse(html.match(/<pre id="report-manifest">([\s\S]*?)<\/pre>/)[1].replaceAll('&quot;','"'));
  assert.equal(manifest.counts.attempted,1);assert.equal(manifest.counts.pass,1);assert.equal(manifest.supplemental_review.pass,1);
  assert.ok(html.includes('浏览器补充复核'));assert.ok(html.includes('不计入 Agent 已执行数量'));
  input.cases[0].steps[0].expected='伪造新预期';await fs.writeFile(path.join(store.dir(id),'report-supplement.json'),JSON.stringify(input));
  await assert.rejects(()=>report(store,id),code('REPORT_SUPPLEMENT_STEP_MISMATCH'));
  input.baseline_sha256=hash('other');await fs.writeFile(path.join(store.dir(id),'report-supplement.json'),JSON.stringify(input));
  await assert.rejects(()=>report(store,id),code('REPORT_SUPPLEMENT_BASELINE_MISMATCH'));
});

test('F05 report derives counts from verified facts and exposes mutable status conflict',async t=>{
  const {store,id}=await fixture(t);await commit(store,id);await store.update(id,s=>s.cases[0].status='FAIL_ASSERTION');
  const projection=await store.executionProjection(id);assert.equal(projection.counts.pass,1);assert.equal(projection.counts.fail,0);assert.ok(projection.issues.some(i=>i.code==='PROJECTION_STATUS_MISMATCH'));
  const html=await report(store,id);assert.ok(html.includes('断言满足 1 · 断言不一致 0'));assert.ok(html.includes('历史数据没有冻结批次范围'));assert.ok(html.includes('PROJECTION_STATUS_MISMATCH'));
});
test('frozen selected-case denominator ignores previous scope results and later mutable selections',async t=>{
  const {store,id}=await fixture(t);await commit(store,id,{case_id:'B'});const runId=uid();await store.beginRun(id,{id:runId,case_ids:['A'],case_hashes:{A:hash('A')},plan_hashes:{A:hash('plan')}});
  const state=await store.read(id);await commit(store,id,{run_scope_id:runId,case_hash:hash('A'),approved_plan_hash:hash('plan'),baseline_sha256:state.baseline_sha256});
  await store.update(id,s=>s.selected_case_ids=['B']);const projection=await store.executionProjection(id);assert.equal(projection.counts.total,1);assert.equal(projection.counts.pass,1);assert.deepEqual(projection.cases.map(c=>c.case_id),['A']);
  const html=await report(store,id);assert.ok(html.includes('原用例 2 · 报告范围 1'));assert.ok(html.includes('本轮范围已冻结'));
});
test('whole-task projection derives earlier and latest batch results from each own frozen scope',async t=>{
  const {store,id}=await fixture(t),baseline_sha256=(await store.read(id)).baseline_sha256;
  for(const case_id of ['A','B']){
    const runId=uid();await store.beginRun(id,{id:runId,case_ids:[case_id],case_hashes:{[case_id]:hash(case_id)},plan_hashes:{[case_id]:hash('plan '+case_id)}});
    await commit(store,id,{schema_version:'ui-agent-facts/v2',case_id,run_scope_id:runId,case_hash:hash(case_id),approved_plan_hash:hash('plan '+case_id),baseline_sha256});
  }
  await store.update(id,s=>{s.cases[0].status='TECHNICAL_FAILED';s.cases[1].status='FAIL_ASSERTION';});
  const all=await store.executionProjection(id,undefined,{allScopes:true});assert.equal(all.scope_source,'ALL_TASK_SCOPES');assert.deepEqual(all.cases.map(c=>c.status),['PASS_ASSERTIONS','PASS_ASSERTIONS']);assert.equal(all.counts.pass,2);assert.equal(all.counts.total,2);
  const latest=await store.executionProjection(id);assert.deepEqual(latest.cases.map(c=>c.case_id),['B']);assert.equal(latest.counts.pass,1);assert.ok((await report(store,id)).includes('原用例 2 · 报告范围 1'));
});
test('whole-task projection rejects missing or corrupt own scope without hiding untouched preparation',async t=>{
  const {store,id}=await fixture(t);await commit(store,id,{schema_version:'ui-agent-facts/v2',run_scope_id:uid()});
  let projection=await store.executionProjection(id,undefined,{allScopes:true});assert.equal(projection.counts.pass,0);assert.equal(projection.cases[0].status,'EVIDENCE_INCOMPLETE');assert.equal(projection.cases[1].status,'NEEDS_REVIEW');assert.ok(projection.cases[0].issues.some(i=>i.code==='FACT_SCOPE_MISSING'));
  const runId=uid();await store.beginRun(id,{id:runId,case_ids:['B']});await commit(store,id,{schema_version:'ui-agent-facts/v2',case_id:'B',run_scope_id:runId,baseline_sha256:(await store.read(id)).baseline_sha256});await fs.appendFile(path.join(store.dir(id),'jobs',runId,'scope.json'),' ');
  projection=await store.executionProjection(id,undefined,{allScopes:true});assert.equal(projection.counts.pass,0);assert.ok(projection.cases[1].issues.some(i=>i.code==='RUN_SCOPE_CHANGED'));
});
test('changed scope cannot supply a trusted denominator or a passing result',async t=>{
  const {store,id}=await fixture(t),runId=uid();await store.beginRun(id,{id:runId,case_ids:['A']});
  await assert.rejects(()=>store.beginRun(id,{id:runId,case_ids:['B']}),code('EEXIST'));
  await fs.appendFile(path.join(store.dir(id),'jobs',runId,'scope.json'),' ');
  const projection=await store.executionProjection(id);assert.equal(projection.scope_valid,false);assert.equal(projection.counts.pass,0);assert.equal(projection.cases[0].evidence_status,'PARTIAL');assert.ok((await report(store,id)).includes('本轮分母未验证'));
});
test('corrupt or missing final facts cannot fall back to an older passing attempt',async t=>{
  const {store,id}=await fixture(t);await commit(store,id);const latest=await commit(store,id,{finished_at:'2026-09-15T00:00:02.000Z'});
  await fs.appendFile(path.join(store.dir(id),'runs',latest.fact.id,'facts.json'),' ');const projection=await store.executionProjection(id);
  assert.equal(projection.counts.pass,0);assert.equal(projection.cases[0].status,'EVIDENCE_INCOMPLETE');assert.ok((await report(store,id)).includes('EVIDENCE_CHANGED'));
});
test('missing media yields a usable PARTIAL report without erasing verified business observations',async t=>{
  const {store,id}=await fixture(t);await commit(store,id,{media:[{file:'missing.png',sha256:hash('missing')}],executed_case:{...baseline.cases[0],steps:[{step_id:'S1',action:'执行时步骤',expected:'执行时已确认预期'}]}});
  const html=await report(store,id);assert.ok(html.includes('PARTIAL'));assert.ok(html.includes('媒体证据不可用'));assert.ok(html.includes('断言满足 1'));assert.ok(html.includes('原预期：名称为苹果且数量为1'));assert.ok(html.includes('执行时已确认预期'));
});
test('business, cleanup and partial-evidence dimensions remain independent',async t=>{
  const {store,id}=await fixture(t);await commit(store,id,{status:'CLEANUP_REQUIRED',business_status:'ASSERTIONS_PASSED',cleanup_status:'FAILED',evidence_status:'PARTIAL'});
  const projection=await store.executionProjection(id);assert.equal(projection.counts.pass,1);assert.equal(projection.counts.cleanup_required,1);assert.equal(projection.counts.evidence_incomplete,1);assert.equal(projection.cases[0].status,'CLEANUP_REQUIRED');assert.equal(projection.cases[0].evidence_status,'PARTIAL');
});
test('execution events are serialized, chained, sealed into facts, and cannot be appended after sealing',async t=>{
  const {store,id}=await fixture(t),attemptId=uid();const records=await Promise.all(Array.from({length:12},(_,i)=>store.recordExecutionEvent(id,attemptId,{type:i%2?'ACTION_EXECUTED':'ACTION_STARTED',case_id:'A',action_id:'A'+i})));
  assert.deepEqual(records.map(r=>r.seq),Array.from({length:12},(_,i)=>i+1));
  const receipt=await store.fact(id,{id:attemptId,case_id:'A',status:'TECHNICAL_FAILED',media:[]}),fact=await store.facts(id,receipt);assert.equal(fact.execution_event_receipts.length,12);
  await assert.rejects(()=>store.recordExecutionEvent(id,attemptId,{type:'ACTION_STARTED'}),code('EXECUTION_ALREADY_SEALED'));
  await fs.appendFile(path.join(store.dir(id),'runs',attemptId,'events','000002.json'),' ');await assert.rejects(()=>store.facts(id,receipt),code('EXECUTION_EVENTS_CHANGED'));
});
test('cached event head avoids full rescans but seal still detects a changed last event',async t=>{
  const {store,id}=await fixture(t),attemptId=uid();let fullReads=0;const read=store.executionEvents.bind(store);store.executionEvents=async(...args)=>{fullReads++;return read(...args);};
  for(let i=0;i<20;i++)await store.recordExecutionEvent(id,attemptId,{type:'ACTION_STARTED',case_id:'A',action_id:'A'+i});assert.equal(fullReads,1);
  await fs.appendFile(path.join(store.dir(id),'runs',attemptId,'events','000020.json'),' ');await assert.rejects(()=>store.fact(id,{id:attemptId,case_id:'A',status:'TECHNICAL_FAILED',media:[]}),code('EXECUTION_EVENTS_CHANGED'));assert.equal(fullReads,2);
});
test('event persistence errors propagate instead of manufacturing a committed intent',async t=>{
  const {store,id}=await fixture(t),attemptId=uid(),dir=path.join(store.dir(id),'runs',attemptId);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'events'),'not a directory');
  await assert.rejects(()=>store.recordExecutionEvent(id,attemptId,{type:'ACTION_STARTED',case_id:'A'}));await assert.rejects(()=>fs.access(path.join(dir,'facts.json')),code('ENOENT'));
});
test('unsealed intent after interruption is evidence-incomplete, never silently unexecuted',async t=>{
  const {store,id}=await fixture(t),runId=uid();await store.beginRun(id,{id:runId,case_ids:['A']});await store.recordExecutionEvent(id,uid(),{type:'ACTION_STARTED',case_id:'A',run_scope_id:runId});
  const projection=await store.executionProjection(id);assert.equal(projection.cases[0].status,'EVIDENCE_INCOMPLETE');assert.equal(projection.cases[0].cleanup_status,'UNVERIFIED');assert.ok(projection.issues.some(i=>i.code==='UNSEALED_EXECUTION'));
});
test('orphan fact remains unverified until an authentic receipt exists',async t=>{
  const {store,id}=await fixture(t);await store.fact(id,{id:uid(),case_id:'A',status:'PASS_ASSERTIONS',media:[]});const projection=await store.executionProjection(id);
  assert.equal(projection.counts.pass,0);assert.equal(projection.cases[0].status,'EVIDENCE_INCOMPLETE');assert.ok(projection.issues.some(i=>i.code==='ORPHAN_FACT_UNINDEXED'));
});
test('facts determine attempt ordering even when mutable receipt array is reversed',async t=>{
  const {store,id}=await fixture(t);await commit(store,id,{status:'FAIL_ASSERTION',finished_at:'2026-09-15T00:00:01.000Z'});await commit(store,id,{status:'PASS_ASSERTIONS',finished_at:'2026-09-15T00:00:02.000Z'});
  await store.update(id,s=>s.cases[0].attempts.reverse());assert.equal((await store.executionProjection(id)).cases[0].status,'PASS_ASSERTIONS');
});
test('a mutable pass without an execution fact is not counted as a pass',async t=>{
  const {store,id}=await fixture(t);await store.update(id,s=>s.cases[0].status='PASS_ASSERTIONS');const projection=await store.executionProjection(id);assert.equal(projection.counts.pass,0);assert.equal(projection.cases[0].status,'NOT_EXECUTED');
});
test('writer lock prevents another instance and only the owner releases it',async t=>{
  const {store,dir}=await fixture(t),second=new Store(dir);await store.acquireLock();await assert.rejects(()=>second.acquireLock(),code('DATA_DIRECTORY_LOCKED'));await second.releaseLock();await assert.rejects(()=>second.acquireLock(),code('DATA_DIRECTORY_LOCKED'));await store.releaseLock();await second.acquireLock();await second.releaseLock();
  await fs.writeFile(path.join(dir,'.writer.lock'),JSON.stringify({id:uid(),pid:999999999}));await assert.rejects(()=>store.acquireLock(),code('DATA_DIRECTORY_LOCKED'));
});
test('confirmed obligations propagate without mutating baseline or confirmation objects',()=>{
  const record={confirmations:[{step_id:'S1',action:'读取',expected:'名称和数量',obligations:[{obligation_id:'O1',text:'名称'}]}]},before=JSON.stringify(baseline),result=effectiveCase(baseline.cases[0],record);
  assert.deepEqual(result.steps[0].obligations,record.confirmations[0].obligations);result.steps[0].obligations[0].text='changed';assert.equal(record.confirmations[0].obligations[0].text,'名称');assert.equal(JSON.stringify(baseline),before);
});

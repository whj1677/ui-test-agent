import test from 'node:test';
import assert from 'node:assert/strict';
import {batchSummary,batchRemainingItems,batchDetailHtml} from '../web-v2/batch-view.js';
const item=(id,state,result='NOT_RUN')=>({case_id:id,case_version:1,external_id:id,title:id,state,result});

test('technical pass is visible without hiding pending requirement review in advanced details',()=>{
 const row={...item('a','FINISHED','PASSED'),qualification:'LIMITED_TECHNICAL_TRIAL_NOT_APPROVED'};
 const html=batchDetailHtml({batch_id:'b',state:'FINISHED',items:[row]},{project_id:'p',cases:[row]});
 assert.match(html,/运行通过/);assert.match(html,/脚本要求待核对/);
 assert.ok(html.indexOf('脚本要求待核对')<html.indexOf('高级：'));
 assert.equal(batchSummary({items:[row]}).passed,1);
});
test('stopped summary and retry only use this batch, including actual last completed result',()=>{
 const batch={batch_id:'batch-1',state:'CANCELLED',items:[item('a','FINISHED','PASSED'),item('b','CANCELLED'),item('c','NOT_RUN'),item('d','NOT_RUN')]};
 assert.deepEqual(batchSummary(batch),{total:4,passed:1,failed:0,interrupted:1,blocked:0,notStarted:2,running:0,unknown:0,processed:2});
 assert.deepEqual(batchRemainingItems(batch).map(i=>i.case_id),['b','c','d']);
 const html=batchDetailHtml(batch,{project_id:'p',cases:[...batch.items,item('e','BLOCKED'),item('f','BLOCKED')]});
 assert.match(html,/本次范围 4 条/);assert.match(html,/另外 2 条未选入本次/);assert.match(html,/选择本次未完成的 3 条/);
 assert.doesNotMatch(html,/本次范围 6 条/);
});
test('stop requested does not fabricate cancelled results or offer retry while current execution runs',()=>{
 const batch={batch_id:'b',state:'STOPPING',items:[item('a','FINISHED','PASSED'),item('b','RUNNING'),item('c','QUEUED')]};
 const summary=batchSummary(batch);assert.equal(summary.passed,1);assert.equal(summary.interrupted,0);assert.equal(summary.running,1);
 const html=batchDetailHtml(batch,{project_id:'p',cases:batch.items});assert.match(html,/结果以实际返回为准/);assert.doesNotMatch(html,/id="rerun-remaining"/);
 batch.items[1]=item('b','FINISHED','PASSED');batch.items[2]=item('c','NOT_RUN');batch.state='CANCELLED';
 assert.equal(batchSummary(batch).passed,2);assert.deepEqual(batchRemainingItems(batch).map(i=>i.case_id),['c']);
});
test('unknown and blocked results remain separate from passed; titles are escaped',()=>{
 const batch={batch_id:'b',state:'FINISHED',items:[item('<img src=x>','FINISHED','UNKNOWN'),item('b','BLOCKED'),item('c','FINISHED','FAILED')]};
 assert.equal(batchSummary(batch).unknown,1);assert.equal(batchSummary(batch).blocked,1);assert.equal(batchSummary(batch).passed,0);
 const html=batchDetailHtml(batch,{project_id:'p',cases:batch.items});assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x>/);
 assert.deepEqual(batchRemainingItems(batch),[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Exercise the real app's notes-mount boundary without starting app routing or
// an HTTP server. The status selection and host selectors come from app.js.
const source=await fs.readFile(new URL('../web-v2/app.js',import.meta.url),'utf8');
const start=source.indexOf("  if(selected &&",source.indexOf('async function renderExecutionRecords'));
const end=source.indexOf("  document.querySelector('#stop-candidate-trial')",start);
assert.ok(start>=0&&end>start);
const mount=new Function('selected','context','document','executionNotesHtml','mountExecutionNotes','project','api','jsonOptions',source.slice(start,end));
for(const context of [null,{item:{case_id:'case-one'}}]){
 for(const execution_status of ['CANCELLED','INTERRUPTED'])test(`${execution_status} with raw NOT_RUN offers notes in ${context?'case':'standalone'} result without changing raw facts`,()=>{
  const selected={run_id:'run-one',status:'NOT_RUN',execution_status},before=JSON.stringify(selected),calls=[];
  const host={insertAdjacentHTML:(position,html)=>calls.push({position,html}),querySelector:()=>({isConnected:true})};
  const queries=[];const document={querySelector:selector=>{queries.push(selector);return selector==='#case-results .panel-body'?host:selector==='[data-run-id]'?{parentElement:host}:null;}};
  mount(selected,context,document,()=>'<form>notes</form>',value=>calls.push(value),{project_id:'project-one'},()=>{},()=>{});
  assert.equal(calls.length,2);assert.equal(calls[1].runId,'run-one');assert.equal(calls[1].projectId,'project-one');assert.equal(JSON.stringify(selected),before);assert.equal(queries[0],context?'#case-results .panel-body':'[data-run-id]');
 });
}
test('ordinary unfinished or passed records do not become problem records',()=>{
 for(const selected of [{status:'NOT_RUN',execution_status:'QUEUED'},{status:'NOT_RUN',execution_status:'RUNNING'},{status:'PASSED',execution_status:'FINISHED'}]){
  mount(selected,null,{querySelector:()=>{throw Error('UNEXPECTED_NOTES');}},()=>{},()=>{}, {},()=>{},()=>{});
 }
});
test('failed results retain their existing problem entry',()=>{
 const host={insertAdjacentHTML(){},querySelector:()=>({})},calls=[];
 mount({run_id:'failed-one',status:'FAILED',execution_status:'FINISHED'},null,{querySelector:()=>({parentElement:host})},()=>'',value=>calls.push(value),{project_id:'project-one'},()=>{},()=>{});assert.equal(calls[0].runId,'failed-one');
});

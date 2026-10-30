import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectCaseSelection, selectionRouteIdentity } from '../web-v2/case-selection.js';
import { batchCoverage, closeoutReason, assertAttemptAllowed } from '../server/native-dsh/completion.mjs';

test('70 selected IDs survive paging, workflow, DSH, empty scope and project isolation', () => {
  const id = randomUUID(), cases = Array.from({length:70},(_,i)=>({case_id:`case-${i}`}));
  const selected = projectCaseSelection(id,cases);
  for(const item of cases)selected.add(item.case_id);
  assert.equal(projectCaseSelection(id,cases).size,70);
  const transferred=projectCaseSelection(id,cases,new URLSearchParams({selected:[...selected].join(',')}));
  assert.equal(transferred,selected);assert.equal(transferred.size,70);
  transferred.delete('case-15');assert.equal(projectCaseSelection(id,cases).size,69);
  assert.equal(projectCaseSelection(randomUUID(),cases).size,0);
  assert.equal(projectCaseSelection(id,cases.slice(0,10)).size,10,'deleted cases pruned');
  assert.equal(projectCaseSelection(id,cases,new URLSearchParams('selected=')).size,0);
});

test('refresh restores project selection and storage errors do not break selection',()=>{
  const previous=globalThis.sessionStorage,id=randomUUID();
  globalThis.sessionStorage={getItem:()=>JSON.stringify(['saved','stale']),setItem(){throw Error('quota');}};
  try { const selected=projectCaseSelection(id,[{case_id:'saved'},{case_id:'new'}]);assert.deepEqual([...selected],['saved']);selected.add('new');assert.equal(selected.size,2); }
  finally {globalThis.sessionStorage=previous;}
});

test('diagnostics do not cover cases; persisted blocked drafts and mixed formal outcomes do',()=>{
  const task={items:[{case_id:'a',status:'FAILED'},{case_id:'b',status:'NOT_RUN'}],runs:[{case_id:'a',counts_for_case:false}],drafts:[]};
  const ids=new Set(['a','b']);assert.equal(batchCoverage(task,ids).some(item=>item.handled),false);
  task.runs.push({case_id:'a',counts_for_case:true});task.drafts.push({case_id:'b',draft_status:'BLOCKED_PRECONDITION'});
  assert.equal(batchCoverage(task,ids).every(item=>item.handled),true);
});

test('closeout bounds only apply after coverage and never interrupt owned execution or draft persistence',()=>{
  assert.equal(closeoutReason({},999999),null);
  const active={closeout:{lastProgress:1000,tools:0}};
  assert.equal(closeoutReason(active,120999),null);assert.equal(closeoutReason(active,121001),'NATIVE_DSH_CLOSEOUT_STALLED');
  active.closeout.tools=12;assert.equal(closeoutReason(active,1001),'NATIVE_DSH_CLOSEOUT_TOOL_LIMIT');
  active.executePromise=Promise.resolve();assert.equal(closeoutReason(active,999999),null);
  active.executePromise=null;active.draftPromise=Promise.resolve();assert.equal(closeoutReason(active,999999),null);
});


test('selection URL persistence keeps the current page alive without weakening navigation boundaries',()=>{
  assert.equal(selectionRouteIdentity('#/projects/p/native-dsh?selected=a'),selectionRouteIdentity('#/projects/p/native-dsh?selected=b'));
  assert.equal(selectionRouteIdentity('#/projects/p'),selectionRouteIdentity('#/projects/p?selected=a'));
  assert.notEqual(selectionRouteIdentity('#/projects/p/cases?page=1'),selectionRouteIdentity('#/projects/p/cases?page=2'));
  assert.notEqual(selectionRouteIdentity('#/projects/p/native-dsh'),selectionRouteIdentity('#/projects/q/native-dsh'));
  assert.equal(selectionRouteIdentity('#/projects/p/reports?selected=a'),'#/projects/p/reports?selected=a');
});

test('passing assertions with incomplete evidence may be repaired within the same attempt limit',()=>{
  const task={runs:[{case_id:'a',counts_for_case:true,status:'PASSED',evidence_status:'INCOMPLETE'}]},item={case_id:'a',status:'PASSED'};
  assert.doesNotThrow(()=>assertAttemptAllowed(task,item,{counts_for_case:true}));
  task.runs.push({...task.runs[0],evidence_status:'COMPLETE'});
  assert.throws(()=>assertAttemptAllowed(task,item,{counts_for_case:true}),/ALREADY_PASSED/);
});

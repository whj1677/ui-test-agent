import test from 'node:test';
import assert from 'node:assert/strict';
import { executionSteps, executionMediaUrl, executionMediaFiles, verifiedWindowTimeline, mediaStepPosition } from '../web-v2/execution-media.js';
import { nativeMediaRun, nativeEvidenceHtml, nativeAssertionDetails, nativePrimaryActualLabel, nativeRerunItems, nativeRerunHtml, nativeConsoleModel, nativeTaskProgress } from '../web-v2/native-console-view.js';

const H='a'.repeat(64),S='b'.repeat(64),B='c'.repeat(64);
const content={steps:[{order:1,action:'查询',expected:'原用例预期原文'},{order:2,action:'核对',expected:'第二步预期'}]};
const project={project_id:'p',cases:[{case_id:'c',current_version:1,versions:[{version:1,content_sha256:H.toUpperCase(),content}]}]};
const row={origin:'NATIVE_DSH',project_id:'p',task_id:'t',run_id:'r',latest_run_id:'r',case_id:'c',case_version:1,content_sha256:H,script_sha256:S,bundle_sha256:B,status:'PASSED',purpose:'case',counts_for_case:true,binding_status:'CURRENT',source:{available:true},external_id:'TC-001'};
const captured=(actual,status='PASSED')=>({step_id:'CASE_STEP_1',order:1,action:'脚本中的描述',expected:'不得覆盖原预期',execution_status:status,actual,actual_present:true,actual_recorded:true,value_source:'PLAYWRIGHT_MATCHER_ARGUMENTS'});
const file=(id,kind)=>({file_id:id,file_name:`${id}.webm`,kind,url:`/api/case-library/projects/p/native-dsh/tasks/t/files/${id}`});

test('native legacy pass retains original expected but cannot invent step actual or verdict',()=>{
 const input={...row},before=JSON.stringify(input),run=nativeMediaRun(project,input),steps=executionSteps(run);
 assert.deepEqual(steps.map(step=>step.execution_status),['MISSING','MISSING']);
 assert.equal(steps[0].expected,'原用例预期原文');assert.equal(steps[0].actual,'未单独采集可信实际值');
 assert.match(nativeEvidenceHtml(project,input),/此记录未采集浏览器整窗录像/);assert.equal(JSON.stringify(input),before);
});

test('collection failures stay visibly explained while complete mapping details can collapse',()=>{
 const html=nativeEvidenceHtml(project,{...row,evidence_status:'INCOMPLETE',evidence_mapping:{status:'UNAVAILABLE',reason:'STEP_BOUNDARY_AMBIGUOUS'},evidence_errors:['CAPTURE_FAILED <img src=x>'],step_replay:{status:'UNAVAILABLE',reason:'STEP_MAPPING_NOT_VERIFIED'},window_timeline:{status:'UNAVAILABLE',reason:'WINDOW_RECORDING_NOT_COMPLETE'}});
 const notice=html.match(/<div class="notice warning native-evidence-issues"[^>]*>([\s\S]*?)<\/div>/)?.[1];
 assert.ok(notice);assert.match(notice,/步骤映射：STEP_BOUNDARY_AMBIGUOUS/);assert.match(notice,/采集错误：CAPTURE_FAILED &lt;img src=x&gt;/);
 assert.match(notice,/步骤回放：STEP_MAPPING_NOT_VERIFIED/);assert.match(notice,/整窗同步：WINDOW_RECORDING_NOT_COMPLETE/);assert.doesNotMatch(notice,/<img/);
 const complete=nativeEvidenceHtml(project,{...row,evidence_status:'COMPLETE',evidence_mapping:{status:'BOUND'},evidence_errors:[],step_replay:{status:'READY',steps:[]}});
 assert.match(complete,/<details class="native-evidence-mapping"><summary>步骤采集映射/);assert.doesNotMatch(complete,/native-evidence-issues|步骤回放：LEGACY/);
});

test('trusted null false zero empty string and empty array remain distinct from absent actual for pass and failure',()=>{
 for(const actual of [null,false,0,'',[]])for(const status of ['PASSED','FAILED']){
   const input={...row,status,step_replay:{steps:[captured(actual,status)]}};
   const [step]=executionSteps(nativeMediaRun(project,input));assert.deepEqual(step.actual,actual);assert.equal(step.actual_recorded,true);
   assert.equal(step.expected,'原用例预期原文');assert.equal(step.execution_status,status);
 }
 for(const change of [step=>{delete step.actual;},step=>{step.actual_present=false;},step=>{step.actual_recorded=false;},step=>{step.value_source='MODEL_SUMMARY';}]){
   const step=captured(null);change(step);assert.equal(executionSteps({step_replay:{steps:[step]}})[0].actual,'未单独采集可信实际值');
 }
});

test('all assertion details retain script expected actual status and source location independently of original expected',()=>{
 const assertions=[{matcher:'toBeNull',expected:null,actual:null,actual_present:true,value_source:'PLAYWRIGHT_MATCHER_ARGUMENTS',status:'PASSED',location:{file:'specs/a.mjs',line:9,column:1}},
 {matcher:'toEqual',expected:[],actual:[],actual_present:true,value_source:'PLAYWRIGHT_MATCHER_RESULT',status:'FAILED',location:'specs/a.mjs:10'},
 {matcher:'toBeVisible',expected:true,status:'PASSED',actual_present:false}];
 const html=nativeAssertionDetails({order:1,assertions},{});
 assert.match(html,/本步骤断言明细（3）/);assert.match(html,/toBeNull/);assert.match(html,/>null</);assert.match(html,/\[\]/);assert.match(html,/specs\/a.mjs:9:1/);assert.match(html,/未单独采集可信实际值/);
 const primary={...captured(null),assertions,primary_assertion_index:0,actual_source_assertion:{matcher_name:'toBeNull',message:'空值核对'}};
 assert.match(nativePrimaryActualLabel(primary),/第 1\/3 条断言：toBeNull · 空值核对/);
 const full=nativeEvidenceHtml(project,{...row,step_replay:{steps:[primary]}});
 assert.match(full,/原用例预期原文/);assert.match(full,/脚本断言预期/);
});
test('collector assertion_expected and parameterless matcher semantics preserve not and soft flags',()=>{
 const assertions=[{matcher_name:'toEqual',assertion_expected:[0,false],expected_present:true,actual:[1,false],actual_present:true,actual_recorded:true,value_source:'PLAYWRIGHT_MATCHER_ARGUMENTS',status:'FAILED'},
 {matcher_name:'toBeTruthy',is_not:true,is_soft:true,expected_present:false,actual:false,actual_present:true,actual_recorded:true,value_source:'PLAYWRIGHT_MATCHER_ARGUMENTS',status:'PASSED'}];
 const html=nativeAssertionDetails({order:1,assertions},{});
 assert.match(html,/0,\n  false/);assert.match(html,/not.toBeTruthy/);assert.match(html,/无显式预期参数/);assert.match(html,/soft/);assert.doesNotMatch(html,/断言预期未采集/);
});

test('native registered media uses native URLs and preserves window webpage replay identities',()=>{
 const input={...row,files:[file('window','trial_window_video'),file('web','trial_video'),file('replay','trial_step_replay_video')]};
 const run=nativeMediaRun(project,input),files=executionMediaFiles(run);
 assert.equal(files.window.file_id,'window');assert.equal(files.original.file_id,'web');assert.equal(files.replay.file_id,'replay');
 assert.equal(executionMediaUrl(run,'window'),'/api/case-library/projects/p/native-dsh/tasks/t/files/window');
 assert.equal(executionMediaUrl({...run,task_id:'foreign'},'window'),'');
 assert.equal(executionMediaUrl({...run,files:[{file_id:'window',artifact_url:'https://wrong/'}]},'window'),'');
});

test('native timeline retains exact run and frozen script identity for playback synchronization',()=>{
 const input={...row,step_replay:{steps:[captured(0)]},window_timeline:{schema:'workbench/window-step-timeline-v1',status:'VERIFIED',run_id:'r',candidate_sha256:S,duration_seconds:10,accuracy_seconds:.1,steps:[{step_id:'CASE_STEP_1',order:1,start_seconds:1,action_start_seconds:1,result_start_seconds:3,end_seconds:5,execution_status:'PASSED'}]}};
 const run=nativeMediaRun(project,input),timeline=verifiedWindowTimeline(run,10);
 assert.equal(timeline.status,'VERIFIED');assert.deepEqual(mediaStepPosition(timeline.steps,4),{step_id:'CASE_STEP_1',phase:'result'});
 assert.equal(verifiedWindowTimeline({...run,run_id:'foreign'},10).status,'UNAVAILABLE');assert.equal(verifiedWindowTimeline(run,11).status,'UNAVAILABLE');
});

test('rerun selections preserve frozen source identities and reject duplicate cases or incomplete hashes',()=>{
 const items=nativeRerunItems([row]);assert.deepEqual(items,[{source_task_id:'t',source_run_id:'r',case_id:'c',case_version:1,content_sha256:H,script_sha256:S,bundle_sha256:B}]);
 assert.throws(()=>nativeRerunItems([row,row]),/同一用例/);assert.throws(()=>nativeRerunItems([{...row,bundle_sha256:''}]),/身份不完整/);assert.throws(()=>nativeRerunItems([]),/1–20/);
 const html=nativeRerunHtml(project,[{external_id:'TC-001',rows:[{...row,display_version:'D3'}]}]);assert.match(html,/不调用模型/);assert.match(html,/data-native-rerun-preview/);assert.match(html,/D3/);assert.match(html,new RegExp(B));
});

test('partial and blocked reruns terminate progress while stop-unconfirmed remains locked',()=>{
 for(const status of ['PARTIAL','BLOCKED','TIMED_OUT','COMPLETED'])assert.equal(nativeTaskProgress({task_id:'t',status},[]).terminal,true);
 const state=nativeTaskProgress({task_id:'t',status:'STOP_UNCONFIRMED'},[]);assert.equal(state.terminal,false);assert.equal(state.locked,true);
});

test('new and legacy timeout spellings count as failure while diagnostic pass never contributes',()=>{
 const records=[{...row,status:'TIMED_OUT'},{...row,run_id:'r2',case_id:'c2',status:'TIMEDOUT'},{...row,run_id:'d',purpose:'diagnostic',counts_for_case:false}];
 const state=nativeTaskProgress({task_id:'t',status:'PARTIAL'},records);assert.equal(state.failed,2);assert.equal(state.passed,0);
 assert.equal(nativeConsoleModel(project,{records}).failed,2);
});

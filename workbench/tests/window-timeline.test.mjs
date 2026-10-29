import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {windowTimelineFromObservations,withWindowTimeline} from '../server/build/window-timeline.mjs';
const identity={run_id:'run-sync-1',candidate_sha256:'A'.repeat(64),candidate_bundle_sha256:'B'.repeat(64),executed_external_id:'UI-01',executed_case_id:'case-1',executed_case_version:1,executed_content_sha256:'C'.repeat(64)};
const stamp=ms=>new Date(Date.UTC(2026,9,9)+ms).toISOString();
function fixture(){
 const observations=[{schema:'workbench/step-observation-v1',...identity,step_id:'CASE_STEP_1',order:1,depth:0,raw_title:'CASE_STEP_1: query',status:'PASSED',started_at:stamp(100),business_started_at:stamp(200),business_ended_at:stamp(500),ended_at:stamp(600)},
 {schema:'workbench/step-observation-v1',...identity,step_id:'CASE_STEP_2',order:2,depth:0,raw_title:'CASE_STEP_2: check',status:'FAILED',started_at:stamp(650),business_started_at:stamp(700),business_ended_at:stamp(1200),ended_at:stamp(1300)}];
 const run={...identity,bundle_sha256:identity.candidate_bundle_sha256,origin:'EXPLICIT_CANDIDATE_TRIAL',window_recording:{status:'COMPLETE',identity:{...identity},fps:10,frame_count:20,encoded_duration_seconds:2,maximum_capture_gap_ms:135,started_at:stamp(0),ended_at:stamp(1980),video_bytes:1234},
 files:[{kind:'trial_window_video',relative_path:'execution/artifacts/window-recording/browser-window.webm',sha256:'D'.repeat(64),bytes:1234}],
 step_coverage:{items:observations.map(o=>({step_id:o.step_id,order:o.order,raw_title:o.raw_title,observed:true,execution_status:o.status}))}};
 return {run,observations};
}
test('actual capture clock maps steps and failure results without changing the run',()=>{
 const {run,observations}=fixture(),before=JSON.stringify(run);const t=windowTimelineFromObservations(run,observations);
 assert.equal(t.status,'VERIFIED');assert.deepEqual(t.steps[1],{step_id:'CASE_STEP_2',order:2,execution_status:'FAILED',start_seconds:.65,action_start_seconds:.7,result_start_seconds:1.2,end_seconds:1.3});
 assert.equal(t.accuracy_seconds,.135);assert.equal(JSON.stringify(run),before);
});
test('every run/case/bundle identity is checked for both recording and observations',()=>{
 for(const key of Object.keys(identity))for(const target of ['recording','observation']){
 const {run,observations}=fixture();if(target==='recording')run.window_recording.identity[key]='mismatch';else observations[0][key]='mismatch';
 assert.equal(windowTimelineFromObservations(run,observations).status,'UNAVAILABLE',key+' '+target);
 }
});
test('missing or foreign media cannot become a browser timeline',()=>{
 for(const change of [r=>r.files=[],r=>r.files[0].relative_path='another/browser-window.webm',r=>r.files[0].bytes++,r=>r.window_recording.status='INCOMPLETE']){
 const {run,observations}=fixture();change(run);assert.equal(windowTimelineFromObservations(run,observations).status,'UNAVAILABLE');
 }
});
test('clock jumps, shortened videos, missing frame counts and capture stalls reject mapping',()=>{
 for(const change of [r=>r.ended_at=stamp(4000),r=>r.encoded_duration_seconds=1,r=>delete r.frame_count,r=>r.maximum_capture_gap_ms=2000,r=>r.started_at='unknown']){
 const {run,observations}=fixture();change(run.window_recording);assert.equal(windowTimelineFromObservations(run,observations).reason,'WINDOW_TIMELINE_CLOCK_UNVERIFIED');
 }
});
test('unordered, overlapping, out-of-range, nested and missing observations reject mapping',()=>{
 for(const change of [a=>a.reverse(),a=>a[1].started_at=stamp(300),a=>a[1].ended_at=stamp(2200),a=>a[0].business_started_at=stamp(800),a=>a[0].depth=1,a=>a.pop(),a=>a[1].step_id=a[0].step_id]){
 const {run,observations}=fixture();change(observations);assert.equal(windowTimelineFromObservations(run,observations).status,'UNAVAILABLE');
 }
});
test('legacy projection reads bound observations without rewriting run or evidence',async()=>{
 const {run,observations}=fixture();const directory=await fs.mkdtemp(path.join(os.tmpdir(),'window-sync-'));
 try{
 const evidence=path.join(directory,'execution/artifacts/step-evidence/step-observations.ndjson');await fs.mkdir(path.dirname(evidence),{recursive:true});
 const content=observations.map(JSON.stringify).join('\n');await fs.writeFile(evidence,content);
 const before=JSON.stringify(run),projected=await withWindowTimeline(run,{runDirectory:id=>{assert.equal(id,run.run_id);return directory}});
 assert.equal(projected.window_timeline.status,'VERIFIED');assert.match(projected.window_timeline.observations_sha256,/^[A-F0-9]{64}$/);
 assert.equal(JSON.stringify(run),before);assert.equal(await fs.readFile(evidence,'utf8'),content);
 }finally{await fs.rm(directory,{recursive:true,force:true})}
});
test('missing observations degrade only synchronization and legacy records stay untouched',async()=>{
 const {run}=fixture();const projected=await withWindowTimeline(run,{runDirectory:()=>path.join(os.tmpdir(),'nonexistent-run-for-window-sync')});
 assert.equal(projected.window_timeline.status,'UNAVAILABLE');const legacy={run_id:'legacy'};assert.equal(await withWindowTimeline(legacy,{}),legacy);
});

test('disk timing cannot contradict frozen replay observations',()=>{
 for(const field of ['observer_start','executed_start','executed_end','observer_end']){
  const {run,observations}=fixture();
  run.step_replay={status:'READY',steps:observations.map(o=>({step_id:o.step_id,observer_start:o.started_at,executed_start:o.business_started_at,executed_end:o.business_ended_at,observer_end:o.ended_at}))};
  assert.equal(windowTimelineFromObservations(run,observations).status,'VERIFIED');
  run.step_replay.steps[0][field]=stamp(1000);
  assert.equal(windowTimelineFromObservations(run,observations).reason,'WINDOW_TIMELINE_FROZEN_TIME_CONFLICT');
 }
});

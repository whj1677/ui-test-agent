import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativeReportRecords} from '../server/native-dsh/report-records.mjs';
import {ReportSnapshots} from '../server/report-snapshots.mjs';
import {selectProjectLatest} from '../server/report-latest-selection.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const content={external_id:'UI-1',title:'真实页面值',case_type:'UI',steps:[{order:1,action:'读取页面',expected:'字段值保持 false 和 0'}]};
const contentSha='a'.repeat(64);
const project={project_id:'project-a',name:'报告回归',cases:[{case_id:'case-ui',current_version:2,versions:[{version:1,content_sha256:'b'.repeat(64),content:{...content,title:'旧版'}},{version:2,content_sha256:contentSha.toUpperCase(),content}]}]};
const native=(extra={})=>({origin:'NATIVE_DSH',project_id:'project-a',task_id:'native-a',run_id:'run-a',case_id:'case-ui',external_id:'UI-1',case_version:2,content_sha256:contentSha,frozen_case_content:content,binding_status:'CURRENT',recorded_counts_for_case:true,counts_for_case:true,purpose:'case',status:'PASSED',evidence_status:'COMPLETE',source:{available:true},started_at:'2026-10-27T01:00:00Z',finished_at:'2026-10-27T01:01:00Z',environment_binding:{environment_id:'env-a',configuration_sha256:'c'.repeat(64),base_url:'http://127.0.0.1:4460/inspection/'},files:[],...extra});
const projectRecords=rows=>nativeReportRecords({console:async()=>({records:structuredClone(rows)})},'project-a');
test('native reports count only bound formal records and match uppercase current content hashes',async()=>{
 const rows=await projectRecords([native(),native({run_id:'diag',purpose:'diagnostic',recorded_counts_for_case:false}),native({run_id:'foreign',project_id:'project-b'}),native({run_id:'unbound',binding_status:'UNBOUND'}),native({run_id:'draft',purpose:'draft'})]);
 assert.equal(rows.length,1);
 const result=selectProjectLatest(project,rows,[],{group_key:'latest_per_case'});
 assert.equal(result.counts.passed,1);assert.equal(result.counts.not_run,0);
 assert.equal(result.groups[0].scope.environment_id,'env-a');
 assert.equal(rows[0].approval_status,'NOT_APPROVED');
});
test('newer native failure or broken frozen source never falls back to an earlier pass',async()=>{
 for(const extra of [{status:'FAILED'},{counts_for_case:false,source:{available:false,reason:'SOURCE_FILE_MISMATCH'}},{evidence_status:'NOT_CAPTURED'}]){
  const rows=await projectRecords([native(),native({run_id:'newest',started_at:'2026-10-27T02:00:00Z',...extra})]);
  const result=selectProjectLatest(project,rows,[],{group_key:'latest_per_case'}),entry=result.groups[0].entries[0];
  assert.equal(entry.run_id,'newest');assert.equal(result.counts.passed,0);
  assert.equal(entry.state,extra.status==='FAILED'?'FAILED':'INCOMPLETE');
 }
 const oldOnly=await projectRecords([native({case_version:1,content_sha256:'b'.repeat(64),binding_status:'HISTORICAL'})]);
 assert.equal(selectProjectLatest(project,oldOnly,[],{group_key:'latest_per_case'}).counts.not_run,1);
});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-report-'));
 t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^native-report-/);await fs.rm(root,{recursive:true,force:true});});
 const files=[];
 for(const [relative_path,kind,bytes] of [['image.png','trial_screenshot',Buffer.from('image fixture')],['video.webm','trial_video',Buffer.from('video fixture')],['trace.zip','trial_trace',Buffer.from('trace fixture')]]){
  await fs.writeFile(path.join(root,relative_path),bytes);files.push({file_id:relative_path,relative_path,kind,sha256:hash(bytes),bytes:bytes.length});
 }
 const observed=native({files,step_replay:{steps:[{order:1,status:'PASSED',screenshot_file_name:'image.png',assertions:[{matcher_name:'toBe',status:'PASSED',actual:false,actual_present:true,assertion_expected:false},{matcher_name:'toBe',status:'PASSED',actual:0,actual_present:true,assertion_expected:0}]}]}});
 const reports=new ReportSnapshots({root:path.join(root,'reports'),caseStore:{getProject:async()=>structuredClone(project)},batchManager:{list:async()=>[]},records:()=>projectRecords([observed]),
  nativeArtifact:async(p,task,id)=>{assert.equal(p,'project-a');assert.equal(task,'native-a');const media=files.find(f=>f.file_id===id);assert.ok(media);return {root,media};}});
 return {root,observed,files,reports};
}
test('native snapshot freezes actual values and registered attachments with exact hashes',async t=>{
 const f=await fixture(t),snapshot=await f.reports.create('project-a',{scope:'project_latest',group_key:'latest_per_case',request_id:'native-full-attachments',include_video:true,include_trace:true});
 assert.equal(snapshot.counts.passed,1);assert.equal(snapshot.entries[0].media.length,3);
 for(const media of snapshot.entries[0].media){assert.equal(media.included,true);assert.equal(hash(Buffer.from(media.data_url.split(',')[1],'base64')).toUpperCase(),media.sha256);}
 const html=await f.reports.html(snapshot.report_id,'project-a');
 assert.match(html,/实际 false/);assert.match(html,/实际 0/);assert.match(html,/人工首审未登记/);
 const before=JSON.stringify(snapshot);f.observed.status='FAILED';
 assert.equal(JSON.stringify(await f.reports.get(snapshot.report_id,'project-a')),before);
 assert.equal(await f.reports.html(snapshot.report_id,'project-a'),html);
 await assert.rejects(f.reports.get(snapshot.report_id,'project-other'),/REPORT_PROJECT_MISMATCH/);
});
test('native single-run reports honour video and trace selection',async t=>{
 const f=await fixture(t),snapshot=await f.reports.create('project-a',{scope:'run',run_id:'run-a',request_id:'native-single-run'});
 assert.equal(snapshot.counts.passed,1);
 assert.deepEqual(snapshot.entries[0].media.map(m=>[m.kind,m.included]),[['image',true],['video',false],['trace',false]]);
});
test('native tampered or mismatched registered attachment marks latest report incomplete',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.root,'image.png'),'tampered');
 const snapshot=await f.reports.create('project-a',{scope:'project_latest',group_key:'latest_per_case',request_id:'native-corrupt-image'});
 assert.equal(snapshot.counts.passed,0);assert.equal(snapshot.counts.incomplete,1);
 assert.equal(snapshot.entries[0].media[0].reason,'MEDIA_INTEGRITY_FAILED');
 f.reports.nativeArtifact=async()=>({root:f.root,media:{relative_path:'foreign.png',sha256:f.files[0].sha256,bytes:f.files[0].bytes}});
 const mismatch=await f.reports.create('project-a',{scope:'project_latest',group_key:'latest_per_case',request_id:'native-foreign-media'});
 assert.equal(mismatch.entries[0].media[0].reason,'MEDIA_IDENTITY_MISMATCH');
});
test('single native run keeps raw pass but reports incomplete source or media without a false passed count',async t=>{
 const f=await fixture(t);f.observed.counts_for_case=false;f.observed.source={available:false,reason:'SOURCE_FILE_MISMATCH'};
 const source=await f.reports.create('project-a',{scope:'run',run_id:'run-a',request_id:'single-source-invalid'});
 assert.equal(source.entries[0].result,'PASSED');assert.equal(source.entries[0].state,'INCOMPLETE');assert.equal(source.counts.passed,0);assert.equal(source.counts.incomplete,1);
 f.observed.counts_for_case=true;f.observed.source={available:true};await fs.writeFile(path.join(f.root,'image.png'),'changed');
 const media=await f.reports.create('project-a',{scope:'run',run_id:'run-a',request_id:'single-media-invalid'});
 assert.equal(media.entries[0].state,'INCOMPLETE');assert.equal(media.counts.passed,0);assert.equal(media.counts.executed,1);
});

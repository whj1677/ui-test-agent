import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ReportSnapshots } from '../server/report-snapshots.mjs';
import { selectProjectLatest } from '../server/report-latest-selection.mjs';

const project = {project_id:'project-a',name:'项目 A',cases:['A','B','C'].map(id=>({case_id:id,current_version:id==='C'?2:1,versions:[1,2].map(version=>({version,content_sha256:`${id}${version}`,content:{external_id:id,title:`用例 ${id}`,case_type:'UI',steps:[]}}))}))};
const scope = {environment_id:'env-one',configuration_sha256:'a'.repeat(64),url:'http://127.0.0.1:4381/workspace?token=secret',name:'库存页面'};
const run = (id,caseId,status,time,extra={})=>({schema:'workbench/candidate-trial-v1',origin:'EXPLICIT_CANDIDATE_TRIAL',project_id:'project-a',run_id:id,executed_case_id:caseId,executed_case_version:1,executed_external_id:caseId,started_at:`2026-09-29T02:${time}:00.000Z`,finished_at:`2026-09-29T02:${time}:10.000Z`,execution_status:'FINISHED',status,evidence_status:'COMPLETE',software_version:'v1',environment_binding:scope,auth:{role:'inspector'},files:[],...extra});
const records = [run('a-1','A','PASSED','01'),run('b-1','B','FAILED','02'),run('c-old','C','PASSED','03'),run('b-2','B','PASSED','04'),run('b-3','B','FAILED','05')];

test('same-address scopes retain identities and describe their actual test periods',()=>{
  const variants=[run('a','A','PASSED','01'),run('b','B','FAILED','06'),
    run('other-config','A','FAILED','07',{environment_binding:{...scope,configuration_sha256:'b'.repeat(64)}})];
  const preview=selectProjectLatest(project,variants);
  assert.equal(preview.groups.length,2);
  assert.equal(preview.groups[0].scope.tested_from,variants[0].started_at);
  assert.equal(preview.groups[0].scope.tested_to,variants[1].started_at);
  assert.notEqual(preview.groups[0].group_key,preview.groups[1].group_key);
  const latest=selectProjectLatest(project,variants,[],{group_key:'latest_per_case'});
  assert.equal(latest.groups.find(g=>g.entries.some(e=>e.run_id==='other-config')).scope.tested_to,variants[2].started_at);
});

test('reports retain HTTP plan qualification without claiming product approval and preserve falsey observations',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'report-qualification-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const content={external_id:'A',title:'业务查询',case_type:'BACKEND',steps:[{order:1,action:'查询',expected:'返回授权业务值'},{order:2,action:'核对',expected:'分页正确'}]};
  const observed=run('http-a','A','FAILED','01',{schema:'workbench/backend-run-v1',origin:'HTTP_BACKEND_PLAN',
    qualification:'CONFIRMED_HTTP_PLAN_NOT_PRODUCT_APPROVAL',approval_status:'NOT_APPROVED',frozen_case_content:content,
    steps:[{order:1,status:'FAILED',actual:false},{order:2,status:'PASSED',actual:0}]});
  const reports=new ReportSnapshots({root:path.join(dir,'reports'),caseStore:{getProject:async()=>project},records:async()=>[observed],
    batchManager:{list:async()=>[]},store:{runDirectory:()=>dir},buildStore:{taskDirectory:()=>dir}});
  for(const scopeName of ['run','project_latest']){
    const input=scopeName==='run'?{run_id:'http-a'}:{group_key:'latest_per_case'};
    const snapshot=await reports.create('project-a',{scope:scopeName,...input,request_id:'qualification-'+scopeName});
    const entry=snapshot.entries.find(e=>e.run_id==='http-a');
    assert.equal(entry.qualification,'CONFIRMED_HTTP_PLAN_NOT_PRODUCT_APPROVAL');
    assert.equal(entry.product_approval_status,'NOT_APPROVED');
    const html=await reports.html(snapshot.report_id,'project-a');
    assert.match(html,/已确认HTTP执行计划，非产品验收结论/);
    assert.match(html,/失败 \/ false/);assert.match(html,/通过 \/ 0/);
    assert.doesNotMatch(html,/PASSED \/|FAILED \//);
    const frozen=JSON.stringify(snapshot);
    observed.qualification='NOT_APPROVED';
    assert.equal(JSON.stringify(await reports.get(snapshot.report_id,'project-a')),frozen);
    observed.qualification='CONFIRMED_HTTP_PLAN_NOT_PRODUCT_APPROVAL';
  }
});

test('cross-batch latest takes the last failure, keeps current-version absence, and excludes development results',()=>{
  const development={...run('a-dev','A','PASSED','59'),origin:'DEVELOPMENT_SELF_TEST'};
  const preview=selectProjectLatest(project,[...records,development]);
  assert.equal(preview.case_count,3);assert.equal(preview.groups.length,1);
  const [a,b,c]=preview.groups[0].entries;
  assert.equal(a.run_id,'a-1');assert.equal(b.run_id,'b-3');assert.equal(b.state,'FAILED');
  assert.equal(b.retest_count,2);assert.equal(c.run_id,null);assert.equal(c.reason,'CURRENT_VERSION_NOT_RUN');
  assert.equal(preview.groups[0].counts.requested,3);assert.equal(preview.groups[0].counts.failed,1);
});

test('running, blocked, cancelled, interrupted and evidence gaps never fall back to a prior pass',()=>{
  const mixed=[run('a-pass','A','PASSED','01'),run('a-live','A','RUNNING','08',{execution_status:'RUNNING',finished_at:null,files:[{kind:'trial_video',relative_path:'mutable.webm'}]}),
    run('b-pass','B','PASSED','02'),run('b-incomplete','B','PASSED','09',{evidence_status:'INCOMPLETE'}),
    run('c-cancel','C','CANCELLED','04',{executed_case_version:2,execution_status:'CANCELLED'}),
    run('c-interrupt','C','NOT_RUN','05',{executed_case_version:2,execution_status:'INTERRUPTED'})];
  const batch={project_id:'project-a',batch_id:'batch-late',state:'FINISHED',created_at:'2026-09-29T02:10:00.000Z',started_at:'2026-09-29T02:10:00.000Z',software_version:'v1',items:[{case_id:'B',case_version:1,external_id:'B',environment_identity:scope,state:'BLOCKED',reason:'SCRIPT_MISSING'}]};
  const preview=selectProjectLatest(project,mixed,[batch]);
  const groups=preview.groups;const found=groups.flatMap(g=>g.entries);
  assert.equal(found.find(e=>e.case_id==='A'&&e.run_id==='a-live').state,'RUNNING');
  assert.equal(found.find(e=>e.case_id==='B'&&e.run_id==='b-incomplete').state,'INCOMPLETE');
  assert.equal(found.find(e=>e.case_id==='C'&&e.run_id==='c-interrupt').state,'INTERRUPTED');
  assert.ok(found.some(e=>e.case_id==='B'&&e.state==='BLOCKED'&&e.reason==='SCRIPT_MISSING'));
  const previewOnly={...batch,batch_id:'preview-only',state:'PREVIEW',started_at:null,created_at:'2026-09-29T02:59:00.000Z'};
  const withoutPreview=selectProjectLatest(project,mixed,[batch,previewOnly]);
  assert.equal(withoutPreview.groups.flatMap(g=>g.entries).filter(e=>e.state==='BLOCKED').length,1);
});

test('project, target, role, software and unknown configuration boundaries are distinct',()=>{
  const variants=[run('base','A','PASSED','01'),run('other-project','A','FAILED','02',{project_id:'project-b'}),
    run('other-target','A','FAILED','03',{environment_binding:{...scope,environment_id:'env-two'}}),
    run('other-role','A','FAILED','04',{auth:{role:'admin'}}),
    run('other-version','A','FAILED','05',{software_version:'v2'}),
    run('unknown-config','A','FAILED','06',{environment_binding:{environment_id:'env-one',url:scope.url}})];
  const result=selectProjectLatest(project,variants);
  assert.equal(result.groups.length,5);assert.equal(result.case_count,3);
  assert.ok(result.groups.every(g=>g.counts.requested===3));
  assert.equal(result.counts.requested,15);assert.equal(result.counts.count_unit,'CASE_SCOPE');
  assert.equal(result.entry_count,15);
  assert.ok(result.groups.some(g=>g.scope.configuration_sha256===null));
  assert.ok(result.groups.every(g=>!g.scope.target_url?.includes('token=')));
});

test('cutoff and current content digest prevent future or changed content from becoming latest',()=>{
  const future=run('future','A','FAILED','59');
  const changed=run('changed-content','A','FAILED','08',{executed_content_sha256:'different'});
  const preview=selectProjectLatest(project,[run('valid','A','PASSED','01',{executed_content_sha256:'A1'}),future,changed],[],{cutoff_at:'2026-09-29T02:30:00.000Z'});
  assert.equal(preview.groups[0].entries[0].run_id,'valid');
  assert.throws(()=>selectProjectLatest({...project,cases:[{...project.cases[0],current_version:99}]},[]),/CURRENT_CASE_VERSION_MISSING/);
});

test('latest per case returns eight cases once across scopes and keeps a newer role failure',async t=>{
  const wide={...project,cases:'ABCDEFGH'.split('').map(id=>({case_id:id,current_version:id==='H'?2:1,
    versions:[1,2].map(version=>({version,content_sha256:`${id}${version}`,content:{external_id:id,title:`用例 ${id}`,case_type:'UI',steps:[]}}))}))};
  const mixed=[run('a-pass','A','PASSED','01'),run('a-fail-admin','A','FAILED','20',{auth:{role:'admin'}}),
    ...'BCDEFG'.split('').map((id,index)=>run(`${id}-run`,id,'PASSED',String(index+2).padStart(2,'0'),
      {environment_binding:{...scope,environment_id:index%2?'env-two':'env-one'},software_version:index%3?'v1':'v2'})),
    run('h-old','H','PASSED','09')];
  const latest=selectProjectLatest(wide,mixed,[],{group_key:'latest_per_case'});
  assert.equal(latest.case_count,8);assert.equal(latest.entry_count,8);
  assert.equal(latest.groups.flatMap(g=>g.entries).length,8);
  assert.equal(new Set(latest.groups.flatMap(g=>g.entries.map(e=>e.case_id))).size,8);
  const chosen=latest.groups.flatMap(g=>g.entries);
  assert.equal(chosen.find(e=>e.case_id==='A').run_id,'a-fail-admin');
  assert.equal(chosen.find(e=>e.case_id==='A').state,'FAILED');
  assert.equal(chosen.find(e=>e.case_id==='A').retest_count,1);
  assert.equal(chosen.find(e=>e.case_id==='H').run_id,null);
  assert.equal(chosen.find(e=>e.case_id==='H').reason,'CURRENT_VERSION_NOT_RUN');
  assert.ok(latest.groups.some(g=>g.group_key==='group-unexecuted'&&g.entries.length===1));
  assert.ok(latest.groups.every(g=>g.counts.requested===g.entries.length));
  assert.match(latest.group_options.find(option=>option.group_key==='all').label,/重复用例/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'report-eight-cases-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const reports=new ReportSnapshots({root:path.join(dir,'reports'),caseStore:{getProject:async()=>wide},records:async()=>mixed,
    batchManager:{list:async()=>[]},store:{runDirectory:()=>dir},buildStore:{taskDirectory:()=>dir}});
  const snapshot=await reports.create('project-a',{scope:'project_latest',group_key:'latest_per_case',request_id:'eight-once'});
  const html=await reports.html(snapshot.report_id,'project-a');
  assert.equal(snapshot.entries.length,8);assert.equal(snapshot.entry_count,8);
  assert.equal((html.match(/<article class="case">/g)||[]).length,8);
  assert.match(html,/不同测试范围与时间/);
});

test('latest snapshot freezes selection and content; repeat request is idempotent, legacy run remains valid',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'report-latest-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const mutable=[...records];mutable[0]={...mutable[0],script_version:'script-v1',candidate_version:3,
    approval_status:'NOT_APPROVED',requirement_review:{requirements_status:'NOT_ACCEPTED_ACTION_CHANGED',finding:'动作与原要求不符'}};
  const fixture={root:path.join(dir,'reports'),caseStore:{getProject:async id=>id===project.project_id?project:null},
    records:async()=>mutable,batchManager:{list:async()=>[]},store:{runDirectory:()=>dir},buildStore:{taskDirectory:()=>dir}};
  const reports=new ReportSnapshots(fixture);
  const preview=await reports.latestPreview('project-a');
  const request={scope:'project_latest',group_key:preview.groups[0].group_key,request_id:'latest-idempotent'};
  const first=await reports.create('project-a',request);
  const html=await reports.html(first.report_id,'project-a');
  assert.equal(first.entries.find(e=>e.case_id==='B').run_id,'b-3');
  mutable.push(run('b-4','B','PASSED','59'));
  const repeated=await reports.create('project-a',request);
  assert.deepEqual(repeated,first);assert.equal(await reports.html(first.report_id,'project-a'),html);
  assert.match(html,/b-3/);assert.match(html,/全项目最新测试结果/);
  assert.match(html,/当前用例 3 · 已执行/);
  assert.match(html,/脚本版本：script-v1 · 候选版本：3/);
  assert.match(html,/原始执行：<b>通过<\/b> · 要求核对：动作或预期偏离，不采纳 · 脚本资格：未批准/);
  assert.match(html,/动作与原要求不符/);
  const legacy=await reports.create('project-a',{scope:'run',run_id:'a-1',request_id:'legacy-still-valid'});
  assert.equal(legacy.scope,'run');assert.equal(legacy.entries[0].run_id,'a-1');
  await assert.rejects(reports.create('project-a',{...request,include_video:true}),/REPORT_REQUEST_CONFLICT/);
  mutable.push(run('a-live','A','RUNNING','58',{execution_status:'RUNNING',finished_at:null,
    evidence_status:'PENDING',files:[{kind:'trial_video',relative_path:'mutable.webm',bytes:100,sha256:'bad'}]}));
  const livePreview=await reports.latestPreview('project-a');
  const live=await reports.create('project-a',{scope:'project_latest',group_key:livePreview.groups[0].group_key,request_id:'latest-running-media',include_video:true});
  const liveEntry=live.entries.find(e=>e.case_id==='A');
  assert.equal(liveEntry.state,'RUNNING');assert.equal(liveEntry.media.length,0);assert.equal(liveEntry.previous_run_id,'a-1');
  mutable.push(run('b-media','B','PASSED','59',{files:[{kind:'trial_video',relative_path:'missing.webm',bytes:100,sha256:'bad'}]}));
  const mediaReport=await reports.create('project-a',{scope:'project_latest',group_key:livePreview.groups[0].group_key,request_id:'latest-missing-media',include_video:true});
  const mediaEntry=mediaReport.entries.find(e=>e.case_id==='B');
  assert.equal(mediaEntry.state,'INCOMPLETE');assert.equal(mediaEntry.evidence_status,'INCOMPLETE');
  assert.equal(mediaReport.groups[0].counts.incomplete,1);
  assert.equal(mediaEntry.result,'PASSED');
  assert.match(await reports.html(mediaReport.report_id,'project-a'),/当前结果：<strong>不完整<\/strong>[\s\S]*原始执行：<b>通过<\/b>/);
});

test('media is stored once and report list never exposes embedded attachment data',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'report-latest-media-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const bytes=Buffer.from('image-byte-fixture');await fs.writeFile(path.join(dir,'image.png'),bytes);
  const image=run('a-image','A','PASSED','01',{files:[{kind:'trial_screenshot',file_id:'image-1',relative_path:'image.png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex').toUpperCase()}]});
  const reports=new ReportSnapshots({root:path.join(dir,'reports'),caseStore:{getProject:async()=>project},records:async()=>[image],
    batchManager:{list:async()=>[]},store:{runDirectory:()=>dir},buildStore:{taskDirectory:()=>dir}});
  const latest=await reports.create('project-a',{scope:'project_latest',group_key:'all',request_id:'latest-image-once'});
  assert.equal(latest.entries[0].media[0].included,true);
  assert.equal(JSON.stringify(latest).split('data:image/png;base64,').length-1,1);
  const listed=await reports.list('project-a');
  assert.equal(JSON.stringify(listed).includes('data:image/png;base64,'),false);
  assert.equal(listed[0].groups[0].entry_count,3);
});


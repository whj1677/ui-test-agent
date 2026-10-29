import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeConsoleModel, nativeScriptAvailability, nativeScriptsHtml, nativeRecordsHtml, nativeTasksHtml, loadNativeConsole } from '../web-v2/native-console-view.js';

const project={project_id:'p',cases:[{case_id:'c',current_version:2,versions:[{version:1,content_sha256:'old'},{version:2,content_sha256:'ABC'}]}]};
const record=(run_id,status,started_at,extra={})=>({project_id:'p',case_id:'c',external_id:'TC-001',case_version:2,content_sha256:'abc',task_id:'t',run_id,status,started_at,purpose:'case',counts_for_case:true,binding_status:'CURRENT',source:{available:true,script_url:'/api/case-library/projects/p/native-dsh/tasks/t/files/source'},...extra});
const script=(id,created_at,extra={})=>({...record(id,'PASSED',created_at),script_id:id,created_at,run_ids:[id],latest_run_id:id,...extra});

test('summary cards defer full evidence and scope requests without leaking options to fetch',async()=>{
  const row=record('run-deferred','FAILED','2026-10-01',{evidence_deferred:true,assertion_coverage:{total:4,actual:3,missing:1}});
  const html=nativeRecordsHtml(project,nativeConsoleModel(project,{records:[row]}));
  assert.match(html,/data-native-detail=/);assert.match(html,/run_id=run-deferred/);assert.match(html,/展开后读取本次完整步骤/);assert.doesNotMatch(html,/<video/);
  const signal=new AbortController().signal;
  await loadNativeConsole(project,async(url,options)=>{assert.match(url,/view=summary&case_id=c&case_version=2$/);assert.equal(options.signal,signal);assert.equal(options.caseId,undefined);return {project_id:'p'};},{caseId:'c',caseVersion:2,signal});
});

test('completed registration remains separate from the latest failed business run and has an unexecuted task label',()=>{
 const data={records:[record('failed','FAILED','2026-10-01')],scripts:[],drafts:[{...record('draft','NOT_RUN','2026-10-02'),task_id:'registered',draft_id:'draft-one',draft_status:'UNEXECUTED',counts_for_case:false}],tasks:[{task_id:'registered',kind:'REGISTER_EXISTING_DRAFT',status:'COMPLETED',created_at:'2026-10-02'}]};
 const model=nativeConsoleModel(project,data);
 assert.equal(model.latest[0].run_id,'failed');assert.equal(model.failed,1);assert.equal(model.passed,0);assert.equal(model.drafts.length,1);
 const html=nativeTasksHtml(project,data);
 assert.match(html,/登记完成 · 未运行/);assert.match(html,/0 最近运行通过/);assert.match(html,/1 已登记稿件/);assert.doesNotMatch(html,/原生 DSH 自测/);
});

test('project and exact version/content scope excludes other projects, revisions and unbound data',()=>{
 const rows=[record('pass','PASSED','2026-10-01'),record('other-project','PASSED','2026-10-02',{project_id:'q'}),record('old','PASSED','2026-10-02',{case_version:1,content_sha256:'old',binding_status:'HISTORICAL'}),record('wrong-content','PASSED','2026-10-02',{content_sha256:'wrong'})];
 const current=nativeConsoleModel(project,{records:rows},{currentOnly:true});
 assert.deepEqual(current.records.map(row=>row.run_id),['pass']);
 const selected=nativeConsoleModel(project,{records:rows},{caseId:'c',version:project.cases[0].versions[1]});
 assert.deepEqual(selected.records.map(row=>row.run_id),['pass']);assert.equal(selected.passed,1);
});
test('later diagnostic PASS does not replace formal FAILED and remains independently visible',()=>{
 const data={records:[record('failure','FAILED','2026-10-01'),record('diag','PASSED','2026-10-02',{purpose:'diagnostic',counts_for_case:false})]};
 const model=nativeConsoleModel(project,data);
 assert.equal(model.latest[0].run_id,'failure');assert.equal(model.passed,0);assert.equal(model.failed,1);assert.equal(model.excluded.length,1);
 const html=nativeRecordsHtml(project,model);
 assert.match(html,/诊断执行不计用例通过/);assert.match(html,/全部正式运行历史（1，含失败记录）/);assert.match(html,/data-native-run="failure"/);assert.match(html,/data-native-run="diag"/);
});
test('newest formal run missing frozen evidence blocks fallback to earlier pass even with newer diagnostic pass',()=>{
 const data={records:[record('old-pass','PASSED','2026-10-01'),record('missing','PASSED','2026-10-02',{counts_for_case:false,recorded_counts_for_case:true,source:{available:false,reason:'FROZEN_SOURCE_MISSING'}}),record('diag','PASSED','2026-10-03',{purpose:'diagnostic',counts_for_case:false})]};
 const model=nativeConsoleModel(project,data);
 assert.equal(model.latest[0].run_id,'missing');assert.equal(model.passed,0);
 assert.match(nativeRecordsHtml(project,model),/证据未核验 · 不计通过/);
});
test('script version numbers are stable across task filtering without mutating input',()=>{
 const data={scripts:[script('new','2026-10-02',{task_id:'t2',task_ids:['t2']}),script('old','2026-10-01',{task_ids:['t']})],records:[]};
 const model=nativeConsoleModel(project,data,{taskId:'t2'});
 assert.equal(model.scripts[0].display_version,'D2');assert.equal(data.scripts[0].display_version,undefined);
});
test('frozen script preview and artifact evidence are escaped and same-project URLs only',()=>{
 const row=record('run','FAILED','2026-10-01',{error:'<script>oops</script>',artifacts:[{name:'screen.png',content_type:'image/png',url:'/api/case-library/projects/p/native-dsh/tasks/t/files/image'},{name:'trace.zip',kind:'trace',url:'/api/case-library/projects/p/native-dsh/tasks/t/files/trace'},{name:'bad',url:'javascript:alert(1)'}]});
 const model=nativeConsoleModel(project,{records:[row],scripts:[script('script','2026-10-01')]});
 const html=nativeRecordsHtml(project,model,{selectedRunId:'run'});
 assert.match(html,/data-native-run="run" open/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/javascript:|style=/);assert.match(html,/data-native-media=/);assert.match(html,/trace.zip/);
 assert.match(nativeScriptsHtml(project,model),/data-native-source=/);assert.match(nativeScriptsHtml(project,model),/人工首审未登记/);
});
test('failed API reads are explicit rather than silently classified no scripts/results',async()=>{
 const data=await loadNativeConsole(project,async()=>{throw Error('NETWORK');});
 const html=nativeRecordsHtml(project,nativeConsoleModel(project,data));
 assert.match(html,/暂时读取失败/);assert.match(html,/不能据此判断为尚未生成或尚未执行/);
});
test('existing run with unreadable frozen source is a pending historical script, never not generated',()=>{
 const model=nativeConsoleModel(project,{scripts:[],records:[record('missing','FAILED','2026-10-01',{counts_for_case:false,recorded_counts_for_case:true,source:{available:false,reason:'FROZEN_SOURCE_MISSING'}})]},{caseId:'c',version:project.cases[0].versions[1]});
 const state=nativeScriptAvailability(model),html=nativeScriptsHtml(project,model);
 assert.equal(state.hasScripts,false);assert.equal(state.hasHistory,true);assert.equal(state.label,'已有历史记录 · 冻结脚本待核验');
 assert.match(html,/冻结脚本不可读取或尚待核验/);assert.doesNotMatch(html,/尚未生成|缺少脚本/);
 assert.match(nativeRecordsHtml(project,model),/data-native-run="missing"/);assert.equal(model.records[0].status,'FAILED');assert.equal(model.passed,0);
});

test('main console task summary displays startup diagnostics even without a formal run',()=>{
 const task={task_id:'t',status:'FAILED',created_at:'2026-10-15T09:00:00.000Z',items:[],diagnostics:[{
  schema:'workbench/native-dsh-task-diagnostic-v1',project_id:'p',task_id:'t',phase:'SAVE_MODEL_STAGE',update_phase:'SAVE',code:'EACCES',
  summary:'操作失败：EACCES <img src=x onerror=alert(1)>',message:'RAW_MESSAGE',stack:'RAW_STACK',
 }]};
 const data={scripts:[],records:[],tasks:[task]},before=JSON.stringify(data),html=nativeTasksHtml(project,data);
 const summary=html.match(/<summary>([\s\S]*?)<\/summary>/)?.[1];
 assert.match(summary,/data-native-diagnostic-summary/);assert.match(summary,/SAVE_MODEL_STAGE/);assert.match(summary,/EACCES/);
 assert.match(summary,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/任务故障诊断/);assert.match(html,/0 最近运行通过/);assert.match(html,/任务：<code>t<\/code> · 失败/);
 assert.doesNotMatch(html,/<img|RAW_MESSAGE|RAW_STACK|data-native-run=/);assert.equal(JSON.stringify(data),before);
 assert.doesNotMatch(nativeTasksHtml(project,{tasks:[{task_id:'legacy',status:'FAILED'}]}),/data-native-task-diagnostics/);
});

test('unexecuted blocked drafts are readable but never join runs, diagnostic totals or rerun selection',()=>{
 const draft={project_id:'p',case_id:'c',external_id:'TC-024',case_version:2,content_sha256:'ABC',task_id:'t',draft_id:'draft-one',
  draft_status:'BLOCKED_PRECONDITION',created_at:'2026-10-15',entry:'specs/TC-024.spec.mjs',source:{available:true},
  script_url:'/api/case-library/projects/p/native-dsh/tasks/t/files/draft-one-source',blocker:{code:'MISSING_AUTHORIZED_TEST_DATA',summary:'缺少园区 <script>unsafe</script>'}};
 const data={drafts:[draft,{...draft,project_id:'other'},{...draft,case_version:1,content_sha256:'old',draft_id:'old'}],tasks:[{task_id:'t',status:'BLOCKED'}]};
 const model=nativeConsoleModel(project,data,{currentOnly:true});
 assert.deepEqual(model.drafts.map(row=>row.draft_id),['draft-one']);
 for(const key of ['scripts','records','latest','cases','excluded'])assert.equal(model[key].length,0);
 assert.equal(model.passed,0);assert.equal(model.failed,0);
 const availability=nativeScriptAvailability(model),html=nativeScriptsHtml(project,model);
 assert.equal(availability.hasDrafts,true);assert.equal(availability.hasScripts,false);assert.match(availability.label,/已登记稿件 · 未执行/);
 assert.match(html,/前置阻塞 · 未执行/);assert.match(html,/DSH 报告/);assert.match(html,/data-native-source=/);
 assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>|data-native-rerun|data-native-run=|采集完整/);
 assert.equal(nativeRecordsHtml(project,model),'');assert.match(nativeTasksHtml(project,data),/已登记稿件/);
 const mixed=nativeConsoleModel(project,{drafts:[draft],scripts:[script('old-run','2026-10-01',{script_sha256:'a'.repeat(64),bundle_sha256:'b'.repeat(64)})]});
 const mixedHtml=nativeScriptsHtml(project,mixed);
 const selector=mixedHtml.match(/<select data-native-rerun-version[\s\S]*?<\/select>/)?.[0];
 assert.ok(selector);assert.doesNotMatch(selector,/draft-one|TC-024/);
 const missing=nativeScriptsHtml(project,nativeConsoleModel(project,{drafts:[{...draft,source:{available:false,reason:'SOURCE_FILE_MISSING'}}]}));
 assert.match(missing,/冻结脚本不可读取/);assert.match(missing,/稿件登记保留，未执行/);assert.doesNotMatch(missing,/尚未生成/);
});

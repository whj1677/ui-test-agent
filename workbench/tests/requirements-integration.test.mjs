import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { confirmDesignedCases, typedMetadata, assertDesignImport } from '../server/cases/design.mjs';
import { BatchManager } from '../server/batches.mjs';
import { assembleProjectCaseInput } from '../server/build/project-case.mjs';
import { requirementsRoute } from '../server/requirements-routes.mjs';
import { DeepSeek } from '../../src/deepseek.mjs';
import { createServiceShutdown } from '../server/service-shutdown.mjs';
import { RequirementsManager } from '../server/requirements/manager.mjs';

test('confirmation retry is content-exact and does not increment project revision or duplicate cases', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'requirement-sink-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store=new CaseLibraryStore(root);await store.init();
  const p=await store.createProject({name:'Synthetic acceptance'});
  const request={projectId:p.project_id,projectRevision:1,designId:'design-one',candidates:[{
    candidate_id:'candidate-one',case_type:'BACKEND',source_refs:[],
    root_source:{type:'requirements-design',stable_id:'requirements:design-one:candidate-one'},
    content:{external_id:'BE-01',title:'Reject duplicate',module:'',preconditions:'',test_data:'',steps:[{order:1,action:'Submit duplicate',expected:'Reject'}]}
  }]};
  const first=await confirmDesignedCases(store,request);
  assert.deepEqual(await confirmDesignedCases(store,request),first);
  const current=await store.getProject(p.project_id);
  assert.equal(current.revision,2);assert.equal(current.cases.length,1);
  assert.equal(current.cases[0].versions[0].content.case_type,'BACKEND');
  const changed=structuredClone(request);changed.candidates[0].content.steps[0].expected='Accept';
  await assert.rejects(confirmDesignedCases(store,changed),/CASE_DESIGN_CONFIRM_CONFLICT/);
  assert.throws(()=>typedMetadata({source_refs:[{}]}),/CASE_DESIGN_REVIEW_REQUIRED/);
  const forged=structuredClone(current.cases[0].versions[0].content);forged.steps[0].expected='Accept';
  assert.throws(()=>assertDesignImport(current,forged),/CASE_DESIGN_REVIEW_REQUIRED/);
  const revision=structuredClone(request);revision.projectRevision=2;revision.designId='design-revision';
  Object.assign(revision.candidates[0],{candidate_id:'revision-one',root_source:{type:'requirements-design',stable_id:'requirements:design-revision:revision-one'},
    target_case:{case_id:first.cases[0].case_id,case_version:1,content_sha256:current.cases[0].versions[0].content_sha256}});
  revision.candidates[0].content.steps[0].expected='Reject with newly confirmed reason';
  const updated=await confirmDesignedCases(store,revision);
  assert.equal(updated.cases[0].case_id,first.cases[0].case_id);assert.equal(updated.cases[0].version,2);
  assert.deepEqual(await confirmDesignedCases(store,revision),updated);
  const after=await store.getProject(p.project_id);assert.equal(after.revision,3);assert.equal(after.cases[0].versions[0].content.steps[0].expected,'Reject');
  const stale=structuredClone(revision);stale.candidates[0].content.steps[0].expected='Another revision';
  await assert.rejects(confirmDesignedCases(store,stale),/CASE_DESIGN_REVISION_TARGET_STALE/);
});

test('mixed batch preserves UI admission checks and blocks backend without calling UI automation lookup',async()=>{
  const cases=['UI','BACKEND'].map((type,i)=>({case_id:`case-${i}`,current_version:1,versions:[{version:1,content_sha256:`hash${i}`,content:{case_type:type,title:type,external_id:type}}]}));
  const lookedUp=[];
  const manager=new BatchManager({caseStore:{getProject:async()=>({project_id:'project-test',revision:1,cases})},buildManager:{caseAutomation:async(_p,id)=>{lookedUp.push(id);return{candidates:[]};}}});
  const b=await manager.preview({project_id:'project-test',scope:'project'},{persist:false});
  assert.deepEqual(lookedUp,['case-0']);
  assert.equal(b.items[0].reason,'SCRIPT_MISSING');assert.equal(b.items[1].reason,'BACKEND_EXECUTOR_NOT_CONFIGURED');
  assert.throws(()=>assembleProjectCaseInput({versionRecord:cases[1].versions[0]}),/BACKEND_EXECUTOR_NOT_CONFIGURED/);
});

test('requirements routes preserve list envelope and enforce mutation origin',async()=>{
  let result,calls=0;
  const common={response:{},manager:{listSources:async()=>({sources:[{snapshot_id:'source-a'}]}),diagnostics:()=>({model_available:true}),reviewDesignIssue:async(_p,_d,b)=>{calls++;return b;},createCaseRevision:async(_p,b)=>({design_id:'design-case',idempotent:false,reason:b.reason})},
    sendJson:(_r,status,value)=>{result={status,value};},readJsonBody:async()=>({issueId:'issue-a'}),trustedMutation:()=>true,trustedLocalOrigin:()=>true};
  await requirementsRoute({...common,request:{method:'GET'},url:new URL('http://localhost/api/case-library/projects/project-test/requirements/sources')});
  assert.ok(Array.isArray(result.value.sources));assert.equal(result.value.sources[0].snapshot_id,'source-a');
  const mutation={...common,request:{method:'POST'},url:new URL('http://localhost/api/case-library/projects/project-test/requirements/designs/design-a/issue-review')};
  await requirementsRoute({...mutation,trustedMutation:()=>false});assert.equal(result.status,403);assert.equal(calls,0);
  await requirementsRoute(mutation);assert.equal(calls,1);assert.equal(result.value.issueId,'issue-a');
  await requirementsRoute({...common,request:{method:'POST'},url:new URL('http://localhost/api/case-library/projects/project-test/requirements/case-revisions'),
    readJsonBody:async()=>({reason:'Correct source-backed case'})});
  assert.equal(result.status,201);assert.equal(result.value.design_id,'design-case');
});

test('one-request requirements budget prevents transport retry for rate limit and server failure',async()=>{
  for(const status of [429,502,503]){
    let calls=0;
    const client=new DeepSeek({key:'test-only',fetchImpl:async()=>{calls++;return new Response('{}',{status});}});
    await assert.rejects(client.json('test',{},{maxAttempts:1}),/DEEPSEEK_/);
    assert.equal(calls,1);
  }
});

test('service shutdown cancels requirement job before closing its model transport',async()=>{
  const order=[],state={accepting:true};
  const shutdown=createServiceShutdown({state,server:{close:cb=>cb()},requirementsManager:{shutdown:async()=>order.push('cancel')},requirementsModel:{close:async()=>order.push('transport')}});
  const result=await shutdown();assert.equal(result.closed,true);assert.equal(state.accepting,false);assert.deepEqual(order,['cancel','transport']);
});

test('real case store and requirements manager join split confirmation to conflict revision without losing the original version',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'requirement-joined-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store=new CaseLibraryStore(path.join(root,'cases'));await store.init();const project=await store.createProject({name:'joined synthetic'});
  let requests=0;
  const manager=new RequirementsManager({root:path.join(root,'requirements'),projectStore:store,confirmCases:p=>confirmDesignedCases(store,p),modelClient:{generate:async({input})=>{
    requests++;const ref=input.source_segments[0];const candidate=type=>({content:{external_id:type,title:'duplicate',steps:[{order:1,action:'Submit duplicate',expected:'Reject',source_refs:[ref]}]}});
    return{candidates:{UI:[candidate('UI')],BACKEND:[candidate('BE')]},issues:[]};
  }}});
  await manager.init();t.after(()=>manager.shutdown());
  const source=await manager.upload(project.project_id,{kind:'PRD',fileName:'prd.md',body:Buffer.from('Submit duplicate: Reject')});
  let design=await manager.createDesign(project.project_id,{sourceIds:[source.snapshot_id],scope:{mode:'SELECTED',description:'重复编号的前后端用例与同源修订'},allowModelText:true});
  await manager.startGeneration(project.project_id,design.design_id,{revision:design.revision,allowModelText:true});
  for(let i=0;i<100&&manager.active;i++)await new Promise(r=>setTimeout(r,5));
  for(const type of ['UI','BACKEND']){
    design=await manager.getDesign(project.project_id,design.design_id);
    await manager.confirmCandidates(project.project_id,design.design_id,{revision:design.revision,projectRevision:design.projectRevision,candidateIds:[design.candidates[type][0].candidate_id]});
  }
  const before=await store.getProject(project.project_id);assert.equal(before.cases.length,2);
  const item=before.cases.find(c=>c.versions[0].content.case_type==='BACKEND');
  const protocol=await manager.upload(project.project_id,{kind:'PROTOCOL',fileName:'protocol.md',body:Buffer.from('Reject duplicate with reason DUPLICATE')});
  const binding=await manager.createBinding(project.project_id,{caseId:item.case_id,caseVersion:1,caseContentSha256:item.versions[0].content_sha256,protocolSourceId:protocol.snapshot_id,conflictNote:'Reason must now be checked'});
  let revision=await manager.createBindingRevision(project.project_id,{caseId:item.case_id,bindingVersion:binding.version});
  let candidate=revision.candidates.BACKEND[0];const content=structuredClone(candidate.content);content.steps[0].expected='Reject with reason DUPLICATE';
  revision=await manager.editCandidate(project.project_id,revision.design_id,candidate.candidate_id,{revision:revision.revision,content,decisions:[{issue_id:candidate.issues.find(i=>i.code==='BUSINESS_CONFLICT').issue_id,reviewer:'Synthetic reviewer',text:'Synthetic acceptance confirms DUPLICATE reason',step_order:1}]});
  revision=await manager.getDesign(project.project_id,revision.design_id);
  const receipt=await manager.confirmCandidates(project.project_id,revision.design_id,{revision:revision.revision,projectRevision:revision.projectRevision,candidateIds:[candidate.candidate_id]});
  assert.equal(receipt.cases[0].case_id,item.case_id);assert.equal(receipt.cases[0].version,2);assert.equal(requests,1);
  const after=await store.getProject(project.project_id);assert.equal(after.cases.length,2);
  const revised=after.cases.find(c=>c.case_id===item.case_id);assert.equal(revised.versions[0].content_sha256,item.versions[0].content_sha256);
  assert.ok(revised.versions[1].content.requirements_review.human_decisions.length);assert.equal((await manager.getBindings(project.project_id,item.case_id)).bindings[0].applicability,'STALE_CASE_VERSION');
});

test('case design correction requires current sourced content and decisions before appending one version', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirement-case-correction-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(path.join(root, 'cases')); await store.init();
  const project = await store.createProject({ name: 'Synthetic correction' });
  let modelCalls = 0;
  const manager = new RequirementsManager({ root: path.join(root, 'requirements'), projectStore: store,
    confirmCases: value => confirmDesignedCases(store, value), modelClient: { async generate({ input }) {
      modelCalls += 1;
      const ref = input.source_segments[0];
      return { candidates: { UI: [], BACKEND: [{ content: { external_id: 'BE-R8', title: 'Original',
        preconditions: 'Eight items', test_data: 'BK-001', steps: [{ order: 1, action: 'Search BK-001 then visit page 2',
          expected: 'Page 2 appears', source_refs: [ref] }] } }] }, issues: [] };
    } } });
  await manager.init(); t.after(() => manager.shutdown());
  const source = await manager.upload(project.project_id, { kind: 'PRD', fileName: 'prd.md',
    body: Buffer.from('Eight items, five per page. Searching BK-001 leaves one item; only page 1 exists.') });
  let design = await manager.createDesign(project.project_id, { sourceIds: [source.snapshot_id],
    scope: { mode: 'SELECTED', description: '编号查询后的分页与同源修订' }, allowModelText: true });
  await manager.startGeneration(project.project_id, design.design_id, { revision: design.revision, allowModelText: true });
  for (let i = 0; i < 100 && manager.active; i++) await new Promise(resolve => setTimeout(resolve, 5));
  design = await manager.getDesign(project.project_id, design.design_id);
  const original = design.candidates.BACKEND[0];
  const first = await manager.confirmCandidates(project.project_id, design.design_id, {
    revision: design.revision, projectRevision: design.projectRevision, candidateIds: [original.candidate_id] });
  const current = await store.getProject(project.project_id);
  const item = current.cases.find(entry => entry.case_id === first.cases[0].case_id);
  const body = { caseId: item.case_id, caseVersion: 1, contentSha256: item.versions[0].content_sha256,
    projectRevision: current.revision, reason: 'Correct unreachable second page', requestId: 'correction-r8-001' };
  await assert.rejects(manager.createCaseRevision(project.project_id, { ...body, projectRevision: 1 }),
    /REQUIREMENT_PROJECT_REVISION_CONFLICT/);
  let correction = await manager.createCaseRevision(project.project_id, body);
  assert.equal(correction.idempotent, false);
  assert.equal(correction.revision_basis.mode, 'CASE_DESIGN_CORRECTION');
  assert.equal(correction.model_requests.length, 0);
  assert.equal(correction.candidates.BACKEND.length, 1);
  assert.equal((await manager.createCaseRevision(project.project_id, body)).design_id, correction.design_id);
  await assert.rejects(manager.createCaseRevision(project.project_id, { ...body, reason: 'Other reason' }),
    /CASE_DESIGN_REVISION_REQUEST_CONFLICT/);
  const candidate = correction.candidates.BACKEND[0];
  await assert.rejects(manager.confirmCandidates(project.project_id, correction.design_id, {
    revision: correction.revision, projectRevision: current.revision, candidateIds: [candidate.candidate_id] }),
  /CASE_DESIGN_REVISION_CONTENT_UNCHANGED/);
  const edited = structuredClone(candidate.content);
  edited.title = 'Reachable pagination after filter';
  edited.steps[0].action = 'Search BK-001 and check only page 1 is reachable';
  edited.steps[0].expected = 'One result and no page 2';
  edited.steps.push({ order: 2, action: 'Clear search and visit page 2', expected: 'Three remaining items',
    source_refs: structuredClone(edited.steps[0].source_refs) });
  const unknown = structuredClone(edited);
  unknown.steps[1].source_refs = [];
  correction = await manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id,
    { revision: correction.revision, content: unknown });
  await assert.rejects(manager.confirmCandidates(project.project_id, correction.design_id, {
    revision: correction.revision, projectRevision: current.revision, candidateIds: [candidate.candidate_id] }),
  /REQUIREMENT_CONFIRM_BLOCKED/);
  const forged = structuredClone(edited);
  forged.steps[1].source_refs[0].quote_sha256 = 'forged';
  await assert.rejects(manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id,
    { revision: correction.revision, content: forged }), /CASE_DESIGN_REVISION_SOURCE_INVALID/);
  correction = await manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id,
    { revision: correction.revision, content: edited });
  await assert.rejects(manager.confirmCandidates(project.project_id, correction.design_id, {
    revision: correction.revision, projectRevision: current.revision, candidateIds: [candidate.candidate_id] }),
  /REQUIREMENT_CONFIRM_BLOCKED/);
  const changed = correction.candidates.BACKEND[0].issues.filter(issue => issue.code === 'QUALITY_CONTENT_CHANGED' && !issue.resolved_at);
  assert.deepEqual(changed.map(issue => issue.step_order), [1, 2]);
  correction = await manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id, {
    revision: correction.revision, decisions: changed.map(issue => ({ issue_id: issue.issue_id,
      reviewer: 'Synthetic reviewer', text: `PRD source checked for step ${issue.step_order}`, step_order: issue.step_order })) });
  const globalEdit = structuredClone(correction.candidates.BACKEND[0].content);
  globalEdit.title = 'Reachable pagination and visible totals';
  correction = await manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id,
    { revision: correction.revision, content: globalEdit });
  await assert.rejects(manager.confirmCandidates(project.project_id, correction.design_id, {
    revision: correction.revision, projectRevision: current.revision, candidateIds: [candidate.candidate_id] }),
  /REQUIREMENT_CONFIRM_BLOCKED/);
  const globalIssues = correction.candidates.BACKEND[0].issues.filter(issue => issue.code === 'QUALITY_CONTENT_CHANGED' && !issue.resolved_at);
  assert.deepEqual(globalIssues.map(issue => issue.step_order), [1, 2]);
  correction = await manager.editCandidate(project.project_id, correction.design_id, candidate.candidate_id, {
    revision: correction.revision, decisions: globalIssues.map(issue => ({ issue_id: issue.issue_id,
      reviewer: 'Synthetic reviewer', text: `Updated title checked for step ${issue.step_order}`, step_order: issue.step_order })) });
  const receipt = await manager.confirmCandidates(project.project_id, correction.design_id, {
    revision: correction.revision, projectRevision: current.revision, candidateIds: [candidate.candidate_id] });
  assert.equal(receipt.cases[0].case_id, item.case_id);
  assert.equal(receipt.cases[0].version, 2);
  const after = await store.getProject(project.project_id);
  assert.equal(after.cases.length, 1);
  assert.equal(after.cases[0].versions[0].content_sha256, item.versions[0].content_sha256);
  assert.equal(after.cases[0].versions[1].content.steps.length, 2);
  assert.equal(modelCalls, 1);
  const next = await manager.createCaseRevision(project.project_id, {
    caseId: item.case_id, caseVersion: 2, contentSha256: after.cases[0].versions[1].content_sha256,
    projectRevision: after.revision, reason: 'Review the newly confirmed version again', requestId: 'correction-r8-v2' });
  assert.equal(next.revision_basis.case_version, 2);
  assert.equal(next.candidates.BACKEND[0].target_case.case_version, 2);
  assert.equal(next.candidates.BACKEND[0].content.steps.length, 2);
  assert.equal(next.idempotent, false);
  const deleteOne = structuredClone(next.candidates.BACKEND[0].content);
  deleteOne.steps.pop();
  const deletionDraft = await manager.editCandidate(project.project_id, next.design_id,
    next.candidates.BACKEND[0].candidate_id, { revision: next.revision, content: deleteOne });
  assert.ok(deletionDraft.candidates.BACKEND[0].issues.some(issue => issue.code === 'QUALITY_CONTENT_CHANGED' &&
    issue.step_order === 1 && !issue.resolved_at));
  await assert.rejects(manager.confirmCandidates(project.project_id, next.design_id, {
    revision: deletionDraft.revision, projectRevision: after.revision,
    candidateIds: [next.candidates.BACKEND[0].candidate_id] }), /REQUIREMENT_CONFIRM_BLOCKED/);
  await assert.rejects(manager.createCaseRevision(project.project_id, { ...body, projectRevision: after.revision,
    requestId: 'correction-r8-stale' }), /CASE_DESIGN_REVISION_TARGET_STALE/);
});

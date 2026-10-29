import { USER_GENERATION_LIMITS, checkDevelopmentEnvironment } from './build/user-workflow.mjs';
import { digest } from './build/development-session.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { developmentAuthorizations, registerDevelopmentAuthorization } from './build/development-authorization.mjs';
import { loadCandidateBundle } from './build/candidate-trials.mjs';
import { writeAtomicJson } from './atomic-json.mjs';
import { freezeSkill, normalizeSkillProfile, skillIdentity, verifyFrozenSkill } from './skills/loader.mjs';
import { buildFailureFeedback } from './failure-feedback.mjs';
import { resolveDemonstrationEnvironment } from './demonstration-environment.mjs';
import { freezeTechnicalContext, generationContextOptions, technicalContextHash } from './build/development-technical-context.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const failedTaskStates = new Set(['CANDIDATE_VALIDATION_FAILED','ENVIRONMENT_BLOCKED','FAILED','CANCELLED','INTERRUPTED']);
export function generationFailureReason(task) {
  const review = task?.development?.submission?.quality_review || task?.development?.quality_reviews?.at(-1)?.review;
  if ((!task?.error?.code || ['CANDIDATE_NEEDS_ANALYSIS','CANDIDATE_BUDGET_EXHAUSTED'].includes(task.error.code)) && review?.error_code)
    return review.model_diagnostic?.error_code || review.error_code;
  return task?.error?.code || review?.model_diagnostic?.error_code || review?.error_code || task?.failure?.reason || null;
}
export function providerUnavailable(reason) {
  return ['HARNESS_MODEL_TRANSPORT_FAILED','HARNESS_MODEL_TIMEOUT_FAILED','HARNESS_MODEL_RATE_LIMIT_FAILED',
    'HARNESS_MODEL_AUTH_FAILED','HARNESS_MODEL_AUTHENTICATION_FAILED','HARNESS_MODEL_PERMISSION_FAILED','HARNESS_MODEL_SERVER_FAILED','HARNESS_MODEL_SERVER_ERROR_FAILED',
    'DEEPSEEK_CONNECTION_FAILED','DEEPSEEK_TRANSPORT_ERROR'].includes(reason);
}
export function failedGenerationCandidate(candidate, tasks = []) {
  if (['APPROVED','WAITING_REVIEW','REJECTED'].includes(candidate.human_review_status) || candidate.technical_status === 'TECHNICAL_VALIDATION_PASSED') return false;
  const task = tasks.find(t => t.task_id === candidate.selection?.source_task_id);
  return candidate.human_review_status === 'NOT_READY' && candidate.technical_status === 'INCOMPLETE'
    || Boolean(task && failedTaskStates.has(task.task_status));
}
export function uiRevisionEvidence(record, { projectId, input, environmentId, sourceEnvironmentId, caseContent, contentSha256 }) {
  if (!record || record.run_id !== input.run_id || record.project_id !== projectId ||
      record.executed_case_id !== input.case_id || record.executed_case_version !== input.case_version ||
      record.source_build_task_id !== input.source_task_id || record.candidate_version !== input.candidate_version ||
      record.bundle_sha256 !== input.bundle_sha256 ||
      record.executed_content_sha256 && record.executed_content_sha256 !== contentSha256)
    throw Error('REVISION_RUN_IDENTITY_MISMATCH');
  if (!record.finished_at || [record.execution_status,record.status].some(status => ['QUEUED','RUNNING','STARTING','STOPPING','EXECUTING'].includes(status)))
    throw Error('REVISION_RUN_NOT_FINISHED');
  const actualEnvironment = record.environment_id || record.selection?.environment_id || sourceEnvironmentId;
  if (actualEnvironment !== environmentId || sourceEnvironmentId !== environmentId) throw Error('REVISION_RUN_ENVIRONMENT_MISMATCH');
  const failure_feedback = buildFailureFeedback({ record, caseContent });
  const snapshot = { run_id: record.run_id, source_task_id: input.source_task_id, candidate_version: input.candidate_version,
    bundle_sha256: input.bundle_sha256, content_sha256: contentSha256, environment_id: actualEnvironment,
    finished_at: record.finished_at, failure_feedback };
  return { ...snapshot, evidence_sha256: hash(snapshot) };
}
const reviewMode = value => {
  const mode = value ?? 'static-v1';
  if (!['self-test-v1', 'static-v1', 'dsh-tools-v1'].includes(mode)) throw Error('QUALITY_REVIEW_MODE_INVALID');
  return mode;
};
export class ScriptOperations {
  constructor({root, buildManager, caseStore, records, demonstrations = null, atomicJson = writeAtomicJson}) { Object.assign(this,{root,buildManager,caseStore,records,demonstrations,atomicJson});this.queue=Promise.resolve();this.writeQueue=Promise.resolve();this.active=null;this.starting=false; }
  serial(fn) { const p=this.queue.then(fn,fn);this.queue=p.catch(()=>{});return p; }
  file(id) { if(!/^generation-[a-f0-9-]{36}$/.test(id))throw Error('GENERATION_ID_INVALID');return path.join(this.root,id+'.json'); }
  save(value) { const write=async()=>{await this.atomicJson(this.file(value.operation_id),value);return value;};const next=this.writeQueue.then(write,write).catch(error=>{this.buildManager.reportStorageFault(error,'generation_save');throw error;});this.writeQueue=next.catch(()=>{});return next; }
  async get(id,project) { const v=JSON.parse(await fs.readFile(this.file(id),'utf8'));if(v.project_id!==project)throw Error('GENERATION_PROJECT_MISMATCH');return v; }
  async list(project) { await fs.mkdir(this.root,{recursive:true});const rows=await Promise.all((await fs.readdir(this.root)).filter(f=>/^generation-[a-f0-9-]{36}\.json$/.test(f)).map(async f=>JSON.parse(await fs.readFile(path.join(this.root,f),'utf8'))));return rows.filter(v=>!project||v.project_id===project).sort((a,b)=>b.created_at.localeCompare(a.created_at)); }
  async init() { for(const v of await this.list()) if(['QUEUED','RUNNING'].includes(v.state)) { v.state='INTERRUPTED';for(const i of v.items)if(['QUEUED','RUNNING'].includes(i.state)){i.state='NOT_RUN';i.reason='SERVICE_INTERRUPTED_NO_REPLAY';}await this.save(v); } }
  async preflight(projectId, request) {
    generationContextOptions(request);
    if(!['generate','revise','regenerate'].includes(request.mode)||!Array.isArray(request.items)||!request.items.length||request.items.length>200||new Set(request.items.map(i=>i.case_id)).size!==request.items.length)throw Error('GENERATION_REQUEST_INVALID');
    if(request.demonstration!==undefined)throw Error('GENERATION_DEMONSTRATION_SNAPSHOT_FORBIDDEN');
    await this.buildManager.projectEnvironments?.assert(projectId, 'ui', request.environment_id);
    const qualityReviewMode=reviewMode(request.quality_review_mode);
    const skill=await freezeSkill(normalizeSkillProfile(request.skill_profile),'ui');
    const project=await this.caseStore.getProject(projectId);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const m=this.buildManager, grants=await developmentAuthorizations(m.store), rows=[];
    const allTasks = typeof m.store.listTasks === 'function' ? await m.store.listTasks() : [];
    const previousTasks = allTasks.filter(t => t.source?.project_id === projectId);
    const environment=m.developmentEnvironments.find(e=>e.id===request.environment_id);
    let environmentError=null;
    if(environment?.user_registered_target&&environment.project_id!==projectId)environmentError='PROJECT_TARGET_PROJECT_MISMATCH';
    if(m.userInitiatedOperations || environment?.auth_requirement)try{await checkDevelopmentEnvironment(m,environment,projectId);}catch(e){environmentError=e.message;}
    for(const input of request.items){
      if (input.demonstration !== undefined) throw Error('GENERATION_DEMONSTRATION_SNAPSHOT_FORBIDDEN');
      const item=project.cases.find(c=>c.case_id===input.case_id),version=item?.versions.find(v=>v.version===input.case_version);
      if(!version)throw Error('GENERATION_CASE_VERSION_INVALID');
      let demonstration=null;
      if(input.demonstration_id!==undefined){
        if(typeof input.demonstration_id!=='string'||!input.demonstration_id||!this.demonstrations)throw Error('GENERATION_DEMONSTRATION_UNAVAILABLE');
        const snapshot=structuredClone(await this.demonstrations.resolve(projectId,input.demonstration_id,{case_id:input.case_id,case_version:input.case_version,content_sha256:version.content_sha256,environment_id:request.environment_id}));
        const demonstrationHash=environment?.auth_requirement
          ? (await resolveDemonstrationEnvironment(m,projectId,request.environment_id)).configuration_sha256
          : environment?.configuration_sha256;
        if(snapshot.status!=='CONFIRMED'||snapshot.project_id!==projectId||snapshot.case_id!==input.case_id||snapshot.case_version!==input.case_version||snapshot.content_sha256!==version.content_sha256||snapshot.environment_id!==request.environment_id||snapshot.environment_configuration_sha256!==demonstrationHash||!snapshot.recording_sha256||!snapshot.confirmed_sha256)throw Error('GENERATION_DEMONSTRATION_MISMATCH');
        demonstration={demonstration_id:input.demonstration_id,confirmed_sha256:snapshot.confirmed_sha256,snapshot_sha256:hash(snapshot),snapshot};
      }
      if(version.content.case_type==='BACKEND'){
        rows.push({case_id:item.case_id,external_id:version.content.external_id,title:version.content.title,case_version:version.version,
          content_sha256:version.content_sha256,old_scripts:[],state:'BLOCKED',reason:'BACKEND_EXECUTOR_NOT_CONFIGURED',input:structuredClone(input)});
        continue;
      }
      const technicalContext = await freezeTechnicalContext(m, projectId, version.content.module, request);
      const candidates=(await m.caseAutomation(projectId,input.case_id,input.case_version,{allTasks})).candidates.filter(c=>c.applies_to_selected_version);
      const usableCandidates=candidates.filter(c=>!failedGenerationCandidate(c,previousTasks));
      const failedScripts=previousTasks.filter(t=>t.source?.case_id===input.case_id&&t.source?.case_version===input.case_version&&failedTaskStates.has(t.task_status))
        .map(t=>({task_id:t.task_id,reason:generationFailureReason(t),candidate_version:t.candidates?.at(-1)?.version||null}));
      const source=candidates.find(c=>c.selection.source_task_id===input.source_task_id&&c.selection.candidate_version===input.candidate_version&&c.selection.bundle_sha256===input.bundle_sha256);
      if(request.mode!=='revise' && (input.source_task_id||input.feedback||input.run_id))throw Error('GENERATION_FRESH_INPUT_MUST_NOT_INCLUDE_OLD_SCRIPT');
      let reason=version.content.status!=='CONFIRMED'?'CASE_CONTENT_NOT_CONFIRMED':request.mode==='generate'&&usableCandidates.length?'SCRIPT_ALREADY_EXISTS':null;
      if(request.mode==='revise'&&(!source||typeof input.feedback!=='string'||!input.feedback.trim()||input.feedback.length>6000))reason='REVISION_SCRIPT_AND_FEEDBACK_REQUIRED';
      let revisionEvidence = null;
      if(request.mode==='revise'&&input.run_id){
        const r=(await this.records(projectId)).find(r=>r.run_id===input.run_id);
        revisionEvidence=uiRevisionEvidence(r,{projectId,input,environmentId:request.environment_id,sourceEnvironmentId:source?.selection.environment_id,caseContent:version.content,contentSha256:version.content_sha256});
      }
      const eligible=grants.filter(g=>!g.task_id&&g.project_id===projectId&&g.case_id===input.case_id&&g.case_version===input.case_version&&g.content_sha256===version.content_sha256&&g.environment_id===request.environment_id&&
        (g.technical_context_sha256 || null) === technicalContextHash(technicalContext) &&
        (g.quality_review_mode ?? 'static-v1')===qualityReviewMode&&
        (!g.request_id||g.request_id===request.request_id)&&
        (g.operation_mode?g.operation_mode===request.mode:request.mode==='revise'?g.mode==='recovery':g.mode==='new'));
      const grant=eligible.length===1?eligible[0]:null;
      const userRequest=m.userInitiatedOperations===true&&!m.generationDisabled&&Boolean(m.modelConfiguration)&&Boolean(environment);
      if(environmentError)reason ||= environmentError;
      if(eligible.length>1)reason ||= 'GENERATION_AUTHORIZATION_AMBIGUOUS';
      if(!grant&&!userRequest)reason ||= 'GENERATION_NOT_AUTHORIZED';
      if(!m.developmentEnvironments.some(e=>e.id===request.environment_id))reason ||= 'GENERATION_ENVIRONMENT_NOT_READY';
      if(m.generationDisabled)reason ||= 'MODEL_GENERATION_DISABLED_IN_TRIAL_PROFILE';
      if(qualityReviewMode === 'dsh-tools-v1' && typeof m.toolQualityReviewer !== 'function') reason ||= 'QUALITY_REVIEWER_UNAVAILABLE';
      rows.push({case_id:item.case_id,external_id:version.content.external_id,title:version.content.title,case_version:version.version,content_sha256:version.content_sha256,
        old_scripts:candidates.map(c=>c.selection),failed_script_records:failedScripts,logical_id:grant?.logical_id||null,requires_model_confirmation:!grant&&userRequest,limits:grant?.limits||(userRequest?USER_GENERATION_LIMITS:null),state:reason?'BLOCKED':'QUEUED',reason,input:structuredClone(input),revision_evidence:revisionEvidence,
        ...(demonstration?{demonstration}:{}),technical_context:technicalContext});
    }
    return {mode:request.mode,environment_id:request.environment_id,quality_review_mode:qualityReviewMode,skill_profile:skill.profile,skill:skillIdentity(skill),items:rows,model_calls_required:true,
      ...(request.frontend_handoff_id !== undefined ? {frontend_handoff_id:request.frontend_handoff_id} : {}),
      ...(request.generation_experiment ? {generation_experiment:generationContextOptions(request).experiment} : {})};
  }
  async start(projectId, request) { return this.serial(async()=>{
    const m=this.buildManager;
    // Reserve the preparation window before reading or writing authorization.
    const preparing=!this.active;
    if(preparing){m.assertStorageWritable();if(this.starting||m.batchStarting||m.batchOwner||m.active||m.starting||m.otherActive())throw Error('BUILD_TASK_ALREADY_ACTIVE');this.starting=true;m.generationStarting=true;}
    try {
    if(!/^[-\w]{8,100}$/.test(request.request_id||''))throw Error('GENERATION_REQUEST_ID_REQUIRED');
    request={...request,quality_review_mode:reviewMode(request.quality_review_mode)};
    const requestFingerprint=hash(request),prior=(await this.list(projectId)).find(v=>v.request_id===request.request_id);
    if(prior){
      if((prior.request_fingerprint||prior.fingerprint)!==requestFingerprint)throw Error('GENERATION_REQUEST_CONFLICT');
      for(const item of prior.items.filter(i=>i.demonstration)){
        if(!this.demonstrations)throw Error('GENERATION_DEMONSTRATION_UNAVAILABLE');
        const snapshot=await this.demonstrations.resolve(projectId,item.demonstration.demonstration_id,{case_id:item.case_id,case_version:item.case_version,content_sha256:item.content_sha256,environment_id:prior.environment_id});
        if(hash(snapshot)!==item.demonstration.snapshot_sha256||!isDeepStrictEqual(snapshot,item.demonstration.snapshot))throw Error('GENERATION_DEMONSTRATION_CHANGED');
      }
      return prior;
    }
    const frozenSkill=await freezeSkill(normalizeSkillProfile(request.skill_profile),'ui');
    let plan=await this.preflight(projectId,request);
    if(plan.skill.sha256!==frozenSkill.sha256)throw Error('SKILL_SOURCE_CHANGED');
    if(plan.items.some(i=>i.reason))throw Error('GENERATION_BLOCKED:'+plan.items.filter(i=>i.reason).map(i=>i.external_id+':'+i.reason).join(';'));
    if(this.active||m.generationOwner||m.batchOwner||m.batchStarting||m.active||m.starting||m.otherActive())throw Error('BUILD_TASK_ALREADY_ACTIVE');
    m.assertStorageWritable();
    if(plan.items.some(i=>i.requires_model_confirmation)){
      if(request.confirm_model_use!==true)throw Error('GENERATION_MODEL_CONFIRMATION_REQUIRED');
      const currentSkill=await freezeSkill(frozenSkill.profile,'ui');
      if(currentSkill.sha256!==frozenSkill.sha256||currentSkill.text!==frozenSkill.text)throw Error('SKILL_SOURCE_CHANGED');
      // A receipt belongs to this explicit operation, never a reusable blanket
      // permission or a reset of an earlier consumed authorization.
      for(const item of plan.items.filter(i=>i.requires_model_confirmation)){
        m.assertStorageWritable();
        let seed={};
        if(request.mode==='revise'){
          const t=await m.store.getTask(item.input.source_task_id),c=t.candidates.find(c=>c.version===item.input.candidate_version);
          const b=await loadCandidateBundle(path.join(m.store.taskDirectory(t.task_id),'development/final'),c.bundle);
          const code=b.entries.find(f=>f.path==='candidate.spec.mjs').content.toString('utf8');
          seed={seed_code:code,seed_sha256:digest(code)};
        }
        const logical_id='user-'+hash([projectId,request.request_id,item.case_id,item.case_version]).slice(0,48);
        const old=(await developmentAuthorizations(m.store)).find(g=>g.logical_id===logical_id);
        if(old)throw Error('GENERATION_REQUEST_ALREADY_RESERVED');
        await registerDevelopmentAuthorization(m.store,{logical_id,request_id:request.request_id,project_id:projectId,
          case_id:item.case_id,case_version:item.case_version,content_sha256:item.content_sha256,environment_id:request.environment_id,
          mode:request.mode==='revise'?'recovery':'new',operation_mode:request.mode,limits:USER_GENERATION_LIMITS,
          quality_review_mode:request.quality_review_mode,
          ...(item.technical_context ? {technical_context_sha256:technicalContextHash(item.technical_context)} : {}),
          authorization_source:'EXPLICIT_USER_GENERATION_CONFIRMATION',...seed});
      }
      const before=plan;
      plan=await this.preflight(projectId,request);
      if(!isDeepStrictEqual(plan.items.map(i=>i.technical_context||null),before.items.map(i=>i.technical_context||null)))throw Error('GENERATION_CONTEXT_CHANGED');
      if(!isDeepStrictEqual(plan.items.map(i=>i.demonstration||null),before.items.map(i=>i.demonstration||null)))throw Error('GENERATION_DEMONSTRATION_CHANGED');
      if(plan.items.some(i=>i.reason||!i.logical_id))throw Error('GENERATION_AUTHORIZATION_NOT_READY');
    }
    m.assertStorageWritable();
    if(plan.skill.sha256!==frozenSkill.sha256)throw Error('SKILL_SOURCE_CHANGED');
    const demonstrationDigest=plan.items.map(i=>i.demonstration?.snapshot_sha256||null);
    const fingerprint=demonstrationDigest.some(Boolean)?hash({request,demonstrationDigest}):requestFingerprint;
    const operation=await this.save({...plan,skill_snapshot:frozenSkill,operation_id:'generation-'+randomUUID(),project_id:projectId,request_id:request.request_id,fingerprint,
      ...(fingerprint!==requestFingerprint?{request_fingerprint:requestFingerprint}:{}),state:'QUEUED',created_at:new Date().toISOString(),service_identity:m.store.serviceIdentity||null});
    m.assertStorageWritable();
    this.active={operation,cancelled:false};m.generationOwner=operation.operation_id;
    this.completion=this.execute(operation).finally(()=>{m.generationOwner=null;this.active=null;});
    void this.completion.catch(error=>m.reportStorageFault(error,'generation_background_completion'));
    return operation;
    } finally {if(preparing){this.starting=false;m.generationStarting=false;}}
  }); }
  async execute(v) {
    const m=this.buildManager;
    try {v.state='RUNNING';await this.save(v);
      for(const item of v.items){
        m.assertStorageWritable();
        if(this.active.cancelled){item.state='NOT_RUN';item.reason='GENERATION_CANCELLED';continue;}
        try{
          const frozenSkill=verifyFrozenSkill(v.skill_snapshot,'ui');
          const checked=await this.preflight(v.project_id,{mode:v.mode,environment_id:v.environment_id,request_id:v.request_id,quality_review_mode:v.quality_review_mode,skill_profile:frozenSkill.profile,items:[item.input],
            frontend_handoff_id:item.technical_context?.frontend_handoff?.handoff_id || null,
            ...(v.generation_experiment ? {generation_experiment:v.generation_experiment} : {})});
          if(checked.skill.sha256!==frozenSkill.sha256)throw Error('SKILL_SOURCE_CHANGED');
          if(checked.items[0].reason)throw Error(checked.items[0].reason);
          if(!isDeepStrictEqual(checked.items[0].demonstration||null,item.demonstration||null))throw Error('GENERATION_DEMONSTRATION_CHANGED');
          if(!isDeepStrictEqual(checked.items[0].technical_context||null,item.technical_context||null))throw Error('GENERATION_CONTEXT_CHANGED');
          const maintenance={mode:v.mode,operation_id:v.operation_id,feedback:v.mode==='revise'?item.input.feedback:null,run_id:v.mode==='revise'?item.input.run_id||null:null};
          if(checked.items[0].revision_evidence) maintenance.revision_evidence=structuredClone(checked.items[0].revision_evidence);
          let seedBundle;
          if(v.mode==='revise'){
            const task=await m.store.getTask(item.input.source_task_id),candidate=task.candidates.find(c=>c.version===item.input.candidate_version);
            seedBundle=await loadCandidateBundle(path.join(m.store.taskDirectory(task.task_id),'development/final'),candidate.bundle);
            maintenance.source_selection={...item.input};delete maintenance.source_selection.feedback;
          }
          const task=await m.submitDevelopment({logical_id:item.logical_id,maintenance,seedBundle,skill_profile:frozenSkill.profile,skillSnapshot:frozenSkill,
            ...(item.technical_context?{technicalContext:structuredClone(item.technical_context)}:{}),
            ...(item.demonstration?{demonstration:structuredClone(item.demonstration)}:{})});
          item.task_id=task.task_id;item.state='RUNNING';await this.save(v);
          if(this.active.cancelled)await m.stop(task.task_id);
          await m.completions.get(task.task_id);const done=await m.store.getTask(task.task_id);item.state=done.task_status;item.reason=generationFailureReason(done);
        }catch(e){if(m.storageFault)throw e;item.state='BLOCKED';item.reason=e.message;}
        await this.save(v);
        if (providerUnavailable(item.reason)) {
          for (const pending of v.items.filter(i=>i.state==='QUEUED')) {pending.state='NOT_RUN';pending.reason='MODEL_PROVIDER_UNAVAILABLE';}
          v.error='MODEL_PROVIDER_UNAVAILABLE';v.failed_task_id=item.task_id||null;break;
        }
      }v.state=this.active.cancelled?'CANCELLED':v.error==='MODEL_PROVIDER_UNAVAILABLE'?'INTERRUPTED':'FINISHED';
    }catch(e){v.state='INTERRUPTED';v.error=e.message;if(m.storageFault)throw e;}
    v.finished_at=new Date().toISOString();await this.save(v);
  }
  async stop(id,project){const v=await this.get(id,project);if(this.active?.operation.operation_id!==id)return v;this.active.cancelled=true;this.active.operation.cancel_requested=true;await this.save(this.active.operation);const m=this.buildManager;if(m.active?.taskId)await m.stop(m.active.taskId);return {...this.active?.operation||v,cancel_requested:true};}
}

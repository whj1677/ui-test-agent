import { USER_GENERATION_LIMITS, checkDevelopmentEnvironment } from './build/user-workflow.mjs';
import { digest } from './build/development-session.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { developmentAuthorizations, registerDevelopmentAuthorization } from './build/development-authorization.mjs';
import { loadCandidateBundle } from './build/candidate-trials.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class ScriptOperations {
  constructor({root, buildManager, caseStore, records}) { Object.assign(this,{root,buildManager,caseStore,records});this.queue=Promise.resolve();this.writeQueue=Promise.resolve();this.active=null; }
  serial(fn) { const p=this.queue.then(fn,fn);this.queue=p.catch(()=>{});return p; }
  file(id) { if(!/^generation-[a-f0-9-]{36}$/.test(id))throw Error('GENERATION_ID_INVALID');return path.join(this.root,id+'.json'); }
  save(value) { const write=async()=>{await fs.mkdir(this.root,{recursive:true});const file=this.file(value.operation_id),tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2));await fs.rename(tmp,file);return value;};const next=this.writeQueue.then(write,write);this.writeQueue=next.catch(()=>{});return next; }
  async get(id,project) { const v=JSON.parse(await fs.readFile(this.file(id),'utf8'));if(v.project_id!==project)throw Error('GENERATION_PROJECT_MISMATCH');return v; }
  async list(project) { await fs.mkdir(this.root,{recursive:true});const rows=await Promise.all((await fs.readdir(this.root)).filter(f=>/^generation-[a-f0-9-]{36}\.json$/.test(f)).map(async f=>JSON.parse(await fs.readFile(path.join(this.root,f),'utf8'))));return rows.filter(v=>!project||v.project_id===project).sort((a,b)=>b.created_at.localeCompare(a.created_at)); }
  async init() { for(const v of await this.list()) if(['QUEUED','RUNNING'].includes(v.state)) { v.state='INTERRUPTED';for(const i of v.items)if(['QUEUED','RUNNING'].includes(i.state)){i.state='NOT_RUN';i.reason='SERVICE_INTERRUPTED_NO_REPLAY';}await this.save(v); } }
  async preflight(projectId, request) {
    if(!['generate','revise','regenerate'].includes(request.mode)||!Array.isArray(request.items)||!request.items.length||request.items.length>200||new Set(request.items.map(i=>i.case_id)).size!==request.items.length)throw Error('GENERATION_REQUEST_INVALID');
    const project=await this.caseStore.getProject(projectId);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const m=this.buildManager, grants=await developmentAuthorizations(m.store), rows=[];
    const environment=m.developmentEnvironments.find(e=>e.id===request.environment_id);
    let environmentError=null;
    if(m.userInitiatedOperations)try{await checkDevelopmentEnvironment(m,environment);}catch(e){environmentError=e.message;}
    for(const input of request.items){
      const item=project.cases.find(c=>c.case_id===input.case_id),version=item?.versions.find(v=>v.version===input.case_version);
      if(!version)throw Error('GENERATION_CASE_VERSION_INVALID');
      const candidates=(await m.caseAutomation(projectId,input.case_id,input.case_version)).candidates.filter(c=>c.applies_to_selected_version);
      const source=candidates.find(c=>c.selection.source_task_id===input.source_task_id&&c.selection.candidate_version===input.candidate_version&&c.selection.bundle_sha256===input.bundle_sha256);
      if(request.mode!=='revise' && (input.source_task_id||input.feedback||input.run_id))throw Error('GENERATION_FRESH_INPUT_MUST_NOT_INCLUDE_OLD_SCRIPT');
      let reason=version.content.status!=='CONFIRMED'?'CASE_CONTENT_NOT_CONFIRMED':request.mode==='generate'&&candidates.length?'SCRIPT_ALREADY_EXISTS':null;
      if(request.mode==='revise'&&(!source||typeof input.feedback!=='string'||!input.feedback.trim()||input.feedback.length>6000))reason='REVISION_SCRIPT_AND_FEEDBACK_REQUIRED';
      if(request.mode==='revise'&&input.run_id){const r=(await this.records(projectId)).find(r=>r.run_id===input.run_id&&r.executed_case_id===input.case_id&&r.executed_case_version===input.case_version&&r.bundle_sha256===input.bundle_sha256);if(!r)throw Error('REVISION_RUN_IDENTITY_MISMATCH');}
      const eligible=grants.filter(g=>!g.task_id&&g.project_id===projectId&&g.case_id===input.case_id&&g.case_version===input.case_version&&g.content_sha256===version.content_sha256&&g.environment_id===request.environment_id&&
        (!g.request_id||g.request_id===request.request_id)&&
        (g.operation_mode?g.operation_mode===request.mode:request.mode==='revise'?g.mode==='recovery':g.mode==='new'));
      const grant=eligible.length===1?eligible[0]:null;
      const userRequest=m.userInitiatedOperations===true&&!m.generationDisabled&&Boolean(m.modelConfiguration)&&Boolean(environment);
      if(environmentError)reason ||= environmentError;
      if(eligible.length>1)reason ||= 'GENERATION_AUTHORIZATION_AMBIGUOUS';
      if(!grant&&!userRequest)reason ||= 'GENERATION_NOT_AUTHORIZED';
      if(!m.developmentEnvironments.some(e=>e.id===request.environment_id))reason ||= 'GENERATION_ENVIRONMENT_NOT_READY';
      if(m.generationDisabled)reason ||= 'MODEL_GENERATION_DISABLED_IN_TRIAL_PROFILE';
      rows.push({case_id:item.case_id,external_id:version.content.external_id,title:version.content.title,case_version:version.version,content_sha256:version.content_sha256,
        old_scripts:candidates.map(c=>c.selection),logical_id:grant?.logical_id||null,requires_model_confirmation:!grant&&userRequest,limits:grant?.limits||(userRequest?USER_GENERATION_LIMITS:null),state:reason?'BLOCKED':'QUEUED',reason,input:structuredClone(input)});
    }
    return {mode:request.mode,environment_id:request.environment_id,items:rows,model_calls_required:true};
  }
  async start(projectId, request) { return this.serial(async()=>{
    if(!/^[-\w]{8,100}$/.test(request.request_id||''))throw Error('GENERATION_REQUEST_ID_REQUIRED');
    const fingerprint=hash(request),prior=(await this.list(projectId)).find(v=>v.request_id===request.request_id);
    if(prior){if(prior.fingerprint!==fingerprint)throw Error('GENERATION_REQUEST_CONFLICT');return prior;}
    let plan=await this.preflight(projectId,request);
    if(plan.items.some(i=>i.reason))throw Error('GENERATION_BLOCKED:'+plan.items.filter(i=>i.reason).map(i=>i.external_id+':'+i.reason).join(';'));
    const m=this.buildManager;if(this.active||m.generationOwner||m.batchOwner||m.active||m.starting||m.otherActive())throw Error('BUILD_TASK_ALREADY_ACTIVE');
    if(plan.items.some(i=>i.requires_model_confirmation)){
      if(request.confirm_model_use!==true)throw Error('GENERATION_MODEL_CONFIRMATION_REQUIRED');
      // A receipt belongs to this explicit operation, never a reusable blanket
      // permission or a reset of an earlier consumed authorization.
      for(const item of plan.items.filter(i=>i.requires_model_confirmation)){
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
          authorization_source:'EXPLICIT_USER_GENERATION_CONFIRMATION',...seed});
      }
      plan=await this.preflight(projectId,request);
      if(plan.items.some(i=>i.reason||!i.logical_id))throw Error('GENERATION_AUTHORIZATION_NOT_READY');
    }
    const operation=await this.save({...plan,operation_id:'generation-'+randomUUID(),project_id:projectId,request_id:request.request_id,fingerprint,state:'QUEUED',created_at:new Date().toISOString()});
    this.active={operation,cancelled:false};m.generationOwner=operation.operation_id;
    this.completion=this.execute(operation).finally(()=>{m.generationOwner=null;this.active=null;});return operation;
  }); }
  async execute(v) {
    const m=this.buildManager;
    try {v.state='RUNNING';await this.save(v);
      for(const item of v.items){
        if(this.active.cancelled){item.state='NOT_RUN';item.reason='GENERATION_CANCELLED';continue;}
        try{
          const checked=await this.preflight(v.project_id,{mode:v.mode,environment_id:v.environment_id,request_id:v.request_id,items:[item.input]});
          if(checked.items[0].reason)throw Error(checked.items[0].reason);
          const maintenance={mode:v.mode,operation_id:v.operation_id,feedback:v.mode==='revise'?item.input.feedback:null,run_id:v.mode==='revise'?item.input.run_id||null:null};
          let seedBundle;
          if(v.mode==='revise'){
            const task=await m.store.getTask(item.input.source_task_id),candidate=task.candidates.find(c=>c.version===item.input.candidate_version);
            seedBundle=await loadCandidateBundle(path.join(m.store.taskDirectory(task.task_id),'development/final'),candidate.bundle);
            maintenance.source_selection={...item.input};delete maintenance.source_selection.feedback;
          }
          const task=await m.submitDevelopment({logical_id:item.logical_id,maintenance,seedBundle});
          item.task_id=task.task_id;item.state='RUNNING';await this.save(v);
          if(this.active.cancelled)await m.stop(task.task_id);
          await m.completions.get(task.task_id);const done=await m.store.getTask(task.task_id);item.state=done.task_status;item.reason=done.error?.code||null;
        }catch(e){item.state='BLOCKED';item.reason=e.message;}
        await this.save(v);
      }v.state=this.active.cancelled?'CANCELLED':'FINISHED';
    }catch(e){v.state='INTERRUPTED';v.error=e.message;}
    v.finished_at=new Date().toISOString();await this.save(v);
  }
  async stop(id,project){const v=await this.get(id,project);if(this.active?.operation.operation_id!==id)return v;this.active.cancelled=true;this.active.operation.cancel_requested=true;await this.save(this.active.operation);const m=this.buildManager;if(m.active?.taskId)await m.stop(m.active.taskId);return {...this.active?.operation||v,cancel_requested:true};}
}

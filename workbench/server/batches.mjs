import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest } from './build/development-session.mjs';

export const reviewFor = (manager, selection) => (manager.requirementReviews || []).find(r =>
  ['project_id','case_id','case_version','content_sha256','source_task_id','bundle_sha256'].every(k => r[k] === selection[k])) || null;
export const rejectedReview = review => ['NOT_ACCEPTED_ACTION_CHANGED','BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP','FROZEN_CASE_INPUT_CONFLICT'].includes(review?.requirements_status);
const terminal = new Set(['FINISHED','CANCELLED','INTERRUPTED']);
const now = () => new Date().toISOString();

// Durable preview is the frozen selection, not a second execution system.
export class BatchManager {
  constructor({root, buildManager, caseStore, runStore}) { Object.assign(this,{root,buildManager,caseStore,runStore}); this.queue=Promise.resolve(); this.active=null; }
  serial(fn) { const p=this.queue.then(fn,fn);this.queue=p.catch(()=>{});return p; }
  file(id) { if(!/^batch-[a-f0-9-]{36}$/.test(id))throw Error('BATCH_ID_INVALID');return path.join(this.root,id+'.json'); }
  async save(b) { await fs.mkdir(this.root,{recursive:true});const f=this.file(b.batch_id),tmp=f+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(b,null,2));await fs.rename(tmp,f);return b; }
  async get(id,project) { let b;try{b=JSON.parse(await fs.readFile(this.file(id),'utf8'));}catch(e){if(e.code==='ENOENT')throw Error('BATCH_NOT_FOUND');throw e;}if(project&&b.project_id!==project)throw Error('BATCH_PROJECT_MISMATCH');return b; }
  async list(project) { await fs.mkdir(this.root,{recursive:true});const all=await Promise.all((await fs.readdir(this.root)).filter(f=>/^batch-[a-f0-9-]{36}\.json$/.test(f)).map(f=>this.get(f.slice(0,-5))));return all.filter(b=>!project||b.project_id===project).sort((a,b)=>b.created_at.localeCompare(a.created_at)); }
  async init() { for(const b of await this.list())if(['QUEUED','RUNNING','STOPPING'].includes(b.state)){b.state='INTERRUPTED';b.finished_at=now();for(const i of b.items)if(['QUEUED','RUNNING'].includes(i.state)){const r=i.run_id&&await this.runStore.getRun(i.run_id);i.state=r?.execution_status==='FINISHED'?'FINISHED':'NOT_RUN';i.reason='SERVICE_INTERRUPTED_NO_REPLAY';if(r)i.result=r.status;}await this.save(b);} }
  async preview(request) {
    const {project_id,scope,case_ids,selections=[],software_version='',mode='technical'}=request;
    if(!['single','selected','project'].includes(scope)||!['technical','diagnostic'].includes(mode)||typeof software_version!=='string'||software_version.length>160||!Array.isArray(selections))throw Error('BATCH_REQUEST_INVALID');
    const project=await this.caseStore.getProject(project_id);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const ids=scope==='project'?project.cases.map(c=>c.case_id):case_ids;
    if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||(scope==='single'&&ids.length!==1))throw Error('BATCH_SELECTION_INVALID');
    if(selections.some(s=>!ids.includes(s.case_id))||new Set(selections.map(s=>s.case_id)).size!==selections.length)throw Error('BATCH_SELECTION_INVALID');
    const items=[];
    for(const id of ids){
      const item=project.cases.find(c=>c.case_id===id);if(!item)throw Error('BATCH_CROSS_PROJECT_CASE');
      const explicit=selections.find(s=>s.case_id===id),v=item.versions.find(v=>v.version===(explicit?.case_version??item.current_version));if(!v)throw Error('BATCH_CASE_VERSION_INVALID');
      const candidates=(await this.buildManager.caseAutomation(project_id,id,v.version)).candidates;
      const matches=candidates.filter(c=>c.applies_to_selected_version);
      const chosen=explicit?matches.find(c=>JSON.stringify(c.selection)===JSON.stringify(explicit)):matches.length===1?matches[0]:null;
      let reason=chosen?.reason||(!chosen?(matches.length>1?'SCRIPT_SELECTION_REQUIRED':candidates.length?'CASE_VERSION_NOT_APPLICABLE':'SCRIPT_MISSING'):null);
      const review=chosen?reviewFor(this.buildManager,chosen.selection):null;
      if(rejectedReview(review)&&mode!=='diagnostic')reason='REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY';
      const env=chosen&&this.buildManager.candidateTrialEnvironments.find(e=>e.id===chosen.selection.environment_id);
      items.push({case_id:id,external_id:v.content.external_id,title:v.content.title,case_version:v.version,content_sha256:v.content_sha256,selection:chosen?.selection||null,environment_identity:env?.configurationIdentity||null,requirement_review:review,qualification:chosen?'LIMITED_TECHNICAL_TRIAL_NOT_APPROVED':'NO_APPLICABLE_SCRIPT',state:reason?'BLOCKED':'QUEUED',reason});
    }
    return this.save({schema:'workbench/test-batch-v1',batch_id:'batch-'+randomUUID(),project_id,scope,mode,software_version:software_version.trim()||null,software_version_source:software_version.trim()?'USER_LABEL_NOT_DEPLOYMENT_PROOF':'NOT_PROVIDED',project_revision:project.revision,created_at:now(),state:'PREVIEW',items,harness_starts:0,model_calls:0});
  }
  async start(id,project,request) { return this.serial(async()=>{
    const b=await this.get(id,project);
    if(b.request_id){if(b.request_id!==request.request_id||b.allow_partial!==request.allow_partial)throw Error('BATCH_REQUEST_CONFLICT');return b;}
    if((await this.list(project)).some(other=>other.batch_id!==id&&other.request_id===request.request_id))throw Error('BATCH_REQUEST_CONFLICT');
    if(b.state!=='PREVIEW'||!/^[-\w]{8,100}$/.test(request.request_id||''))throw Error('BATCH_REQUEST_INVALID');
    if(b.items.some(i=>i.state==='BLOCKED')&&request.allow_partial!==true)throw Error('BATCH_PARTIAL_CONFIRMATION_REQUIRED');
    const m=this.buildManager;if(this.active||m.active||m.starting||m.otherActive())throw Error('BATCH_EXECUTOR_BUSY');
    b.request_id=request.request_id;b.allow_partial=request.allow_partial;b.state='QUEUED';b.started_at=now();await this.save(b);
    m.batchOwner=id;m.batchToken=randomUUID();this.active={id,token:m.batchToken,cancelled:false};this.completion=this.execute(b).finally(()=>{m.batchOwner=null;m.batchToken=null;this.active=null;});return b;
  }); }
  async execute(b) {
    try {
      b.state='RUNNING';await this.save(b);
      const blockedEnvironments=new Set();
      for(const item of b.items){
        if(item.state!=='QUEUED')continue;
        if(this.active.cancelled){item.state='NOT_RUN';item.reason='BATCH_CANCELLED';continue;}
        if(blockedEnvironments.has(item.selection.environment_id)){item.state='BLOCKED';item.reason='SHARED_ENVIRONMENT_UNAVAILABLE';continue;}
        try {
          const env=this.buildManager.candidateTrialEnvironments.find(e=>e.id===item.selection.environment_id);
          if(JSON.stringify(env?.configurationIdentity||null)!==JSON.stringify(item.environment_identity))throw Error('BATCH_ENVIRONMENT_CONFIGURATION_CHANGED');
          const run=await this.buildManager.startCandidateTrial({...item.selection,lane:'normal',request_id:b.batch_id+'-'+b.items.indexOf(item),batch_id:b.batch_id,batch_token:this.active.token,diagnostic:b.mode==='diagnostic'});
          item.run_id=run.run_id;item.state='RUNNING';await this.save(b);
          await this.runStore.updateRun(run.run_id,r=>({...r,batch_id:b.batch_id,software_version:b.software_version,requirement_review:item.requirement_review,qualification:item.qualification}));
          if(this.active.cancelled)await this.buildManager.stopCandidateTrial(run.run_id).catch(()=>{});
          await this.buildManager.completions.get(run.run_id);
          const done=await this.runStore.getRun(run.run_id);item.state=done.execution_status==='CANCELLED'?'CANCELLED':done.result?'FINISHED':'BLOCKED';item.result=done.status;item.complete_pass=done.complete_pass;item.reason=done.technical_error?.code||null;
          if(item.reason&&/ENVIRONMENT|SITE_|ECONN|AUTH_SESSION/.test(item.reason))blockedEnvironments.add(item.selection.environment_id);
        }catch(e){item.state='BLOCKED';item.reason=e.message;if(/ENVIRONMENT|SITE_|AUTH_SESSION/.test(e.message))blockedEnvironments.add(item.selection.environment_id);}
        await this.save(b);
      }
      b.state=this.active.cancelled?'CANCELLED':'FINISHED';
    }catch(e){b.state='INTERRUPTED';b.error=e.message;for(const i of b.items)if(['RUNNING','QUEUED'].includes(i.state)){i.state='NOT_RUN';i.reason='BATCH_ENGINEERING_INTERRUPTED';}}
    b.finished_at=now();await this.save(b);
  }
  async stop(id,project) {return this.serial(async()=>{const b=await this.get(id,project);if(terminal.has(b.state))return b;if(this.active?.id!==id)throw Error('BATCH_NOT_ACTIVE');this.active.cancelled=true;if(this.buildManager.active?.runId)await this.buildManager.stopCandidateTrial(this.buildManager.active.runId);return this.get(id,project);});}
}

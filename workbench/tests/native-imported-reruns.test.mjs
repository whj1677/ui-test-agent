import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {NativeDshManager} from '../server/native-dsh/manager.mjs';
import {executeNativeScript} from '../server/native-dsh/executor.mjs';
import {contentHash} from '../server/cases/excel.mjs';
import {nativeConsoleModel,nativeRerunGroups,nativeRerunSelection,nativeRerunItems,nativeScriptsHtml} from '../web-v2/native-console-view.js';
const hash=value=>createHash('sha256').update(value).digest('hex');

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-imported-rerun-'));
  t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^native-imported-rerun-/);await fs.rm(root,{recursive:true,force:true});});
  const content={external_id:'PKG-001',title:'导入包工程样本',case_type:'UI',status:'CONFIRMED',steps:[{order:1,action:'工程样本动作',expected:'工程样本预期'}]};
  const entry='specs/PKG-001.spec.mjs',texts={'lib/helper.mjs':'export const fixtureValue = 1;\n',[entry]:"import {test,expect} from '@playwright/test';import {fixtureValue} from '../lib/helper.mjs';test('PKG-001 fixture',async()=>{await test.step('CASE_STEP_1',async()=>{expect(fixtureValue).toBe(2);});});\n"};
  const manifest=Object.entries(texts).map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:hash(text)}));
  const pkg={schema:'workbench/script-package-v1',runtime:'PLAYWRIGHT',entry,case_content_sha256:contentHash(content),script_sha256:hash(texts[entry]),bundle_sha256:hash(JSON.stringify(manifest)),manifest,files:Object.entries(texts).map(([path,text])=>({path,content_base64:Buffer.from(text).toString('base64')})),provenance:{project_id:'project-origin',case_id:'case-origin',case_version:2}};
  const imported={id:'imported-script-'+hash('owned fixture'),imported_at:'2026-10-16T00:00:00Z',package:pkg};
  const projectId='project-'+randomUUID(),project={project_id:projectId,cases:[{case_id:'case-imported',external_id:content.external_id,current_version:1,versions:[{version:1,content_sha256:contentHash(content),content,imported_scripts:[imported]}]}]};
  let configured=true,authValid=true,executions=0;const identity={environment_id:'env-target',configuration_sha256:'e'.repeat(64)};
  const manager=new NativeDshManager({root,caseStore:{getProject:async id=>id===projectId?structuredClone(project):null},workspaceRoot:path.join(root,'never-use-workspace'),
    client:{available:false,run(){assert.fail('imported rerun must not call a model');}},
    projectEnvironments:{binding:async()=>({ui_environment_id:configured?'env-target':null}),assert:async(id,kind,env)=>{assert.equal(id,projectId);assert.equal(kind,'ui');if(!configured)throw Error('PROJECT_ENVIRONMENT_NOT_CONFIGURED');assert.equal(env,'env-target');return {ui_identity:structuredClone(identity)};}},
    buildManager:{developmentEnvironments:[{id:'env-target',project_id:projectId,user_registered_target:true,normal_url:'http://local-sut.invalid/',auth_requirement:{environment_id:'env-target',role:'qa'}}],authSessions:{check:async()=>({status:authValid?'VALID':'INVALID'}),beginTaskProtection:()=>()=>{},stateForExecution:async()=>({cookies:[],origins:[]})}},
    execute:async args=>{executions++;assert.equal(args.workspace,undefined);assert.equal(args.frozenSource.runDirectory,undefined);assert.equal(args.frozenSource.importedPackage.bundle_sha256,pkg.bundle_sha256);assert.equal(args.identity.source_draft_id,imported.id);assert.equal(args.identity.source_kind,'IMPORTED_SCRIPT');
      return executeNativeScript(args,{prepareRecorder:async()=>null,finalizeEvidence:async()=>{},execute:async(_,argv,options)=>{
        const config=(await import(pathToFileURL(argv.at(-1)).href)).default;assert.equal(config.use.headless,true);assert.equal(options.env.DEEPSEEK_API_KEY,undefined);
        for(const [name,text]of Object.entries(texts))assert.equal(await fs.readFile(path.join(config.testDir,name),'utf8'),text);
        await fs.writeFile(config.reporter[0][1].outputFile,JSON.stringify({status:'failed',finished_at:new Date().toISOString(),tests:[{title:'PKG-001 fixture',status:'failed',expected_status:'passed',errors:['factual fixture failure']}]}));
        return {exitCode:1,stdout:'',stderr:'',outputComplete:true};
      }});
    }});
  const selection={source_kind:'IMPORTED_SCRIPT',source_draft_id:imported.id,case_id:'case-imported',case_version:1,content_sha256:contentHash(content),script_sha256:pkg.script_sha256,bundle_sha256:pkg.bundle_sha256};
  const input=()=>({request_id:randomUUID(),allow_execution:true,items:[{...selection,environment_identity:structuredClone(identity)}],timeout_minutes:1});
  return {root,projectId,project,pkg,imported,content,manager,selection,input,identity,texts,executions:()=>executions,configure:value=>{configured=value;},auth:value=>{authValid=value;}};
}

test('imported UI package runs without model or source project, freezes exact files, appends actual failure and preserves draft',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.project),preview=await f.manager.previewRerun(f.projectId,{items:[f.selection]});
  assert.equal(preview.allowed,true);assert.equal(preview.model_calls,0);assert.equal(preview.items[0].environment_url,'http://local-sut.invalid/');assert.deepEqual(preview.items[0].environment_identity,f.identity);assert.equal(f.executions(),0);
  const input=f.input(),task=await f.manager.createRerun(f.projectId,input);await f.manager.completion;
  const saved=await f.manager.get(f.projectId,task.id);assert.equal(saved.model_calls,0);assert.equal(saved.status,'PARTIAL');assert.equal(saved.runs[0].status,'FAILED');assert.equal(saved.runs[0].source_draft_id,f.imported.id);assert.equal(saved.runs[0].source_kind,'IMPORTED_SCRIPT');
  assert.equal(saved.runs[0].script_sha256,f.pkg.script_sha256);assert.equal(saved.runs[0].bundle_sha256,f.pkg.bundle_sha256);assert.equal(JSON.stringify(f.project),before);
  const projection=await f.manager.console(f.projectId),model=nativeConsoleModel(f.project,projection);assert.equal(model.passed,0);assert.equal(model.failed,1);assert.equal(projection.drafts[0].execution_status,'NOT_RUN');assert.equal(projection.drafts[0].counts_for_case,false);
  assert.equal((await f.manager.createRerun(f.projectId,input)).id,task.id);assert.equal(f.executions(),1);await assert.rejects(f.manager.createRerun(f.projectId,{...input,timeout_minutes:2}),/REQUEST_CONFLICT/);
});

test('imported execution requires a configured target, valid login, and exact confirmed environment identity',async t=>{
  const f=await fixture(t);f.configure(false);assert.equal((await f.manager.previewRerun(f.projectId,{items:[f.selection]})).reason,'PROJECT_ENVIRONMENT_NOT_CONFIGURED');
  f.configure(true);f.auth(false);assert.equal((await f.manager.previewRerun(f.projectId,{items:[f.selection]})).reason,'NATIVE_DSH_LOGIN_REQUIRED');f.auth(true);
  await assert.rejects(f.manager.createRerun(f.projectId,{...f.input(),items:[f.selection]}),/ENVIRONMENT_CONFIRMATION_REQUIRED/);
  const confirmed=f.input();f.identity.configuration_sha256='f'.repeat(64);await assert.rejects(f.manager.createRerun(f.projectId,confirmed),/ENVIRONMENT_CHANGED/);assert.equal(f.executions(),0);assert.equal((await f.manager.load(f.projectId)).tasks.length,0);
});

test('stale content, foreign draft, normal DSH draft, mixed source type and tampered bundle never execute',async t=>{
  const f=await fixture(t);
  for(const changed of [{case_version:2},{case_id:'foreign'},{source_draft_id:'draft-native'},{bundle_sha256:'0'.repeat(64)},{source_kind:'DIAGNOSTIC'},{source_run_id:'run-foreign'}]){
    const preview=await f.manager.previewRerun(f.projectId,{items:[{...f.selection,...changed}]});assert.equal(preview.allowed,false,JSON.stringify(changed));
  }
  f.pkg.files[0].content_base64=Buffer.from('tampered').toString('base64');assert.equal((await f.manager.previewRerun(f.projectId,{items:[f.selection]})).allowed,false);assert.equal(f.executions(),0);
});

test('pending content or diagnostic entry cannot become a formal case through imported rerun',async t=>{
  const f=await fixture(t);f.content.status='PENDING_CONFIRMATION';assert.equal((await f.manager.previewRerun(f.projectId,{items:[f.selection]})).allowed,false);
  f.content.status='CONFIRMED';f.pkg.entry='specs/diag/PKG-001.probe.spec.mjs';assert.equal((await f.manager.previewRerun(f.projectId,{items:[f.selection]})).allowed,false);assert.equal(f.executions(),0);
});

test('imported source uses the same import-graph boundary and rejects unsnapshotted dependencies',async t=>{
  const f=await fixture(t),entry=f.pkg.entry,text="import '../not-exported.mjs';";f.pkg.files[1].content_base64=Buffer.from(text).toString('base64');f.pkg.manifest[1]={path:entry,bytes:Buffer.byteLength(text),sha256:hash(text)};f.pkg.script_sha256=hash(text);f.pkg.bundle_sha256=hash(JSON.stringify(f.pkg.manifest));
  const result=await executeNativeScript({runDirectory:path.join(f.root,'graph-check'),entry,caseId:'PKG-001',frozenCaseContent:f.content,frozenSource:{entry,script_sha256:f.pkg.script_sha256,bundle_sha256:f.pkg.bundle_sha256,importedPackage:f.pkg}}, {execute:async()=>assert.fail('must reject before process start')});
  assert.equal(result.status,'ERROR');assert.match(result.error,/DEPENDENCY_NOT_SNAPSHOTTED/);
});

test('UI offers imported rerun without changing pass counts or promoting ordinary draft registrations',async t=>{
  const f=await fixture(t),projection=await f.manager.console(f.projectId),model=nativeConsoleModel(f.project,projection);
  const groups=nativeRerunGroups(model);assert.equal(groups.length,1);const item=nativeRerunItems([groups[0].rows[0]])[0];assert.deepEqual(item,{...f.selection,content_sha256:f.selection.content_sha256.toLowerCase()});
  assert.equal(model.scripts.length,0);assert.equal(model.passed,0);assert.match(nativeScriptsHtml(f.project,model),/核对并复跑所选脚本/);
  assert.equal(nativeRerunGroups({...model,drafts:[{...projection.drafts[0],origin:'NATIVE_DSH'}]}).length,0);
  assert.equal(nativeRerunSelection({origin:'NATIVE_DSH',source_kind:'IMPORTED_SCRIPT',draft_id:f.imported.id,run_id:'actual-run',task_id:'actual-task'}).source_run_id,'actual-run');
});

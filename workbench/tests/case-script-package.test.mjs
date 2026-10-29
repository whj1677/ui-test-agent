import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {CaseLibraryStore} from '../server/cases/store.mjs';
import {CaseLibraryManager} from '../server/cases/manager.mjs';
import {contentHash} from '../server/cases/excel.mjs';
import {validateScriptPackages,importedScriptDrafts,importedScriptFile} from '../server/cases/script-package.mjs';
import {exportCasesWorkbook} from '../server/cases/design.mjs';
import {nativeDshConsole} from '../server/native-dsh/console.mjs';
import {exportNativeScriptPackages} from '../server/native-dsh/portable.mjs';
import {nativeConsoleModel,nativeDraftsHtml} from '../web-v2/native-console-view.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const content={external_id:'PACKAGE-01',title:'文件包工程样本',module:'',preconditions:'',test_data:'',case_type:'UI',status:'CONFIRMED',steps:[{order:1,action:'工程样本动作',expected:'工程样本预期'}]};
function script(){
  const files=[{path:'lib/helper.mjs',content_base64:Buffer.from('export const sample = 1;\n').toString('base64')},{path:'specs/PACKAGE-01.spec.mjs',content_base64:Buffer.from("import {sample} from '../lib/helper.mjs';\n").toString('base64')}];
  const manifest=files.map(file=>({path:file.path,bytes:Buffer.from(file.content_base64,'base64').length,sha256:hash(Buffer.from(file.content_base64,'base64'))}));
  return {schema:'workbench/script-package-v1',runtime:'PLAYWRIGHT',entry:files[1].path,case_content_sha256:contentHash(content),script_sha256:manifest[1].sha256,bundle_sha256:hash(JSON.stringify(manifest)),manifest,files,provenance:{project_id:'project-source',case_id:'case-source',case_version:2}};
}
function pkg(scripts=[script()]){return {schema:'workbench/case-package-v1',package_id:'case-package-fixture',source_project:{project_id:'project-source'},cases:[{package_case_id:'project-source:case-source:v2',source_version:2,root_source:{stable_id:'fixture:package',type:'csv'},lineage:[],content:structuredClone(content),script_packages:scripts}]};}
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'case-script-package-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new CaseLibraryStore(root);await store.init();return {store,manager:new CaseLibraryManager(store)};}
async function importTo(manager,project,data){const upload=await manager.upload({fileName:'case-with-scripts.json',contentType:'application/json',body:Buffer.from(JSON.stringify(data))});const preview=await manager.preview(project.project_id,{upload_id:upload.upload_id});return {preview,...await manager.confirm(project.project_id,preview.preview_id)};}

test('JSON roundtrip preserves exact entry and helper bytes, binds new v1 and imports no pass or review',async t=>{
  const {store,manager}=await fixture(t),target=await manager.createProject({name:'导入目标'});
  const data=pkg();Object.assign(data.cases[0].script_packages[0],{status:'PASSED',counts_for_case:true,human_review_status:'APPROVED',environment:{token:'never-copy'}});
  const result=await importTo(manager,target,data);assert.equal(result.result.added,1);assert.equal(result.result.scripts_added,1);assert.equal(result.preview.script_summary.included,1);
  const saved=result.project,rows=importedScriptDrafts(saved);assert.equal(rows.length,1);const row=rows[0];
  assert.equal(row.execution_status,'NOT_RUN');assert.equal(row.counts_for_case,false);assert.equal(row.human_review_status,'NOT_REVIEWED');assert.equal(row.case_version,1);assert.equal(row.provenance.case_version,2);
  assert.equal(importedScriptFile(saved,row.case_id,1,row.draft_id,'1').body.toString(),Buffer.from(script().files[1].content_base64,'base64').toString());
  assert.equal(importedScriptFile(saved,row.case_id,1,row.draft_id,'0').body.toString(),'export const sample = 1;\n');
  assert.throws(()=>importedScriptFile(saved,'other',1,row.draft_id,'0'),/NOT_FOUND/);
  const output=await manager.exportPackage(target.project_id);assert.deepEqual(output.cases[0].script_packages,[validateScriptPackages([script()],content)[0]]);
  assert.equal(JSON.stringify(output).includes('never-copy'),false);
  const console=await nativeDshConsole({caseStore:store,load:async()=>({project_id:target.project_id,tasks:[]}),projectResults:async(_,x)=>x},target.project_id);
  assert.equal(console.records.length,0);assert.equal(console.scripts.length,0);assert.equal(console.drafts.length,1);
  assert.equal(nativeConsoleModel(saved,console).passed,0);
  const html=nativeDraftsHtml(saved,console.drafts);assert.match(html,/导入脚本 · 登记时未执行/);assert.match(html,/脚本与依赖（2 个文件）/);assert.match(html,/lib\/helper.mjs/);assert.match(html,/data-native-source=/);
});

test('same-content duplicates add only absent scripts, confirmation and repeated import are idempotent',async t=>{
  const {manager}=await fixture(t),project=await manager.createProject({name:'重复导入'});
  await importTo(manager,project,pkg([]));const second=await importTo(manager,project,pkg());
  assert.equal(second.result.added,0);assert.equal(second.result.skipped_duplicate,1);assert.equal(second.result.scripts_added,1);
  const repeat=await manager.confirm(project.project_id,second.preview.preview_id);assert.equal(repeat.idempotent,true);
  const third=await importTo(manager,project,pkg());assert.equal(third.result.scripts_added,0);assert.equal(third.result.scripts_skipped,1);assert.equal(third.project.cases.length,1);
});

test('historical duplicate cannot attach an old script to the current changed case',async t=>{
  const {manager}=await fixture(t),project=await manager.createProject({name:'历史版本'});
  const first=await importTo(manager,project,pkg([])),item=first.project.cases[0];
  await manager.updateCase(project.project_id,item.case_id,{revision:first.project.revision,content:{...content,title:'修订后'}});
  const second=await importTo(manager,project,pkg());assert.equal(second.result.scripts_added,0);assert.equal(second.result.scripts_skipped,1);assert.equal(importedScriptDrafts(second.project).length,0);
});

test('byte tampering, bundle tampering and case-content changes reject the script bundle',()=>{
  const a=script();a.files[0].content_base64=Buffer.from('tampered').toString('base64');assert.throws(()=>validateScriptPackages([a],content),/FILE_MISMATCH/);
  const b=script();b.bundle_sha256='a'.repeat(64);assert.throws(()=>validateScriptPackages([b],content),/BUNDLE_MISMATCH/);
  assert.throws(()=>validateScriptPackages([script()],{...content,title:'changed'}),/PACKAGE_INVALID/);
  const c=script();c.files[0].content_base64+='\n';assert.throws(()=>validateScriptPackages([c],content),/FILE_MISMATCH/);
});

test('unsafe paths, case-insensitive collisions and unsupported source types are rejected',()=>{
  for(const name of ['../escape.mjs','C:/escape.mjs','lib\\escape.mjs','.env','node_modules/x.js','.private/secret.json','lib/../x.mjs','lib/auth-state.json']){
    const a=script();a.manifest[0].path=name;a.files[0].path=name;assert.throws(()=>validateScriptPackages([a],content),/PATH_INVALID/);
  }
  const b=script();b.manifest[1].path='LIB/HELPER.MJS';b.files[1].path=b.manifest[1].path;assert.throws(()=>validateScriptPackages([b],content),/PACKAGE_INVALID/);
  const c=script();c.runtime='SHELL';assert.throws(()=>validateScriptPackages([c],content),/PACKAGE_INVALID/);
});

test('Excel hidden package preserves scripts and helpers, original project import adds no duplicate script',async t=>{
  const {manager,store}=await fixture(t),project=await manager.createProject({name:'Excel回导'});
  await importTo(manager,project,pkg());const output=await manager.exportPackage(project.project_id);
  const body=await exportCasesWorkbook(output);const upload=await manager.upload({fileName:'含脚本.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body});
  const preview=await manager.preview(project.project_id,{upload_id:upload.upload_id});assert.equal(preview.script_summary.included,1);assert.deepEqual(preview.items[0].script_packages[0].files,script().files);
  const result=await manager.confirm(project.project_id,preview.preview_id);assert.equal(result.result.scripts_added,0);assert.equal(importedScriptDrafts(await store.getProject(project.project_id)).length,1);
});

test('unavailable newest registered source blocks export instead of reverting to an older pass; diagnostics excluded',async()=>{
  const project={project_id:'project-source'},data=pkg([]);data.cases[0].lineage=[{case_id:'case-source'}];
  const formal={case_id:'case-source',case_version:2,applies_to_current_version:true,recorded_counts_for_case:true,finished_at:'2026-10-16',source:{available:false}};
  await assert.rejects(exportNativeScriptPackages({console:async()=>({records:[formal],drafts:[]})},project,data),/SOURCE_UNAVAILABLE/);
  const onlyDiagnostic={...formal,recorded_counts_for_case:false,purpose:'diagnostic',status:'PASSED'};
  await exportNativeScriptPackages({console:async()=>({records:[onlyDiagnostic],drafts:[]})},project,data);assert.equal(data.cases[0].script_export_status,'NO_CURRENT_SCRIPT');assert.deepEqual(data.cases[0].script_packages,[]);
});

test('legacy case packages without script fields remain importable',async t=>{
  const {manager}=await fixture(t),project=await manager.createProject({name:'旧包'}),data=pkg();delete data.cases[0].script_packages;
  const result=await importTo(manager,project,data);assert.equal(result.result.added,1);assert.equal(result.result.scripts_added,0);
});

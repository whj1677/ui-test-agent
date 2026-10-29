import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {docxFixture} from './fixtures/docx-image-fixture.mjs';
import {inspectDocumentWithOffice,normalizeOfficeResult,readWordDocument,importNativeOfficeDocument} from '../server/requirements/office-reader.mjs';
import {sha256} from '../server/requirements/documents.mjs';
import {RequirementsManager} from '../server/requirements/manager.mjs';
import {requirementsRoute} from '../server/requirements-routes.mjs';
const protectedBytes=Buffer.alloc(1024,0x17);
const extracted=provider=>({status:'PARTIAL',provider,segments:[{kind:'paragraph',location:{paragraph:2},text:'合成需求：名称不能为空。'},{kind:'table_cell',location:{table:1,cell:2},text:'重复编号必须拒绝。'}]});
async function temporary(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ui-office-test-'));
  t.after(async()=>{assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('ui-office-test-'));await fs.rm(directory,{recursive:true,force:true});});
  return directory;
}
test('standard DOCX stays on the original parser; unsafe or oversized input never opens Office',async()=>{
  const reader=()=>assert.fail('must not invoke Office');
  const source=await inspectDocumentWithOffice({kind:'PRD',fileName:'标准.docx',body:docxFixture({images:[]})},{reader});
  assert.equal(source.read_status,'READ');assert.equal(source.reading_method,undefined);
  await assert.rejects(inspectDocumentWithOffice({kind:'PRD',fileName:'../坏.docx',body:protectedBytes},{reader}),/SOURCE_NAME_INVALID/);
  await assert.rejects(inspectDocumentWithOffice({kind:'PRD',fileName:'大.docx',body:Buffer.alloc(10*1024*1024+1)},{reader}),/SOURCE_SIZE_INVALID/);
});
test('protected DOCX freezes original bytes and positioned Word/WPS text, with uncovered images explicit',async()=>{
  for(const provider of ['wps','microsoft-word']) {
    const source=await inspectDocumentWithOffice({kind:'PRD',fileName:'受保护.docx',body:protectedBytes},{reader:async()=>extracted(provider)});
    assert.equal(source.sha256,sha256(protectedBytes));assert.equal(source.bytes,protectedBytes.length);
    assert.equal(source.read_status,'PARTIAL');assert.equal(source.reading.provider,provider);
    assert.equal(source.sections.images,'UNANALYZED');assert.deepEqual(source.embedded_images,[]);
    assert.equal(source.segments[1].location.table,1);assert.equal(source.segments[0].quote_sha256,sha256(source.segments[0].text));
  }
});
test('empty, unbounded or fabricated Office outputs are rejected',()=>{
  const input={kind:'PRD',fileName:'a.docx',body:protectedBytes};
  assert.throws(()=>normalizeOfficeResult(input,{segments:[]}),/OFFICE_EMPTY/);
  assert.throws(()=>normalizeOfficeResult(input,{segments:[{kind:'paragraph',location:{paragraph:1},text:'a'.repeat(2_000_001)}]}),/OFFICE_LIMIT/);
  assert.throws(()=>normalizeOfficeResult(input,{segments:[{kind:'paragraph',location:{path:'untrusted'},text:'a'}]}),/OFFICE_OPEN_FAILED/);
});

test('blank Office paragraphs and table cells do not discard readable text or weaken location checks',()=>{
  const input={kind:'PRD',fileName:'空段落.docx',body:protectedBytes};
  const blank={kind:'paragraph',location:{paragraph:19},text:'\t\u00a0\ufeff\r\n'};
  for(const provider of ['wps','microsoft-word']) {
    const document=extracted(provider);
    document.segments.splice(1,0,blank,{kind:'table_cell',location:{table:1,cell:1},text:' \t '});
    const source=normalizeOfficeResult(input,document);
    assert.equal(source.read_status,'PARTIAL');assert.equal(source.segments.length,2);
    assert.deepEqual(source.segments.map(s=>s.segment_id),['segment-1','segment-2']);
    assert.equal(source.segments[1].location.cell,2);
    assert.equal(source.segments[0].text,document.segments[0].text);
    assert.equal(source.segments[0].quote_sha256,sha256(document.segments[0].text));
    assert.throws(()=>normalizeOfficeResult(input,{provider,segments:[blank]}),/OFFICE_EMPTY/);
    assert.throws(()=>normalizeOfficeResult(input,{provider,segments:[{...blank,location:{path:'untrusted'}}]}),/OFFICE_OPEN_FAILED/);
  }
});
test('assistant original-path reading keeps paths private, forwards provider and filters model credentials',async t=>{
  const directory=await temporary(t),file=path.join(directory,'原文件.docx');await fs.writeFile(file,protectedBytes);
  const calls=[];
  const source=await importNativeOfficeDocument({originalPath:file,provider:'wps',reader:options=>readWordDocument({...options,environment:{...process.env,DEEPSEEK_API_KEY:'SYNTHETIC_SECRET',OPENAI_API_KEY:'SYNTHETIC_SECRET'},run:async(command,args,options)=>{
    calls.push(args);assert.equal(options.env.DEEPSEEK_API_KEY,undefined);assert.equal(options.env.OPENAI_API_KEY,undefined);
    assert.equal(options.windowsHide,true,'Office reading must stay in the background');
    return {stdout:JSON.stringify(extracted('wps')),stderr:''};
  }})});
  assert.equal(calls.length,1);assert.equal(calls[0][0],'read');assert.ok(calls[0].includes(file));assert.ok(calls[0].includes('wps'));
  assert.equal(source.inspected.sha256,sha256(protectedBytes));assert.equal(source.fileName,'原文件.docx');
  assert.doesNotMatch(JSON.stringify(source.inspected),/ui-office-test-|SYNTHETIC_SECRET/);
});
test('invalid local paths and unsupported platform do not fabricate a source',async()=>{
  await assert.rejects(readWordDocument({body:protectedBytes,platform:'linux'}),/OFFICE_REQUIRED/);
  for(const originalPath of [undefined,'relative.docx','C:/secret.txt','https://host/secret.docx','\\\\server\\secret.docx'])await assert.rejects(importNativeOfficeDocument({originalPath}),/OFFICE_PATH_INVALID/);
});
test('native Office import is local-only and persists source integrity without model availability',async t=>{
  const root=await temporary(t),fileName='需求.docx';
  const inspected=normalizeOfficeResult({kind:'PRD',fileName,body:protectedBytes},extracted('wps'));
  const manager=new RequirementsManager({root,projectStore:{getProject:async()=>({})},nativeOfficeReader:async()=>({fileName,body:protectedBytes,inspected})});
  await manager.init();
  const p='project-00000000-0000-4000-8000-000000000001';
  const source=await manager.uploadOffice(p,{provider:'wps'});
  assert.equal(source.model_analysis_status,'NOT_RUN');assert.equal(source.reading.provider,'wps');
  assert.deepEqual(await manager.store.getSourceBytes(p,source.snapshot_id),protectedBytes);
  assert.equal((await manager.listSources(p)).sources.length,1);
});
test('Office source endpoint refuses untrusted origin and caller-supplied filesystem paths',async()=>{
  const base={request:{method:'POST'},response:{},url:new URL('http://127.0.0.1:4322/api/case-library/projects/p/requirements/sources/office'),manager:{uploadOffice:()=>assert.fail('must not open picker')},sendJson:(_r,status)=>assert.equal(status,403),trustedMutation:()=>false};
  assert.equal(await requirementsRoute(base),true);
  await assert.rejects(requirementsRoute({...base,trustedMutation:()=>true,readJsonBody:async()=>({provider:'wps',path:'C:/private.docx'})}),/OFFICE_OPEN_FAILED/);
});
test('shutdown aborts an outstanding local Office read before source persistence',async t=>{
  const root=await temporary(t);let opened;
  const started=new Promise(resolve=>opened=resolve);
  const manager=new RequirementsManager({root,projectStore:{getProject:async()=>({})},nativeOfficeReader:({signal})=>new Promise((resolve,reject)=>{opened();signal.addEventListener('abort',()=>reject(Error('REQUIREMENT_OFFICE_CANCELLED')),{once:true});})});
  await manager.init();const upload=manager.uploadOffice('project-00000000-0000-4000-8000-000000000001');const rejection=assert.rejects(upload,/OFFICE_CANCELLED/);
  await started;await manager.shutdown();await rejection;
});

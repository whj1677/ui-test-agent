import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {inspectDocument,sha256} from './documents.mjs';

const execute=promisify(execFile);
const worker=fileURLToPath(new URL('./office-word-reader.exe',import.meta.url));
const codes=new Set(['REQUIREMENT_OFFICE_REQUIRED','REQUIREMENT_OFFICE_BUSY','REQUIREMENT_OFFICE_UNSAVED','REQUIREMENT_OFFICE_PERMISSION_DENIED','REQUIREMENT_OFFICE_OPEN_FAILED','REQUIREMENT_OFFICE_TIMEOUT','REQUIREMENT_OFFICE_CANCELLED','REQUIREMENT_OFFICE_EMPTY','REQUIREMENT_OFFICE_LIMIT']);
let reading=false;
const fail=code=>{throw Error(code);};

function officeEnvironment(environment) {
  const names=['SystemRoot','WINDIR','COMSPEC','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','ProgramFiles','ProgramFiles(x86)','ProgramW6432','CommonProgramFiles','CommonProgramFiles(x86)','CommonProgramW6432','ALLUSERSPROFILE','USERNAME','USERDOMAIN','USERDNSDOMAIN','SYSTEMDRIVE','SESSIONNAME','LOGONSERVER','HOMEDRIVE','HOMEPATH'];
  return Object.fromEntries(names.filter(name=>environment[name]).map(name=>[name,environment[name]]));
}

export async function readWordDocument({body,signal,originalPath=null,provider='auto',platform=process.platform,environment=process.env,run=execute}={}) {
  if(platform!=='win32')fail('REQUIREMENT_OFFICE_REQUIRED');
  if(signal?.aborted)fail('REQUIREMENT_OFFICE_CANCELLED');
  if(!['auto','word','wps'].includes(provider))fail('REQUIREMENT_OFFICE_OPEN_FAILED');
  if(reading)fail('REQUIREMENT_OFFICE_BUSY');
  reading=true;
  let directory;
  const options={windowsHide:true,encoding:'utf8',maxBuffer:24*1024*1024,env:officeEnvironment(environment)};
  try {
    const build=JSON.parse(await fs.readFile(new URL('./office-word-reader.build.json',import.meta.url),'utf8'));
    const executable=await fs.readFile(worker);
    if(build.schema!=='workbench/office-word-reader-build-v1' || executable.length!==build.bytes || sha256(executable)!==build.sha256)fail('REQUIREMENT_OFFICE_OPEN_FAILED');
    directory=await fs.mkdtemp(path.join(os.tmpdir(),'ui-test-word-read-'));
    const owner=path.join(directory,'owner.json');
    let input=originalPath;
    const useOriginal=Boolean(input);
    if(useOriginal) {
      if(typeof input!=='string' || !/^[a-z]:[\\/]/i.test(input) || !path.isAbsolute(input) || path.extname(input).toLowerCase()!=='.docx' || !(await fs.stat(input)).isFile())fail('REQUIREMENT_OFFICE_PATH_INVALID');
      body=await fs.readFile(input);
      if(!body.length || body.length>10*1024*1024)fail('REQUIREMENT_SOURCE_SIZE_INVALID');
    } else {
      input=path.join(directory,'source.docx');await fs.writeFile(input,body,{flag:'wx'});
    }
    let result;
    try {
      const output=await run(worker,['read','--input',input,'--owner',owner,'--provider',provider],{...options,timeout:90000,signal});
      result=JSON.parse(output.stdout.replace(/^\uFEFF/,''));
    } catch(error) {
      if(signal?.aborted)fail('REQUIREMENT_OFFICE_CANCELLED');
      if(error.killed || error.code==='ETIMEDOUT')fail('REQUIREMENT_OFFICE_TIMEOUT');
      fail('REQUIREMENT_OFFICE_OPEN_FAILED');
    }
    if(result.status!=='PARTIAL')fail(codes.has(result.code)?result.code:'REQUIREMENT_OFFICE_OPEN_FAILED');
    if(useOriginal && sha256(await fs.readFile(input))!==sha256(body))fail('REQUIREMENT_SOURCE_INTEGRITY_FAILED');
    return useOriginal?{...result,original_body:body,file_name:path.basename(input)}:result;
  } finally {
    if(directory) {
      const owner=path.join(directory,'owner.json');
      if(await fs.stat(owner).catch(()=>null)) {
        // Cleanup validates the exact PID and creation time of our new Word.
        // It cannot target an existing user instance or change security policy.
        await run(worker,['cleanup','--owner',owner],{...options,timeout:4000}).catch(()=>{});
      }
      const parent=path.resolve(os.tmpdir()),target=path.resolve(directory);
      if(path.dirname(target)===parent && path.basename(target).startsWith('ui-test-word-read-'))await fs.rm(target,{recursive:true,force:true}).catch(()=>{});
    }
    reading=false;
  }
}

export async function inspectDocumentWithOffice(input,{reader=readWordDocument,signal}={}) {
  try {return inspectDocument(input);} catch(error) {
    // Do not bypass normal parser size, macro, path or archive-safety checks.
    if(error.message!=='REQUIREMENT_DOCX_INVALID_ZIP' || path.extname(input.fileName).toLowerCase()!=='.docx' || input.body.length<512)throw error;
  }
  const result=await reader({body:input.body,signal});
  return normalizeOfficeResult(input,result);
}

export function normalizeOfficeResult(input,result,{standardParser='failed'}={}) {
  if(!Array.isArray(result.segments) || result.segments.length>20000)fail('REQUIREMENT_OFFICE_LIMIT');
  let characters=0;
  const segments=result.segments.map(segment=>{
    if(!['paragraph','table_cell'].includes(segment.kind) || typeof segment.text!=='string' ||
      !segment.location || typeof segment.location!=='object' || Array.isArray(segment.location))fail('REQUIREMENT_OFFICE_OPEN_FAILED');
    const keys=segment.kind==='paragraph'?['paragraph']:['table','cell'];
    if(Object.keys(segment.location).sort().join(',')!==keys.sort().join(',') || keys.some(key=>!Number.isInteger(segment.location[key]) || segment.location[key]<1))fail('REQUIREMENT_OFFICE_OPEN_FAILED');
    // Office can return tab-only paragraphs or blank table cells. They carry
    // no source text; keep validating their locations, then omit them.
    if(!segment.text.trim())return null;
    characters+=segment.text.length;
    if(characters>2_000_000)fail('REQUIREMENT_OFFICE_LIMIT');
    return {kind:segment.kind,location:segment.location,text:segment.text,quote_sha256:sha256(segment.text)};
  }).filter(Boolean).map((segment,index)=>({segment_id:`segment-${index+1}`,...segment}));
  if(!segments.length)fail('REQUIREMENT_OFFICE_EMPTY');
  if(!['wps','microsoft-word'].includes(result.provider))fail('REQUIREMENT_OFFICE_OPEN_FAILED');
  return {file_name:input.fileName,extension:'.docx',sha256:sha256(input.body),bytes:input.body.length,
    read_status:'PARTIAL',reading_method:'local-office',
    sections:{body:'READ',tables:'READ',images:'UNANALYZED'},segments,embedded_images:[],
    issues:[{code:'OFFICE_TEXT_ONLY_OTHER_OBJECTS_NOT_READ',severity:'COVERAGE_GAP'},
      {code:'IMAGES_NOT_EXTRACTED',severity:'COVERAGE_GAP'}],
    reading:{method:'local-office',provider:result.provider,standard_parser:standardParser,original_preserved:true,visual_review:'NOT_RUN',
      limitations:['图片、页眉页脚、批注、修订和嵌入对象尚未读取；正文与表格已提取。']}};
}

export async function importNativeOfficeDocument({originalPath,provider='auto',signal,reader=readWordDocument}={}) {
  if(typeof originalPath!=='string' || !/^[a-z]:[\\/][^\r\n\0]*\.docx$/i.test(originalPath) || originalPath.length>2000)fail('REQUIREMENT_OFFICE_PATH_INVALID');
  const result=await reader({originalPath,provider,signal});
  const input={kind:'PRD',fileName:result.file_name,body:result.original_body};
  if(typeof input.fileName!=='string' || path.basename(input.fileName)!==input.fileName || path.extname(input.fileName).toLowerCase()!=='.docx' || !Buffer.isBuffer(input.body) || !input.body.length || input.body.length>10*1024*1024)fail('REQUIREMENT_OFFICE_OPEN_FAILED');
  return {fileName:input.fileName,body:input.body,inspected:normalizeOfficeResult(input,result,{standardParser:'not_used'})};
}

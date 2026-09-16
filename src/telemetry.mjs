import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,now,uid} from './common.mjs';

const SECRET_KEY=/^(?:password|passwd|pwd|secret|clientsecret|apikey|authorization|proxyauthorization|auth|cookie|setcookie|cookies|token|accesstoken|refreshtoken|idtoken|bearertoken|credential|credentials|storageState|sessionStorage)$/i;
const keyIsSecret=key=>SECRET_KEY.test(String(key).replace(/[ _-]/g,''));
const MASK='[REDACTED]';

// Log redaction is separate from model input and executable plans. Truncation
// markers distinguish bounded diagnostics from complete execution evidence.
export function scrubForLog(value,{secrets=[],maxTextChars=24000,maxDepth=40}={}) {
  const known=[...new Set(secrets.filter(s=>typeof s==='string'&&s.length).flatMap(s=>[s,JSON.stringify(s).slice(1,-1),encodeURIComponent(s)]))].sort((a,b)=>b.length-a.length);
  const limit=Number.isSafeInteger(maxTextChars)&&maxTextChars>=100?maxTextChars:24000;
  const ancestors=new WeakSet();
  function cleanText(input) {
    const priorTruncation=input.match(/\n\[TRUNCATED original_chars=(\d+) limit=(\d+)\]$/);
    let result=priorTruncation?input.slice(0,priorTruncation.index):input;
    for(const secret of known)result=result.split(MASK).map(part=>part.split(secret).join(MASK)).join(MASK);
    result=result.replace(/\bsk-[\w-]{8,}/g,MASK)
      .replace(/(^|\r?\n)((?:cookie|set-cookie|authorization|proxy-authorization)\s*[:=]\s*)[^\r\n]*/gi,'$1$2'+MASK)
      .replace(/\bBearer\s+(?:\[REDACTED\][^\s"'`,;\]}]*|[^\s"'`,;\]}]+)/gi,'Bearer '+MASK)
      .replace(/((?:["']?)(?:password|passwd|pwd|secret|client[_ -]?secret|api[_ -]?key|authorization|proxy[_ -]?authorization|cookie|set[_ -]?cookie|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|token|credential|密码)(?:["']?)\s*[:=：]\s*)(\[REDACTED\][^\s,;，；\]}]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;，；\]}]+)/gi,'$1'+MASK)
      .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1'+MASK+'@');
    if(result.length>limit)return result.slice(0,limit)+`\n[TRUNCATED original_chars=${priorTruncation?priorTruncation[1]:result.length} limit=${limit}]`;
    return priorTruncation?result+priorTruncation[0]:result;
  }
  function visit(v,depth=0) {
    if(typeof v==='string')return cleanText(v);
    if(v===null||typeof v==='boolean'||typeof v==='number')return v;
    if(v===undefined)return null;
    if(typeof v!=='object')return cleanText(String(v));
    if(depth>=maxDepth)return '[TRUNCATED maximum_depth]';
    if(ancestors.has(v))return '[REDACTED circular_reference]';
    ancestors.add(v);
    let out;
    if(Array.isArray(v))out=v.map(item=>visit(item,depth+1));
    else {out={};for(const [key,item]of Object.entries(v))Object.defineProperty(out,cleanText(key),{value:keyIsSecret(key)?MASK:visit(item,depth+1),enumerable:true,writable:true,configurable:true});}
    ancestors.delete(v);return out;
  }
  return visit(value);
}

const diagnosticError=(code,cause)=>Object.assign(new Error(code),{code,status:500,...(cause?.code?{cause_code:String(cause.code)}:{})});

// The application owns the data-directory process lock. Exact sequence filenames
// additionally fail closed on competing writers; entries are never overwritten.
export class DiagnosticLog {
  #queue=Promise.resolve();
  #loaded=false;
  #sequence=0;
  #previous=null;
  constructor(directory,{secrets=[],maxTextChars=24000}={}) {
    this.directory=path.resolve(directory);this.options={secrets,maxTextChars};
  }
  async #load() {
    let files;try{files=await fs.readdir(this.directory);}catch(e){if(e.code==='ENOENT'&&!this.#sequence){this.#loaded=true;return [];}if(e.code==='ENOENT')throw diagnosticError('DIAGNOSTIC_CHANGED');throw e;}
    const entries=files.filter(f=>/^\d{8}\.json$/.test(f)).sort(),records=[];
    let previous=null,sequence=0;
    for(const file of entries){
      const bytes=await fs.readFile(path.join(this.directory,file));let entry;
      try{entry=JSON.parse(bytes.toString('utf8'));}catch{throw diagnosticError('DIAGNOSTIC_CHANGED');}
      sequence++;
      const {entry_sha256,...unsigned}=entry;
      if(file!==String(sequence).padStart(8,'0')+'.json'||entry.schema_version!=='ui-agent-diagnostic/v1'||entry.sequence!==sequence||entry.previous_sha256!==previous||!entry.record||typeof entry.record!=='object'||entry_sha256!==hash(JSON.stringify(unsigned)))throw diagnosticError('DIAGNOSTIC_CHANGED');
      previous=hash(bytes);records.push(entry.record);
    }
    if(this.#loaded&&(sequence<this.#sequence||(sequence===this.#sequence&&previous!==this.#previous)))throw diagnosticError('DIAGNOSTIC_CHANGED');
    this.#sequence=sequence;this.#previous=previous;this.#loaded=true;return records;
  }
  append(record) {
    const pending=this.#queue.then(async()=>{
      try{
        if(!record||typeof record!=='object'||Array.isArray(record))throw diagnosticError('DIAGNOSTIC_RECORD_INVALID');
        if(!this.#loaded)await this.#load();
        await fs.mkdir(this.directory,{recursive:true});
        const sequence=this.#sequence+1,id=uid(),file=String(sequence).padStart(8,'0')+'.json';
        const entry={schema_version:'ui-agent-diagnostic/v1',sequence,id,at:now(),previous_sha256:this.#previous,record:scrubForLog(record,this.options)};
        entry.entry_sha256=hash(JSON.stringify(entry));
        const bytes=Buffer.from(JSON.stringify(entry,null,2)+'\n'),handle=await fs.open(path.join(this.directory,file),'wx');
        try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
        const sha256=hash(bytes);this.#sequence=sequence;this.#previous=sha256;
        return {sequence,id,sha256,file};
      }catch(e){throw diagnosticError('DIAGNOSTIC_WRITE_FAILED',e);}
    });
    this.#queue=pending.catch(()=>{});return pending;
  }
  read() {
    const pending=this.#queue.then(async()=>{
      try{return await this.#load();}catch(e){if(e.code==='DIAGNOSTIC_CHANGED')throw e;throw diagnosticError('DIAGNOSTIC_READ_FAILED',e);}
    });
    this.#queue=pending.catch(()=>{});return pending;
  }
}

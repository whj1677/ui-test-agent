import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
const TYPE="manual_case_frontend_handoff", VERSION="1.0", HASH=/^[a-f0-9]{64}$/, MAX_BYTES=16*1024*1024;
const KNOWLEDGE=new Set(["code_confirmed","inferred_candidate","unresolved"]);
const record=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const text=v=>typeof v==="string"&&v.trim().length>0;
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const digest=v=>crypto.createHash("sha256").update(v).digest("hex");
const add=(errors,code,at="")=>errors.push(code+(at?" at "+at:""));
function fail(code,errors=[]){const error=new Error(code);error.code=code;error.errors=errors;throw error;}
function canonical(v){if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";if(record(v))return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";return JSON.stringify(v);}
function contentDigest(v){const copy={...v};delete copy.integrity;return digest(canonical(copy));}
const SECRET_KEYS=/^(?:password|passwd|pwd|token|access_token|refresh_token|secret|authorization|cookie|cookies|storageState|credential|credentials|api_key|client_secret)$/i;
const SECRET_TEXT=/(?:\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["'][^"'\s]{4,}["']|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
function checkJson(v,e,at="$",depth=0){
 if(depth>32){add(e,"JSON_DEPTH_LIMIT",at);return;}
 if(v===null||typeof v==="boolean")return;
 if(typeof v==="number"){if(!Number.isFinite(v))add(e,"INVALID_NUMBER",at);return;}
 if(typeof v==="string"){if(v.length>65536||/[\u0000\u0008]/.test(v))add(e,"INVALID_STRING",at);if(SECRET_TEXT.test(v))add(e,"POSSIBLE_SECRET_REJECTED",at);return;}
 if(Array.isArray(v)){if(v.length>10000){add(e,"ARRAY_LIMIT",at);return;}v.forEach((x,i)=>checkJson(x,e,at+"["+i+"]",depth+1));return;}
 if(!record(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))){add(e,"INVALID_JSON_TYPE",at);return;}
 for(const k of Object.keys(v)){if(SECRET_KEYS.test(k))add(e,"SECRET_FIELD_REJECTED",at);checkJson(v[k],e,at+".field",depth+1);}
}
function shape(v,allowed,required,e,at){
 if(!record(v)){add(e,"OBJECT_REQUIRED",at);return false;}
 for(const k of Object.keys(v))if(!allowed.includes(k))add(e,"UNKNOWN_FIELD",at);
 for(const k of required)if(!own(v,k))add(e,"MISSING_FIELD",at+"."+k);
 return true;
}
function safeRelative(v,root=false){
 if(!text(v)||v.includes("\\")||v.includes(":")||v.includes("\0")||v.startsWith("/")||v.endsWith("/"))return false;
 if(root&&v===".")return true;
 return v.split("/").every(p=>p&&p!=="."&&p!==".."&&!p.startsWith(".")&&p!=="node_modules"&&!/[<>|"*?]/.test(p)&&!/[. ]$/.test(p)&&!/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p));
}
function entryPath(v){
 if(typeof v!=="string"||!v.startsWith("/")||v.startsWith("//")||v.includes("\\")||/[\u0000-\u001f]/.test(v))return false;
 try{
 let decoded=v;for(let i=0;i<2;i++)decoded=decodeURIComponent(decoded);
 if(decoded.startsWith("//")||decoded.includes("\\")||/[\u0000-\u001f]/.test(decoded)||/(?:^|\/)\.\.(?:\/|[?#]|$)/.test(decoded))return false;
 const u=new URL(v,"https://handoff.invalid");
 if(u.origin!=="https://handoff.invalid"||u.username||u.password||u.hash.startsWith("#//"))return false;
 const sensitive=/^(?:password|passwd|pwd|token|accesstoken|refreshtoken|secret|authorization|cookie|apikey|clientsecret|session|sessionid)$/i;
 const du=new URL(decoded,"https://handoff.invalid");
 if(du.origin!=="https://handoff.invalid"||du.hash.startsWith("#//"))return false;
 const queries=[u.searchParams,du.searchParams,new URLSearchParams(u.hash.includes("?")?u.hash.slice(u.hash.indexOf("?")+1):""),new URLSearchParams(du.hash.includes("?")?du.hash.slice(du.hash.indexOf("?")+1):"")];
 for(const query of queries)for(const [key,value]of query)if(sensitive.test(key.replace(/[-_]/g,""))||SECRET_TEXT.test(value))return false;
 return true;
 }catch{return false;}
}
function locator(v,e,at){
 if(!record(v)){add(e,"LOCATOR_REQUIRED",at);return false;}
 const k=v.kind,allowed=k==="role"?["kind","role","name","exact"]:k==="testid"||k==="css"?["kind","value"]:["kind","value","exact"];
 shape(v,allowed,allowed,e,at);let ok=false;
 if(k==="role")ok=text(v.role)&&text(v.name)&&v.exact===true&&/^[a-z]+$/.test(v.role);
 else if(["label","placeholder","text"].includes(k))ok=text(v.value)&&v.exact===true;
 else if(k==="testid")ok=text(v.value)&&v.value.length<=256;
 else if(k==="css")ok=typeof v.value==="string"&&/^(?:[a-z][a-z0-9-]*)?\[(?:data-[a-z0-9_-]+|id|name|aria-label|placeholder|title|type)=["'][^"'\\\]\r\n]{1,256}["']\]$/i.test(v.value);
 if(!ok)add(e,"INVALID_LOCATOR",at);return ok;
}
function waits(values,e,at,requireOne=false){
 if(!Array.isArray(values)||(requireOne&&values.length===0)){add(e,"WAITS_REQUIRED",at);return;}
 values.forEach((v,i)=>{const where=at+"["+i+"]";if(!shape(v,["state","locator","text","timeout_ms"],["state","locator","timeout_ms"],e,where))return;
 if(!["visible","hidden","enabled","text"].includes(v.state))add(e,"INVALID_WAIT_STATE",where);
 locator(v.locator,e,where+".locator");
 if(!Number.isInteger(v.timeout_ms)||v.timeout_ms<1||v.timeout_ms>60000)add(e,"INVALID_WAIT_TIMEOUT",where);
 if(v.state==="text"?!text(v.text):own(v,"text"))add(e,"INVALID_WAIT_TEXT",where);});
}
function baseline(bytes,e){
 if(!(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array||typeof bytes==="string")){add(e,"CASE_IMPORT_BYTES_REQUIRED");return null;}
 let v;try{const b=Buffer.from(bytes);if(b.length>MAX_BYTES){add(e,"CASE_IMPORT_TOO_LARGE");return null;}v=JSON.parse(b.toString("utf8"));}catch{add(e,"CASE_IMPORT_INVALID_JSON");return null;}
 if(!record(v)||!Array.isArray(v.cases)||v.cases.length===0||v.cases.length>10000){add(e,"CASE_IMPORT_INVALID_CASES");return null;}
 if(own(v,"case_count")&&v.case_count!==v.cases.length)add(e,"CASE_IMPORT_COUNT_MISMATCH");
 const ids=new Set();v.cases.forEach((item,i)=>{const at="case_import.cases["+i+"]";
 if(!record(item)||!text(item.case_id)||!Array.isArray(item.steps)||!item.steps.length){add(e,"CASE_IMPORT_INVALID_CASE",at);return;}
 if(ids.has(item.case_id))add(e,"CASE_IMPORT_DUPLICATE_CASE",at);ids.add(item.case_id);
 const steps=new Set();for(const s of item.steps){if(!record(s)||!text(s.step_id)){add(e,"CASE_IMPORT_INVALID_STEP",at);continue;}if(steps.has(s.step_id))add(e,"CASE_IMPORT_DUPLICATE_STEP",at);steps.add(s.step_id);}});
 return v;
}
function validateSource(v,e){
 const files=new Map(),anchors=new Set();
 if(!shape(v,["revision","scope_roots","files"],["revision","scope_roots","files"],e,"source"))return{files,anchors};
 if(!text(v.revision))add(e,"SOURCE_REVISION_REQUIRED");
 if(!Array.isArray(v.scope_roots)||!v.scope_roots.length)add(e,"SOURCE_SCOPE_REQUIRED");
 else{const seen=new Set();v.scope_roots.forEach((r,i)=>{if(!safeRelative(r,true))add(e,"UNSAFE_SOURCE_SCOPE","source.scope_roots["+i+"]");if(seen.has(r))add(e,"DUPLICATE_SOURCE_SCOPE");seen.add(r);});}
 if(!Array.isArray(v.files)||!v.files.length){add(e,"SOURCE_FILES_REQUIRED");return{files,anchors};}
 v.files.forEach((f,i)=>{const at="source.files["+i+"]";
 if(!shape(f,["path","size_bytes","sha256","disposition","reason","anchors"],["path","size_bytes","sha256","disposition","reason","anchors"],e,at))return;
 if(!safeRelative(f.path))add(e,"UNSAFE_SOURCE_PATH",at);if(files.has(f.path))add(e,"DUPLICATE_SOURCE_FILE",at);files.set(f.path,f);
 if(!Array.isArray(v.scope_roots)||!v.scope_roots.some(r=>r==="."||f.path===r||typeof r==="string"&&typeof f.path==="string"&&f.path.startsWith(r+"/")))add(e,"SOURCE_FILE_OUTSIDE_SCOPE",at);
 if(!Number.isSafeInteger(f.size_bytes)||f.size_bytes<0)add(e,"INVALID_SOURCE_SIZE",at);
 if(typeof f.sha256!=="string"||!HASH.test(f.sha256))add(e,"INVALID_SOURCE_DIGEST",at);
 if(!["mapped","dependency","excluded"].includes(f.disposition))add(e,"INVALID_SOURCE_DISPOSITION",at);
 if(!text(f.reason))add(e,"SOURCE_DISPOSITION_REASON_REQUIRED",at);
 if(!Array.isArray(f.anchors)){add(e,"SOURCE_ANCHORS_REQUIRED",at);return;}
 if(f.disposition==="mapped"&&!f.anchors.length)add(e,"MAPPED_SOURCE_ANCHOR_REQUIRED",at);
 f.anchors.forEach((a,j)=>{const where=at+".anchors["+j+"]";if(!shape(a,["id","line","statement"],["id","line","statement"],e,where))return;
 if(!text(a.id)||!Number.isInteger(a.line)||a.line<1||!text(a.statement)||/[\r\n]/.test(a.statement))add(e,"INVALID_SOURCE_ANCHOR",where);
 const key=f.path+"\0"+a.id;if(anchors.has(key))add(e,"DUPLICATE_SOURCE_ANCHOR",where);anchors.add(key);});
 });
 return{files,anchors};
}
function refs(values,source,e,at,required){
 if(!Array.isArray(values)||(required&&!values.length)){add(e,"SOURCE_REFS_REQUIRED",at);return;}
 values.forEach((v,i)=>{const where=at+"["+i+"]";if(!shape(v,["path","anchor_id"],["path","anchor_id"],e,where))return;
 if(!safeRelative(v.path)||!text(v.anchor_id)||!source.anchors.has(v.path+"\0"+v.anchor_id)||source.files.get(v.path)?.disposition==="excluded")add(e,"SOURCE_REFERENCE_UNRESOLVED",where);});
}
function validateAuthentication(v,source,e){
 const at="authentication";
 if(!shape(v,["knowledge_status","mode","authenticated_locator","login_locator","source_refs","reason"],["knowledge_status","mode","source_refs"],e,at))return false;
 if(!KNOWLEDGE.has(v.knowledge_status))add(e,"INVALID_KNOWLEDGE_STATUS",at);
 if(!["none","manual_headed"].includes(v.mode))add(e,"UNSUPPORTED_AUTH_MODE",at);
 const unresolved=v.knowledge_status==="unresolved";
 if(unresolved&&!text(v.reason))add(e,"UNRESOLVED_REASON_REQUIRED",at);
 if(own(v,"reason")&&!text(v.reason))add(e,"INVALID_REASON",at);
 refs(v.source_refs,source,e,at+".source_refs",!unresolved);
 for(const key of ["authenticated_locator","login_locator"])if(v.mode==="manual_headed"&&!unresolved||own(v,key))locator(v[key],e,at+"."+key);
 return !unresolved;
}


function validateActions(values,source,e){
 const actions=new Map();if(!Array.isArray(values)){add(e,"ACTIONS_ARRAY_REQUIRED");return actions;}
 values.forEach((a,i)=>{const at="actions["+i+"]";
 if(!shape(a,["id","knowledge_status","reason","source_refs","entry_path","locator","controls","fallback_locators","waits","observation","data_effect","setup","cleanup"],["id","knowledge_status","source_refs"],e,at))return;
 if(!text(a.id)||actions.has(a.id))add(e,"INVALID_OR_DUPLICATE_ACTION_ID",at);actions.set(a.id,a);
 if(!KNOWLEDGE.has(a.knowledge_status))add(e,"INVALID_KNOWLEDGE_STATUS",at);
 const unresolved=a.knowledge_status==="unresolved";
 if(unresolved&&!text(a.reason))add(e,"UNRESOLVED_REASON_REQUIRED",at);
 if(own(a,"reason")&&!text(a.reason))add(e,"INVALID_REASON",at);
 refs(a.source_refs,source,e,at+".source_refs",!unresolved);
 if(!unresolved||own(a,"entry_path"))if(!entryPath(a.entry_path))add(e,"INVALID_ENTRY_PATH",at);
 if(!unresolved||own(a,"locator"))locator(a.locator,e,at+".locator");
 if(own(a,"controls")){
  if(!Array.isArray(a.controls))add(e,"CONTROLS_ARRAY_REQUIRED",at+".controls");
  else{const ids=new Set();a.controls.forEach((control,j)=>{
   const where=at+".controls["+j+"]";
   if(!shape(control,["id","locator","source_refs"],["id","locator","source_refs"],e,where))return;
   if(!text(control.id)||ids.has(control.id))add(e,"INVALID_OR_DUPLICATE_CONTROL_ID",where);
   ids.add(control.id);
   locator(control.locator,e,where+".locator");
   refs(control.source_refs,source,e,where+".source_refs",true);
  });}
 }
 if(!unresolved||own(a,"fallback_locators")){if(!Array.isArray(a.fallback_locators))add(e,"FALLBACK_ARRAY_REQUIRED",at);else a.fallback_locators.forEach((v,j)=>locator(v,e,at+".fallback_locators["+j+"]"));}
 if(!unresolved||own(a,"waits"))waits(a.waits,e,at+".waits");
 if(!unresolved||own(a,"observation"))if(shape(a.observation,["kind","locator"],["kind","locator"],e,at+".observation")){
 if(!["ui","dom"].includes(a.observation.kind))add(e,"INVALID_OBSERVATION_KIND",at);locator(a.observation.locator,e,at+".observation.locator");}
 if(!unresolved||own(a,"data_effect"))if(!["read_only","mutation"].includes(a.data_effect))add(e,"INVALID_DATA_EFFECT",at);
 if(!unresolved||own(a,"setup"))if(shape(a.setup,["status","instructions"],["status","instructions"],e,at+".setup")){
 if(!["not_required","runtime_confirmation_required"].includes(a.setup.status))add(e,"INVALID_SETUP_STATUS",at);if(!text(a.setup.instructions))add(e,"SETUP_INSTRUCTIONS_REQUIRED",at);}
 if(!unresolved&&!own(a,"cleanup"))add(e,"CLEANUP_FIELD_REQUIRED",at);
 if(a.data_effect==="mutation"&&!unresolved&&a.cleanup===null)add(e,"MUTATION_CLEANUP_REQUIRED",at);
 if(a.cleanup!==undefined&&a.cleanup!==null)if(shape(a.cleanup,["entry_path","locator","target_identity","restore_instructions","post_cleanup_waits"],["entry_path","locator","target_identity","restore_instructions","post_cleanup_waits"],e,at+".cleanup")){
 if(!entryPath(a.cleanup.entry_path))add(e,"INVALID_ENTRY_PATH",at+".cleanup");
 locator(a.cleanup.locator,e,at+".cleanup.locator");
 if(!text(a.cleanup.target_identity)||!text(a.cleanup.restore_instructions))add(e,"CLEANUP_IDENTITY_AND_RESTORE_REQUIRED",at);
 waits(a.cleanup.post_cleanup_waits,e,at+".cleanup.post_cleanup_waits",true);}
 });return actions;
}
function validateBindings(values,imported,actions,authReady,e){
 const statuses=[];if(!Array.isArray(values)||!values.length){add(e,"CASE_BINDINGS_REQUIRED");return statuses;}
 if(imported&&values.length!==imported.cases.length)add(e,"CASE_BINDING_COUNT_MISMATCH");
 const ids=new Set();values.forEach((b,i)=>{const at="case_bindings["+i+"]";if(!shape(b,["case_id","steps"],["case_id","steps"],e,at))return;
 if(!text(b.case_id)||ids.has(b.case_id))add(e,"INVALID_OR_DUPLICATE_CASE_ID",at);ids.add(b.case_id);
 const original=imported?.cases[i];if(original&&b.case_id!==original.case_id)add(e,"CASE_ORDER_OR_ID_MISMATCH",at);
 let blocked=!authReady,runtime=false;
 if(!Array.isArray(b.steps)||!b.steps.length){add(e,"CASE_STEPS_REQUIRED",at);blocked=true;}
 else{if(original&&b.steps.length!==original.steps.length)add(e,"STEP_BINDING_COUNT_MISMATCH",at);const ids=new Set();
 b.steps.forEach((s,j)=>{const where=at+".steps["+j+"]";if(!shape(s,["step_id","action_id","status","reason"],["step_id","action_id","status"],e,where)){blocked=true;return;}
 if(!text(s.step_id)||ids.has(s.step_id))add(e,"INVALID_OR_DUPLICATE_STEP_ID",where);ids.add(s.step_id);
 if(original?.steps[j]&&s.step_id!==original.steps[j].step_id)add(e,"STEP_ORDER_OR_ID_MISMATCH",where);
 if(!["mapped","unresolved","out_of_scope"].includes(s.status))add(e,"INVALID_STEP_STATUS",where);
 if(own(s,"reason")&&!text(s.reason))add(e,"INVALID_REASON",where);
 if(s.status==="mapped"){if(!text(s.action_id)||!actions.has(s.action_id)){add(e,"ACTION_BINDING_UNRESOLVED",where);blocked=true;return;}
 const a=actions.get(s.action_id);if(a.knowledge_status==="unresolved")blocked=true;if(a.setup?.status==="runtime_confirmation_required")runtime=true;}
 else{blocked=true;if(s.action_id!==null||!text(s.reason))add(e,"UNRESOLVED_STEP_REASON_OR_NULL_REQUIRED",where);}});
 }
 statuses.push({case_id:b.case_id,status:blocked?"BLOCKED_SOURCE":runtime?"RUNTIME_CONFIRMATION_REQUIRED":"SUPPORTED",reason:blocked?"Source or mapping conditions remain unresolved.":runtime?"This Case requires runtime setup confirmation.":"Technical binding is supported; runtime DOM and original business assertions remain required."});
 });return statuses;
}
function under(root,target){const r=path.relative(root,target);return r===""||(!r.startsWith(".."+path.sep)&&r!==".."&&!path.isAbsolute(r));}
function samePath(a,b){return process.platform==="win32"?a.toLowerCase()===b.toLowerCase():a===b;}
async function sourceBase(value){
 if(typeof value!=="string"||!value)fail("SOURCE_ROOT_REQUIRED");
 const root=path.resolve(value),stat=await fs.lstat(root);
 if(!stat.isDirectory()||stat.isSymbolicLink())fail("SOURCE_ROOT_UNSAFE");
 if(!samePath(path.resolve(await fs.realpath(root)),root))fail("SOURCE_ROOT_LINK_REJECTED");
 return root;
}
async function safeTarget(root,relative){
 if(!safeRelative(relative,true))fail("UNSAFE_SOURCE_PATH");
 let current=root;if(relative===".")return current;
 for(const part of relative.split("/")){current=path.join(current,part);if(!under(root,current))fail("SOURCE_PATH_ESCAPE");if((await fs.lstat(current)).isSymbolicLink())fail("SOURCE_LINK_REJECTED");}
 const real=await fs.realpath(current);if(!under(root,real)||!samePath(path.resolve(real),current))fail("SOURCE_LINK_REJECTED");
 return current;
}
async function scanScope(sourceRoot,scopes){
 const root=await sourceBase(sourceRoot),found=new Map();
 if(!Array.isArray(scopes)||!scopes.length||scopes.some(v=>!safeRelative(v,true)))fail("SOURCE_SCOPE_REQUIRED");
 const visit=async absolute=>{
 const stat=await fs.lstat(absolute);if(stat.isSymbolicLink())fail("SOURCE_LINK_REJECTED");
 if(stat.isDirectory()){for(const entry of(await fs.readdir(absolute,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
 if(entry.name.startsWith(".")||entry.name==="node_modules")continue;
 const next=path.join(absolute,entry.name);if(!under(root,next))fail("SOURCE_PATH_ESCAPE");if(entry.isSymbolicLink())fail("SOURCE_LINK_REJECTED");await visit(next);}}
 else if(stat.isFile()){if(found.size>=10000)fail("SOURCE_FILE_LIMIT");const relative=path.relative(root,absolute).split(path.sep).join("/");if(!safeRelative(relative))fail("UNSAFE_SOURCE_PATH");found.set(relative,absolute);}
 else fail("SOURCE_SPECIAL_FILE_REJECTED");};
 for(const scope of scopes)await visit(await safeTarget(root,scope));
 return{root,found};
}
async function verifyDisk(source,sourceRoot,e,fill=false){
 try{
 const {root,found}=await scanScope(sourceRoot,source.scope_roots);
 if(!Array.isArray(source.files)){add(e,"SOURCE_FILES_REQUIRED");return false;}
 const declared=source.files.map(f=>record(f)?f.path:null);
 if(new Set(declared).size!==declared.length||declared.length!==found.size||declared.some(p=>!found.has(p))){add(e,"SOURCE_FILE_SET_MISMATCH");return false;}
 for(let i=0;i<source.files.length;i++){
 const f=source.files[i],at="source.files["+i+"]";await safeTarget(root,f.path);const bytes=await fs.readFile(found.get(f.path)),sha=digest(bytes);
 if(fill){if(own(f,"sha256")&&f.sha256!==sha)add(e,"SOURCE_DIGEST_MISMATCH",at);if(own(f,"size_bytes")&&f.size_bytes!==bytes.length)add(e,"SOURCE_SIZE_MISMATCH",at);f.sha256=sha;f.size_bytes=bytes.length;}
 else if(f.sha256!==sha||f.size_bytes!==bytes.length)add(e,"SOURCE_CONTENT_MISMATCH",at);
 if(!Array.isArray(f.anchors)){add(e,"SOURCE_ANCHORS_REQUIRED",at);continue;}
 const lines=bytes.toString("utf8").split(/\r?\n/);
 for(let j=0;j<f.anchors.length;j++){const a=f.anchors[j],where=at+".anchors["+j+"]";
 if(!record(a)||!Number.isInteger(a.line)||a.line<1||a.line>lines.length||!text(lines[a.line-1])){add(e,"SOURCE_ANCHOR_UNRESOLVED",where);continue;}
 const statement=lines[a.line-1];
 if(fill){if(own(a,"statement")&&a.statement!==statement)add(e,"SOURCE_ANCHOR_MISMATCH",where);a.statement=statement;}
 else if(a.statement!==statement)add(e,"SOURCE_ANCHOR_MISMATCH",where);
 }}
 return e.length===0;
 }catch(error){const allowed=new Set(["SOURCE_ROOT_REQUIRED","SOURCE_ROOT_UNSAFE","SOURCE_ROOT_LINK_REJECTED","UNSAFE_SOURCE_PATH","SOURCE_PATH_ESCAPE","SOURCE_LINK_REJECTED","SOURCE_SCOPE_REQUIRED","SOURCE_FILE_LIMIT","SOURCE_SPECIAL_FILE_REJECTED"]);add(e,allowed.has(error?.code)?error.code:"SOURCE_SCAN_UNAVAILABLE");return false;}
}


/** Validates technical bindings; source behavior never becomes a business oracle. */
export async function validateCaseHandoff(handoff,{caseImportBytes,sourceRoot}={}){
 const errors=[];let sha256=null,caseStatuses=[],baselineVerified=false,sourceVerified=false;
 try{
 checkJson(handoff,errors);
 if(errors.length)return{valid:false,status:"INVALID",errors,case_statuses:[],sha256,baseline_verified:false,source_verified:false};
 if(!shape(handoff,["artifact_type","schema_version","artifact_id","case_import_sha256","source","authentication","actions","case_bindings","integrity"],["artifact_type","schema_version","artifact_id","case_import_sha256","source","authentication","actions","case_bindings","integrity"],errors,"$"))throw new Error("invalid");
 if(handoff.artifact_type!==TYPE||handoff.schema_version!==VERSION||!text(handoff.artifact_id))add(errors,"INVALID_ARTIFACT_HEADER");
 if(typeof handoff.case_import_sha256!=="string"||!HASH.test(handoff.case_import_sha256))add(errors,"INVALID_CASE_IMPORT_DIGEST");
 sha256=contentDigest(handoff);
 if(!shape(handoff.integrity,["content_sha256"],["content_sha256"],errors,"integrity")||handoff.integrity.content_sha256!==sha256)add(errors,"INTEGRITY_MISMATCH");
 let imported;
 if(caseImportBytes!==undefined){imported=baseline(caseImportBytes,errors);if(imported&&digest(Buffer.from(caseImportBytes))!==handoff.case_import_sha256)add(errors,"CASE_IMPORT_DIGEST_MISMATCH");else if(imported)baselineVerified=true;}
 const source=validateSource(handoff.source,errors);
 const authReady=validateAuthentication(handoff.authentication,source,errors);
 const actions=validateActions(handoff.actions,source,errors);
 caseStatuses=validateBindings(handoff.case_bindings,imported,actions,authReady,errors);
 if(sourceRoot!==undefined&&errors.length===0)sourceVerified=await verifyDisk(handoff.source,sourceRoot,errors);
 }catch{add(errors,"VALIDATION_FAILED");}
 const valid=errors.length===0;
 return{valid,status:!valid?"INVALID":!baselineVerified||caseStatuses.some(c=>c.status!=="SUPPORTED")?"PARTIAL":"SOURCE_READY",errors,case_statuses:caseStatuses,sha256,baseline_verified:baselineVerified&&valid,source_verified:sourceVerified&&valid};
}
/** Creates a draft with complete original Case/step order, without readiness claims. */
export async function prepareCaseHandoff(caseImportBytes,{revision}={}){
 const errors=[],imported=baseline(caseImportBytes,errors);
 if(!text(revision))add(errors,"SOURCE_REVISION_REQUIRED");
 if(errors.length)fail("PREPARE_INVALID_INPUT",errors);
 return{artifact_type:TYPE,schema_version:VERSION,artifact_id:crypto.randomUUID(),case_import_sha256:digest(Buffer.from(caseImportBytes)),
 source:{revision,scope_roots:[],files:[]},
 authentication:{knowledge_status:"unresolved",mode:"manual_headed",source_refs:[],reason:"Inspect the declared source and identify safe authentication locators."},
 actions:[],case_bindings:imported.cases.map(c=>({case_id:c.case_id,steps:c.steps.map(s=>({step_id:s.step_id,action_id:null,status:"unresolved",reason:"Technical source mapping has not been inspected."}))}))};
}
/** Seals declared facts after exact scope rescan; inputs and source are not changed. */
export async function sealCaseHandoff(draft,{caseImportBytes,sourceRoot}={}){
 const errors=[];checkJson(draft,errors);const imported=baseline(caseImportBytes,errors);
 if(!record(draft)||!record(draft.source))add(errors,"DRAFT_SOURCE_REQUIRED");
 if(errors.length||!imported)fail("SEAL_INVALID_INPUT",errors);
 const result=JSON.parse(JSON.stringify(draft));delete result.integrity;
 const hash=digest(Buffer.from(caseImportBytes));
 if(own(result,"case_import_sha256")&&result.case_import_sha256!==hash)fail("SEAL_INVALID_INPUT",["CASE_IMPORT_DIGEST_MISMATCH"]);
 result.case_import_sha256=hash;
 await verifyDisk(result.source,sourceRoot,errors,true);
 if(errors.length)fail("SEAL_SOURCE_INVALID",errors);
 result.integrity={content_sha256:contentDigest(result)};
 const validation=await validateCaseHandoff(result,{caseImportBytes,sourceRoot});
 if(!validation.valid)fail("SEAL_INVALID_INPUT",validation.errors);
 return result;
}
async function readJsonFile(filename){
 const bytes=await fs.readFile(filename);if(bytes.length>MAX_BYTES)fail("INPUT_TOO_LARGE");
 try{return JSON.parse(bytes.toString("utf8"));}catch{fail("INPUT_INVALID_JSON");}
}
async function writeNew(filename,value,inputs){
 const absolute=path.resolve(filename);
 if(inputs.some(input=>samePath(path.resolve(input),absolute)))fail("OUTPUT_MUST_DIFFER_FROM_INPUT");
 const handle=await fs.open(absolute,"wx");
 try{await handle.writeFile(JSON.stringify(value,null,2)+"\n","utf8");}finally{await handle.close();}
}
async function cli(args){
 const [command,...rest]=args;
 const allowed=command==="prepare"?["--cases","--source-root","--revision","--out"]:command==="seal"?["--draft","--cases","--source-root","--out"]:command==="validate"?["--handoff","--cases","--source-root"]:[];
 const options={};if(!allowed.length||rest.length%2)fail("INVALID_CLI_ARGUMENTS");
 for(let i=0;i<rest.length;i+=2){if(!allowed.includes(rest[i])||own(options,rest[i])||!text(rest[i+1])||rest[i+1].startsWith("--"))fail("INVALID_CLI_ARGUMENTS");options[rest[i]]=rest[i+1];}
 if(command==="prepare"){
 if(allowed.some(k=>!options[k]))fail("MISSING_CLI_ARGUMENT");await sourceBase(options["--source-root"]);
 const bytes=await fs.readFile(options["--cases"]),draft=await prepareCaseHandoff(bytes,{revision:options["--revision"]});
 await writeNew(options["--out"],draft,[options["--cases"]]);console.log(JSON.stringify({status:"DRAFT",case_count:draft.case_bindings.length,case_import_sha256:draft.case_import_sha256}));return 0;
 }
 if(command==="seal"){
 if(allowed.some(k=>!options[k]))fail("MISSING_CLI_ARGUMENT");
 const bytes=await fs.readFile(options["--cases"]),sealed=await sealCaseHandoff(await readJsonFile(options["--draft"]),{caseImportBytes:bytes,sourceRoot:options["--source-root"]});
 const validation=await validateCaseHandoff(sealed,{caseImportBytes:bytes,sourceRoot:options["--source-root"]});
 await writeNew(options["--out"],sealed,[options["--cases"],options["--draft"]]);console.log(JSON.stringify(validation));return validation.status==="SOURCE_READY"?0:3;
 }
 if(!options["--handoff"])fail("MISSING_CLI_ARGUMENT");
 const validation=await validateCaseHandoff(await readJsonFile(options["--handoff"]),{...(options["--cases"]?{caseImportBytes:await fs.readFile(options["--cases"])}:{}),...(options["--source-root"]?{sourceRoot:options["--source-root"]}:{})});
 console.log(JSON.stringify(validation));return !validation.valid?1:validation.status==="SOURCE_READY"?0:3;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{process.exitCode=await cli(process.argv.slice(2));}
 catch(error){const codes=new Set(["PREPARE_INVALID_INPUT","SEAL_INVALID_INPUT","SEAL_SOURCE_INVALID","INPUT_TOO_LARGE","INPUT_INVALID_JSON","OUTPUT_MUST_DIFFER_FROM_INPUT","INVALID_CLI_ARGUMENTS","MISSING_CLI_ARGUMENT","SOURCE_ROOT_REQUIRED","SOURCE_ROOT_UNSAFE","SOURCE_ROOT_LINK_REJECTED"]);console.log(JSON.stringify({valid:false,status:"INVALID",errors:codes.has(error?.code)?[error.code,...(error.errors||[])]:["HANDOFF_IO_OR_EXECUTION_FAILED"]}));process.exitCode=1;}
}

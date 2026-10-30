// Diagnostic-only clone. Never replaces an installed or production worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source=fileURLToPath(new URL('../../server/requirements/office-word-reader.cs',import.meta.url));
let text=(await fs.readFile(source,'utf8')).replace(/\r\n/g,'\n');
const replace=(a,b)=>{if(text.split(a).length!==2)throw Error('DIAGNOSTIC_PREIMAGE_MISMATCH');text=text.replace(a,b);};
replace('    [STAThread]',`    static string TracePhase="INITIALIZE";
    static Dictionary<string,object> TraceContext=new Dictionary<string,object>();
    static Dictionary<string,object> Technical(Exception error) {
        var chain=new List<Dictionary<string,object>>();
        for(Exception e=error;e!=null && chain.Count<4;e=e.InnerException)chain.Add(new Dictionary<string,object>{{"type",e.GetType().FullName},{"hresult",e.HResult},{"hresult_hex","0x"+unchecked((uint)e.HResult).ToString("X8")}});
        string category=error.Message.IndexOf("maxJsonLength",StringComparison.OrdinalIgnoreCase)>=0?"JSON_LENGTH_LIMIT":error.Message.IndexOf("RecursionLimit",StringComparison.OrdinalIgnoreCase)>=0?"JSON_RECURSION_LIMIT":"NATIVE_EXCEPTION";
        return new Dictionary<string,object>{{"category",category},{"exceptions",chain},{"stack",error.StackTrace??""}};
    }
    [STAThread]`);
replace('        try {\n            string command=', '        try {\n            TracePhase="ARGUMENTS";\n            string command=');
replace('            var checks=new List<Dictionary<string,object>>();var registrations=', '            TracePhase="APPLICATION_REGISTRATION";\n            var checks=new List<Dictionary<string,object>>();TraceContext["checks"]=checks;var registrations=');
replace('            if(command=="probe") {','            if(command=="probe") {\n                TracePhase="PROBE_SERIALIZATION";');
replace('            string input=Path.GetFullPath(Arg(args,"--input"));','            TracePhase="INPUT_PATH";\n            string input=Path.GetFullPath(Arg(args,"--input"));\n            TracePhase="INPUT_FILE_CHECK";TraceContext["input_exists"]=File.Exists(input);TraceContext["input_extension"]=Path.GetExtension(input);');
replace('                result=Read(input,owner,r);','                TracePhase="READ_PROVIDER";TraceContext["selected_provider"]=r.progid;\n                result=Read(input,owner,r);\n                TracePhase="READ_RESULT_ASSEMBLY";');
replace('            result["attempts"]=attempts;Console.WriteLine(Json.Serialize(result));return 0;', '            result["attempts"]=attempts;TracePhase="RESULT_SERIALIZATION";Console.WriteLine(Json.Serialize(result));return 0;');
replace('result["hresult"]=error.HResult;result["provider"]=registration.progid;', 'result["hresult"]=error.HResult;result["technical"]=Technical(error);result["provider"]=registration.progid;');
replace('        }catch {\n            Console.WriteLine(Json.Serialize(Failure("REQUIREMENT_OFFICE_OPEN_FAILED")));return args.Length>0 && args[0]=="cleanup"?1:0;',`        }catch(Exception error) {
            var result=Failure("REQUIREMENT_OFFICE_OPEN_FAILED");result["phase"]=TracePhase;result["technical"]=Technical(error);result["diagnostic"]=TraceContext;result["diagnostic_revision"]="office-trace-20261030-1";
            Console.WriteLine(Json.Serialize(result));return args.Length>0 && args[0]=="cleanup"?1:0;`);
const cs=path.join(dir,'OfficeReaderTrace.cs'),exe=path.join(dir,'OfficeReaderTrace.exe');await fs.writeFile(cs,text);
await promisify(execFile)(path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/platform:x64','/optimize+','/reference:Microsoft.CSharp.dll','/reference:System.Web.Extensions.dll',`/out:${exe}`,cs],{windowsHide:true,timeout:30000});
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest={schema:'office-field-diagnostic/v1',revision:'office-trace-20261030-1',original_source_sha256:hash(await fs.readFile(source)),diagnostic_source_sha256:hash(Buffer.from(text)),exe_sha256:hash(await fs.readFile(exe)),production_modified:false};
await fs.writeFile(path.join(dir,'trace-build.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest));

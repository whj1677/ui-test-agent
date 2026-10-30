using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using System.Text.RegularExpressions;
using System.ComponentModel;

internal static class OfficeWordReader {
    static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 24 * 1024 * 1024, RecursionLimit = 32 };
    [DllImport("ole32.dll", PreserveSig=false)] static extern void CoCreateInstance(ref Guid clsid,IntPtr outer,uint context,ref Guid iid,[MarshalAs(UnmanagedType.IDispatch)] out object instance);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool Process32FirstW(IntPtr snapshot,ref Entry entry);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool Process32NextW(IntPtr snapshot,ref Entry entry);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Entry {
        public uint size,usage,pid;public UIntPtr heap;public uint module,threads,parent;public int priority;public uint flags;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string file;
    }
    internal sealed class Identity { public Identity(){} public int pid;public int parent;public string name,started,image; }
    internal sealed class Registration { public string progid,process;public Guid clsid;public int registry_view; }
    static string Arg(string[] args, string name) { int n = Array.IndexOf(args, name); return n >= 0 && n + 1 < args.Length ? args[n + 1] : null; }
    static bool OfficeProcess(string name) { return String.Equals(name,"WINWORD",StringComparison.OrdinalIgnoreCase) || String.Equals(name,"wps",StringComparison.OrdinalIgnoreCase); }
    static Dictionary<string,object> Failure(string code) { return new Dictionary<string,object> { {"status","FAILED"},{"code",code} }; }
    static bool Cleanup(string owner) {
        var values=Json.Deserialize<List<Identity>>(File.ReadAllText(owner,Encoding.UTF8));
        bool cleaned=true;
        foreach(var value in values)try {
            using(Process process=Process.GetProcessById(value.pid)) {
                IntPtr held=process.Handle;
                if(OfficeProcess(process.ProcessName) && String.Equals(process.ProcessName,value.name,StringComparison.OrdinalIgnoreCase) && process.StartTime.ToUniversalTime().Ticks.ToString()==value.started && String.Equals(process.MainModule.FileName,value.image,StringComparison.OrdinalIgnoreCase)){process.Kill();cleaned=process.WaitForExit(1000)&&cleaned;}else cleaned=false;
            }
        } catch(ArgumentException) { } catch(InvalidOperationException) { }
        return cleaned;
    }
    static void Add(List<Dictionary<string,object>> rows,ref int characters,string kind,Dictionary<string,object> location,string raw) {
        string text=(raw??"").Trim('\r','\a','\n','\0',' ');
        if(text.Length==0)return;
        characters+=text.Length;
        if(rows.Count>=20000 || characters>2000000)throw new Exception("REQUIREMENT_OFFICE_LIMIT");
        rows.Add(new Dictionary<string,object> { {"kind",kind},{"location",location},{"text",text} });
    }
    static Dictionary<string,object> Collect(dynamic document,string provider) {
            var rows=new List<Dictionary<string,object>>();int characters=0;
            int count=document.Paragraphs.Count;
            for(int n=1;n<=count;n++) {
                dynamic paragraph=document.Paragraphs[n];
                if(!(bool)paragraph.Range.Information[12])Add(rows,ref characters,"paragraph",new Dictionary<string,object>{{"paragraph",n}},(string)paragraph.Range.Text);
            }
            int tables=document.Tables.Count;
            for(int t=1;t<=tables;t++) {
                dynamic table=document.Tables[t];int cells=table.Range.Cells.Count;
                for(int c=1;c<=cells;c++)Add(rows,ref characters,"table_cell",new Dictionary<string,object>{{"table",t},{"cell",c}},(string)table.Range.Cells[c].Range.Text);
            }
            if(rows.Count==0)throw new Exception("REQUIREMENT_OFFICE_EMPTY");
            return new Dictionary<string,object>{{"status","PARTIAL"},{"provider",provider},{"segments",rows}};
    }
    internal static Registration Resolve(string progid,Func<int,string,string,string> value,List<Dictionary<string,object>> checks) {
        foreach(int bits in new[]{64,32}) {
            var check=new Dictionary<string,object>{{"progid",progid},{"registry_view",bits},{"status","not_found"}};checks.Add(check);
            try {
                string clsid=value(bits,progid+@"\CLSID","");
                if(clsid==null) {string current=value(bits,progid+@"\CurVer","");if(current!=null)clsid=value(bits,current+@"\CLSID","");}
                if(clsid==null)continue;
                Guid id=new Guid(clsid);check["status"]="server_missing";
                string key=@"CLSID\"+id.ToString("B")+@"\LocalServer32",command=value(bits,key,"");
                if(command==null)continue;
                string server=value(bits,key,"ServerExecutable")??command;
                Match match=Regex.Match(server,@"(?:^|[\\/])([^\\/""\s]+)\.exe(?:""|\s|$)",RegexOptions.IgnoreCase);
                if(!match.Success || !OfficeProcess(match.Groups[1].Value)){check["status"]="unrecognized_server";continue;}
                check["status"]="registered";
                return new Registration{progid=progid,clsid=id,process=match.Groups[1].Value,registry_view=bits};
            }catch(UnauthorizedAccessException){check["status"]="permission_denied";throw;}
             catch(System.Security.SecurityException){check["status"]="permission_denied";throw;}
             catch(FormatException){check["status"]="registration_error";}
        }
        return null;
    }
    static string RegistryValue(int bits,string path,string name) {
        using(var root=RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot,bits==64?RegistryView.Registry64:RegistryView.Registry32))
        using(var key=root.OpenSubKey(path))return key==null?null:key.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
    }
    static List<Identity> Processes(string name) {
        var parents=new Dictionary<int,int>();IntPtr snapshot=CreateToolhelp32Snapshot(2,0);
        if(snapshot==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            var entry=new Entry{size=(uint)Marshal.SizeOf(typeof(Entry))};bool more=Process32FirstW(snapshot,ref entry);
            if(!more)throw new Win32Exception(Marshal.GetLastWin32Error());
            do {parents[(int)entry.pid]=(int)entry.parent;}while(Process32NextW(snapshot,ref entry));
        }finally{CloseHandle(snapshot);}
        var found=new List<Identity>();
        foreach(var p in Process.GetProcessesByName(name))using(p)try {
            found.Add(new Identity{pid=p.Id,parent=parents.ContainsKey(p.Id)?parents[p.Id]:-1,name=p.ProcessName,started=p.StartTime.ToUniversalTime().Ticks.ToString(),image=p.MainModule.FileName});
        }catch(InvalidOperationException) { }
        return found;
    }
    internal static List<Identity> OwnedGroup(List<Identity> before,List<Identity> after,int documents) {
        var earlier=new HashSet<string>(before.Select(p=>p.pid+":"+p.started));
        var created=after.Where(p=>!earlier.Contains(p.pid+":"+p.started)).ToList();
        var ids=new HashSet<int>(created.Select(p=>p.pid));
        if(created.Count==0 || created.Count(p=>!ids.Contains(p.parent))!=1 || documents!=0)throw new Exception("REQUIREMENT_OFFICE_BUSY");
        // Reject cycles or disconnected descendants, even if there is one root.
        var reached=new HashSet<int>(created.Where(p=>!ids.Contains(p.parent)).Select(p=>p.pid));
        bool changed;do {int old=reached.Count;foreach(var p in created)if(reached.Contains(p.parent))reached.Add(p.pid);changed=reached.Count!=old;}while(changed);
        if(reached.Count!=created.Count)throw new Exception("REQUIREMENT_OFFICE_BUSY");
        return created;
    }
    internal static void Secure(dynamic app) {
        app.AutomationSecurity=3;
        if(Convert.ToInt32(app.AutomationSecurity)!=3)throw new Exception("REQUIREMENT_OFFICE_SAFE_MODE_UNSUPPORTED");
    }
    static Dictionary<string,object> Read(string input,string owner,Registration registration) {
        dynamic app=null,document=null;bool owned=false;object priorLinks=null;string phase="CREATE_INSTANCE";
        var diagnostic=new Dictionary<string,object>{{"registry_view",registration.registry_view}};
        try {
            var before=Processes(registration.process);diagnostic["office_processes_before"]=before.Count;
            Guid clsid=registration.clsid,iid=new Guid("00020400-0000-0000-C000-000000000046");object instance;
            CoCreateInstance(ref clsid,IntPtr.Zero,4,ref iid,out instance);app=instance;
            var after=Processes(registration.process);int count=app.Documents.Count;
            diagnostic["document_count"]=count;
            List<Identity> group;
            try{group=OwnedGroup(before,after,count);}catch{diagnostic["busy_reason"]="INDEPENDENT_EMPTY_PROCESS_GROUP_UNCONFIRMED";throw;}
            File.WriteAllText(owner,Json.Serialize(group),new UTF8Encoding(false));owned=true;
            diagnostic["owned_process_count"]=group.Count;
            phase="READONLY_SECURITY";Secure(app);
            app.Visible=false;app.DisplayAlerts=0;
            priorLinks=app.Options.UpdateLinksAtOpen;app.Options.UpdateLinksAtOpen=false;
            if(Convert.ToBoolean(app.Options.UpdateLinksAtOpen))throw new Exception("REQUIREMENT_OFFICE_SAFE_MODE_UNSUPPORTED");
            phase="OPEN_DOCUMENT";
            document=app.Documents.Open(input,false,true,false,"","",false,"","",0,0,false,false);
            if(!(bool)document.ReadOnly || !String.Equals(Path.GetFullPath((string)document.FullName),input,StringComparison.OrdinalIgnoreCase))throw new Exception("REQUIREMENT_OFFICE_PERMISSION_DENIED");
            phase="EXTRACT_DOCUMENT";
            var result=Collect(document,String.Equals(registration.process,"wps",StringComparison.OrdinalIgnoreCase)?"wps":"microsoft-word");
            result["diagnostic"]=diagnostic;return result;
        }catch(Exception error) {
            string code=error.Message;
            string[] allowed={"REQUIREMENT_OFFICE_BUSY","REQUIREMENT_OFFICE_PERMISSION_DENIED","REQUIREMENT_OFFICE_EMPTY","REQUIREMENT_OFFICE_LIMIT","REQUIREMENT_OFFICE_SAFE_MODE_UNSUPPORTED"};
            if(!allowed.Contains(code))code=error is UnauthorizedAccessException || error is System.Security.SecurityException || error.HResult==unchecked((int)0x80070005)?"REQUIREMENT_OFFICE_PERMISSION_DENIED":"REQUIREMENT_OFFICE_OPEN_FAILED";
            var result=Failure(code);result["phase"]=phase;result["hresult"]=error.HResult;result["technical"]=Technical(error);result["provider"]=registration.progid;result["diagnostic"]=diagnostic;return result;
        }finally {
            if(owned) {
                if(document!=null)try{document.Close(0);}catch{}
                if(app!=null && priorLinks!=null)try{app.Options.UpdateLinksAtOpen=priorLinks;}catch{}
                if(app!=null)try{app.Quit(0);}catch{}
                // Do not start another candidate until this group is cleaned up.
                try{if(Cleanup(owner))File.Delete(owner);}catch{}
            }
            foreach(object value in new object[]{document,app})if(value!=null && Marshal.IsComObject(value))try{Marshal.FinalReleaseComObject(value);}catch{}
        }
    }
    static string TracePhase="INITIALIZE";
    static Dictionary<string,object> TraceContext=new Dictionary<string,object>();
    static Dictionary<string,object> Technical(Exception error) {
        var chain=new List<Dictionary<string,object>>();
        for(Exception e=error;e!=null && chain.Count<4;e=e.InnerException)chain.Add(new Dictionary<string,object>{{"type",e.GetType().FullName},{"hresult",e.HResult},{"hresult_hex","0x"+unchecked((uint)e.HResult).ToString("X8")}});
        string category=error.Message.IndexOf("maxJsonLength",StringComparison.OrdinalIgnoreCase)>=0?"JSON_LENGTH_LIMIT":error.Message.IndexOf("RecursionLimit",StringComparison.OrdinalIgnoreCase)>=0?"JSON_RECURSION_LIMIT":"NATIVE_EXCEPTION";
        return new Dictionary<string,object>{{"category",category},{"exceptions",chain},{"stack",error.StackTrace??""}};
    }
    [STAThread]
    public static int Main(string[] args) {
        // A GUI-subsystem helper reads in the background. Write UTF-8 to
        // the inherited pipe without requiring an attached console.
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true});
        try {
            TracePhase="ARGUMENTS";
            string command=args.Length>0?args[0]:"",owner=Arg(args,"--owner");
            if(command=="cleanup"){return Cleanup(owner)?0:1;}
            string provider=Arg(args,"--provider")??"auto";
            if(!new[]{"auto","word","wps"}.Contains(provider))throw new Exception("REQUIREMENT_OFFICE_OPEN_FAILED");
            var ids=new List<string>();
            if(provider!="wps"){ids.Add("Word.Application");}
            if(provider!="word"){ids.Add("KWPS.Application");ids.Add("WPS.Application");}
            TracePhase="APPLICATION_REGISTRATION";
            var checks=new List<Dictionary<string,object>>();TraceContext["checks"]=checks;var registrations=new List<Registration>();var seen=new HashSet<Guid>();
            try {foreach(string id in ids){var r=Resolve(id,RegistryValue,checks);if(r!=null && seen.Add(r.clsid))registrations.Add(r);}}
            catch(UnauthorizedAccessException){var denied=Failure("REQUIREMENT_OFFICE_PERMISSION_DENIED");denied["phase"]="APPLICATION_REGISTRATION";denied["checks"]=checks;Console.WriteLine(Json.Serialize(denied));return 0;}
            catch(System.Security.SecurityException){var denied=Failure("REQUIREMENT_OFFICE_PERMISSION_DENIED");denied["phase"]="APPLICATION_REGISTRATION";denied["checks"]=checks;Console.WriteLine(Json.Serialize(denied));return 0;}
            if(command=="probe") {
                TracePhase="PROBE_SERIALIZATION";
                Console.WriteLine(Json.Serialize(new{word=registrations.Any(r=>r.process.Equals("WINWORD",StringComparison.OrdinalIgnoreCase)),wps=registrations.Any(r=>r.process.Equals("wps",StringComparison.OrdinalIgnoreCase)),process_bits=IntPtr.Size*8,checks=checks}));return 0;
            }
            TracePhase="INPUT_PATH";
            string input=Path.GetFullPath(Arg(args,"--input"));
            TracePhase="INPUT_FILE_CHECK";TraceContext["input_exists"]=File.Exists(input);TraceContext["input_extension"]=Path.GetExtension(input);
            if(command!="read" || !File.Exists(input) || !String.Equals(Path.GetExtension(input),".docx",StringComparison.OrdinalIgnoreCase))throw new Exception("REQUIREMENT_OFFICE_OPEN_FAILED");
            Dictionary<string,object> result=Failure("REQUIREMENT_OFFICE_REQUIRED");result["phase"]="APPLICATION_REGISTRATION";
            var attempts=new List<Dictionary<string,object>>();
            foreach(var r in registrations) {
                TracePhase="READ_PROVIDER";TraceContext["selected_provider"]=r.progid;
                result=Read(input,owner,r);
                TracePhase="READ_RESULT_ASSEMBLY";
                var attempt=new Dictionary<string,object>{{"provider",r.progid},{"status",result["status"]}};
                foreach(string field in new[]{"code","phase","hresult","diagnostic"})if(result.ContainsKey(field))attempt[field]=result[field];
                attempts.Add(attempt);
                if(Convert.ToString(result["status"])=="PARTIAL" || (result.ContainsKey("code") && Convert.ToString(result["code"])=="REQUIREMENT_OFFICE_PERMISSION_DENIED"))break;
                if(File.Exists(owner))break;
            }
            result["checks"]=checks;
            result["attempts"]=attempts;TracePhase="RESULT_SERIALIZATION";Console.WriteLine(Json.Serialize(result));return 0;
        }catch(Exception error) {
            var result=Failure("REQUIREMENT_OFFICE_OPEN_FAILED");result["phase"]=TracePhase;result["technical"]=Technical(error);result["diagnostic"]=TraceContext;result["diagnostic_revision"]="office-trace-20261030-1";
            Console.WriteLine(Json.Serialize(result));return args.Length>0 && args[0]=="cleanup"?1:0;
        }
    }
}


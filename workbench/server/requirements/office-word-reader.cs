using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

internal static class OfficeWordReader {
    static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 24 * 1024 * 1024, RecursionLimit = 32 };
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    static string Arg(string[] args, string name) { int n = Array.IndexOf(args, name); return n >= 0 && n + 1 < args.Length ? args[n + 1] : null; }
    static bool OfficeProcess(string name) { return String.Equals(name,"WINWORD",StringComparison.OrdinalIgnoreCase) || String.Equals(name,"wps",StringComparison.OrdinalIgnoreCase); }
    static bool Registered(string progId) { return Type.GetTypeFromProgID(progId, false) != null; }
    static Dictionary<string,object> Failure(string code) { return new Dictionary<string,object> { {"status","FAILED"},{"code",code} }; }
    static void Cleanup(string owner) {
        var value=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(owner,Encoding.UTF8));
        try {
            Process process=Process.GetProcessById(Convert.ToInt32(value["pid"]));
            if(OfficeProcess(process.ProcessName) && String.Equals(process.ProcessName,Convert.ToString(value["name"]),StringComparison.OrdinalIgnoreCase) && process.StartTime.ToUniversalTime().Ticks.ToString()==Convert.ToString(value["started"]))process.Kill();
        } catch(ArgumentException) { }
    }
    static void Add(List<Dictionary<string,object>> rows,ref int characters,string kind,Dictionary<string,object> location,string raw) {
        string text=(raw??"").Trim('\r','\a','\n','\0',' ');
        if(text.Length==0)return;
        characters+=text.Length;
        if(rows.Count>=20000 || characters>2000000)throw new Exception("REQUIREMENT_OFFICE_LIMIT");
        rows.Add(new Dictionary<string,object> { {"kind",kind},{"location",location},{"text",text} });
    }
    static Dictionary<string,object> Read(string input,string owner,string progId) {
        dynamic app=null,document=null;
        bool owned=false;object priorLinks=null,priorSecurity=null;string phase="CREATE_INSTANCE";
        try {
            var before=new HashSet<int>(Process.GetProcesses().Where(p=>OfficeProcess(p.ProcessName)).Select(p=>p.Id));
            app=Activator.CreateInstance(Type.GetTypeFromProgID(progId,true));
            Process process=null;
            try { uint pid;GetWindowThreadProcessId(new IntPtr(Convert.ToInt64(app.Hwnd)),out pid);process=Process.GetProcessById((int)pid); } catch { }
            if(process==null) {
                var created=Process.GetProcesses().Where(p=>OfficeProcess(p.ProcessName) && !before.Contains(p.Id)).ToArray();
                if(created.Length==1)process=created[0];
            }
            if(process==null || before.Contains(process.Id) || !OfficeProcess(process.ProcessName) || (int)app.Documents.Count!=0)throw new Exception("REQUIREMENT_OFFICE_BUSY");
            owned=true;
            File.WriteAllText(owner,Json.Serialize(new {pid=process.Id,name=process.ProcessName,started=process.StartTime.ToUniversalTime().Ticks.ToString()}),new UTF8Encoding(false));
            priorSecurity=app.AutomationSecurity;app.AutomationSecurity=3;
            app.Visible=false;app.DisplayAlerts=0;
            priorLinks=app.Options.UpdateLinksAtOpen;app.Options.UpdateLinksAtOpen=false;
            phase="OPEN_DOCUMENT";
            document=app.Documents.Open(input,false,true,false,"","",false,"","",0,0,false,false);
            if(!(bool)document.ReadOnly || !String.Equals(Path.GetFullPath((string)document.FullName),input,StringComparison.OrdinalIgnoreCase))throw new Exception("REQUIREMENT_OFFICE_PERMISSION_DENIED");
            var rows=new List<Dictionary<string,object>>();int characters=0;
            phase="READ_PARAGRAPHS";
            int count=document.Paragraphs.Count;
            for(int n=1;n<=count;n++) {
                dynamic paragraph=document.Paragraphs[n];
                if(!(bool)paragraph.Range.Information[12])Add(rows,ref characters,"paragraph",new Dictionary<string,object>{{"paragraph",n}},(string)paragraph.Range.Text);
            }
            phase="READ_TABLES";
            int tables=document.Tables.Count;
            for(int t=1;t<=tables;t++) {
                dynamic table=document.Tables[t];int cells=table.Range.Cells.Count;
                for(int c=1;c<=cells;c++)Add(rows,ref characters,"table_cell",new Dictionary<string,object>{{"table",t},{"cell",c}},(string)table.Range.Cells[c].Range.Text);
            }
            if(rows.Count==0)throw new Exception("REQUIREMENT_OFFICE_EMPTY");
            return new Dictionary<string,object>{{"status","PARTIAL"},{"provider",String.Equals(process.ProcessName,"wps",StringComparison.OrdinalIgnoreCase)?"wps":"microsoft-word"},{"segments",rows}};
        }catch(Exception error) {
            string code=error.Message;
            string[] allowed={"REQUIREMENT_OFFICE_BUSY","REQUIREMENT_OFFICE_PERMISSION_DENIED","REQUIREMENT_OFFICE_EMPTY","REQUIREMENT_OFFICE_LIMIT"};
            if(!allowed.Contains(code))code=error.HResult==unchecked((int)0x80070005)?"REQUIREMENT_OFFICE_PERMISSION_DENIED":"REQUIREMENT_OFFICE_OPEN_FAILED";
            var result=Failure(code);result["phase"]=phase;result["hresult"]=error.HResult;result["provider"]=progId;return result;
        }finally {
            if(owned) {
                if(document!=null)try{document.Close(0);}catch{}
                if(app!=null && priorLinks!=null)try{app.Options.UpdateLinksAtOpen=priorLinks;}catch{}
                if(app!=null && priorSecurity!=null)try{app.AutomationSecurity=priorSecurity;}catch{}
                if(app!=null)try{app.Quit(0);}catch{}
            }
            foreach(object value in new object[]{document,app})if(value!=null && Marshal.IsComObject(value))try{Marshal.FinalReleaseComObject(value);}catch{}
        }
    }
    [STAThread]
    public static int Main(string[] args) {
        // A GUI-subsystem helper reads in the background. Write UTF-8 to
        // the inherited pipe without requiring an attached console.
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true});
        try {
            string command=args.Length>0?args[0]:"",owner=Arg(args,"--owner");
            if(command=="cleanup"){Cleanup(owner);return 0;}
            if(command=="probe") {
                Console.WriteLine(Json.Serialize(new {word=Registered("Word.Application"),wps=Registered("KWPS.Application") || Registered("WPS.Application")}));return 0;
            }
            string input=Path.GetFullPath(Arg(args,"--input")),provider=Arg(args,"--provider")??"auto";
            if(command!="read" || !File.Exists(input) || !String.Equals(Path.GetExtension(input),".docx",StringComparison.OrdinalIgnoreCase) || !new[]{"auto","word","wps"}.Contains(provider))throw new Exception("REQUIREMENT_OFFICE_OPEN_FAILED");
            var candidates=new List<string>();
            if(provider!="wps")candidates.Add("Word.Application");
            if(provider!="word"){candidates.Add("KWPS.Application");candidates.Add("WPS.Application");}
            var seen=new HashSet<Guid>();Dictionary<string,object> result=Failure("REQUIREMENT_OFFICE_REQUIRED");
            foreach(string id in candidates.Where(Registered)) {
                Type type=Type.GetTypeFromProgID(id,true);if(!seen.Add(type.GUID))continue;
                result=Read(input,owner,id);
                if(Convert.ToString(result["status"])=="PARTIAL")break;
            }
            Console.WriteLine(Json.Serialize(result));return 0;
        }catch {
            Console.WriteLine(Json.Serialize(Failure("REQUIREMENT_OFFICE_OPEN_FAILED")));return 0;
        }
    }
}


using System;
using System.Collections.Generic;
public class SecurityApp { public int Value;public bool Ignores;public int AutomationSecurity { get{return Value;}set{if(!Ignores)Value=value;} } }
public class OfficeNativeTests {
    static OfficeWordReader.Identity P(int id,int parent,string stamp="1"){return new OfficeWordReader.Identity{pid=id,parent=parent,started=stamp};}
    static int count;
    static void Check(string name,Action action){action();Console.WriteLine("ok "+(++count)+" - "+name);}
    static void Reject(Action action,string code){try{action();throw new Exception("Expected rejection");}catch(Exception e){if(e.Message!=code)throw;}}
    public static int Main(){try{
        Console.WriteLine("TAP version 13");var checks=new List<Dictionary<string,object>>();
        string clsid="{11111111-1111-1111-1111-111111111111}";
        Check("32-bit-only WPS class resolved without launching",()=>{
            var r=OfficeWordReader.Resolve("KWPS.Application",(bits,path,name)=>bits==32?(path.EndsWith("CLSID")?clsid:path.EndsWith("LocalServer32")&&name==""?@"""C:\WPS\wps.exe"" /prometheus":null):null,checks);
            if(r==null || r.registry_view!=32 || r.process!="wps")throw new Exception("Wrong registration");
        });
        Check("CurVer and ServerExecutable",()=>{
            var r=OfficeWordReader.Resolve("Word.Application",(bits,path,name)=>path.EndsWith("CurVer")?"Word.Application.16":path==@"Word.Application.16\CLSID"?clsid:path.EndsWith("LocalServer32")?(name=="ServerExecutable"?@"C:\Office\WINWORD.EXE":"unparsed command"):null,new List<Dictionary<string,object>>());
            if(r==null || r.process!="WINWORD")throw new Exception("Wrong server");
        });
        Check("unknown server refused",()=>{if(OfficeWordReader.Resolve("KWPS.Application",(bits,path,name)=>path.EndsWith("CLSID")?clsid:@"C:\other\unknown.exe",new List<Dictionary<string,object>>())!=null)throw new Exception("Unknown accepted");});
        Check("registry permissions stop discovery",()=>{try{OfficeWordReader.Resolve("KWPS.Application",(bits,path,name)=>{throw new UnauthorizedAccessException();},new List<Dictionary<string,object>>());throw new Exception("Permission accepted");}catch(UnauthorizedAccessException){}});
        var prior=new List<OfficeWordReader.Identity>{P(10,1)};
        Check("background WPS and new multi-process group accepted",()=>{if(OfficeWordReader.OwnedGroup(prior,new List<OfficeWordReader.Identity>{P(10,1),P(20,1),P(21,20)},0).Count!=2)throw new Exception("Wrong group");});
        Check("reused instance refused",()=>Reject(()=>OfficeWordReader.OwnedGroup(prior,prior,0),"REQUIREMENT_OFFICE_BUSY"));
        Check("independent competing groups refused",()=>Reject(()=>OfficeWordReader.OwnedGroup(prior,new List<OfficeWordReader.Identity>{P(20,1),P(21,1)},0),"REQUIREMENT_OFFICE_BUSY"));
        Check("nonempty new instance refused",()=>Reject(()=>OfficeWordReader.OwnedGroup(prior,new List<OfficeWordReader.Identity>{P(20,1)},1),"REQUIREMENT_OFFICE_BUSY"));
        Check("PID reuse distinguished by creation time",()=>{if(OfficeWordReader.OwnedGroup(prior,new List<OfficeWordReader.Identity>{P(10,1,"2")},0).Count!=1)throw new Exception("PID reuse lost");});
        Check("disconnected cycle refused",()=>Reject(()=>OfficeWordReader.OwnedGroup(prior,new List<OfficeWordReader.Identity>{P(20,1),P(21,22),P(22,21)},0),"REQUIREMENT_OFFICE_BUSY"));
        Check("macro disabling checked by readback",()=>{var a=new SecurityApp();OfficeWordReader.Secure(a);if(a.Value!=3)throw new Exception("Not secured");});
        Check("ignored macro setting refused",()=>Reject(()=>OfficeWordReader.Secure(new SecurityApp{Ignores=true,Value=1}),"REQUIREMENT_OFFICE_SAFE_MODE_UNSUPPORTED"));
        Console.WriteLine("1.."+count+"\n# tests "+count+"\n# pass "+count+"\n# fail 0");return 0;
    }catch(Exception error){Console.Error.WriteLine(error);return 1;}}
}

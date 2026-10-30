let reported=0;
function report(kind,error,file,line) {
 if(reported++>=20){if(reported===21)void fetch('/api/diagnostics/client',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'error',message:'WEB_DIAGNOSTIC_LIMIT_REACHED: additional page errors suppressed until reload'}),keepalive:true}).catch(()=>{});return;}
 const value={kind,message:String(error?.message||error||'Unknown browser error').slice(0,2000),stack:String(error?.stack||'').slice(0,3000),file:String(file||'').split('?')[0].slice(0,800),line};
 void fetch('/api/diagnostics/client',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),keepalive:true}).catch(()=>{});
}
window.addEventListener('error',event=>report('error',event.error||event.message||'Resource load failed',event.filename||event.target?.src,event.lineno),true);
window.addEventListener('unhandledrejection',event=>report('unhandledrejection',event.reason));
const button=document.querySelector('#export-diagnostics');
button?.addEventListener('click',async()=>{
 button.disabled=true;
 try {
  const response=await fetch('/api/diagnostics/export');
  if(!response.ok)throw Error(`日志导出失败（${response.status}）`);
  const value=await response.json();if(value.schema!=='workbench/diagnostic-bundle-v1')throw Error('日志格式不正确');
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`测试Agent-诊断日志-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  button.textContent='诊断日志已导出';
 } catch(error){button.textContent=error.message||'日志导出失败';}
 finally{button.disabled=false;}
});

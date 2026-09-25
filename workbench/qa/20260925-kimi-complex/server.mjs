import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
export async function startSite(port=0){
 const html=await readFile(path.join(dir,'index.html'));
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||!['/','/index.html','/favicon.ico'].includes(req.url)){res.writeHead(404);res.end('Not found');return;}
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'"});res.end(html);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const site=await startSite(Number(process.env.PORT||4391));
 console.log(`Kimi 设备预约调度台 ${site.url} — Ctrl+C 停止（独立于4322工作台）`);
 process.once('SIGINT',async()=>{await site.close();process.exit(0)});
 process.once('SIGTERM',async()=>{await site.close();process.exit(0)});
}

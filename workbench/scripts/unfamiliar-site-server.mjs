import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const siteRoot=fileURLToPath(new URL('../qa/20260925-unfamiliar/site/',import.meta.url));
export async function startUnfamiliarSite(){
 const html=await fs.readFile(path.join(siteRoot,'index.html'),'utf8'),js=await fs.readFile(path.join(siteRoot,'app.js'),'utf8'),data=await fs.readFile(path.join(siteRoot,'data.json'),'utf8');
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const fault=u.searchParams.get('variant')==='fault';if(u.pathname==='/app.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(js.replace('__DATA__',data).replace('__FAULT__',String(fault)));}else if(u.pathname==='/'||u.pathname==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html.replace('/app.js',`/app.js?variant=${fault?'fault':'normal'}`));}else{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>{server.closeAllConnections();server.close(r);})};
}

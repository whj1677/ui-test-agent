import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const allowed=new Map([['/','launch.html'],['/launch.html','launch.html'],['/index.html','index.html'],['/CASES.md','CASES.md'],['/cases.workbench.json','cases.workbench.json']]);
const server=http.createServer(async(req,res)=>{
 const name=allowed.get(new URL(req.url,'http://localhost').pathname);
 if(!name){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'content-type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','cache-control':'no-store'});
 res.end(await fs.readFile(path.join(root,name)));
});
server.listen(4343,'127.0.0.1',()=>console.log('QA fixture: http://127.0.0.1:4343/'));
process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close());

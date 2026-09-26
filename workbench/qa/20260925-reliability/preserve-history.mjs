import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve('workbench/.local/fresh25-b'),out=new URL('./',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=new URL('history-before.json',out);
if(process.argv[2]==='before'){
  const files=[];
  async function walk(rel){for(const e of await fs.readdir(path.join(root,rel),{withFileTypes:true})){
    if(e.isSymbolicLink())throw Error('UNEXPECTED_HISTORY_SYMLINK');
    const name=rel+'/'+e.name;
    if(e.isDirectory())await walk(name);
    else if(name.startsWith('case-library/projects/')&&name.endsWith('.json') || /\/task\.json$/.test(name) || /\/development\/final\/.*\.mjs$/.test(name) || name.startsWith('data/report-snapshots/')&&name.endsWith('.json'))
      files.push({path:name,sha256:hash(await fs.readFile(path.join(root,name)))});
  }}
  for(const dir of ['case-library/projects','build-tasks','data/report-snapshots'])await walk(dir);
  const grants=JSON.parse(await fs.readFile(path.join(root,'build-tasks/development-authorizations.json'),'utf8'));
  await fs.writeFile(manifest,JSON.stringify({checked_at:new Date().toISOString(),files,grants:grants.entries.map(g=>({id:g.logical_id,sha256:hash(JSON.stringify(g))}))},null,2),{flag:'wx'});
  console.log(JSON.stringify({historical_files:files.length,grants:grants.entries.length}));
}else{
  const before=JSON.parse(await fs.readFile(manifest,'utf8')),issues=[];
  for(const f of before.files)if(hash(await fs.readFile(path.join(root,f.path)))!==f.sha256)issues.push(f.path);
  const grants=JSON.parse(await fs.readFile(path.join(root,'build-tasks/development-authorizations.json'),'utf8')).entries;
  for(const g of before.grants)if(hash(JSON.stringify(grants.find(x=>x.logical_id===g.id)))!==g.sha256)issues.push('grant:'+g.id);
  const result={checked_at:new Date().toISOString(),historical_files:before.files.length,old_grants:before.grants.length,new_grants:grants.length-before.grants.length,unchanged:issues.length===0,issues};
  await fs.writeFile(new URL('history-after.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(issues.length,0);
}

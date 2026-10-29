import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
let checked=0;
const applicable=(values,target)=>!values?.length || (!values.includes('!'+target) && (!values.some(v=>!v.startsWith('!')) || values.includes(target)));
for(const [name, item] of Object.entries(lock.packages)) {
  if(!name.startsWith('node_modules/') || item.dev) continue;
  if(!applicable(item.os,process.platform)||!applicable(item.cpu,process.arch))continue;
  const installed=JSON.parse(await fs.readFile(path.join(root,name,'package.json'),'utf8'));
  const expected=item.link ? lock.packages[item.resolved]?.version : item.version;
  if(!expected || installed.version!==expected) throw Error('DEPENDENCY_VERSION_MISMATCH:'+name);
  checked++;
}
console.log(JSON.stringify({status:'LOCKED_DEPENDENCIES_PRESENT',checked}));

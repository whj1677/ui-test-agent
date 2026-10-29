// Standalone updater: runs with the selected installation's existing Node.
// No dependencies, downloads, model requests or environment/data migration.
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(String(b).replace(/^\uFEFF/,''));
const bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const fail=code=>{throw Error(code);};
const exists=async p=>{try{return await fs.lstat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const safe=relative=>typeof relative==='string' && /^(?:workbench\/server\/requirements\/[\w.-]+|workbench\/server\/requirements-routes\.mjs|workbench\/web-v2\/(?:case-assistant|requirements-api)\.js|workbench\/release\.json|portable-manifest\.json)$/.test(relative) && !relative.includes('..');
async function regular(root,relative,optional=false) {
  if(!safe(relative))fail('UPGRADE_PATH_INVALID');
  let current=root;
  for(const part of relative.split('/')) {
    current=path.join(current,part);const item=await exists(current);
    if(!item) {if(optional)return null;fail('UPGRADE_FILE_MISSING');}
    if(item.isSymbolicLink())fail('UPGRADE_LINK_REFUSED');
  }
  if(!(await fs.lstat(current)).isFile())fail('UPGRADE_FILE_INVALID');
  return fs.readFile(current);
}
export async function assertStopped() {
  await new Promise((resolve,reject)=>{
    const socket=net.connect({host:'127.0.0.1',port:4322});
    const finish=error=>{socket.destroy();error?reject(error):resolve();};
    socket.once('connect',()=>finish(Error('UPGRADE_WORKBENCH_RUNNING')));
    socket.once('error',e=>finish(e.code==='ECONNREFUSED'?null:Error('UPGRADE_PORT_CHECK_FAILED')));
    socket.setTimeout(2000,()=>finish(Error('UPGRADE_PORT_CHECK_FAILED')));
  });
}
export async function resolveInstallation(selected) {
  if(typeof selected!=='string' || !path.isAbsolute(selected))fail('UPGRADE_SELECT_INSTALLATION');
  let root=path.resolve(selected);
  if(!(await exists(path.join(root,'portable-manifest.json'))) && await exists(path.join(root,'program/portable-manifest.json')))root=path.join(root,'program');
  if(!await exists(root))fail('UPGRADE_SELECT_INSTALLATION');
  const real=await fs.realpath(root);
  if(real.toLowerCase()!==root.toLowerCase() || (await fs.lstat(root)).isSymbolicLink())fail('UPGRADE_LINK_REFUSED');
  const manifest=json(await regular(root,'portable-manifest.json'));
  if(manifest.schema!=='workbench/portable-package-v1' || manifest.platform!=='win32-x64' || !Array.isArray(manifest.files))fail('UPGRADE_UNSUPPORTED_INSTALLATION');
  const packageFile=path.join(root,'package.json');
  if((await fs.lstat(packageFile)).isSymbolicLink() || json(await fs.readFile(packageFile)).name!=='deepseek-ui-test-agent' || !await exists(path.join(root,'runtime/node/node.exe')))fail('UPGRADE_UNSUPPORTED_INSTALLATION');
  const names=new Set();
  for(const file of manifest.files) {
    if(typeof file.path!=='string' || file.path.includes('\\') || file.path.includes(':') || file.path.startsWith('/') || file.path.split('/').some(p=>!p||p==='.'||p==='..') || names.has(file.path))fail('UPGRADE_MANIFEST_INVALID');
    names.add(file.path);
  }
  return {root,manifest};
}
async function backupDirectory(root,name) {
  let current=root;
  for(const part of ['workbench','.local','updates']) {
    current=path.join(current,part);const item=await exists(current);
    if(item?.isSymbolicLink() || item && !item.isDirectory())fail('UPGRADE_BACKUP_PATH_INVALID');
    await fs.mkdir(current,{recursive:true});
  }
  const directory=path.join(current,name);await fs.mkdir(directory,{recursive:false});return directory;
}
async function replace(root,relative,data) {
  if(!safe(relative))fail('UPGRADE_PATH_INVALID');
  await regular(root,relative,true);
  const file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});
  const temporary=path.join(path.dirname(file),'.office-update-'+randomUUID()+'.tmp');
  try {await fs.writeFile(temporary,data,{flag:'wx'});await fs.rename(temporary,file);}
  finally {await fs.unlink(temporary).catch(()=>{});}
}
async function saveJournal(directory,journal) {await fs.writeFile(path.join(directory,'journal.json'),bytes(journal));}
function patchText(original,changes) {
  let text=original.toString('utf8');
  for(const {before,after} of changes) {
    if(!before || text.split(before).length!==2)fail('UPGRADE_VERSION_NOT_SUPPORTED');
    text=text.replace(before,after);
  }
  return Buffer.from(text);
}
async function restore(root,directory,journal,{guard=false,appliedOnly=false}={}) {
  const backupRoot=path.join(directory,'files');
  if((await fs.lstat(backupRoot)).isSymbolicLink())fail('UPGRADE_LINK_REFUSED');
  const records=appliedOnly?journal.files.filter(row=>row.applied):journal.files;
  for(const record of records) {
    if(!safe(record.path) || !/^[a-f0-9]{64}$/.test(record.after_sha256) || record.before_sha256!==null && !/^[a-f0-9]{64}$/.test(record.before_sha256))fail('UPGRADE_BACKUP_INVALID');
    const current=await regular(root,record.path,true);
    if(guard && (!current || sha(current)!==record.after_sha256))fail('UPGRADE_CHANGED_AFTER_INSTALL');
    if(record.before_sha256!==null) {
      const backup=await regular(backupRoot,record.path);
      if(sha(backup)!==record.before_sha256)fail('UPGRADE_BACKUP_INVALID');
    }
  }
  for(const record of [...records].reverse()) {
    if(record.before_sha256===null)await fs.unlink(path.join(root,record.path)).catch(e=>{if(e.code!=='ENOENT')throw e;});
    else await replace(root,record.path,await regular(backupRoot,record.path));
  }
}
export async function upgradeInstallation({selected,bundle,checkOnly=false,portCheck=assertStopped,afterWrite=async()=>{}}) {
  await portCheck();
  const {root,manifest}=await resolveInstallation(selected);
  const definition=json(await fs.readFile(path.join(bundle,'upgrade.json')));
  if(definition.schema!=='workbench/incremental-upgrade-v1' || definition.id!=='office-docx-read-v1' || !Array.isArray(definition.payload) || !Array.isArray(definition.edits))fail('UPGRADE_BUNDLE_INVALID');
  const installed=manifest.updates?.find(item=>item.id===definition.id);
  if(installed) {
    for(const record of installed.files)if(!safe(record.path) || sha(await regular(root,record.path))!==record.sha256)fail('UPGRADE_CHANGED_AFTER_INSTALL');
    return {status:'ALREADY_CURRENT',version:manifest.release?.version,files:0};
  }
  const changes=new Map(),old=new Map();
  for(const item of definition.payload) {
    if(!safe(item.path) || changes.has(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256))fail('UPGRADE_BUNDLE_INVALID');
    const data=await regular(path.join(bundle,'payload'),item.path);
    if(data.length!==item.bytes || sha(data)!==item.sha256)fail('UPGRADE_PAYLOAD_CHANGED');
    const previous=await regular(root,item.path,true);
    if(previous)fail('UPGRADE_NEW_FILE_ALREADY_EXISTS');
    changes.set(item.path,data);old.set(item.path,previous);
  }
  for(const item of definition.edits) {
    if(!safe(item.path) || changes.has(item.path) || !Array.isArray(item.variants))fail('UPGRADE_BUNDLE_INVALID');
    const previous=await regular(root,item.path);
    const variant=item.variants.find(row=>row.before_sha256===sha(previous));
    if(!variant)fail('UPGRADE_VERSION_NOT_SUPPORTED');
    const recorded=manifest.files.find(row=>row.path===item.path);
    if(!recorded || recorded.sha256!==sha(previous) || recorded.bytes!==previous.length)fail('UPGRADE_INSTALLED_FILE_CHANGED');
    const changed=patchText(previous,variant.changes);
    if(sha(changed)!==variant.after_sha256)fail('UPGRADE_BUNDLE_INVALID');
    changes.set(item.path,changed);old.set(item.path,previous);
  }
  const releaseBytes=await regular(root,'workbench/release.json'),release=json(releaseBytes);
  if(release.schema!=='workbench/release-v1' || typeof release.version!=='string')fail('UPGRADE_UNSUPPORTED_INSTALLATION');
  const baseVersion=release.version;
  release.version=baseVersion+'+office-read.1';release.status='PENDING_ACCEPTANCE';release.incremental_update={id:definition.id,base_version:baseVersion,requirement:definition.requirement};
  changes.set('workbench/release.json',bytes(release));old.set('workbench/release.json',releaseBytes);
  const updated=structuredClone(manifest);
  updated.release=release;
  for(const [name,data] of changes) {
    const record={path:name,bytes:data.length,sha256:sha(data)},index=updated.files.findIndex(row=>row.path===name);
    if(index<0)updated.files.push(record);else updated.files[index]=record;
  }
  updated.files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  updated.source_sha256=sha(bytes(updated.files.filter(row=>!row.path.startsWith('runtime/') && !row.path.startsWith('node_modules/') && !row.path.includes('/node_modules/'))));
  updated.updates=[...(updated.updates || []),{id:definition.id,base_version:baseVersion,files:[...changes].map(([name,data])=>({path:name,sha256:sha(data)}))}];
  changes.set('portable-manifest.json',bytes(updated));old.set('portable-manifest.json',await regular(root,'portable-manifest.json'));
  if(checkOnly)return {status:'READY_TO_UPGRADE',base_version:baseVersion,version:release.version,files:changes.size};
  // Recheck just before writes: no partial upgrade if a workbench was started
  // while validation ran. The user keeps the application stopped during update.
  await portCheck();
  const directory=await backupDirectory(root,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
  const lock=path.join(path.dirname(directory),'office-update.lock');let handle;
  try {handle=await fs.open(lock,'wx');}catch(error){if(error.code==='EEXIST')fail('UPGRADE_IN_PROGRESS');throw error;}
  try {
  // Validate every preimage under the update lock before the first write.
  for(const [name,previous] of old) {
    const current=await regular(root,name,true);
    if((current===null)!==(previous===null) || current && sha(current)!==sha(previous))fail('UPGRADE_FILE_CHANGED_DURING_INSTALL');
  }
  const journal={schema:'workbench/incremental-backup-v1',id:definition.id,status:'PREPARED',files:[]};
  for(const [name,data] of changes) {
    const previous=old.get(name),record={path:name,before_sha256:previous===null?null:sha(previous),after_sha256:sha(data),applied:false};
    journal.files.push(record);
    if(previous!==null) {
      const destination=path.join(directory,'files',name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,previous,{flag:'wx'});
    }
  }
  await saveJournal(directory,journal);
  try {
    for(const [name,data] of changes) {
      const current=await regular(root,name,true),before=old.get(name);
      if((current===null)!==(before===null) || current && sha(current)!==sha(before))fail('UPGRADE_FILE_CHANGED_DURING_INSTALL');
      await replace(root,name,data);
      journal.files.find(row=>row.path===name).applied=true;
      if(sha(await regular(root,name))!==sha(data))fail('UPGRADE_WRITE_VERIFY_FAILED');
      await afterWrite(name);
    }
    journal.status='COMMITTED';await saveJournal(directory,journal);
    return {status:'UPGRADED',version:release.version,files:changes.size,backup:path.relative(root,directory)};
  }catch(error) {
    try {await restore(root,directory,journal,{appliedOnly:true});journal.status='ROLLED_BACK';await saveJournal(directory,journal);}
    catch {journal.status='ROLLBACK_FAILED';await saveJournal(directory,journal).catch(()=>{});fail('UPGRADE_ROLLBACK_FAILED');}
    throw error;
  }
  } finally {await handle.close();await fs.unlink(lock);}
}
export async function rollbackInstallation({selected,portCheck=assertStopped}) {
  await portCheck();
  const {root}=await resolveInstallation(selected),base=path.join(root,'workbench/.local/updates');
  if((await exists(base))?.isSymbolicLink())fail('UPGRADE_LINK_REFUSED');
  const entries=await fs.readdir(base).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  if(!entries.length)fail('UPGRADE_NO_BACKUP');
  const lock=path.join(base,'office-update.lock');let handle;
  try {handle=await fs.open(lock,'wx');}catch(error){if(error.code==='EEXIST')fail('UPGRADE_IN_PROGRESS');throw error;}
  try {
  for(const name of entries.sort().reverse()) {
    const directory=path.join(base,name);if(!(await fs.lstat(directory)).isDirectory() || (await fs.lstat(directory)).isSymbolicLink())continue;
    const journalFile=path.join(directory,'journal.json');if(!await exists(journalFile))continue;
    const journal=json(await fs.readFile(journalFile));
    if(journal.schema!=='workbench/incremental-backup-v1' || journal.id!=='office-docx-read-v1' || journal.status!=='COMMITTED')continue;
    if(!Array.isArray(journal.files))fail('UPGRADE_BACKUP_INVALID');
    await portCheck();await restore(root,directory,journal,{guard:true});journal.status='ROLLED_BACK';await saveJournal(directory,journal);
    return {status:'ROLLED_BACK',files:journal.files.length};
  }
  fail('UPGRADE_NO_BACKUP');
  } finally {await handle.close();await fs.unlink(lock);}
}
const messages={
  UPGRADE_WORKBENCH_RUNNING:'工作台正在运行。请先保存输入，等待任务结束并正常退出，再进行升级或回退。',
  UPGRADE_SELECT_INSTALLATION:'请选择已安装的测试工作台目录，目录中应包含 program，或同时包含 runtime 和 workbench。',
  UPGRADE_VERSION_NOT_SUPPORTED:'旧版程序文件与本升级包支持的版本不匹配，未覆盖程序。请保留版本信息并联系维护者。',
  UPGRADE_INSTALLED_FILE_CHANGED:'待更新程序文件已被修改，未覆盖。请核对原安装包。',
  UPGRADE_CHANGED_AFTER_INSTALL:'升级后的文件又发生了变化，未强制覆盖或回退，请联系维护者。',
  UPGRADE_PAYLOAD_CHANGED:'升级包文件校验失败，请重新获取完整升级包。',
  UPGRADE_NO_BACKUP:'这个目录没有可回退的本次升级备份。',
  UPGRADE_IN_PROGRESS:'这个目录已有升级操作或中断记录。请等待当前操作结束；如仍无法继续，请保留备份联系维护者。',
  UPGRADE_ROLLBACK_FAILED:'更新失败且自动回退未完成。请保留 workbench/.local/updates 备份并联系维护者，暂勿启动。',
};
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
  const work=args.includes('--rollback')?rollbackInstallation({selected:value('--target')}):upgradeInstallation({selected:value('--target'),bundle:value('--bundle'),checkOnly:args.includes('--check-only')});
  work.then(result=>console.log(JSON.stringify(result))).catch(error=>{
    const code=/^UPGRADE_[A-Z_]+$/.test(error.message)?error.message:['EACCES','EPERM'].includes(error.code)?'UPGRADE_WRITE_PERMISSION':'UPGRADE_FAILED';
    console.error((messages[code] || '未完成更新，未更换环境或修改用户配置。请保留错误码联系维护者。')+'\n'+code);process.exitCode=1;
  });
}

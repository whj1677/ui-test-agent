import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';

const exec = promisify(execFile);
const busy = () => Object.assign(Error('NATIVE_DSH_HOME_BUSY'), {code:'NATIVE_DSH_HOME_BUSY'});
const pid = value => Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;
const schema = 'workbench/native-host-lock-v2';
const identitySource = 'windows-cim-creation-v1';
const validIdentity = (value, processId) => value?.source === identitySource && value.pid === processId &&
  typeof value.created_at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(value.created_at) && Number.isFinite(Date.parse(value.created_at));
export function processIsDead(value) {
  if (!pid(value)) return false;
  try { process.kill(value, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; } // Access denied is not proof of death.
}

// Preserve CIM's seven fractional digits; never compare a rounded JS timestamp
// to a stored process generation. Only legacy upper bounds use milliseconds.
export async function readProcessIdentity(value, {run=exec, platform=process.platform, systemRoot=process.env.SystemRoot}={}) {
  if (!pid(value) || platform !== 'win32' || !systemRoot) return null;
  const script = "$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$env:WORKBENCH_LOCK_PID); if($null -eq $p -or $null -eq $p.CreationDate){'null';exit}; @{pid=[int64]$p.ProcessId;created_at=$p.CreationDate.ToUniversalTime().ToString(\"yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'\",[Globalization.CultureInfo]::InvariantCulture)} | ConvertTo-Json -Compress";
  try {
    const {stdout} = await run(path.join(systemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
      {windowsHide:true,timeout:6000,maxBuffer:4096,env:{SystemRoot:systemRoot,WINDIR:systemRoot,WORKBENCH_LOCK_PID:String(value)}});
    const result=JSON.parse(stdout.trim()), identity={source:identitySource,pid:result?.pid,created_at:result?.created_at};
    return validIdentity(identity,value)?identity:null;
  } catch { return null; }
}

// Older locks did not record the host PID. A dead parent alone cannot establish
// that no orphan Host exists. Inspect only this exact bundled CLI, fail closed.
async function noOrphanHost(dshBin) {
  if (process.platform !== 'win32') return false;
  const script = "$ErrorActionPreference='Stop'; $nodes=@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\"); $unknown=@($nodes | Where-Object { -not $_.CommandLine }); $found=@($nodes | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/','\\').IndexOf($env:WORKBENCH_LOCK_DSH_BIN.Replace('/','\\'),[StringComparison]::OrdinalIgnoreCase) -ge 0 }); if($found.Count -eq 0 -and $unknown.Count -eq 0){'CLEAR'}else{'BUSY'}";
  try {
    const {stdout} = await exec(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
      {windowsHide:true,timeout:6000,maxBuffer:4096,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,WORKBENCH_LOCK_DSH_BIN:dshBin}});
    return stdout.trim() === 'CLEAR';
  } catch { return false; }
}

export async function acquireNativeHostLock({home, owner, dshBin, onRecovered=()=>{}},
  {isDead=processIsDead, orphanFree=noOrphanHost, processIdentity=readProcessIdentity}={}) {
  const lock = path.join(home,'workbench-native-host.lock'), gate=path.join(home,'workbench-native-host.recovery.lock');
  let gateHandle;
  try { gateHandle=await fs.open(gate,'wx',0o600); }
  catch (error) { if(error.code==='EEXIST')throw busy();throw error; }
  try {
    await gateHandle.writeFile(JSON.stringify({owner,parent_pid:process.pid}));
    const info=await fs.lstat(lock).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(info){
      if(!info.isFile() || info.isSymbolicLink() || info.size>4096)throw busy();
      let prior, bytes;
      try { bytes=await fs.readFile(lock);prior=JSON.parse(bytes); } catch { throw busy(); }
      if(!/^[a-f0-9-]{36}$/.test(prior.owner || '') || !pid(prior.parent_pid) || !Number.isFinite(Date.parse(prior.started_at)) ||
        prior.schema !== undefined && prior.schema !== schema || prior.host_pid != null && !pid(prior.host_pid))throw busy();
      const identified=prior.schema===schema;
      if(!identified && (Object.hasOwn(prior,'parent_identity') || Object.hasOwn(prior,'host_identity')))throw busy();
      for(const kind of ['parent','host'])if(prior[`${kind}_identity`]!=null && !validIdentity(prior[`${kind}_identity`],prior[`${kind}_pid`]))throw busy();
      const identity = async processId => {
        try { const value=await processIdentity(processId);return validIdentity(value,processId)?value:null; }
        catch { return null; }
      };
      const previousExited = async (processId, recorded, legacyUpperBound) => {
        try { if(await isDead(processId)===true)return true; } catch { return false; }
        const current=await identity(processId);
        if(!current)return false;
        if(identified)return Boolean(recorded && current.source===recorded.source && current.created_at!==recorded.created_at);
        // A legacy process that began after its recorded ownership cannot be
        // that owner. A delayed mtime makes this proof more conservative.
        return Date.parse(current.created_at)>legacyUpperBound;
      };
      const ownersExited = async () => await previousExited(prior.parent_pid,prior.parent_identity,Date.parse(prior.started_at)) &&
        (prior.host_pid==null || await previousExited(prior.host_pid,prior.host_identity,info.mtimeMs));
      if(!await ownersExited() || !await orphanFree(dshBin) || !await ownersExited())throw busy();
      // The recovery gate serializes all new acquisitions; retain the old lock
      // bytes for diagnosis rather than silently removing ownership evidence.
      const current=await fs.lstat(lock);
      if(current.isSymbolicLink() || current.ino!==info.ino || current.size!==info.size || !(await fs.readFile(lock)).equals(bytes))throw busy();
      await fs.rename(lock,path.join(home,`recovered-host-lock-${randomUUID()}.json`));
      onRecovered({type:'runtime_lock_recovered',previous_parent_pid:prior.parent_pid,previous_host_pid:prior.host_pid ?? null});
    }
    const capture = async processId => {
      try { const value=await processIdentity(processId);return validIdentity(value,processId)?value:null; }
      catch { return null; }
    };
    const record={schema,owner,parent_pid:process.pid,parent_identity:await capture(process.pid),host_pid:null,host_identity:null,started_at:new Date().toISOString()};
    await fs.writeFile(lock,JSON.stringify(record),{flag:'wx',mode:0o600});
    let operations=Promise.resolve(), released=false;
    const serial = action => {const pending=operations.then(action,action);operations=pending.catch(()=>{});return pending;};
    return {
      setHostPid(hostPid){return serial(async()=>{
        if(released || !pid(hostPid))throw busy();
        const hostIdentity=await capture(hostPid);
        const current=JSON.parse(await fs.readFile(lock));if(current.owner!==owner)throw busy();
        record.host_pid=hostPid;record.host_identity=hostIdentity;
        // Other acquirers reject the live parent even before this update.
        await fs.writeFile(lock,JSON.stringify(record));
      });},
      release(){return serial(async()=>{
        const info=await fs.lstat(lock).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
        if(info && !info.isSymbolicLink() && JSON.parse(await fs.readFile(lock)).owner===owner)await fs.unlink(lock);
        released=true;
      });},
    };
  } finally { await gateHandle.close();await fs.unlink(gate); }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';

const exec = promisify(execFile);
const busy = () => Object.assign(Error('NATIVE_DSH_HOME_BUSY'), {code:'NATIVE_DSH_HOME_BUSY'});
const pid = value => Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;
export function processIsDead(value) {
  if (!pid(value)) return false;
  try { process.kill(value, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; } // Access denied is not proof of death.
}

// Older locks did not record the host PID. A dead parent alone cannot establish
// that no orphan Host exists. Inspect only this exact bundled CLI, fail closed.
async function noOrphanHost(dshBin) {
  if (process.platform !== 'win32') return false;
  const script = "$ErrorActionPreference='Stop'; $found=@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/','\\').Contains($env:WORKBENCH_LOCK_DSH_BIN.Replace('/','\\')) }); if($found.Count -eq 0){'CLEAR'}else{'BUSY'}";
  try {
    const {stdout} = await exec(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
      {windowsHide:true,timeout:6000,maxBuffer:4096,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,WORKBENCH_LOCK_DSH_BIN:dshBin}});
    return stdout.trim() === 'CLEAR';
  } catch { return false; }
}

export async function acquireNativeHostLock({home, owner, dshBin, onRecovered=()=>{}},
  {isDead=processIsDead, orphanFree=noOrphanHost}={}) {
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
        !await isDead(prior.parent_pid))throw busy();
      if(prior.host_pid != null ? !pid(prior.host_pid) || !await isDead(prior.host_pid) : !await orphanFree(dshBin))throw busy();
      // The recovery gate serializes all new acquisitions; retain the old lock
      // bytes for diagnosis rather than silently removing ownership evidence.
      const current=await fs.lstat(lock);
      if(current.isSymbolicLink() || current.ino!==info.ino || current.size!==info.size || !(await fs.readFile(lock)).equals(bytes))throw busy();
      await fs.rename(lock,path.join(home,`recovered-host-lock-${randomUUID()}.json`));
      onRecovered({type:'runtime_lock_recovered',previous_parent_pid:prior.parent_pid,previous_host_pid:prior.host_pid ?? null});
    }
    const record={owner,parent_pid:process.pid,host_pid:null,started_at:new Date().toISOString()};
    await fs.writeFile(lock,JSON.stringify(record),{flag:'wx',mode:0o600});
    return {
      async setHostPid(hostPid){
        if(!pid(hostPid))throw busy();
        const current=JSON.parse(await fs.readFile(lock));if(current.owner!==owner)throw busy();
        record.host_pid=hostPid;
        // Other acquirers reject the live parent even before this update.
        await fs.writeFile(lock,JSON.stringify(record));
      },
      async release(){
        const info=await fs.lstat(lock).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
        if(info && !info.isSymbolicLink() && JSON.parse(await fs.readFile(lock)).owner===owner)await fs.unlink(lock);
      },
    };
  } finally { await gateHandle.close();await fs.unlink(gate); }
}

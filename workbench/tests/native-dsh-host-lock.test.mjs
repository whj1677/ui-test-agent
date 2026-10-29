import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireNativeHostLock,processIsDead} from '../server/native-dsh/host-lock.mjs';

async function fixture(t,record){
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'native-host-lock-'));
  t.after(async()=>{assert.equal(path.dirname(home),path.resolve(os.tmpdir()));assert.match(path.basename(home),/^native-host-lock-/);await fs.rm(home,{recursive:true,force:true});});
  const file=path.join(home,'workbench-native-host.lock');
  const prior={owner:randomUUID(),parent_pid:0x7ffffffe,started_at:'2026-10-16T06:58:09.650Z',...record};
  await fs.writeFile(file,JSON.stringify(prior));
  return {home,file,prior,options:{home,owner:randomUUID(),dshBin:path.join(home,'bin.js')}};
}

test('dead legacy parent also requires orphan-free proof and retains prior lock bytes',async t=>{
  const f=await fixture(t),before=await fs.readFile(f.file);let probes=0;
  await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>false}),/HOME_BUSY/);
  assert.deepEqual(await fs.readFile(f.file),before);
  const handle=await acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>{probes++;return true;}});
  assert.equal(probes,1);
  const archived=(await fs.readdir(f.home)).find(name=>name.startsWith('recovered-host-lock-'));
  assert.deepEqual(await fs.readFile(path.join(f.home,archived)),before);
  await handle.setHostPid(process.pid);assert.equal(JSON.parse(await fs.readFile(f.file)).host_pid,process.pid);
  await handle.release();await assert.rejects(fs.stat(f.file),{code:'ENOENT'});
});

test('live parent, live orphan and malformed ownership fail closed',async t=>{
  for(const [record,isDead] of [[{parent_pid:process.pid},()=>false],[{host_pid:process.pid},p=>p!==process.pid],[{owner:'corrupt'},()=>true]]){
    const f=await fixture(t,record),before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead,orphanFree:()=>true}),/HOME_BUSY/);
    assert.deepEqual(await fs.readFile(f.file),before);
  }
  assert.equal(processIsDead(process.pid),false);assert.equal(processIsDead(-1),false);
});

test('concurrent recovery has one owner and a second cannot unlink its live lock',async t=>{
  const f=await fixture(t,{host_pid:0x7ffffffd});
  const checks={isDead:p=>p!==process.pid,orphanFree:()=>true};
  const results=await Promise.allSettled([acquireNativeHostLock(f.options,checks),acquireNativeHostLock({...f.options,owner:randomUUID()},checks)]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(results.filter(row=>row.status==='rejected').length,1);
  const winner=results.find(row=>row.status==='fulfilled').value;
  await assert.rejects(acquireNativeHostLock({...f.options,owner:randomUUID()},checks),/HOME_BUSY/);
  await winner.release();
});

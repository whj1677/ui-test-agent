import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireNativeHostLock,processIsDead,readProcessIdentity} from '../server/native-dsh/host-lock.mjs';

const identity=(pid,created_at='2026-10-29T08:00:00.1234567Z')=>({source:'windows-cim-creation-v1',pid,created_at});
const unknownIdentity=()=>null;
const priorIdentity='2026-10-16T06:57:00.1234567Z';

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
  await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>false,processIdentity:unknownIdentity}),/HOME_BUSY/);
  assert.deepEqual(await fs.readFile(f.file),before);
  const handle=await acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>{probes++;return true;},processIdentity:unknownIdentity});
  assert.equal(probes,1);
  const archived=(await fs.readdir(f.home)).find(name=>name.startsWith('recovered-host-lock-'));
  assert.deepEqual(await fs.readFile(path.join(f.home,archived)),before);
  await handle.setHostPid(process.pid);assert.equal(JSON.parse(await fs.readFile(f.file)).host_pid,process.pid);
  await handle.release();await assert.rejects(fs.stat(f.file),{code:'ENOENT'});
});

test('live parent, live orphan and malformed ownership fail closed',async t=>{
  for(const [record,isDead] of [[{parent_pid:process.pid},()=>false],[{host_pid:process.pid},p=>p!==process.pid],[{owner:'corrupt'},()=>true]]){
    const f=await fixture(t,record),before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead,orphanFree:()=>true,processIdentity:unknownIdentity}),/HOME_BUSY/);
    assert.deepEqual(await fs.readFile(f.file),before);
  }
  assert.equal(processIsDead(process.pid),false);assert.equal(processIsDead(-1),false);
});

test('concurrent recovery has one owner and a second cannot unlink its live lock',async t=>{
  const f=await fixture(t,{host_pid:0x7ffffffd});
  const checks={isDead:p=>p!==process.pid,orphanFree:()=>true,processIdentity:unknownIdentity};
  const results=await Promise.allSettled([acquireNativeHostLock(f.options,checks),acquireNativeHostLock({...f.options,owner:randomUUID()},checks)]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(results.filter(row=>row.status==='rejected').length,1);
  const winner=results.find(row=>row.status==='fulfilled').value;
  await assert.rejects(acquireNativeHostLock({...f.options,owner:randomUUID()},checks),/HOME_BUSY/);
  await winner.release();
});

test('a new lock records parent and host generations without reducing CIM precision',async t=>{
  const f=await fixture(t);const handle=await acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>true,processIdentity:p=>identity(p)});
  await handle.setHostPid(12345);
  const record=JSON.parse(await fs.readFile(f.file));
  assert.equal(record.schema,'workbench/native-host-lock-v2');
  assert.deepEqual(record.parent_identity,identity(process.pid));assert.deepEqual(record.host_identity,identity(12345));
  assert.equal(record.parent_identity.created_at.endsWith('.1234567Z'),true);
  await handle.release();
});

test('reused live parent and host PIDs recover only after two identity checks and orphan exclusion',async t=>{
  const parent=0x7ffffffe,host=0x7ffffffd;
  const f=await fixture(t,{schema:'workbench/native-host-lock-v2',host_pid:host,parent_identity:identity(parent,priorIdentity),host_identity:identity(host,priorIdentity)});
  const before=await fs.readFile(f.file),lookups=[],events=[];let scans=0;
  const handle=await acquireNativeHostLock({...f.options,onRecovered:event=>events.push(event)},{isDead:()=>false,
    orphanFree:()=>{scans++;return true;},processIdentity:p=>{lookups.push(p);return identity(p,'2026-10-16T06:57:00.1234568Z');}});
  assert.equal(lookups.filter(p=>p===parent).length,2);assert.equal(lookups.filter(p=>p===host).length,2);assert.equal(scans,1);
  assert.equal(events[0].type,'runtime_lock_recovered');
  const archived=(await fs.readdir(f.home)).find(name=>name.startsWith('recovered-host-lock-'));
  assert.deepEqual(await fs.readFile(path.join(f.home,archived)),before);
  await handle.release();
});

test('matching live generation and unavailable or foreign identity keep ownership protected',async t=>{
  const parent=0x7ffffffe;
  for(const read of [()=>identity(parent,priorIdentity),()=>null,()=>{throw Error('ACCESS_DENIED');},()=>({...identity(parent),source:'another-clock'})]){
    const f=await fixture(t,{schema:'workbench/native-host-lock-v2',parent_identity:identity(parent,priorIdentity),host_identity:null,host_pid:null});
    const before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>false,orphanFree:()=>true,processIdentity:read}),/HOME_BUSY/);
    assert.deepEqual(await fs.readFile(f.file),before);
  }
});

test('a matching live host and a failed original host identity capture cannot be reclaimed',async t=>{
  const parent=0x7ffffffe,host=0x7ffffffd;
  for(const recorded of [identity(host,priorIdentity),null]){
    const f=await fixture(t,{schema:'workbench/native-host-lock-v2',parent_identity:identity(parent,priorIdentity),host_pid:host,host_identity:recorded});
    const before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead:p=>p===parent,orphanFree:()=>true,processIdentity:p=>identity(p,priorIdentity)}),/HOME_BUSY/);
    assert.deepEqual(await fs.readFile(f.file),before);
  }
});

test('identity capture failure is stored explicitly and never falls back to legacy time inference',async t=>{
  const f=await fixture(t);const handle=await acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>true,processIdentity:unknownIdentity});
  await handle.setHostPid(12345);const before=await fs.readFile(f.file),record=JSON.parse(before);
  assert.equal(record.parent_identity,null);assert.equal(record.host_identity,null);
  await assert.rejects(acquireNativeHostLock({...f.options,owner:randomUUID()},{isDead:p=>p===record.parent_pid,orphanFree:()=>true,
    processIdentity:p=>identity(p,'2030-01-01T00:00:00.0000000Z')}),/HOME_BUSY/);
  assert.deepEqual(await fs.readFile(f.file),before);await handle.release();
});

test('legacy reused parent needs a strictly later creation time and an orphan-free scan',async t=>{
  for(const created of ['2026-10-16T06:58:09.6499999Z','2026-10-16T06:58:09.6500000Z']){
    const f=await fixture(t),before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>false,orphanFree:()=>true,processIdentity:p=>identity(p,created)}),/HOME_BUSY/);
    assert.deepEqual(await fs.readFile(f.file),before);
  }
  const f=await fixture(t),checks={isDead:()=>false,processIdentity:p=>identity(p)};
  await assert.rejects(acquireNativeHostLock(f.options,{...checks,orphanFree:()=>false}),/HOME_BUSY/);
  const handle=await acquireNativeHostLock(f.options,{...checks,orphanFree:()=>true});await handle.release();
});

test('legacy host creation must exceed lock mtime and a delayed mtime never weakens protection',async t=>{
  for(const [modified,recover] of [['2026-10-16T07:00:00.000Z',true],['2030-01-01T00:00:00.000Z',false]]){
    const f=await fixture(t,{host_pid:0x7ffffffd});await fs.utimes(f.file,new Date(modified),new Date(modified));const before=await fs.readFile(f.file);
    const operation=acquireNativeHostLock(f.options,{isDead:()=>false,orphanFree:()=>true,processIdentity:p=>identity(p)});
    if(recover){const handle=await operation;await handle.release();}
    else {await assert.rejects(operation,/HOME_BUSY/);assert.deepEqual(await fs.readFile(f.file),before);}
  }
});

test('identity is rechecked after orphan exclusion before archiving a lock',async t=>{
  const parent=0x7ffffffe;const f=await fixture(t,{schema:'workbench/native-host-lock-v2',parent_identity:identity(parent,priorIdentity),host_identity:null});
  for(const second of [identity(parent,priorIdentity),null]){
    let reads=0;const before=await fs.readFile(f.file);
    await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>false,orphanFree:()=>true,
      processIdentity:p=>p===parent?(++reads===1?identity(p):second):identity(p)}),/HOME_BUSY/);
    assert.equal(reads,2);assert.deepEqual(await fs.readFile(f.file),before);
  }
});

test('a lock replaced during recovery remains untouched even when both PIDs are dead',async t=>{
  const f=await fixture(t,{host_pid:0x7ffffffd});const replacement={...f.prior,owner:randomUUID()};
  await assert.rejects(acquireNativeHostLock(f.options,{isDead:()=>true,processIdentity:unknownIdentity,
    orphanFree:async()=>{await fs.writeFile(f.file,JSON.stringify(replacement));return true;}}),/HOME_BUSY/);
  assert.deepEqual(JSON.parse(await fs.readFile(f.file)),replacement);
  assert.equal((await fs.readdir(f.home)).some(name=>name.startsWith('recovered-host-lock-')),false);
});

test('host identity capture and release serialize without recreating a released lock',async t=>{
  const f=await fixture(t);let captured,resolveIdentity;
  const pendingIdentity=new Promise(resolve=>{resolveIdentity=resolve;});
  const captureStarted=new Promise(resolve=>{captured=resolve;});
  const handle=await acquireNativeHostLock(f.options,{isDead:()=>true,orphanFree:()=>true,
    processIdentity:p=>{if(p===12345){captured();return pendingIdentity;}return identity(p);}});
  const setting=handle.setHostPid(12345);await captureStarted;const releasing=handle.release();
  resolveIdentity(identity(12345));await Promise.all([setting,releasing]);
  await assert.rejects(fs.stat(f.file),{code:'ENOENT'});await assert.rejects(handle.setHostPid(12346),/HOME_BUSY/);
  await assert.rejects(fs.stat(f.file),{code:'ENOENT'});
});

test('Windows identity queries return only same-source PID and exact creation time, and fail closed',async()=>{
  const options={platform:'win32',systemRoot:'C:/Windows'};let launch;
  const result=await readProcessIdentity(12345,{...options,run:async(...args)=>{launch=args;return {stdout:JSON.stringify({pid:12345,created_at:priorIdentity})};}});
  assert.deepEqual(result,identity(12345,priorIdentity));assert.equal(launch[2].windowsHide,true);
  assert.deepEqual(Object.keys(launch[2].env).sort(),['SystemRoot','WINDIR','WORKBENCH_LOCK_PID']);
  for(const value of [null,{pid:12346,created_at:priorIdentity},{pid:12345,created_at:'2026-10-16T06:57:00.123Z'},{pid:12345,created_at:'invalid'}]){
    assert.equal(await readProcessIdentity(12345,{...options,run:async()=>({stdout:JSON.stringify(value)})}),null);
  }
  assert.equal(await readProcessIdentity(12345,{...options,run:async()=>{throw Error('denied');}}),null);
  assert.equal(await readProcessIdentity(-1,{...options,run:async()=>{throw Error('must not query');}}),null);
});

test('Windows CIM identifies this test process consistently without exposing its command line',{skip:process.platform!=='win32'},async()=>{
  const first=await readProcessIdentity(process.pid),second=await readProcessIdentity(process.pid);
  assert.ok(first);assert.deepEqual(first,second);assert.equal(first.pid,process.pid);
  assert.deepEqual(Object.keys(first).sort(),['created_at','pid','source']);
});

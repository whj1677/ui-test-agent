import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorkbenchWhenReady} from '../scripts/native-entry.mjs';
test('desktop launch opens only an identified ready workbench',async()=>{
  let opened=0;
  assert.equal(await openWorkbenchWhenReady({inspect:async()=>({status:'ready'}),open:()=>opened++}),true);
  assert.equal(opened,1);
  assert.equal(await openWorkbenchWhenReady({inspect:async()=>{throw Error('RUNTIME_PORT4322_OTHER_PROJECT');},open:()=>opened++}),false);
  const c=new AbortController();c.abort();assert.equal(await openWorkbenchWhenReady({signal:c.signal,inspect:async()=>({status:'ready'}),open:()=>opened++}),false);
  assert.equal(opened,1);
});

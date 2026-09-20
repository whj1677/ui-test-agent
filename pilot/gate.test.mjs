import test from 'node:test';
import assert from 'node:assert/strict';
import {allowed,validateCall} from './gate.mjs';
const entry='http://localhost:4198/probe/s1';
test('only original normal entry allowed',()=>{
 assert.ok(validateCall('browser_navigate',{url:entry},entry));
 for(const url of ['http://localhost:4198/probe/s2','file:///C:/secret','http://localhost:4179/',entry+'?source=1']) assert.throws(()=>validateCall('browser_navigate',{url},entry));
});
test('implementation, arbitrary execution and healer are not exposed',()=>{
 for(const name of ['browser_evaluate','browser_run_code','test_run','test_debug','Read','Bash','browser_file_upload','browser_network_requests']) {assert.ok(!allowed.has(name));assert.throws(()=>validateCall(name,{},entry));}
});
test('seed and output cannot escape or be overwritten',()=>{
 assert.ok(validateCall('generator_setup_page',{seedFile:'seed.spec.ts'},entry));
 for(const seedFile of ['tests/sorting.spec.ts','../seed.spec.ts','C:/secret'])assert.throws(()=>validateCall('generator_setup_page',{seedFile},entry));
 assert.ok(validateCall('generator_write_test',{fileName:'tests/sorting.spec.ts',code:'test'},entry));
 for(const fileName of ['seed.spec.ts','../src/server.mjs','tests/../../secret','C:/secret'])assert.throws(()=>validateCall('generator_write_test',{fileName},entry));
});
test('no devtools shortcut or unbounded presentation wait',()=>{
 assert.throws(()=>validateCall('browser_press_key',{key:'F12'},entry));
 assert.throws(()=>validateCall('browser_wait_for',{time:1000},entry));
 assert.ok(validateCall('browser_wait_for',{time:1},entry));
});

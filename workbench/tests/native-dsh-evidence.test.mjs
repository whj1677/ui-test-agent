import test from 'node:test';
import {contentHash} from '../server/cases/excel.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { instrumentNativeSource } from '../server/native-dsh/evidence-transform.mjs';
import { executeNativeScript } from '../server/native-dsh/executor.mjs';
import { prepareWindowRecorder } from '../server/build/window-recorder.mjs';
const hash = v => createHash('sha256').update(v).digest('hex');
const content = { steps: [{ order: 1, action: 'Open local page and check values', expected: 'Known values retained' }, { order: 2, action: 'Check the visible heading', expected: 'Ready' }] };
const identity = { run_id: 'run-engineering', project_id: 'project-engineering', source_task_id: 'task-engineering', executed_case_id: 'case-engineering', executed_case_version: 1, executed_content_sha256: hash(JSON.stringify(content)), executed_external_id: 'CASE-1' };

test('capture shutdown backpressure and slow release preserve clock and reject excessive gaps', {timeout:120000},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-recording-release-')),workspace=path.join(root,'workspace');
  try{
    await fs.mkdir(workspace);
    const recorder=await fs.readFile(new URL('../server/build/window-recorder.cs',import.meta.url),'utf8');
    assert.ok(recorder.includes('static void ReleaseWindow() {'));
    await fs.writeFile(path.join(workspace,'case.spec.mjs'),"import {test,expect} from '@playwright/test';test('CASE-1 slow release',async({page})=>{await test.step('CASE_STEP_1',async()=>{await page.setContent('<h1>Recorder release fixture</h1>');await expect(page.getByRole('heading')).toHaveText('Recorder release fixture');});await test.step('CASE_STEP_2',async()=>{await expect(page.getByRole('heading')).toBeVisible();});});");
    for(const delay of [450,1700]){
    const source=path.join(root,`slow-release-${delay}.cs`);
    await fs.writeFile(source,recorder.replace('static void ReleaseWindow() {','static void ReleaseWindow() { Thread.Sleep(1000);')
      .replace('reason = stopReason;',`Thread.Sleep(${delay}); reason = stopReason;`));
    const result=await executeNativeScript({workspace,runDirectory:path.join(root,'run-'+delay),entry:'case.spec.mjs',caseId:'CASE-1',identity:{...identity,run_id:'run-slow-window-release-'+delay},frozenCaseContent:content,browserExecutable:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeoutMs:30000},
      {prepareRecorder:()=>prepareWindowRecorder({source,cacheRoot:path.join(root,'cache')})});
    assert.equal(result.status,'PASSED',result.error);
    const recording=result.window_recording;
    if(delay>1500){
      assert.notEqual(recording.status,'COMPLETE');assert.equal(recording.native_reason,'WINDOW_CAPTURE_GAP');
      assert.equal(result.evidence_status,'INCOMPLETE');assert.notEqual(result.window_timeline.status,'VERIFIED');continue;
    }
    assert.equal(recording.status,'COMPLETE');
    const captured=(Date.parse(recording.ended_at)-Date.parse(recording.started_at))/1000;
    assert.ok(Math.abs(captured-recording.encoded_duration_seconds)<=.25,JSON.stringify({captured,encoded:recording.encoded_duration_seconds}));
    assert.equal(result.window_timeline.status,'VERIFIED');assert.equal(result.evidence_status,'COMPLETE');
    }
  }finally{
    assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^native-recording-release-/);
    await fs.rm(root,{recursive:true,force:true});
  }
});

test('a minimized owned window is restored with real frames and an unchanged recording clock', {timeout:60000},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-recording-recovery-')),workspace=path.join(root,'workspace');await fs.mkdir(workspace);
  try{
    const source="import {test,expect} from '@playwright/test';test('CASE-1 recording fault injection',async({page})=>{await test.step('CASE_STEP_1',async()=>{await page.setContent('<h1>Recorder engineering fixture</h1>');await expect(page.getByRole('heading')).toHaveText('Recorder engineering fixture');});await test.step('CASE_STEP_2',async()=>{const session=await page.context().newCDPSession(page);try{const {windowId}=await session.send('Browser.getWindowForTarget');await session.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});await page.waitForFunction(()=>document.visibilityState==='visible');await expect(page.getByRole('heading')).toHaveText('Recorder engineering fixture');}finally{await session.detach();}});});";
    await fs.writeFile(path.join(workspace,'case.spec.mjs'),source);
    const result=await executeNativeScript({workspace,runDirectory:path.join(root,'run'),entry:'case.spec.mjs',caseId:'CASE-1',identity:{...identity,run_id:'run-real-window-recovery'},frozenCaseContent:content,
      browserExecutable:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeoutMs:30000});
    assert.equal(result.status,'PASSED',result.error);assert.equal(result.window_recording.status,'COMPLETE',JSON.stringify(result.window_recording));
    assert.ok(result.window_recording.minimization_recoveries.some(r=>r.status==='RESTORED'));
    assert.ok(result.window_recording.maximum_capture_gap_ms<=1500);assert.equal(result.window_timeline.status,'VERIFIED');assert.equal(result.evidence_status,'COMPLETE');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('real imported bundle retains lineage in observations and produces complete step/window evidence', {timeout:60000}, async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-imported-evidence-'));
  try{
    const caseContent={external_id:'CASE-1',case_type:'UI',status:'CONFIRMED',steps:[{order:1,action:'Show the engineering fixture',expected:'Ready and value 42'},{order:2,action:'Check the engineering fixture result',expected:'Known object'}]};
    const entry='specs/CASE-1.spec.mjs',texts={
      'lib/fixture.mjs':"import {expect} from '@playwright/test';export async function check(page){await expect(page.getByRole('heading')).toHaveText('Ready');}",
      [entry]:"import {test,expect} from '@playwright/test';import {check} from '../lib/fixture.mjs';test('CASE-1 imported fixture',async({page})=>{await test.step('CASE_STEP_1',async()=>{await page.setContent('<h1>Ready</h1><input aria-label=\"Value\" value=\"42\">');await check(page);await expect(page.getByRole('textbox')).toHaveValue('42');});await test.step('CASE_STEP_2',async()=>{expect({fixture:true}).toEqual({fixture:true});});});"
    };
    const files=Object.entries(texts).map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:hash(text)}));
    const pkg={schema:'workbench/script-package-v1',runtime:'PLAYWRIGHT',entry,case_content_sha256:contentHash(caseContent),script_sha256:hash(texts[entry]),bundle_sha256:hash(JSON.stringify(files)),manifest:files,files:Object.entries(texts).map(([path,text])=>({path,content_base64:Buffer.from(text).toString('base64')})),provenance:{}};
    const runDirectory=path.join(root,'run'),source_draft_id='imported-script-'+hash('fixture lineage');
    const result=await executeNativeScript({runDirectory,entry,caseId:'CASE-1',timeoutMs:45000,browserExecutable:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      identity:{...identity,run_id:'run-imported-lineage',executed_content_sha256:contentHash(caseContent),source_kind:'IMPORTED_SCRIPT',source_draft_id},frozenCaseContent:caseContent,
      frozenSource:{entry,script_sha256:pkg.script_sha256,bundle_sha256:pkg.bundle_sha256,importedPackage:pkg}});
    assert.equal(result.status,'PASSED',result.error);assert.equal(result.evidence_status,'COMPLETE',JSON.stringify({coverage:result.step_coverage,errors:result.evidence_errors}));
    assert.equal(result.window_timeline.status,'VERIFIED');assert.equal(result.step_coverage.observed_steps,2);assert.deepEqual(result.assertion_coverage,{total:3,actual:3,missing:0,status:'COMPLETE'});
    const observations=(await fs.readFile(path.join(runDirectory,'artifacts/step-evidence/step-observations.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(observations.length,2);assert.equal(observations.every(row=>row.source_kind==='IMPORTED_SCRIPT'&&row.source_draft_id===source_draft_id),true);
    for(const [name,text]of Object.entries(texts))assert.equal(await fs.readFile(path.join(runDirectory,'snapshot',name),'utf8'),text);
  }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^native-imported-evidence-/);await fs.rm(root,{recursive:true,force:true});}
});

test('source instrumentation binds only unique explicit boundaries and preserves shared lexical scope', () => {
  const source = "import {test,expect} from '@playwright/test'; test('CASE-1',async()=>{\n// 步骤 1：setup\nconst x=1;expect(x).toBe(1);\n// 步骤 2：check\nexpect(x).not.toBe(2);});";
  const result = instrumentNativeSource(source, 'case.mjs', { entry: true, steps: content.steps });
  assert.equal(result.mapping.status, 'BOUND');
  assert.match(result.source, /const x=1/); assert.match(result.source, /boundary\(2\);.*wrapExpect/s);
  assert.equal((result.source.match(/const x=1/g) || []).length, 1);
  assert.equal(instrumentNativeSource(source.replace('// 步骤 2：check', ''), 'case.mjs', { entry: true, steps: content.steps }).mapping.status, 'UNAVAILABLE');
  assert.equal(instrumentNativeSource(source + "test('second',async()=>{});", 'case.mjs', { entry: true, steps: content.steps }).mapping.status, 'UNAVAILABLE');
});

test('real local fixture preserves assertions and frozen bytes while collecting full-window step evidence', { timeout: 120000 }, async t => {
  const browserExecutable = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  if (!await fs.stat(browserExecutable).catch(() => null)) return t.skip('No local Edge');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-evidence-engineering-'));
  const workspace = path.join(root, 'workspace'); await fs.mkdir(workspace);
  try {
    const pageFile = path.join(root, 'fixture.html');
    await fs.writeFile(pageFile, '<!doctype html><title>Evidence engineering fixture</title><h1 class="ready">Ready</h1><label>Numeric field<input id="value" value="0"></label><input id="empty" value="">');
    const source = `import {test,expect} from '@playwright/test';import {Checks} from './helper.mjs';test('CASE-1 local evidence',async({page})=>{const shared=2;const checks=new Checks();try{await test.step('CASE_STEP_1',async()=>{await page.goto(${JSON.stringify(pathToFileURL(pageFile).href)});for(const v of [null,false,0,[]])checks.check(v);expect(shared).not.toBe(3);});await test.step('CASE_STEP_2',async()=>{expect(shared).toBe(2);await expect(page.getByRole('heading')).toHaveText('Ready');await expect(page.locator('#value')).toHaveValue('0');await expect(page.locator('#empty')).toHaveValue('');await expect(page.getByRole('heading')).toHaveClass(/ready/);await expect(page.getByRole('heading')).toHaveCount(1);await expect(page.getByRole('heading')).toBeVisible();await expect.soft(page.getByRole('heading')).not.toHaveText('Wrong');});}finally{void shared;}});`;
    await fs.writeFile(path.join(workspace, 'case.spec.mjs'), source);
    await fs.writeFile(path.join(workspace, 'helper.mjs'), "import {expect} from '@playwright/test';export class Checks {check(v){expect(v).toEqual(v);}}");
    const runDirectory = path.join(root, 'run');
    const result = await executeNativeScript({ workspace, runDirectory, entry: 'case.spec.mjs', caseId: 'CASE-1', browserExecutable, timeoutMs: 45000, identity, frozenCaseContent: content });
    assert.equal(result.status, 'PASSED', result.error + '\n' + await fs.readFile(path.join(runDirectory, 'stderr.log'), 'utf8'));
    assert.equal(result.script_sha256, hash(source));
    assert.equal(await fs.readFile(path.join(runDirectory, 'snapshot/case.spec.mjs'), 'utf8'), source);
    assert.equal(result.step_coverage?.status, 'COMPLETE', JSON.stringify({ mapping: result.evidence_mapping, errors: result.evidence_errors }));
    const first = result.step_replay.steps[0].assertions;
    assert.deepEqual(first.slice(0, 4).map(a => a.actual), [null, false, 0, []]);
    assert.equal(first.length, 5); assert.ok(first.every(a => a.status === 'PASSED'));
    const locator = result.step_replay.steps[1].assertions.find(a => a.matcher_name === 'toHaveText');
    assert.equal(locator.actual, 'Ready'); assert.equal(locator.value_source, 'PLAYWRIGHT_LOCATOR_OBSERVATION');
    assert.equal(locator.observation_phase, 'AFTER_MATCHER');assert.ok(Date.parse(locator.observed_at)>=Date.parse(locator.started_at));
    const all=result.step_replay.steps[1].assertions;
    assert.deepEqual(all.filter(a=>a.matcher_name==='toHaveValue').map(a=>a.actual),['0','']);
    assert.equal(all.find(a=>a.matcher_name==='toHaveClass').actual,'ready');
    assert.equal(all.find(a=>a.matcher_name==='toHaveCount').actual,1);
    assert.equal(all.find(a=>a.matcher_name==='toBeVisible').actual,true);
    assert.equal(all.at(-1).is_not,true);assert.equal(all.at(-1).is_soft,true);assert.equal(all.at(-1).actual,'Ready');
    assert.deepEqual(result.assertion_coverage,{total:13,actual:13,missing:0,status:'COMPLETE'});
    assert.equal(result.window_recording.status, 'COMPLETE', JSON.stringify(result.window_recording));
    assert.equal(result.window_timeline.status, 'VERIFIED', JSON.stringify(result.window_timeline));
    assert.equal(result.evidence_status, 'COMPLETE', JSON.stringify(result.evidence_errors));
    // A frozen rerun cannot borrow changed helpers from the mutable workspace.
    await fs.writeFile(path.join(workspace, 'helper.mjs'), 'throw Error("mutable helper must not run");');
    const rerun = await executeNativeScript({ runDirectory: path.join(root, 'rerun'), entry: 'case.spec.mjs', caseId: 'CASE-1', browserExecutable, timeoutMs: 45000,
      frozenSource: { runDirectory, entry: 'case.spec.mjs', script_sha256: result.script_sha256, bundle_sha256: result.bundle_sha256 },
      identity: { ...identity, run_id: 'run-engineering-rerun' }, frozenCaseContent: content });
    assert.equal(rerun.status, 'PASSED', rerun.error); assert.equal(rerun.bundle_sha256, result.bundle_sha256);
    await fs.writeFile(path.join(runDirectory, 'snapshot/helper.mjs'), 'changed');
    const invalid = await executeNativeScript({ workspace, runDirectory: path.join(root, 'invalid'), entry: 'case.spec.mjs', caseId: 'CASE-1',
      frozenSource: { runDirectory, entry: 'case.spec.mjs', script_sha256: result.script_sha256, bundle_sha256: result.bundle_sha256 } }, { execute: () => assert.fail('Must reject before process') });
    assert.match(invalid.error, /FROZEN_SOURCE_CHANGED/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('real fixture retains soft and hard failure semantics with trustworthy actual values', { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-evidence-failure-'));
  const workspace = path.join(root, 'workspace'); await fs.mkdir(workspace);
  try {
    const source = "import {test,expect} from '@playwright/test';test('CASE-1 failures',async({page})=>{\n// 步骤 1：soft failure\nconst shared=2;await page.setContent('<h1>Ready</h1>');expect.soft(false,'actual false is retained').toBe(true);\n// 步骤 2：hard failure\nexpect(shared).not.toBe(3);await expect(page.getByRole('heading')).toHaveText('Wrong',{timeout:100});});";
    await fs.writeFile(path.join(workspace, 'case.spec.mjs'), source);
    const result = await executeNativeScript({ workspace, runDirectory: path.join(root, 'run'), entry: 'case.spec.mjs', caseId: 'CASE-1',
      browserExecutable: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', timeoutMs: 30000, identity: { ...identity, run_id: 'run-failure' }, frozenCaseContent: content });
    assert.equal(result.status, 'FAILED', result.error + JSON.stringify(result.report));
    assert.equal(result.script_sha256, hash(source));
    assert.deepEqual(result.step_replay.steps.map(s => s.execution_status), ['FAILED','FAILED']);
    const soft = result.step_replay.steps[0].assertions[0];
    assert.equal(soft.actual, false); assert.equal(soft.status, 'FAILED'); assert.equal(soft.value_source, 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS');
    const locator = result.step_replay.steps[1].assertions.at(-1);
    assert.equal(locator.status, 'FAILED'); assert.equal(locator.actual, 'Ready'); assert.equal(locator.assertion_expected, 'Wrong');
    assert.equal(locator.value_source, 'PLAYWRIGHT_MATCHER_RESULT');
    assert.equal(result.window_timeline.status, 'VERIFIED', JSON.stringify(result.window_timeline));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('evidence finalization failure and unknown termination never invent a business failure or completion', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-evidence-fault-'));
  const workspace = path.join(root, 'workspace'); await fs.mkdir(workspace);
  try {
    await fs.writeFile(path.join(workspace, 'case.spec.mjs'), "import {test} from '@playwright/test';test('CASE-1',async()=>{await test.step('CASE_STEP_1',async()=>{});await test.step('CASE_STEP_2',async()=>{});});");
    async function execute(command, args) {
      const config = (await import(pathToFileURL(args.at(-1)).href)).default;
      await fs.writeFile(config.reporter[0][1].outputFile, JSON.stringify({ finished_at: new Date().toISOString(), status: 'passed', tests: [{title:'CASE-1',status:'passed',expected_status:'passed'}] }));
      return { exitCode: 0, stdout: '', stderr: '', pid: 1234, exitObserved: true, closeObserved: true };
    }
    const options = { workspace, runDirectory: path.join(root, 'run'), entry: 'case.spec.mjs', caseId:'CASE-1', identity, frozenCaseContent: content };
    const result = await executeNativeScript(options, { execute, prepareRecorder: async()=>null, finalizeEvidence: ()=>{throw Error('fault injection');} });
    assert.equal(result.status, 'PASSED'); assert.equal(result.evidence_status, 'INCOMPLETE');
    assert.ok(result.evidence_errors.includes('NATIVE_EVIDENCE_FINALIZATION_FAILED'));
    assert.ok(result.step_replay.steps.every(s => s.execution_status === 'MISSING'));
    const stopped = await executeNativeScript({ ...options, runDirectory: path.join(root,'stop') }, { prepareRecorder:async()=>null,
      execute:async(...args)=>({ ...await execute(...args), termination:'cancelled', exitObserved:false,closeObserved:false }) });
    assert.equal(stopped.status,'CANCELLED'); assert.equal(stopped.stop_unconfirmed,true); assert.equal(stopped.evidence_status,'INCOMPLETE');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('unsupported CommonJS TypeScript is diagnosed before formal execution and keeps frozen source', { timeout: 30000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-evidence-ts-'));
  const workspace = path.join(root,'workspace'); await fs.mkdir(workspace);
  try {
    await fs.writeFile(path.join(workspace,'case.spec.ts'), "import {test,expect} from '@playwright/test';test('CASE-1 typed',async()=>{const n:number=2;expect(n).toBe(2);});");
    const result = await executeNativeScript({ workspace,runDirectory:path.join(root,'run'),entry:'case.spec.ts',caseId:'CASE-1',
      identity:{...identity,run_id:'run-ts'},frozenCaseContent:content,timeoutMs:15000 },{execute:()=>assert.fail('Unsupported formal evidence must not start a child')});
    assert.equal(result.status,'ERROR');assert.equal(result.error,'NATIVE_EVIDENCE_CONTRACT_UNBOUND');
    assert.equal(result.evidence_status,'INCOMPLETE');assert.equal(result.evidence_preflight.business_execution_started,false);
    assert.equal(result.evidence_mapping.reason,'NATIVE_EVIDENCE_REQUIRES_ESM_MJS');
    assert.equal(await fs.readFile(path.join(root,'run/snapshot/case.spec.ts'),'utf8'),await fs.readFile(path.join(workspace,'case.spec.ts'),'utf8'));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

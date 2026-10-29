import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentSession } from '../server/build/development-session.mjs';
import { startDevelopmentMcp, DEVELOPMENT_TOOLS } from '../server/build/development-mcp.mjs';
import { checkExplorationGate } from '../server/build/development-tool-guard.mjs';
import { developmentRepairFocus } from '../server/build/development-repair-focus.mjs';
import { runHarnessTask } from '../../harness-probe/src/harness-runner.mjs';

const tool = 'mcp__playwright-mcp__browser_click';
const frozenCase = { steps: [{ order: 1, action: 'Read status', expected: 'Ready' }] };
const draft = `import {test,expect} from '@playwright/test';
test('case',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('Ready');});});`;

test('real private MCP hook shares the session budget and cannot be reset by rejected draft or reads', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'convergence-session-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('convergence-session-')); await fs.rm(root, {recursive:true,force:true}); });
  const session = new DevelopmentSession({ directory: root, frozenCase, normalUrl: 'http://127.0.0.1:4322/target',
    qualityPolicy: {quality_review_mode:'self-test-v1'}, persist: async()=>{}, signal: new AbortController().signal });
  await session.init();
  const bridge = await startDevelopmentMcp((name,args)=>session.invoke(name,args), {getState:()=>session.state,beforeBrowserTool:(name,args)=>session.beforeBrowserTool(name,args)});
  t.after(()=>bridge.close());
  assert.ok(!DEVELOPMENT_TOOLS.some(entry=>entry.name==='browser-observation'));
  const gate = () => checkExplorationGate(tool,{element:'same scoped control'},{enabled:true,endpoint:bridge.url});
  for(let n=0;n<32;n++) assert.equal((await gate()).allowed,true);
  assert.equal((await gate()).code,'EXPLORATION_WINDOW_EXHAUSTED');
  assert.equal(session.state.tool_calls,0,'private RPC is not another model call');
  await session.invoke('read_draft');
  await assert.rejects(session.invoke('write_draft',{code:'not js }',previous_sha256:null}));
  assert.equal((await gate()).allowed,false);
  await session.invoke('write_draft',{code:draft,previous_sha256:null});
  await fs.appendFile(session.draftPath,'\n// native edit is not admitted');
  assert.equal((await gate()).allowed,false,'native edit invalidates admitted current bytes');
  await session.invoke('write_draft',{code:draft,previous_sha256:session.state.draft_sha256});
  for(let n=0;n<8;n++) assert.equal((await gate()).allowed,true);
  assert.equal((await gate()).allowed,false);
  assert.equal(session.state.self_tests.length,0,'gate does not pretend a draft was tested');
  await session.invoke('write_draft',{code:draft+'\n// changed',previous_sha256:session.state.draft_sha256});
  assert.equal((await gate()).allowed,false,'multiple drafts cannot reset exploration');
});

test('old harness invocation remains compatible; unavailable enabled hook denies without fallback execution',async()=>{
  let requests=0;
  const request=async()=>{requests++;throw Error('unavailable');};
  assert.equal((await checkExplorationGate(tool,{}, {enabled:false,request})).allowed,true);
  assert.equal((await checkExplorationGate('mcp__workbench__self_test',{}, {enabled:true,request})).allowed,true);
  assert.equal(requests,0);
  assert.equal((await checkExplorationGate(tool,{}, {enabled:true,endpoint:'http://127.0.0.1/unused',request})).code,'EXPLORATION_GATE_UNAVAILABLE');
  assert.equal(requests,1);
});

test('repair focus distinguishes startup, step and post-step evidence without changing verdicts',()=>{
  const early={result:{test_status:'FAILED'},coverage:{items:[]}};
  assert.equal(developmentRepairFocus(early,frozenCase).boundary,'BEFORE_CASE_STEPS_OR_EXECUTOR');
  const failed={result:{test_status:'FAILED'},coverage:{items:[{order:1,execution_status:'FAILED',attributed_errors:[{error:{type:'ASSERTION_MISMATCH'}}]}]}};
  assert.equal(developmentRepairFocus(failed,frozenCase).boundary,'WITHIN_CASE_STEP');
  const cleanup={result:{test_status:'FAILED'},coverage:{items:[{order:1,execution_status:'PASSED',attributed_errors:[]}],complete:true}};
  const before=structuredClone(cleanup);
  assert.equal(developmentRepairFocus(cleanup,frozenCase).boundary,'AFTER_CASE_STEPS_OR_TEARDOWN');
  assert.deepEqual(cleanup,before);
  assert.equal(developmentRepairFocus({...cleanup,result:{complete_pass:true}},frozenCase).boundary,'COMPLETE_PASS');
});

test('child convergence flag is opt-in and cannot leak from the parent environment into legacy tasks', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'convergence-child-'));
  t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('convergence-child-'));await fs.rm(root,{recursive:true,force:true});});
  const candidatePath=path.join(root,'candidate.spec.mjs');await fs.writeFile(candidatePath,draft);
  for(const enabled of [false,true]){
    let child;
    await runHarnessTask({task:'offline environment propagation check',workspace:root,dshHome:root,patchPath:'unused',candidatePath,browserExecutable:'unused',
      developmentEndpoint:'http://127.0.0.1:12345/unused',developmentNormalUrl:'http://127.0.0.1:4322/target',developmentConvergence:enabled,
      networkEnvironment:{WORKBENCH_DEVELOPMENT_CONVERGENCE:'1'},timeoutMs:1000,
      runProcess:async options=>{child=options.env;return {events:[],processResult:{exitCode:0,termination:null,outputComplete:true,closeObserved:true,observerError:null,stdout:'',stderr:''},toolCalls:0};}});
    assert.equal(child.WORKBENCH_DEVELOPMENT_CONVERGENCE,enabled?'1':undefined);
  }
});

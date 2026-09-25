import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { executionSteps, stepOutcomeNotice, stepResultLabel } from '../web-v2/execution-media.js';

test('real KC-02 self-tests retain failure, continued steps and captured locator actual', async () => {
  const round=JSON.parse(await fs.readFile(new URL('../qa/20260925-v21/engineer-generation.json',import.meta.url),'utf8'));
  const task=round.tasks.find(t=>t.case==='KC-02');
  const first={status:'FAILED',step_coverage:task.self_tests[0].coverage};
  const second={status:'FAILED',step_coverage:task.self_tests[1].coverage};
  assert.deepEqual(executionSteps(first).map(s=>s.execution_status),['FAILED','NOT_EXECUTED','NOT_EXECUTED']);
  const steps=executionSteps(second);
  assert.deepEqual(steps.map(s=>s.execution_status),['FAILED','PASSED','PASSED']);
  assert.equal(steps[0].actual,'共 5 条，第 1/2 页，每页3条');
  assert.equal(steps[1].actual,'未单独采集实际值');
  assert.equal(stepResultLabel(steps[1],second),'本步骤通过（整例仍失败）');
  assert.match(stepOutcomeNotice(second,steps),/本用例执行失败.*2 个步骤单独通过，0 个步骤未执行/);
  assert.match(stepOutcomeNotice(first,executionSteps(first)),/0 个步骤单独通过，2 个步骤未执行/);
});

test('only attributed evidence is displayed; zero and false are not missing',()=>{
  const run={error:{actual:'unrelated overall value'},step_coverage:{items:[
    {marker:'CASE_STEP_1',order:1,execution_status:'FAILED',attributed_errors:[{error:{type:'LOCATOR_OR_TARGET',actual:0}}]},
    {marker:'CASE_STEP_2',order:2,execution_status:'FAILED',attributed_errors:[{error:{type:'OTHER',actual:false}}]},
    {marker:'CASE_STEP_3',order:3,execution_status:'NOT_EXECUTED',attributed_errors:[]}
  ]}};
  assert.deepEqual(executionSteps(run).map(s=>s.actual),[0,false,'未单独采集实际值']);
});

test('recorded replay steps remain authoritative and successful run has no failure notice',()=>{
  const steps=[{order:1,execution_status:'PASSED',actual:'captured'}];
  const run={status:'PASSED',step_replay:{steps}};
  assert.equal(executionSteps(run),steps);
  assert.equal(stepOutcomeNotice(run,steps),'');
  assert.equal(stepResultLabel(steps[0],run),'本步骤通过');
});

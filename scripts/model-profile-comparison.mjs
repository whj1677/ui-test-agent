import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runLab } from './autonomous-lab.mjs';
import { readBuildInfo } from '../src/build-info.mjs';

export const COMPARISON = Object.freeze({
  schema: 'bounded-model-comparison/v1',
  cases: ['HOLD-Q1','HOLD-F1','HOLD-F2','HOLD-M2'],
  order: ['A1','B1','C1','C2','B2','A2'],
  profiles: { A:'baseline', B:'reasoning-low', C:'preflight-hints' },
  max_calls: 1200, max_ms: 120*60000, round_calls:200, round_ms:20*60000,
  repeats:2, recovery_allowed:false,
});

export function comparisonBudget(state, save, clock = Date.now) {
  return {
    expired: () => clock() - Date.parse(state.started_at) >= COMPARISON.max_ms,
    async take() {
      if (state.calls >= COMPARISON.max_calls || this.expired())
        throw Error('COMPARISON_BUDGET_EXHAUSTED');
      state.calls++;
      await save();
    },
  };
}

export function requireNextGroup(state, label) {
  if (state.groups.some(g => g.status !== 'FINISHED')) throw Error('COMPARISON_INTERRUPTED_NO_RECOVERY');
  if (COMPARISON.order[state.groups.length] !== label) throw Error('COMPARISON_ORDER_FROZEN');
}

export async function runComparisonGroup(label) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = path.join(root,'validation/req0017/v39-comparison.json');
  const lock = await fs.open(file+'.lock','wx');
  try {
    const build = await readBuildInfo();
    let state;
    try { state = JSON.parse(await fs.readFile(file,'utf8')); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
    if (!state) {
      if(label!=='A1') throw Error('COMPARISON_ORDER_FROZEN');
      state = { protocol:COMPARISON, build_id:build.build_id, started_at:new Date().toISOString(), calls:0, groups:[], acceptance:'NOT_ESTABLISHED' };
    }
    if (JSON.stringify(state.protocol)!==JSON.stringify(COMPARISON)) throw Error('COMPARISON_PROTOCOL_CHANGED');
    if (state.build_id!==build.build_id) throw Error('COMPARISON_BUILD_CHANGED');
    requireNextGroup(state,label);
    const save = () => fs.writeFile(file,JSON.stringify(state,null,2));
    const budget = comparisonBudget(state,save);
    if(budget.expired() || state.calls>=COMPARISON.max_calls) throw Error('COMPARISON_BUDGET_EXHAUSTED');
    const group={label,status:'RUNNING',profile:COMPARISON.profiles[label[0]],started_at:new Date().toISOString(),directory:null};
    state.groups.push(group);
    await save();
    try {
      const remaining=COMPARISON.max_ms-(Date.now()-Date.parse(state.started_at));
      const result=await runLab({realModel:true,suite:'heldout',caseIds:COMPARISON.cases,
        diagnosticProfile:group.profile,sharedBudget:budget,
        maxCalls:Math.min(COMPARISON.round_calls,COMPARISON.max_calls-state.calls),
        maxMinutes:Math.min(COMPARISON.round_ms,remaining)/60000,
        onRoundStarted:async({directory})=>{group.directory=directory;await save();},
      });
      group.status='FINISHED';group.finished_at=new Date().toISOString();
      group.budget=result.budget;group.results=result.tasks.flatMap(t=>t.results??[]);
      group.semantic_acceptance='REQUIRES_INDEPENDENT_FACT_REVIEW';
      state.elapsed_ms=Date.now()-Date.parse(state.started_at);
      await save();
      return {label,directory:group.directory,results:group.results,total_calls:state.calls,elapsed_ms:state.elapsed_ms};
    } catch(error) {
      group.status='FAILED_NO_RECOVERY';group.error=error.code??error.message;
      group.finished_at=new Date().toISOString();await save();throw error;
    }
  } finally { await lock.close(); await fs.unlink(file+'.lock'); }
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=='--real-model' || !/^--group=[ABC][12]$/.test(args[1]))
    throw Error('EXPLICIT_FROZEN_GROUP_REQUIRED');
  console.log(JSON.stringify(await runComparisonGroup(args[1].slice(8))));
}

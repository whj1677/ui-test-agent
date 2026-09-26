// Diagnostic probes only: no HTTP listener, browser, model, or business execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DevelopmentSession, digest } from '../../../workbench/server/build/development-session.mjs';
import { developmentToolAllowed } from '../../../workbench/server/build/development-tool-guard.mjs';
import { stopCandidateTrial } from '../../../workbench/server/build/candidate-trials.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const directory = await fs.mkdtemp(path.join(output, 'probe-data-'));
const code = value => `import {test,expect} from '@playwright/test';\ntest('diagnostic',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('${value}');});});\n`;
const seed = code('original');
const modified = code('modified');
let observedSha = null;
const session = new DevelopmentSession({
  directory, frozenCase: { steps: [{order:1,action:'Read status',expected:'Original requirement'}] },
  normalUrl: 'http://127.0.0.1:4322/not-visited',
  persist: async () => {}, signal: new AbortController().signal,
  verify: async ({candidatePath}) => {
    observedSha = digest(await fs.readFile(candidatePath));
    throw new Error('DIAGNOSTIC_STUB_NO_EXECUTION');
  },
});
await session.init(seed);
let wrapperRejection = null;
try { await session.invoke('write_draft', {code:modified,previous_sha256:digest(seed)}); }
catch (error) { wrapperRejection = error.message; }
const nativeWriteAllowed = developmentToolAllowed('edit',{file_path:session.draftPath},session.normalUrl,path.dirname(session.draftPath));
if (!nativeWriteAllowed) throw new Error('PROBE_NATIVE_PATH_NOT_ADMITTED');
// Simulate only the filesystem effect of a policy-admitted native edit.
await fs.writeFile(session.draftPath,modified);
await session.invoke('self_test');

// Simulate the narrow window after the terminal row is written and before active clears.
let row = { run_id:'diagnostic-only',execution_status:'FINISHED',complete_pass:true };
const controller = new AbortController();
const manager = {
  active:{runId:row.run_id,controller},
  runStore:{updateRun:async (_id,update)=>{row=update(row);return row;}},
};
const before = structuredClone(row);
await stopCandidateTrial(manager,row.run_id);
manager.active = null;

const result = {
  generated_at:new Date().toISOString(),
  scope:'Production function probes with in-memory/store/executor doubles; no business or end-to-end execution',
  recovery:{wrapper_rejection:wrapperRejection,native_edit_admitted:nativeWriteAllowed,
    seed_sha256:digest(seed),modified_sha256:digest(modified),first_self_test_snapshot_sha256:observedSha,
    observed_original:observedSha===digest(seed),observed_modified:observedSha===digest(modified),
    self_test_status:session.state.self_tests[0].status},
  terminal_stop:{before,after:row,controller_aborted:controller.signal.aborted,active_after_settle:manager.active,
    limit:'Injected finalization window, not a real concurrent browser run'},
};
if (wrapperRejection!=='EXECUTE_ORIGINAL_RECOVERY_DRAFT_FIRST'||observedSha!==digest(modified)||row.execution_status!=='STOPPING') throw new Error('OBSERVED_BEHAVIOR_CHANGED');
await fs.writeFile(path.join(output,'boundary-probes.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

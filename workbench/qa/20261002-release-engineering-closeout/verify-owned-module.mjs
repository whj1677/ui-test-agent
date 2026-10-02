// Pure offline contract probe of the only provenance-proven new runtime file.
// Does not import a server, call a provider or replay previously accepted tests.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const moduleURL = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2], 'workbench/server/requirements/generation-plan.mjs')) : new URL('../../server/requirements/generation-plan.mjs', import.meta.url);
const { standardGenerationInputs } = await import(moduleURL);

const input = { system_prompt:'完整资料', sources:[{id:'source-synthetic', text:'全部规则'}],
  images:[{source_id:'source-synthetic', consent:true}], scope:{selected:['a','b']} };
const before = JSON.stringify(input);
let checks = 0;
function check(name, verify) { verify(); checks++; console.log(`ok ${checks} - ${name}`); }
check('ordinary scope returns the exact existing input without partition', () => assert.deepEqual(standardGenerationInputs({scope:{mode:'SELECTED'}},input), [input]));
const partitions = standardGenerationInputs({scope:{mode:'ALL_CURRENT'}},input);
check('ALL_CURRENT produces precisely two fixed UI/backend partitions', () => assert.deepEqual(partitions.map(p=>p.generation_partition), [
  {case_type:'UI',order:1,total:2},{case_type:'BACKEND',order:2,total:2}]));
check('both partitions retain the complete evidence source', () => partitions.forEach(p=>assert.strictEqual(p.sources,input.sources)));
check('both partitions retain already-authorized image inputs', () => partitions.forEach(p=>assert.strictEqual(p.images,input.images)));
check('both partitions retain the original scope and prompt', () => partitions.forEach(p=>{assert.strictEqual(p.scope,input.scope);assert.ok(p.system_prompt.startsWith(input.system_prompt+'\n'));}));
check('input is unchanged', () => assert.equal(JSON.stringify(input),before));
console.log(JSON.stringify({status:'OWNED_MODULE_OFFLINE_CONTRACT_VERIFIED',checks,models_called:0,service_started:false,semantic_model_effect:'NOT_RUN'}));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createModelCredentialProvider, resolveModelCredentials, readWindowsCredential } from '../server/model-credentials.mjs';
import { createRequirementsModel } from '../server/requirements-model.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { enableModel } from '../scripts/native-entry.mjs';
import { locateModelCredential, modelCredentialPaths, modelCredentialWritePath } from '../server/model-credential-storage.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'model-credentials-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('model-credentials-'));
    return fs.rm(root, { recursive: true, force: true });
  });
  return { root, dshHome: path.join(root, 'private-dsh'), environment: { USERPROFILE:root, LOCALAPPDATA: root, SystemRoot: process.env.SystemRoot } };
}

test('explicit process credentials and existing DSH homes do not silently switch sources', async t => {
  const f = await fixture(t);
  const canonical = modelCredentialWritePath(f.environment);
  await fs.mkdir(path.dirname(canonical), {recursive:true}); await fs.writeFile(canonical, 'canonical-presence-only-fixture');
  assert.equal(await resolveModelCredentials({ ...f, environment: {} }), null);
  assert.deepEqual(await resolveModelCredentials({ ...f, environment: { DEEPSEEK_API_KEY: 'synthetic-environment-key' } }), {
    apiKey: 'synthetic-environment-key', baseUrl: 'https://api.deepseek.com', source: 'process-environment',
  });
  await fs.mkdir(f.dshHome); await fs.writeFile(path.join(f.dshHome, '.env'), 'DEEPSEEK_API_KEY=synthetic-legacy-key\n');
  const legacy = await resolveModelCredentials({ ...f, useStoredCredentials: true, environment: { ...f.environment, DEEPSEEK_API_KEY: 'different-key' }, decrypt: () => { throw Error('must not read DPAPI'); } });
  assert.equal(legacy.apiKey, 'synthetic-legacy-key'); assert.equal(legacy.source, 'saved-dsh-home');
  await assert.rejects(resolveModelCredentials({ environment: { DEEPSEEK_API_KEY: 'synthetic', DEEPSEEK_BASE_URL: 'https://untrusted.invalid' } }), /ENDPOINT_NOT_OFFICIAL/);
});

test('canonical DPAPI is preferred; only its absence permits legacy LOCALAPPDATA fallback', async t => {
  const f = await fixture(t), candidates = modelCredentialPaths(f.environment), reads = [];
  for (const candidate of candidates) {
    await fs.mkdir(path.dirname(candidate.file), {recursive:true});
    await fs.writeFile(candidate.file, candidate.location + '-ciphertext-fixture');
  }
  const decrypt = async file => { reads.push(file); return {apiKey:'synthetic-key',baseUrl:'https://api.deepseek.com',source:'windows-dpapi-current-user'}; };
  await resolveModelCredentials({...f,useStoredCredentials:true,decrypt});
  assert.deepEqual(reads, [candidates[0].file]);
  assert.equal((await locateModelCredential({environment:f.environment})).location, 'user-profile');
  await fs.unlink(candidates[0].file);
  await resolveModelCredentials({...f,useStoredCredentials:true,decrypt});
  assert.deepEqual(reads, [candidates[0].file,candidates[1].file]);
  assert.equal((await locateModelCredential({environment:f.environment})).location, 'legacy-localappdata');
});

test('explicit webpage activation selects the saved DPAPI key without reading or overwriting legacy credentials',async t=>{
  const f=await fixture(t),file=modelCredentialWritePath(f.environment);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'encrypted-fixture');
  let reads=0;
  const actual=await resolveModelCredentials({...f,useStoredCredentials:true,preferWindowsCredentials:true,readFile:async()=>{reads++;throw Error('must not read legacy');},decrypt:async()=>({apiKey:'synthetic-web-key'})});
  assert.equal(actual.apiKey,'synthetic-web-key');assert.equal(reads,0);
});

test('canonical invalid metadata, access errors and decryption failure never switch to legacy', async t => {
  const f = await fixture(t), [canonical,legacy] = modelCredentialPaths(f.environment), reads = [];
  for (const selected of [canonical,legacy]) await fs.mkdir(path.dirname(selected.file), {recursive:true});
  await fs.writeFile(legacy.file, 'usable-legacy-fixture');
  await fs.writeFile(canonical.file, '');
  const decrypt = async file => { reads.push(file); throw Error('MODEL_CREDENTIAL_DPAPI_INVALID'); };
  await assert.rejects(resolveModelCredentials({...f,useStoredCredentials:true,decrypt}), /DPAPI_INVALID/);
  assert.deepEqual(reads, []);
  await fs.writeFile(canonical.file, 'corrupt-canonical-fixture');
  await assert.rejects(resolveModelCredentials({...f,useStoredCredentials:true,decrypt}), /DPAPI_INVALID/);
  assert.deepEqual(reads, [canonical.file]);
  const stats = [];
  await assert.rejects(resolveModelCredentials({...f,useStoredCredentials:true,decrypt,stat:async file=>{
    stats.push(file); throw Object.assign(Error('private filesystem error'),{code:'EACCES'});
  }}), error => error.message === 'MODEL_CREDENTIAL_DPAPI_UNAVAILABLE');
  assert.deepEqual(stats, [canonical.file]);
});

test('explicit environments with no absolute USERPROFILE stay in their legacy storage view', async t => {
  const f = await fixture(t), legacyEnvironment = {LOCALAPPDATA:f.root};
  const legacy = path.join(f.root,'ui-test-agent/credentials/deepseek-api-key.dpapi');
  await fs.mkdir(path.dirname(legacy),{recursive:true}); await fs.writeFile(legacy,'legacy-presence');
  for (const environment of [legacyEnvironment,{...legacyEnvironment,USERPROFILE:'relative-profile'}]) {
    assert.deepEqual(modelCredentialPaths(environment), [{file:legacy,location:'legacy-localappdata'}]);
    assert.equal(modelCredentialWritePath(environment), legacy);
    assert.equal((await locateModelCredential({environment})).file, legacy);
  }
  assert.deepEqual(modelCredentialPaths({}), []);
  assert.equal(await locateModelCredential({environment:{},stat:()=>{throw Error('must not probe real user');}}), null);
  assert.throws(()=>modelCredentialWritePath({}), /STORAGE_PATH_REQUIRED/);
});

test('one cached DPAPI source supplies document model and both Harness paths without key metadata', async t => {
  const f = await fixture(t); let decryptions = 0;
  const directory = path.join(f.root, 'ui-test-agent', 'credentials'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'deepseek-api-key.dpapi'), 'encrypted-fixture');
  const provider = createModelCredentialProvider({ ...f, useStoredCredentials: true, decrypt: async () => {
    decryptions++; return { apiKey: 'synthetic-pipe-key', baseUrl: 'https://api.deepseek.com', source: 'windows-dpapi-current-user' };
  } });
  let options;
  const model = await createRequirementsModel({ configuration: { provider: 'deepseek-official', model: 'deepseek-flash' }, credentialProvider: provider,
    clientFactory: value => { options = value; return { close() {}, async json() { return { value: { candidates: { UI: [], BACKEND: [] }, issues: [] }, usage: { total_tokens: 0 } }; } }; } });
  const manager = { useStoredDshCredentials: true, storedCredentialProvider: provider };
  const first = await BuildTaskManager.prototype.modelCredentials.call(manager);
  const second = await BuildTaskManager.prototype.modelCredentials.call(manager);
  assert.equal(decryptions, 1); assert.deepEqual(first, second); assert.equal(first.apiKey, options.key);
  assert.equal(model.credential_source, 'windows-dpapi-current-user');
  assert.doesNotMatch(JSON.stringify(model), /synthetic-pipe-key/);
  assert.deepEqual((await model.generate({ input: { system_prompt: 'test', source_segments: [] } })).candidates, { UI: [], BACKEND: [] });
  const managerText = await fs.readFile(new URL('../server/build/manager.mjs', import.meta.url), 'utf8');
  const developmentText = await fs.readFile(new URL('../server/build/development-task.mjs', import.meta.url), 'utf8');
  assert.match(managerText, /const credentials = await this\.modelCredentials\(\)/);
  assert.match(developmentText, /credentials = await manager\.modelCredentials\(\)/);
});

test('disabled or absent credentials make no decryption or model request; corrupt saved files fail closed', async t => {
  const f = await fixture(t); let called = false;
  assert.equal(await createRequirementsModel({ disabled: true, configuration: { provider: 'deepseek-official' }, credentialProvider: () => { called = true; throw Error('not allowed'); } }), null);
  assert.equal(called, false);
  assert.equal(await resolveModelCredentials({ ...f, useStoredCredentials: true }), null);
  await assert.rejects(BuildTaskManager.prototype.modelCredentials.call({ useStoredDshCredentials: true, storedCredentialProvider: async () => null }), /BUILD_MODEL_CONFIGURATION_REQUIRED/);
  const directory = path.join(f.root, 'ui-test-agent', 'credentials'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'deepseek-api-key.dpapi'), 'invalid-encrypted-fixture');
  await assert.rejects(resolveModelCredentials({ ...f, useStoredCredentials: true, decrypt: async () => { throw Error('MODEL_CREDENTIAL_DPAPI_INVALID'); } }), /DPAPI_INVALID/);
});

test('DPAPI worker arguments contain no secret and worker failures never return stderr or output', async () => {
  const fixtureKey = 'synthetic-argument-check'; let captured;
  const value = await readWindowsCredential('C:\\fixture\\deepseek-api-key.dpapi', { platform: 'win32', environment: { SystemRoot: 'C:\\Windows' }, execute(command, args, options, callback) {
    captured = { command, args, options }; callback(null, JSON.stringify({ apiKey: fixtureKey }));
  } });
  assert.equal(value.apiKey, fixtureKey); assert.equal(captured.options.windowsHide, true);
  assert.ok(captured.command.endsWith('WindowsCredential.exe'));
  assert.deepEqual(captured.args,['read','--file','C:\\fixture\\deepseek-api-key.dpapi']);
  assert.doesNotMatch(JSON.stringify(captured),/powershell|ExecutionPolicy|Bypass/i);
  assert.doesNotMatch(JSON.stringify(captured), /synthetic-argument-check/);
  await assert.rejects(readWindowsCredential('C:\\fixture\\key.dpapi', { platform: 'win32', execute(_c, _a, _o, callback) {
    callback(new Error(fixtureKey), fixtureKey, fixtureKey);
  } }), error => error.message === 'MODEL_CREDENTIAL_DPAPI_UNAVAILABLE' && !error.stack.includes(fixtureKey));
});

test('Windows DPAPI persists encrypted fixture and decrypts through private child pipe', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t), file = path.join(f.root, 'fixture.dpapi');
  const fixtureKey = 'synthetic-roundtrip-only-credential';
  const broker=fileURLToPath(new URL('../scripts/native/WindowsCredential.exe',import.meta.url));
  await new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(broker, ['write','--file',file,'--stdin'], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.on('data', bytes => { stderr += bytes.toString(); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error(`fixture encryption failed (${code}): ${stderr.replaceAll(fixtureKey, '[REDACTED]')}`))); child.stdin.end(fixtureKey + '\n');
  });
  assert.ok(!(await fs.readFile(file, 'utf8')).includes(fixtureKey));
  const credentials = await readWindowsCredential(file);
  assert.equal(credentials.apiKey, fixtureKey); assert.equal(credentials.source, 'windows-dpapi-current-user');
  await fs.writeFile(file, 'corrupt-fixture');
  await assert.rejects(readWindowsCredential(file), /DPAPI_UNAVAILABLE/);
});

test('first-run model enablement changes only local availability and preserves empty target authorization', { skip: process.platform !== 'win32' }, async t => {
  const f=await fixture(t), runtime=path.join(f.root,'runtime'), directory=path.dirname(modelCredentialWritePath(f.environment));
  await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'deepseek-api-key.dpapi'),'presence-only-fixture-not-decrypted');
  await enableModel({runtimeHome:runtime,environment:{...process.env,USERPROFILE:f.root,LOCALAPPDATA:f.root}});
  const trial=JSON.parse(await fs.readFile(path.join(runtime,'config/trial.json'),'utf8'));
  assert.equal(trial.model_calls_allowed,true);assert.equal(trial.user_initiated_operations,true);
  assert.deepEqual(trial.authorizations,[]);assert.deepEqual(trial.environments,[]);
  const config=JSON.parse(await fs.readFile(path.join(runtime,'config/start-workbench.json'),'utf8'));
  assert.equal(config.profiles['fresh-b'].WORKBENCH_DSH_HOME,path.join(runtime,'dsh'));
  await assert.rejects(fs.access(path.join(runtime,'dsh/.env')),{code:'ENOENT'});
  assert.equal(await fs.readFile(path.join(directory,'deepseek-api-key.dpapi'),'utf8'),'presence-only-fixture-not-decrypted');
});

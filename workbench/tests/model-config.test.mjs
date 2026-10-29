import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';

const exec = promisify(execFile);
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
const modulePath = path.join(scripts, 'model-config.ps1');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const shells = process.platform === 'win32'
  ? ['pwsh', path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')]
  : ['pwsh'];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-model-config-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('workbench-model-config-'));
    await fs.rm(root, {recursive:true, force:true});
  });
  return {root, trial:path.join(root, 'trial.json')};
}

async function powershell(shell, command) {
  try {
    const result = await exec(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(
      `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $env:PSModulePath=Join-Path $PSHOME 'Modules'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ${command}`,
      'utf16le').toString('base64')], {windowsHide:true, timeout:20000, maxBuffer:1024*1024});
    return {code:0, ...result};
  } catch (error) { return {code:error.code, stdout:error.stdout || '', stderr:error.stderr || ''}; }
}

const invoke = (shell, file, body) => powershell(shell, `. ${quote(modulePath)}; $trial=${quote(file)}; ${body}`);
const success = result => { assert.equal(result.code, 0, result.stdout + result.stderr); return JSON.parse(result.stdout.trim()); };

for (const shell of shells) {
  const label = path.basename(shell);
  test(`${label}: prepare changes only the root Boolean bytes and is idempotent`, async t => {
    const f = await fixture(t);
    const original = '\uFEFF{\r\n  "model_calls_allowed": false,\r\n  "authorizations": [{"budget": 900719925474099312345, "used": 7}],\r\n  "nested": {"model_calls_allowed": false}, "label": "价格",\r\n  "memo": "quoted \\\"model_calls_allowed\\\":false", "date": "2026-01-01T00:00:00Z"\r\n}\r\n';
    await fs.writeFile(f.trial, original);
    const result = success(await invoke(shell, f.trial, '$first=Prepare-WorkbenchModelConfig -TrialPath $trial; $second=Prepare-WorkbenchModelConfig -TrialPath $trial; @{first=$first;second=$second} | ConvertTo-Json -Depth 12 -Compress'));
    assert.equal(await fs.readFile(f.trial, 'utf8'), original.replace('"model_calls_allowed": false', '"model_calls_allowed": true'));
    assert.equal(result.first.status, 'PREPARED_AND_VERIFIED');
    assert.equal(result.first.changed, true);
    assert.equal(result.first.before.model_calls_allowed, false);
    assert.equal(result.first.after.model_calls_allowed, true);
    assert.notEqual(result.first.before.trial_sha256, result.first.after.trial_sha256);
    assert.equal(result.second.changed, false);
    assert.equal(result.second.status, 'ALREADY_ENABLED');
    assert.equal(result.second.before.trial_sha256, result.second.after.trial_sha256);
    assert.equal(result.first.after.value_type, 'System.Boolean');
    assert.ok(['UNKNOWN','PROVIDER_TARGET'].includes(result.first.after.storage.identity_status));
    if (result.first.after.storage.identity_status === 'UNKNOWN') assert.equal(result.first.after.storage.effective_path, null);
    assert.deepEqual(await fs.readdir(f.root), ['trial.json']);
  });

  test(`${label}: CheckOnly and ordinary reads do not write a false configuration`, async t => {
    const f = await fixture(t), original = '{"model_calls_allowed":false,"authorizations":[{"quota":3}]}\n';
    await fs.writeFile(f.trial, original);
    await fs.utimes(f.trial, new Date('2020-01-01'), new Date('2020-01-01'));
    const before = await fs.stat(f.trial);
    const result = success(await invoke(shell, f.trial, '$read=Get-WorkbenchModelConfigState -TrialPath $trial; $check=Prepare-WorkbenchModelConfig -TrialPath $trial -CheckOnly; @{read=$read;check=$check} | ConvertTo-Json -Depth 12 -Compress'));
    assert.equal(result.read.model_calls_allowed, false);
    assert.equal(result.check.status, 'CHECK_ONLY');
    assert.equal(result.check.changed, false);
    assert.equal(result.check.after.model_calls_allowed, false);
    assert.equal(await fs.readFile(f.trial, 'utf8'), original);
    assert.equal((await fs.stat(f.trial)).mtimeMs, before.mtimeMs);
    assert.deepEqual(await fs.readdir(f.root), ['trial.json']);
  });

  test(`${label}: invalid, duplicate or non-Boolean flags are rejected without writes`, async t => {
    const f = await fixture(t);
    for (const original of [
      '{"model_calls_allowed":', '{}', '[]',
      '{"model_calls_allowed":"false","canary":"DO_NOT_LOG_CONTENT"}',
      '{"model_calls_allowed":false,"model_calls_allowed":true}',
      '{"nested":{"model_calls_allowed":false}}',
    ]) {
      await fs.writeFile(f.trial, original);
      const result = await invoke(shell, f.trial, 'Prepare-WorkbenchModelConfig -TrialPath $trial | ConvertTo-Json -Depth 12 -Compress');
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /MODEL_CONFIG_/);
      assert.doesNotMatch(result.stdout + result.stderr, /DO_NOT_LOG_CONTENT/);
      assert.equal(await fs.readFile(f.trial, 'utf8'), original);
      assert.deepEqual(await fs.readdir(f.root), ['trial.json']);
    }
  });

  test(`${label}: locked destination blocks atomic replace and cleans its own temporary file`, async t => {
    const f = await fixture(t), original = '{"model_calls_allowed":false,"budget":99}';
    await fs.writeFile(f.trial, original);
    const result = success(await invoke(shell, f.trial, `$continued=$false; $blocked=$false; $handle=[IO.File]::Open($trial,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); try { try { $null=Prepare-WorkbenchModelConfig -TrialPath $trial; $continued=$true } catch { $blocked=$true } } finally { $handle.Dispose() }; @{blocked=$blocked;continued=$continued} | ConvertTo-Json -Compress`));
    assert.equal(result.blocked, true);
    assert.equal(result.continued, false);
    assert.equal(await fs.readFile(f.trial, 'utf8'), original);
    assert.deepEqual(await fs.readdir(f.root), ['trial.json']);
  });

  test(`${label}: readback mismatch fails before the caller can continue`, async t => {
    const f = await fixture(t);
    await fs.writeFile(f.trial, '{"model_calls_allowed":false,"budget":99}');
    const result = success(await invoke(shell, f.trial, `
      $originalReader=(Get-Command Read-WorkbenchModelConfig).ScriptBlock; $script:reads=0;
      function Read-WorkbenchModelConfig { param([string]$TrialPath); $script:reads++; $value=& $originalReader -TrialPath $TrialPath; if ($script:reads -eq 2) { $value.safe.trial_sha256='readback-mismatch' }; return $value }
      $continued=$false; $errorCode=$null; try { $null=Prepare-WorkbenchModelConfig -TrialPath $trial; $continued=$true } catch { $errorCode=$_.Exception.Message }
      @{continued=$continued;error_code=$errorCode;reads=$script:reads} | ConvertTo-Json -Compress`));
    assert.equal(result.error_code, 'MODEL_CONFIG_READBACK_MISMATCH');
    assert.equal(result.continued, false);
    assert.equal(result.reads, 2);
    assert.equal(await fs.readFile(f.trial, 'utf8'), '{"model_calls_allowed":true,"budget":99}');
    assert.deepEqual(await fs.readdir(f.root), ['trial.json']);
  });

  test(`${label}: real launcher rejects invalid switches and keeps CheckOnly read-only in an isolated fixture`, async t => {
    const f = await fixture(t), workbench = path.join(f.root, 'workbench'), target = path.join(workbench, 'scripts');
    await fs.mkdir(target, {recursive:true});
    for (const file of ['start-workbench.ps1','runtime-paths.ps1','model-config.ps1']) await fs.copyFile(path.join(scripts, file), path.join(target, file));
    await fs.mkdir(path.join(workbench, 'config'));
    await fs.mkdir(path.join(workbench, '.local/fresh25-b/case-library/projects'), {recursive:true});
    await fs.mkdir(path.join(f.root, 'private-runtime'));
    for (const file of ['config/fresh-b-trial.json','config/empty-trial.json']) await fs.writeFile(path.join(workbench, file), '{}');
    const patch = path.join(f.root, 'patch.yml'), environments = path.join(f.root, 'environments.json'), config = path.join(f.root, 'start.json');
    await fs.writeFile(patch, '# fixture'); await fs.writeFile(environments, '[]');
    const original = '{"model_calls_allowed":false,"authorizations":[{"max_starts":8,"used_starts":2}]}';
    await fs.writeFile(f.trial, original);
    await fs.writeFile(config, JSON.stringify({profiles:{'fresh-b':{
      WORKBENCH_DSH_HOME:path.join(f.root,'private-runtime'), WORKBENCH_HARNESS_PATCH:patch,
      WORKBENCH_USE_STORED_DSH_CREDENTIALS:'1', WORKBENCH_DEVELOPMENT_ENVIRONMENTS:environments,
      WORKBENCH_CANDIDATE_TRIAL_CONFIG:f.trial,
    }}}));
    const launcher = quote(path.join(target, 'start-workbench.ps1'));
    for (const args of ['-PrepareModelConfig', '-EnableModel -PrepareModelConfig -Restart']) {
      const result = await powershell(shell, `& ${launcher} ${args}`);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /PrepareModelConfig/);
      assert.equal(await fs.readFile(f.trial, 'utf8'), original);
    }
    // A local command stub prevents even querying any running workbench. The
    // real launcher exits at its false-config gate before service startup.
    for (const preparation of ['', '-PrepareModelConfig']) {
      const result = await powershell(shell, `function Get-NetTCPConnection { param($LocalPort,$State,$ErrorAction) }; & ${launcher} -EnableModel ${preparation} -CheckOnly -ConfigPath ${quote(config)} -BrowserPath ${quote(process.execPath)}`);
      assert.notEqual(result.code, 0);
      assert.match(result.stdout, /"model_calls_allowed":false/, result.stdout + result.stderr);
      if (preparation) assert.match(result.stdout, /"status":"CHECK_ONLY"/);
      assert.equal(await fs.readFile(f.trial, 'utf8'), original);
      assert.deepEqual(await fs.readdir(path.dirname(f.trial)).then(names => names.filter(name => name.startsWith('.model-config-'))), []);
    }
  });
}

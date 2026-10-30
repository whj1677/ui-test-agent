import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const script=await fs.readFile(new URL('../../packaging/windows-installer.iss',import.meta.url),'utf8');
test('installer upgrades the previous registered directory without making version directories',()=>{
  assert.match(script,/AppId=\{\{ACB05159-C0F8-4B5B-8E57-6F734FA1A2AC\}/);
  assert.match(script,/UsePreviousAppDir=yes/);assert.match(script,/UsePreviousGroup=yes/);
  assert.doesNotMatch(script,/请选择新的安装位置|所选位置已有测试工作台/);
  assert.match(script,/DefaultDirName=\{localappdata\}\\UITestAgent\s/);
});
test('upgrade preserves mutable data and refuses an active workbench',()=>{
  assert.doesNotMatch(script,/\[InstallDelete\]|\[UninstallDelete\]|taskkill|Stop-Process/i);
  assert.match(script,/CloseApplications=no/);assert.match(script,/RestartApplications=no/);
  const prepare=script.slice(script.indexOf('function PrepareToInstall'),script.indexOf('function InitializeUninstall'));
  assert.match(prepare,/portable-manifest\.json/);assert.match(prepare,/127\.0\.0\.1:4322\/api\/health/);
  assert.match(prepare,/工作台仍在运行/);assert.match(script,/Flags: ignoreversion recursesubdirs createallsubdirs/);
});
test('silent installer does not launch a second workbench during verification',()=>{
  const section=script.slice(script.indexOf('[Run]'),script.indexOf('[Code]'));
  assert.match(section,/postinstall skipifsilent/);assert.doesNotMatch(section,/RunOnce|runascurrentuser/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { assessIsolation } from '../src/isolation-audit.mjs';

function child({ outsideRead = false, outsideWrite = false, deniedNetwork = false, key = false } = {}) {
  return {
    environment: { allowedMarkerPresent: true, deepseekApiKeyPresent: key, deepseekBaseUrlPresent: key },
    files: {
      workspaceRead: { succeeded: true }, workspaceWrite: { succeeded: true },
      outsideRead: { succeeded: outsideRead }, outsideWrite: { succeeded: outsideWrite },
    },
    network: { allowed: { succeeded: true }, denied: { succeeded: deniedNetwork } },
  };
}

const browser = (denied = false) => ({ allowed: { succeeded: true }, denied: { succeeded: denied } });

test('文件、网络和凭据禁止项都被阻断时才允许真实修订', () => {
  assert.deepEqual(assessIsolation(child(), browser()), {
    fileIsolationSatisfied: true,
    networkIsolationSatisfied: true,
    credentialIsolationSatisfied: true,
    acceptableForRealHarnessRevision: true,
  });
});

test('工作区外读取或写入成功会关闭总门', () => {
  assert.equal(assessIsolation(child({ outsideRead: true }), browser()).acceptableForRealHarnessRevision, false);
  assert.equal(assessIsolation(child({ outsideWrite: true }), browser()).acceptableForRealHarnessRevision, false);
});

test('候选或浏览器可访问禁止端点会关闭总门', () => {
  assert.equal(assessIsolation(child({ deniedNetwork: true }), browser()).acceptableForRealHarnessRevision, false);
  assert.equal(assessIsolation(child(), browser(true)).acceptableForRealHarnessRevision, false);
});

test('候选携带模型凭据会关闭总门', () => {
  assert.equal(assessIsolation(child({ key: true }), browser()).acceptableForRealHarnessRevision, false);
});

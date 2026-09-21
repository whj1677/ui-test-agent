import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport } from '../server/build/report.mjs';
import { startFixtureServer } from '../../harness-probe/src/fixture-server.mjs';
import { inspectPlaywrightRuntime, verifyCandidate } from '../../harness-probe/src/verify-candidate.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.dirname(workbenchRoot);
const harnessRoot = path.join(repoRoot, 'harness-probe');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const candidateCode = `import { test, expect } from '@playwright/test';
test('fixed runtime candidate', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await page.getByRole('button', { name: '执行探针交互' }).click();
  await expect(page.locator('#probe-result')).toHaveText('PROBE-42');
});
`;

async function mediaKinds(runDirectory) {
  const names = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else names.push(entry.name);
    }
  }
  await visit(path.join(runDirectory, 'artifacts'));
  return {
    screenshot: names.some((name) => name.endsWith('.png')),
    video: names.some((name) => name.endsWith('.webm')),
    trace: names.some((name) => name.endsWith('.zip')),
  };
}

test('workbench候选使用同一Playwright运行根并真实执行正常与反例', async () => {
  await fs.access(browserExecutable);
  await fs.mkdir(path.join(workbenchRoot, '.local'), { recursive: true });
  const tempRoot = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'candidate-runtime-test-'));
  const candidatePath = path.join(tempRoot, 'candidate.spec.mjs');
  await fs.writeFile(candidatePath, candidateCode);
  const legacy = await inspectPlaywrightRuntime({ candidatePath });
  assert.equal(legacy.consistent, false);
  assert.notEqual(legacy.cli_test.package_path, legacy.candidate_test.package_path);
  const normalServer = await startFixtureServer(path.join(harnessRoot, 'fixture', 'index.html'));
  const negativeServer = await startFixtureServer(path.join(harnessRoot, 'fixture', 'wrong-output.html'));
  try {
    const normalDirectory = path.join(tempRoot, 'normal');
    const normalRaw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable, fixtureUrl: normalServer.url, runDirectory: normalDirectory });
    const normal = await parseCandidateReport(normalRaw.reportPath, normalRaw.process);
    assert.equal(normalRaw.runtime.consistent, true);
    assert.equal(normalRaw.runtime.cli_test.version, '1.62.1');
    assert.equal(normalRaw.runtime.cli_test.package_path, normalRaw.runtime.config_test.package_path);
    assert.equal(normalRaw.runtime.cli_test.package_path, normalRaw.runtime.candidate_test.package_path);
    assert.equal(normal.test_count, 1);
    assert.equal(normal.test_status, 'PASSED');
    assert.equal(normal.complete_pass, true);
    assert.deepEqual(await mediaKinds(normalDirectory), { screenshot: true, video: true, trace: true });

    const negativeDirectory = path.join(tempRoot, 'negative');
    const negativeRaw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable, fixtureUrl: negativeServer.url, runDirectory: negativeDirectory });
    const negative = await parseCandidateReport(negativeRaw.reportPath, negativeRaw.process);
    assert.equal(negativeRaw.runtime.consistent, true);
    assert.equal(negative.test_count, 1);
    assert.equal(negative.test_status, 'FAILED');
    assert.equal(negative.error.type, 'ASSERTION_MISMATCH');
    assert.equal(negative.error.expected, 'PROBE-42');
    assert.equal(negative.error.actual, 'PROBE-41');
    assert.deepEqual(await mediaKinds(negativeDirectory), { screenshot: true, video: true, trace: true });
  } finally {
    await normalServer.close();
    await negativeServer.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('harness-probe默认运行根保持独立可执行', async () => {
  await fs.mkdir(path.join(harnessRoot, '.local'), { recursive: true });
  const tempRoot = await fs.mkdtemp(path.join(harnessRoot, '.local', 'candidate-runtime-test-'));
  const candidatePath = path.join(tempRoot, 'candidate.spec.mjs');
  await fs.writeFile(candidatePath, candidateCode);
  const fixture = await startFixtureServer(path.join(harnessRoot, 'fixture', 'index.html'));
  try {
    const result = await verifyCandidate({ candidatePath, browserExecutable, fixtureUrl: fixture.url, runDirectory: path.join(tempRoot, 'normal') });
    assert.equal(result.runtime.consistent, true);
    assert.equal(result.runtime.cli_test.version, '1.62.1');
    assert.equal(result.report.testCount, 1);
    assert.equal(result.success, true);
  } finally {
    await fixture.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from '../../harness-probe/src/fixture-server.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport } from '../server/build/report.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.dirname(workbenchRoot);
const root = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'm4a-cli-preflight-'));
const candidateDirectory = path.join(root, 'candidate');
const candidatePath = path.join(candidateDirectory, 'candidate.spec.mjs');
const fixturePath = path.join(repoRoot, 'heldout-lab', 'index.html');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await fs.access(browserExecutable);
await fs.mkdir(candidateDirectory, { recursive: true });
await fs.writeFile(candidatePath, [
  "import { test, expect } from '@playwright/test';",
  "test('M4-A engineering route preflight only', async ({ page }) => {",
  "  await page.goto(process.env.PROBE_URL);",
  "  await test.step('ENGINEERING_ROUTE_CHECK', async () => {",
  "    await expect(page).toHaveURL(/\\/probe\\/q1$/);",
  "    await expect(page.getByRole('heading', { name: '巡检任务台账' })).toBeVisible();",
  "  });",
  "});",
  '',
].join('\n'));

const normalServer = await startFixtureServer(fixturePath, { route: '/probe/q1' });
const negativeServer = await startFixtureServer(fixturePath, { route: '/probe/q2' });
try {
  const normalRaw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable, fixtureUrl: normalServer.url, runDirectory: path.join(root, 'normal') });
  const negativeRaw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable, fixtureUrl: negativeServer.url, runDirectory: path.join(root, 'negative') });
  const normal = await parseCandidateReport(normalRaw.reportPath, normalRaw.process);
  const negative = await parseCandidateReport(negativeRaw.reportPath, negativeRaw.process);
  assert.equal(normal.test_count, 1);
  assert.equal(normal.complete_pass, true);
  assert.equal(negative.test_count, 1);
  assert.equal(negative.test_status, 'FAILED');
  assert.equal(normalRaw.runtime.consistent, true);
  for (const lane of ['normal', 'negative']) {
    const files = await fs.readdir(path.join(root, lane, 'artifacts'), { recursive: true });
    assert.ok(files.some((file) => String(file).endsWith('.png')), `${lane} screenshot`);
    assert.ok(files.some((file) => String(file).endsWith('.webm')), `${lane} video`);
    assert.ok(files.some((file) => String(file).endsWith('.zip')), `${lane} trace`);
  }
  console.log(JSON.stringify({
    kind: 'zero-model-engineering-preflight', normal: normal.test_status, negative: negative.test_status,
    runtime_consistent: normalRaw.runtime.consistent, root,
  }));
} finally {
  await normalServer.close();
  await negativeServer.close();
}

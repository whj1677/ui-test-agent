import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from '../../harness-probe/src/fixture-server.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { mapProjectCaseSteps, parseCandidateReport } from '../server/build/report.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
if (!browserExecutable) throw new Error('DSH_PROBE_BROWSER_EXECUTABLE_REQUIRED');
const root = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'step-title-cli-'));
const candidatePath = path.join(root, 'candidate.spec.mjs');
const fixturePath = path.join(root, 'fixture.html');
const runDirectory = path.join(root, 'run');
const contract = { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2'] };
await fs.writeFile(fixturePath, '<!doctype html><html><body><h1>工程夹具</h1><button>核对</button></body></html>');
await fs.writeFile(candidatePath, `import { test, expect } from '@playwright/test';
test('step title compatibility fixture', async ({ page }) => {
  await test.step('CASE_STEP_1', async () => { await page.goto(process.env.PROBE_URL); await expect(page.getByRole('heading')).toHaveText('工程夹具'); });
  await test.step('CASE_STEP_2：带说明的步骤', async () => { await expect(page.getByRole('button', { name: '核对' })).toBeVisible(); });
});
`);
const fixture = await startFixtureServer(fixturePath, { route: '/probe/step-title' });
try {
  const raw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable, fixtureUrl: fixture.url, runDirectory });
  assert.equal(raw.process.exitCode, 0);
  const parsed = await parseCandidateReport(raw.reportPath, raw.process);
  assert.equal(parsed.test_count, 1);
  assert.equal(parsed.test_status, 'PASSED');
  const mapping = mapProjectCaseSteps(parsed, contract);
  assert.equal(mapping.complete, true);
  assert.deepEqual(mapping.observed_sequence, ['CASE_STEP_1', 'CASE_STEP_2']);
  console.log(JSON.stringify({ test_status: parsed.test_status, test_count: parsed.test_count, mapping_rule: mapping.rule_version, titles: mapping.items.map((item) => item.raw_title) }));
} finally {
  await fixture.close();
  await fs.rm(root, { recursive: true, force: true });
}

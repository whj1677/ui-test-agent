import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

test('项目用例新版本不会自动继承旧版本的限定首审资产', async () => {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reviewed-asset-browser-'));
  const paths = createPaths({ localRoot });
  const store = new WorkbenchStore(paths.dataRoot); await store.init();
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const projectId = 'project-44444444-4444-4444-8444-444444444444';
  const caseId = 'case-55555555-5555-4555-8555-555555555555';
  const projectDirectory = caseStore.projectDirectory(projectId);
  await fs.mkdir(projectDirectory, { recursive: true });
  await fs.writeFile(path.join(projectDirectory, 'project.json'), JSON.stringify({
    schema: 'workbench/case-project-v1', project_id: projectId, name: '版本绑定项目', description: '', revision: 2,
    created_at: '2026-09-21T00:00:00.000Z', updated_at: '2026-09-21T00:00:00.000Z', imports: [],
    cases: [{ case_id: caseId, external_id: 'CASE-001', title: '版本绑定用例', module: '探针', status: 'CONFIRMED', current_version: 2,
      root_source: { stable_id: 'synthetic:case-001' }, import_batch_id: 'preview-test',
      versions: [
        { version: 1, content_sha256: 'A'.repeat(64), content: { external_id: 'CASE-001', title: 'v1', module: '探针', status: 'CONFIRMED', preconditions: '', test_data: '', steps: [{ order: 1, action: '动作', expected: '预期' }] } },
        { version: 2, content_sha256: 'B'.repeat(64), content: { external_id: 'CASE-001', title: 'v2', module: '探针', status: 'CONFIRMED', preconditions: '', test_data: '', steps: [{ order: 1, action: '新动作', expected: '新预期' }] } },
      ] }],
  }));
  await store.registerAsset({
    schema: 'approved-workbench/asset-v2', asset_id: 'reviewed-project-case-browser', version: 'reviewed-v1-browser',
    approval_status: 'HUMAN_FIRST_REVIEW_PASSED_SCOPED', title: 'CASE-001', case_id: 'CASE-001', scope: '仅确认v1合成场景',
    project_case: { project_id: projectId, case_id: caseId, case_version: 1, content_sha256: 'A'.repeat(64) },
    source_build: { task_id: 'build-test-browser', attempt_id: 'attempt-01-initial', candidate_version: 1 },
    script: { sha256: 'C'.repeat(64) }, review_basis: { sha256: 'D'.repeat(64) },
    allowed_environments: [{ id: 'normal', label: '正常' }],
  });
  const manager = { active: null };
  const buildStore = { async getBudget() { return null; }, async getRevalidationAuthorization() { return null; }, async listTasks() { return []; } };
  const buildManager = { active: null, diagnostics() { return { storage_status: 'READY' }; }, async templates() { return []; } };
  const server = createWorkbenchServer({ store, manager, buildStore, buildManager, caseStore });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ locale: 'zh-CN' });
  try {
    await page.goto(baseUrl);
    await page.locator('#case-project-list').getByText(/版本绑定项目/).click();
    await page.getByRole('cell', { name: 'CASE-001', exact: true }).locator('..').click();
    assert.equal(await page.getByTestId('case-build-version').inputValue(), '2');
    assert.equal(await page.getByTestId('case-reviewed-run').isDisabled(), true);
    assert.match(await page.locator('#case-reviewed-assets').innerText(), /不自动继承/);
    await page.getByTestId('case-build-version').selectOption('1');
    assert.equal(await page.getByTestId('case-reviewed-run').isEnabled(), true);
    assert.match(await page.locator('#case-reviewed-assets').innerText(), /版本匹配/);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(localRoot, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-sidebar-'));
const caseStore = new CaseLibraryStore(path.join(root, 'cases'));
const buildStore = new BuildTaskStore(path.join(root, 'builds'));
let server;
let browser;
try {
  await caseStore.init();
  await buildStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const first = await caseManager.createProject({ name: '侧栏项目 A', description: '' });
  const second = await caseManager.createProject({ name: '侧栏项目 B', description: '' });
  server = createWorkbenchServer({ caseStore, caseManager, buildStore });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/workspace/`;
  browser = await chromium.launch(process.env.DSH_PROBE_BROWSER_EXECUTABLE
    ? { headless: true, executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE }
    : { headless: true });
  const page = await browser.newPage();
  const sidebar = page.locator('.side-nav');

  await page.goto(`${base}#/projects`);
  await page.getByRole('heading', { name: '项目', exact: true }).waitFor();
  assert.equal(await sidebar.getByRole('link', { name: '建例任务' }).count(), 0);
  assert.equal(await sidebar.getByText('请先选择项目').count(), 2);

  await page.goto(`${base}#/projects/${first.project_id}/cases`);
  await page.getByRole('heading', { name: '项目用例' }).waitFor();
  const builds = sidebar.getByRole('link', { name: '建例任务' });
  const records = sidebar.getByRole('link', { name: '执行记录' });
  assert.equal(await builds.getAttribute('href'), `#/projects/${first.project_id}/build-tasks`);
  assert.equal(await records.getAttribute('href'), `#/projects/${first.project_id}/execution-records`);
  assert.equal(await sidebar.getByText('请先选择项目').count(), 0);

  await builds.click();
  await page.getByRole('heading', { name: '建例任务', exact: true }).waitFor();
  assert.equal(await builds.getAttribute('aria-current'), 'page');
  await records.click();
  await page.getByRole('heading', { name: '项目执行记录' }).waitFor();
  assert.equal(await records.getAttribute('aria-current'), 'page');

  await page.goto(`${base}#/projects/${second.project_id}/cases`);
  await page.getByRole('heading', { name: '项目用例' }).waitFor();
  assert.equal(await sidebar.getByRole('link', { name: '建例任务' }).getAttribute('href'), `#/projects/${second.project_id}/build-tasks`);
  assert.equal(await sidebar.getByRole('link', { name: '执行记录' }).getAttribute('href'), `#/projects/${second.project_id}/execution-records`);
  await sidebar.getByRole('link', { name: '项目', exact: true }).click();
  await page.getByRole('heading', { name: '项目', exact: true }).waitFor();
  assert.equal(await sidebar.getByRole('link', { name: '建例任务' }).count(), 0);
  console.log('workspace sidebar: project context, both destinations, switching and clearing passed');
} finally {
  await browser?.close();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

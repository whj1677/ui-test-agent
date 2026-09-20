import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createPaths } from '../server/paths.mjs';

const paths = createPaths();
const baseUrl = process.env.WORKBENCH_URL || 'http://127.0.0.1:4210';
const acceptanceRoot = path.join(paths.localRoot, 'acceptance');
const summary = JSON.parse(await fs.readFile(path.join(acceptanceRoot, 'real-integration-summary.json'), 'utf8'));
assert.equal(summary.runs.length, 2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });

try {
  await page.goto(baseUrl);
  await page.getByTestId('asset-card').waitFor();
  for (const expected of summary.runs) {
    const button = page.getByTestId('history').locator(`button[data-run-id="${expected.run_id}"]`);
    await button.waitFor();
    await button.click();
    const detail = await page.getByTestId('run-detail').innerText();
    assert.match(detail, new RegExp(expected.test_status));
    const current = await fetch(`${baseUrl}/api/runs/${encodeURIComponent(expected.run_id)}`).then((response) => response.json());
    assert.equal(current.run_id, expected.run_id);
    assert.equal(current.media.length, 3);
    for (const media of current.media) {
      const response = await fetch(`${baseUrl}/api/runs/${encodeURIComponent(expected.run_id)}/media/${encodeURIComponent(media.media_id)}`, { headers: { range: 'bytes=0-31' } });
      assert.ok([200, 206].includes(response.status));
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
  }
  const screenshot = path.join(acceptanceRoot, 'restart-history.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ status: 'passed', history_run_ids: summary.runs.map((run) => run.run_id), screenshot }));
} finally {
  await browser.close();
}

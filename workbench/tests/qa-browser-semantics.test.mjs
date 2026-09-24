import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { projectCaseAgentInstructionTemplate } from '../server/build/project-case.mjs';
import { BROWSER_SEMANTICS_RULES } from '../server/build/browser-semantics.mjs';

test('engineering counterexamples: labels, live selection, visibility and scope (zero model)', async () => {
  assert.ok(projectCaseAgentInstructionTemplate().includes(BROWSER_SEMANTICS_RULES));
  const browser = await chromium.launch({ executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const html = await fs.readFile(new URL('./fixtures/qa-browser-semantics.html', import.meta.url), 'utf8');
    for (const internal of ['internal-all', 'alternative-code']) {
      await page.setContent(html.replace('internal-all', internal));
      const select = page.getByRole('combobox', { name: 'Mode' });
      await expect(select.locator('option:checked')).toHaveText('All');
      await expect(select).toHaveValue(internal); // Valid engineering implementation fact, not a product oracle.
      await assert.rejects(() => expect(select).toHaveValue('All', { timeout: 100 }));
      await select.selectOption({ label: 'Ready' });
      await expect(select.locator('option:checked')).toHaveText('Ready');
      await expect(select.locator('option[selected]')).toHaveText('All');
      await select.selectOption({ label: 'All' });
      await expect(select.locator('option:checked')).toHaveText('All');
      await expect(page.locator('button')).toHaveCount(4);
      await expect(page.locator('button:visible')).toHaveCount(2);
      await expect(page.getByRole('main', { name: 'Active panel' }).getByRole('button')).toHaveCount(1);
      await assert.rejects(() => expect(page.locator('button')).toHaveCount(1, { timeout: 100 }));
    }
  } finally { await browser.close(); }
});

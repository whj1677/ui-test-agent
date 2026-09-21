import { test, expect } from '@playwright/test';

test('probe interaction yields PROBE-42', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await page.getByRole('button', { name: '执行探针交互' }).click();
  await expect(page.locator('#probe-result')).toHaveText('PROBE-42');
});

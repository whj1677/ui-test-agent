import {test,expect} from '@playwright/test';
test('diagnostic',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('modified');});});

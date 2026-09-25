import { test, expect } from "@playwright/test";

test("KC-19 结束不晚于开始拒绝", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const dialog = page.getByRole("dialog", { name: "新建预约" });
  const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
  const bulkBook = page.getByRole("button", { name: "批量预约" });
  const applicant = page.getByLabel("申请人");
  const purpose = page.getByLabel("用途");
  const startSel = page.getByLabel("开始整点");
  const endSel = page.getByLabel("结束整点");
  const nextBtn = dialog.getByRole("button", { name: "下一步" });
  const msg = page.locator("#bookMsg");
  const step2 = page.locator("#step2");
  const step3 = page.locator("#step3");

  await test.step("CASE_STEP_1", async () => {
    await eq101.check();
    await expect(eq101).toBeChecked();
    await expect(bulkBook).toBeEnabled();
    await bulkBook.click();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#step1")).toBeVisible();
    await expect(dialog.locator("#selList")).toContainText("EQ-101");

    await nextBtn.click();

    await expect(step2).toBeVisible();
    await expect(step3).toBeHidden();
    await expect(startSel).toBeVisible();
    await expect(endSel).toBeVisible();

    await applicant.fill("张三");
    await purpose.fill("实验测试用途");
    await expect(applicant).toHaveValue("张三");
    await expect(purpose).toHaveValue("实验测试用途");
  });

  await test.step("CASE_STEP_2", async () => {
    await startSel.selectOption({ label: "10:00" });
    await endSel.selectOption({ label: "10:00" });
    await expect(startSel.locator("option:checked")).toHaveText("10:00");
    await expect(endSel.locator("option:checked")).toHaveText("10:00");

    await nextBtn.click();

    await expect(msg).toHaveText("结束必须严格晚于开始");
    await expect(step2).toBeVisible();
    await expect(step3).toBeHidden();
  });

  await test.step("CASE_STEP_3", async () => {
    await startSel.selectOption({ label: "14:00" });
    await endSel.selectOption({ label: "12:00" });
    await expect(startSel.locator("option:checked")).toHaveText("14:00");
    await expect(endSel.locator("option:checked")).toHaveText("12:00");

    await nextBtn.click();

    await expect(msg).toHaveText("结束必须严格晚于开始");
    await expect(step3).toBeHidden();
    await expect(applicant).toHaveValue("张三");
    await expect(purpose).toHaveValue("实验测试用途");
    await expect(dialog.locator("#selList")).toContainText("EQ-101");

    await startSel.selectOption({ label: "12:00" });
    await endSel.selectOption({ label: "14:00" });
    await expect(startSel.locator("option:checked")).toHaveText("12:00");
    await expect(endSel.locator("option:checked")).toHaveText("14:00");

    await nextBtn.click();

    await expect(step3).toBeVisible();
    await expect(step2).toBeHidden();
    await expect(dialog.locator("#confirmBox")).toContainText("12:00-14:00");
  });
});

import { test, expect } from "@playwright/test";

// KC-15 向导回退保留输入
// 正常入口由任务绑定；本机合成数据；保留原始用例输入。
test("KC-15 向导回退保留输入", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const bookDialog = page.getByRole("dialog", { name: "新建预约" });
  const applicant = bookDialog.getByLabel("申请人");
  const purpose = bookDialog.getByLabel("用途");
  const date = bookDialog.getByLabel("日期");
  const startHour = bookDialog.getByLabel("开始整点");
  const endHour = bookDialog.getByLabel("结束整点");
  const stepOne = bookDialog.locator("#step1");
  const errorRegion = bookDialog.locator('[aria-live="assertive"]');

  await test.step("CASE_STEP_1", async () => {
    const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
    await expect(eq101).toBeVisible();
    await eq101.check();
    await expect(eq101).toBeChecked();

    await page.getByRole("button", { name: "批量预约" }).click();

    await expect(bookDialog).toBeVisible();
    await expect(stepOne.getByRole("heading", { name: "已选设备" })).toBeVisible();
    await expect(stepOne).toContainText("EQ-101");

    await bookDialog.getByRole("button", { name: "下一步" }).click();

    // 进入第2步 时间用途 页
    await expect(applicant).toBeVisible();
    await expect(date).toBeVisible();
    await expect(startHour).toBeVisible();
    await expect(endHour).toBeVisible();
    await expect(purpose).toBeVisible();
  });

  await test.step("CASE_STEP_2", async () => {
    await applicant.fill("王五");
    await purpose.fill("高温老化验证");
    await date.fill("2026-10-11");
    await startHour.selectOption({ label: "13:00" });
    await endHour.selectOption({ label: "15:00" });

    await expect(applicant).toHaveValue("王五");
    await expect(purpose).toHaveValue("高温老化验证");
    await expect(date).toHaveValue("2026-10-11");
    await expect(startHour.locator("option:checked")).toHaveText("13:00");
    await expect(endHour.locator("option:checked")).toHaveText("15:00");
    await expect(errorRegion).toBeEmpty();
  });

  await test.step("CASE_STEP_3", async () => {
    await bookDialog.getByRole("button", { name: "返回" }).click();

    // 回到第1步，已选设备仍为 EQ-101
    await expect(stepOne.getByRole("heading", { name: "已选设备" })).toBeVisible();
    await expect(stepOne).toContainText("EQ-101");

    await bookDialog.getByRole("button", { name: "下一步" }).click();

    // 再次进入第2步，五项输入全部保留
    await expect(applicant).toHaveValue("王五");
    await expect(purpose).toHaveValue("高温老化验证");
    await expect(date).toHaveValue("2026-10-11");
    await expect(startHour.locator("option:checked")).toHaveText("13:00");
    await expect(endHour.locator("option:checked")).toHaveText("15:00");
  });
});

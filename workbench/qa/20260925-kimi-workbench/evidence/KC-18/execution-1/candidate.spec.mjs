import { test, expect } from "@playwright/test";

test("KC-18 日期越界拒绝", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  await test.step("CASE_STEP_1", async () => {
    // 选择 EQ-101（资源基础选择）
    const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
    await eq101.check();
    await expect(eq101).toBeChecked();

    // 打开新建预约向导
    await page.getByRole("button", { name: "批量预约" }).click();
    const wizard = page.getByRole("dialog", { name: "新建预约" });
    await expect(wizard).toBeVisible();

    // 第1步（资源）确认已选 EQ-101，进入第2步
    await expect(page.locator("#step1")).toContainText("EQ-101");
    await page.locator("#to2").click();

    // 到达并停留在第2步
    await expect(page.locator("#step2")).toBeVisible();
    await expect(page.locator("#s2")).toHaveClass(/on/);
    await expect(page.locator("#step3")).toBeHidden();

    // 填写合法基础字段：申请人 张三、用途 稳定性验证
    await page.locator("#applicant").fill("张三");
    await page.locator("#purpose").fill("稳定性验证");
    await expect(page.locator("#applicant")).toHaveValue("张三");
    await expect(page.locator("#purpose")).toHaveValue("稳定性验证");

    // 基础字段通过（无校验错误提示），仍停留在第2步
    await expect(page.locator("#bookMsg")).toHaveText("");
    await expect(page.locator("#step2")).toBeVisible();
    await expect(page.locator("#s2")).toHaveClass(/on/);
    await expect(page.locator("#step3")).toBeHidden();
  });

  await test.step("CASE_STEP_2", async () => {
    // 日期越界 2026-10-09 尝试下一步
    await page.locator("#date").fill("2026-10-09");
    await expect(page.locator("#date")).toHaveValue("2026-10-09");
    await page.locator("#to3").click();

    // 提示日期需在 2026-10-10 至 2026-10-20 含边界
    await expect(page.locator("#bookMsg")).toContainText(
      "日期需在2026-10-10至2026-10-20含边界"
    );

    // 不进入确认（第3步）
    await expect(page.locator("#step3")).toBeHidden();
    await expect(page.locator("#s3")).not.toHaveClass(/on/);
    await expect(page.locator("#step2")).toBeVisible();
  });

  await test.step("CASE_STEP_3", async () => {
    // 改为边界 2026-10-20
    await page.locator("#date").fill("2026-10-20");
    await expect(page.locator("#date")).toHaveValue("2026-10-20");
    await page.locator("#to3").click();

    // 允许进入第3步，日期边界包含
    await expect(page.locator("#step3")).toBeVisible();
    await expect(page.locator("#s3")).toHaveClass(/on/);
    await expect(page.locator("#step3")).toContainText("2026-10-20");
  });
});

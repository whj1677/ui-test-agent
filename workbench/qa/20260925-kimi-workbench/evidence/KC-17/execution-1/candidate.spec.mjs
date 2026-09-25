import { test, expect } from "@playwright/test";

// Frozen case KC-17: 用途不足5字校验 (设备预约调度)
// Precondition "独立重置演示数据" is provided by the bound environment: a fresh
// navigation to PROBE_URL restores the demo data (verified by observation).
test("KC-17 用途不足5字校验", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const wizard = page.getByRole("dialog", { name: "新建预约" });
  const step1 = wizard.locator("#step1"); // 资源
  const step2 = wizard.locator("#step2"); // 时间用途
  const step3 = wizard.locator("#step3"); // 确认
  const applicantInput = wizard.getByLabel("申请人");
  const purposeInput = wizard.getByLabel("用途");
  const purposeError = wizard.locator("#bookMsg"); // aria-live error region of the wizard
  const confirmButton = wizard.locator("#confirmBook"); // 确认预约

  await test.step("CASE_STEP_1", async () => {
    // 选择 EQ-101 并进入第 2 步
    const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
    await eq101.check();
    await expect(eq101).toBeChecked();

    await page.getByRole("button", { name: "批量预约" }).click();
    await expect(wizard).toBeVisible();
    await expect(step1).toContainText("EQ-101");

    await step1.getByRole("button", { name: "下一步" }).click();
    await expect(purposeInput).toBeVisible();

    // 申请人填张三，用途填校准
    await applicantInput.fill("张三");
    await purposeInput.fill("校准");

    // 下一步被拒绝：停留在第 2 步并给出用途去空白后 5 到 100 字的提示
    await step2.getByRole("button", { name: "下一步" }).click();
    await expect(purposeError).toBeVisible();
    await expect(purposeError).toContainText("用途");
    await expect(purposeError).toContainText("空白");
    await expect(purposeError).toContainText("5到100字");
    await expect(step2).toBeVisible();
    await expect(step3).toBeHidden();
    await expect(confirmButton).toBeHidden();
  });

  await test.step("CASE_STEP_2", async () => {
    // 用途输入前后带空格的四个汉字（去两端空白后仍只有 4 字）
    await purposeInput.fill("  校准测试  ");
    await expect(purposeInput).toHaveValue("  校准测试  ");

    // 去两端空白后仍不足 5 字：错误具体且不进入确认
    await step2.getByRole("button", { name: "下一步" }).click();
    await expect(purposeError).toBeVisible();
    await expect(purposeError).toContainText("用途");
    await expect(purposeError).toContainText("空白");
    await expect(purposeError).toContainText("5到100字");
    await expect(step2).toBeVisible();
    await expect(step3).toBeHidden();
    await expect(confirmButton).toBeHidden();
  });

  await test.step("CASE_STEP_3", async () => {
    // 改为功能联调验证：校验通过进入第 3 步
    await purposeInput.fill("功能联调验证");
    await step2.getByRole("button", { name: "下一步" }).click();

    await expect(step3).toBeVisible();
    await expect(wizard.getByRole("heading", { name: "确认信息" })).toBeVisible();
    await expect(wizard.locator("#confirmBox")).toContainText("功能联调验证");
    await expect(confirmButton).toBeVisible();

    // 返回第 2 步：用途保留
    await step3.getByRole("button", { name: "返回" }).click();
    await expect(step2).toBeVisible();
    await expect(step3).toBeHidden();
    await expect(purposeInput).toHaveValue("功能联调验证");
  });
});

import { test, expect } from "@playwright/test";

// KC-20 超过4小时拒绝：设备预约调度（独立重置演示数据由绑定的 NORMAL 环境提供）
test("KC-20 预约时长超过4小时被拒绝，4小时边界允许", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const eq105 = page.getByRole("checkbox", { name: "选择EQ-105" });
  const batchBook = page.getByRole("button", { name: "批量预约" });
  const nextButton = page.getByRole("button", { name: "下一步" });
  const bookDialog = page.getByRole("dialog", { name: "新建预约" });
  const applicant = bookDialog.getByRole("textbox", { name: "申请人" });
  const purpose = bookDialog.getByRole("textbox", { name: "用途" });
  const startHour = bookDialog.getByLabel("开始整点");
  const endHour = bookDialog.getByLabel("结束整点");
  const durationError = bookDialog.getByText("预约时长需为1到4小时", { exact: true });
  const confirmHeading = bookDialog.getByRole("heading", { name: "确认信息" });
  const confirmButton = bookDialog.getByRole("button", { name: "确认预约" });

  await test.step("CASE_STEP_1", async () => {
    // 选择 EQ-105 并进入第2步
    await eq105.check();
    await expect(eq105).toBeChecked();
    await expect(batchBook).toBeEnabled();
    await batchBook.click();

    await expect(bookDialog).toBeVisible();
    await expect(bookDialog.getByText("EQ-105 电源柜 北站 60元/小时")).toBeVisible();
    await nextButton.click();

    // 合法填写申请人和用途
    await expect(applicant).toBeVisible();
    await applicant.fill("张三");
    await purpose.fill("设备例行测试");
    await expect(applicant).toHaveValue("张三");
    await expect(purpose).toHaveValue("设备例行测试");

    // 时间字段已就绪，可被校验（可见、可用，且展示时间校验规则）
    await expect(startHour).toBeVisible();
    await expect(startHour).toBeEnabled();
    await expect(endHour).toBeVisible();
    await expect(endHour).toBeEnabled();
    await expect(
      bookDialog.getByText(
        "时间限08:00-18:00，结束严格晚于开始，时长1-4小时；与已确认预约半开区间重叠禁止，紧接结束时刻允许。"
      )
    ).toBeVisible();
  });

  await test.step("CASE_STEP_2", async () => {
    // 设置 08:00 到 13:00（5小时）
    await startHour.selectOption({ label: "08:00" });
    await endHour.selectOption({ label: "13:00" });
    await expect(startHour.locator("option:checked")).toHaveText("08:00");
    await expect(endHour.locator("option:checked")).toHaveText("13:00");

    await nextButton.click();

    // 提示时长需为1到4小时，且不进入确认步骤
    await expect(durationError).toBeVisible();
    await expect(confirmHeading).toHaveCount(0);
    await expect(confirmButton).toHaveCount(0);
    // 仍停留在第2步（时间/用途表单）
    await expect(applicant).toBeVisible();
    await expect(purpose).toBeVisible();
  });

  await test.step("CASE_STEP_3", async () => {
    // 改为 08:00 到 12:00（4小时，边界）
    await endHour.selectOption({ label: "12:00" });
    await expect(startHour.locator("option:checked")).toHaveText("08:00");
    await expect(endHour.locator("option:checked")).toHaveText("12:00");

    await nextButton.click();

    // 边界允许，进入第3步确认
    await expect(confirmHeading).toBeVisible();
    await expect(confirmButton).toBeVisible();
    await expect(durationError).toHaveCount(0);
    await expect(bookDialog.getByText(/08:00-12:00/)).toBeVisible();
    await expect(bookDialog.getByText(/时长：4小时/)).toBeVisible();
  });
});

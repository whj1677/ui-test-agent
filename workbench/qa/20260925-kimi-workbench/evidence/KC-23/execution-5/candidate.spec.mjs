import { test, expect } from "@playwright/test";

// ---- 只读定位辅助（页面结构观察自正常入口） ----

function statsRegion(page) {
  return page.getByRole("region", { name: "统计" });
}

// 统计卡片结构：<div><span>标签</span><b>数值</b></div>；按标签绑定同一项内的数值元素
function statValue(page, label) {
  return statsRegion(page)
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::b");
}

function bookingDialog(page) {
  return page.locator('[role="dialog"]').filter({ hasText: "新建预约" });
}

function recordsTable(page) {
  return page.getByRole("table", { name: "预约记录" });
}

function bookingRows(page, bookingNo) {
  return recordsTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: bookingNo, exact: true }) });
}

function deviceRow(page, code) {
  return page
    .getByRole("table", { name: "设备列表" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: code, exact: true }) });
}

test("KC-23 多设备总价与双击确认只增一条", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  let idleCountBeforeBooking = "";

  await test.step("CASE_STEP_1", async () => {
    // 前置条件：独立重置演示数据，使初始状态只含已确认预约 R-001
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "重置演示数据" }).click();
    await expect(statValue(page, "已确认预约")).toHaveText("1");

    idleCountBeforeBooking = (await statValue(page, "可预约设备").innerText()).trim();
    expect(idleCountBeforeBooking).not.toBe("");

    // 选择 EQ-101 与 EQ-105
    await page.getByRole("checkbox", { name: "选择EQ-101" }).check();
    await page.getByRole("checkbox", { name: "选择EQ-105" }).check();
    await expect(page.getByRole("checkbox", { name: "选择EQ-101" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "选择EQ-105" })).toBeChecked();
    await expect(page.getByText(/^已选\s*2\s*项/)).toBeVisible();

    await page.getByRole("button", { name: "批量预约" }).click();
    const dialog = bookingDialog(page);
    await expect(dialog).toBeVisible();

    // 步骤 1（已选设备）→ 步骤 2（时间用途）
    await dialog.getByRole("button", { name: "下一步" }).click();

    await dialog.getByRole("textbox", { name: "申请人" }).fill("孙八");
    await dialog.getByRole("textbox", { name: "用途" }).fill("联合压力测试");
    await dialog.getByRole("textbox", { name: "日期" }).fill("2026-10-12");
    await dialog.getByLabel("开始整点").selectOption({ label: "13:00" });
    await dialog.getByLabel("结束整点").selectOption({ label: "15:00" });

    await expect(dialog.getByRole("textbox", { name: "申请人" })).toHaveValue("孙八");
    await expect(dialog.getByRole("textbox", { name: "用途" })).toHaveValue("联合压力测试");
    await expect(dialog.getByRole("textbox", { name: "日期" })).toHaveValue("2026-10-12");
    // 当前选中项按可见文本 13:00 / 15:00 校验
    await expect(dialog.locator("#start option:checked")).toHaveText("13:00");
    await expect(dialog.locator("#end option:checked")).toHaveText("15:00");

    // 步骤 2 → 步骤 3（确认）
    await dialog.getByRole("button", { name: "下一步" }).click();
    const confirmStep = dialog.locator("#step3");

    // 第 3 步列出两台设备
    await expect(confirmStep.getByText("EQ-101 温循箱")).toBeVisible();
    await expect(confirmStep.getByText("EQ-105 电源柜")).toBeVisible();

    // 时长 2 小时、小时费合计 140 元、总价 280 元
    const summary = confirmStep.getByText(/时长：2小时/);
    await expect(summary).toContainText("时长：2小时");
    await expect(summary).toContainText("小时费合计：140元");
    await expect(summary).toContainText("总价：280元");
  });

  await test.step("CASE_STEP_2", async () => {
    const dialog = bookingDialog(page);
    const confirmButton = dialog.getByRole("button", { name: "确认预约" });
    const confirmState = page.locator("#confirmBook");

    // 创建前的可用性校验完成后，确认按钮才可点击
    await expect(confirmButton).toBeEnabled({ timeout: 15000 });

    // DIAGNOSTIC: 读取点击过程中按钮的实时状态
    const pendingClick = confirmButton.click();
    const secondAttempt = confirmButton
      .click({ timeout: 3000 })
      .then(
        () => "clicked",
        () => "rejected",
      );
    const stateDuringFirst = await confirmState.evaluate((el) => el.disabled);
    await pendingClick;
    const stateAfterFirst = await confirmState.evaluate((el) => el.disabled);
    const secondResult = await secondAttempt;
    await expect(dialog).toBeHidden();
    await expect(recordsTable(page)).toBeVisible();
    const diagNumbers = [
      ...new Set(
        (await recordsTable(page).locator("tbody tr td:first-child").allInnerTexts()).map((value) =>
          value.trim(),
        ),
      ),
    ];
    expect(
      `DIAG|duringFirst=${stateDuringFirst}|afterFirst=${stateAfterFirst}|second=${secondResult}|numbers=${diagNumbers.join("/")}`,
    ).toBe("DIAG");

    // 仅新增一个预约号 R-002
    await expect(bookingRows(page, "R-002").first()).toBeVisible();
    const numbers = await recordsTable(page).locator("tbody tr td:first-child").allInnerTexts();
    console.log("DIAG_NUMBERS=" + JSON.stringify([...new Set(numbers.map((value) => value.trim()))]));
  });

  await test.step("CASE_STEP_3", async () => {
    // 跳转到预约记录
    await expect(page.getByRole("heading", { name: "预约记录" })).toBeVisible();
    const table = recordsTable(page);
    await expect(table).toBeVisible();

    // R-002 已确认，总价 280 元
    const r002Rows = bookingRows(page, "R-002");
    const r002Count = await r002Rows.count();
    console.log("DIAG_R002_ROWS=" + r002Count);
    expect(r002Count).toBeGreaterThan(0);
    for (let index = 0; index < r002Count; index += 1) {
      await expect(r002Rows.nth(index).getByRole("cell", { name: "已确认" })).toBeVisible();
      await expect(r002Rows.nth(index).getByRole("cell", { name: "280元" })).toBeVisible();
    }

    console.log("DIAG_STAT_CONFIRMED=" + (await statValue(page, "已确认预约").innerText()));
    console.log("DIAG_STAT_INCOME=" + (await statValue(page, "已确认收入").innerText()));
    console.log("DIAG_STAT_IDLE=" + (await statValue(page, "可预约设备").innerText()));

    // 统计：已确认预约 2 条
    await expect(statValue(page, "已确认预约")).toHaveText("2");

    // 空闲设备静态状态不变
    await expect(statValue(page, "可预约设备")).toHaveText(idleCountBeforeBooking);
    await page.getByRole("button", { name: "设备资源" }).click();
    await expect(deviceRow(page, "EQ-101").getByRole("cell", { name: "空闲" })).toBeVisible();
    await expect(deviceRow(page, "EQ-105").getByRole("cell", { name: "空闲" })).toBeVisible();
  });
});

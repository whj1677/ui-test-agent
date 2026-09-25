import { test, expect } from "@playwright/test";

const STAT_NAMES = ["设备总数", "可预约设备", "已确认预约", "已确认收入"];

function reservationTable(page) {
  return page.getByRole("table", { name: "预约记录" });
}

function reservationRow(page, reservationId) {
  return reservationTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: reservationId, exact: true }) });
}

async function fieldCell(table, row, label) {
  const headers = (await table.locator("thead th").allTextContents()).map((text) => text.trim());
  const index = headers.indexOf(label);
  if (index < 0) {
    throw new Error(`预约记录表缺少列「${label}」，实际列：${headers.join("、")}`);
  }
  return row.locator("td").nth(index);
}

function statsRegion(page) {
  return page.getByRole("region", { name: "统计" });
}

function statValue(page, label) {
  return statsRegion(page).locator(".card").filter({ hasText: label }).locator("b");
}

async function readStats(page) {
  const snapshot = {};
  for (const name of STAT_NAMES) {
    snapshot[name] = (await statValue(page, name).innerText()).trim();
  }
  return snapshot;
}

function bookingWizard(page) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "新建预约" }) });
}

async function resolveDialog(page, target, decision) {
  let captured = null;
  const handler = async (dialog) => {
    captured = { type: dialog.type(), message: dialog.message() };
    if (decision === "accept") {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  };
  page.on("dialog", handler);
  try {
    await target.click();
  } finally {
    page.off("dialog", handler);
  }
  return captured;
}

function requireDialog(dialog, action) {
  if (dialog === null) {
    throw new Error(`${action} 未出现确认框`);
  }
  return dialog;
}

async function openReservationView(page) {
  await page.getByRole("button", { name: "预约记录" }).click();
  await expect(reservationTable(page)).toBeVisible();
}

test("KC-24 取消先放弃再确认后可再约", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  await test.step("CASE_STEP_1", async () => {
    await openReservationView(page);
    const table = reservationTable(page);
    const row = reservationRow(page, "R-001");
    await expect(row).toBeVisible();
    const statusCell = await fieldCell(table, row, "状态");
    await expect(statusCell).toHaveText("已确认");

    const statsBefore = await readStats(page);
    const cancelButton = row.getByRole("button", { name: "取消预约" });
    await expect(cancelButton).toBeEnabled();

    const dialog = requireDialog(
      await resolveDialog(page, cancelButton, "dismiss"),
      "取消预约后放弃",
    );
    expect(dialog.type).toBe("confirm");

    await expect(statusCell).toHaveText("已确认");
    expect(await readStats(page)).toEqual(statsBefore);
    await expect(cancelButton).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    const table = reservationTable(page);
    const row = reservationRow(page, "R-001");
    const cancelButton = row.getByRole("button", { name: "取消预约" });
    await expect(cancelButton).toBeEnabled();

    const dialog = requireDialog(
      await resolveDialog(page, cancelButton, "accept"),
      "再次取消预约后确认",
    );
    expect(dialog.type).toBe("confirm");

    await expect(await fieldCell(table, row, "状态")).toHaveText("已取消");
    await expect(row).toBeVisible();
    await expect(await fieldCell(table, row, "总价")).toHaveText("40元");
    await expect(await fieldCell(table, row, "时间")).toHaveText("2026-10-10 10:00至12:00");
    await expect(cancelButton).toBeDisabled();
    await expect(statValue(page, "已确认预约")).toHaveText("0");
    await expect(statValue(page, "已确认收入")).toHaveText("0");
  });

  await test.step("CASE_STEP_3", async () => {
    await page.getByRole("button", { name: "设备资源" }).click();
    const deviceTable = page.getByRole("table", { name: "设备列表" });
    await expect(deviceTable).toBeVisible();
    const deviceRow = deviceTable
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "EQ-103", exact: true }) });
    await deviceRow.getByRole("checkbox", { name: "选择EQ-103" }).check();
    await page.getByRole("button", { name: "批量预约" }).click();

    const wizard = bookingWizard(page);
    await expect(wizard).toBeVisible();
    await expect(wizard).toContainText("EQ-103");
    await wizard.getByRole("button", { name: "下一步" }).click();

    await page.getByLabel("申请人").fill("王强");
    await page.getByLabel("日期").fill("2026-10-10");
    await page.getByLabel("开始整点").selectOption({ label: "10:00" });
    await page.getByLabel("结束整点").selectOption({ label: "12:00" });
    await page.getByLabel("用途").fill("例行精度检测");

    await expect(page.getByLabel("日期")).toHaveValue("2026-10-10");
    await expect(page.getByLabel("开始整点").locator("option:checked")).toHaveText("10:00");
    await expect(page.getByLabel("结束整点").locator("option:checked")).toHaveText("12:00");

    await wizard.getByRole("button", { name: "下一步" }).click();
    await expect(wizard).toContainText("2026-10-10 10:00-12:00");
    const confirmButton = wizard.getByRole("button", { name: "确认预约" });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    await expect(reservationTable(page)).toBeVisible();
    const table = reservationTable(page);
    const newRow = reservationRow(page, "R-002");
    await expect(newRow).toBeVisible();
    await expect(await fieldCell(table, newRow, "设备")).toHaveText("EQ-103 示波器");
    await expect(await fieldCell(table, newRow, "时间")).toHaveText("2026-10-10 10:00至12:00");
    await expect(await fieldCell(table, newRow, "状态")).toHaveText("已确认");
    await expect(await fieldCell(table, reservationRow(page, "R-001"), "状态")).toHaveText("已取消");

    await page.goto(process.env.PROBE_URL);
    await openReservationView(page);
    const tableAfterReload = reservationTable(page);
    const reloadedRow = reservationRow(page, "R-002");
    await expect(reloadedRow).toBeVisible();
    await expect(await fieldCell(tableAfterReload, reloadedRow, "设备")).toHaveText("EQ-103 示波器");
    await expect(await fieldCell(tableAfterReload, reloadedRow, "时间")).toHaveText(
      "2026-10-10 10:00至12:00",
    );
    await expect(await fieldCell(tableAfterReload, reloadedRow, "状态")).toHaveText("已确认");
    await expect(
      await fieldCell(tableAfterReload, reservationRow(page, "R-001"), "状态"),
    ).toHaveText("已取消");
  });
});

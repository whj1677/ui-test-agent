import { test, expect } from "@playwright/test";

test("KC-11 维护与使用中的设备不可预约", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const deviceRows = deviceTable.locator("tbody tr");
  const statusFilter = (label) =>
    page.getByRole("checkbox", { name: label, exact: true });
  const selectionSummary = page.getByText(/已选\s*\d+\s*项/);

  await expect(deviceTable).toBeVisible();

  await test.step("CASE_STEP_1", async () => {
    // 查看EQ-102维护行：默认只勾选“空闲”，需同时启用“维护”状态才能看到维护中的设备。
    await statusFilter("维护").check();
    await expect(statusFilter("维护")).toBeChecked();

    const maintenanceRow = deviceRows.filter({ hasText: "EQ-102" });
    await expect(maintenanceRow).toHaveCount(1);
    await expect(
      maintenanceRow.getByRole("cell", { name: "维护", exact: true })
    ).toBeVisible();

    // 选择复选框禁用，且以“不可预约”标注（体现在复选框的可访问名称上）。
    const maintenanceCheckbox = maintenanceRow.getByRole("checkbox");
    await expect(maintenanceCheckbox).toBeDisabled();
    await expect(maintenanceCheckbox).not.toBeChecked();
    await expect(
      maintenanceRow.getByRole("checkbox", { name: /不可预约/ })
    ).toBeVisible();
    // 禁用复选框无法被选中，因此不能加入批量预约集合，已选数量保持为 0。
    await expect(selectionSummary).toContainText("已选 0 项");
  });

  await test.step("CASE_STEP_2", async () => {
    // 搜索“温循箱”，并在状态中同时启用“使用中”，让空闲的EQ-101与使用中的EQ-104同页显示。
    await statusFilter("使用中").check();
    await expect(statusFilter("使用中")).toBeChecked();
    await page.getByRole("searchbox", { name: "搜索编号或名称" }).fill("温循箱");

    const idleRow = deviceRows.filter({ hasText: "EQ-101" });
    const inUseRow = deviceRows.filter({ hasText: "EQ-104" });
    await expect(idleRow).toHaveCount(1);
    await expect(inUseRow).toHaveCount(1);
    await expect(
      inUseRow.getByRole("cell", { name: "使用中", exact: true })
    ).toBeVisible();

    // EQ-104 使用中：复选框禁用且标注不可预约。
    const inUseCheckbox = inUseRow.getByRole("checkbox");
    await expect(inUseCheckbox).toBeDisabled();
    await expect(inUseCheckbox).not.toBeChecked();
    await expect(
      inUseRow.getByRole("checkbox", { name: /不可预约/ })
    ).toBeVisible();

    // EQ-101 空闲：复选框可勾选。
    const idleCheckbox = idleRow.getByRole("checkbox");
    await expect(idleCheckbox).toBeEnabled();
    await idleCheckbox.check();
    await expect(idleCheckbox).toBeChecked();
    await idleCheckbox.uncheck();
    await expect(idleCheckbox).not.toBeChecked();
  });

  await test.step("CASE_STEP_3", async () => {
    // 在当前含不可预约行的页面上尝试全选。
    const selectAll = deviceTable.getByRole("checkbox", {
      name: "当前页全选可预约行",
    });
    await expect(selectAll).toBeEnabled();
    await selectAll.check();
    await expect(selectAll).toBeChecked();

    const idleRow = deviceRows.filter({ hasText: "EQ-101" });
    const inUseRow = deviceRows.filter({ hasText: "EQ-104" });
    // 全选只选中空闲可预约行。
    await expect(idleRow.getByRole("checkbox")).toBeChecked();
    // 不可预约行保持未选（仍为禁用状态）。
    await expect(inUseRow.getByRole("checkbox")).not.toBeChecked();
    await expect(inUseRow.getByRole("checkbox")).toBeDisabled();
    await expect(selectionSummary).toContainText("已选 1 项");
  });
});

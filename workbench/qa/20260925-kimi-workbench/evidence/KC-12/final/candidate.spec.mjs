import { test, expect } from "@playwright/test";

test("KC-12 南站同名设备详情与返回状态保持", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  // 前置：独立重置演示数据，得到确定的合成数据基线
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重置演示数据" }).click();
  await expect(page.getByRole("searchbox", { name: "搜索编号或名称" })).toHaveValue("");

  await test.step("CASE_STEP_1", async () => {
    // 搜索温循箱并站点选南站。目标 EQ-104 状态为“使用中”，而页面默认只勾选“空闲”，
    // 因此必须同时勾选“使用中”，EQ-104 才会出现在结果列表中（控件语义，非新增业务期望）。
    await page.getByRole("searchbox", { name: "搜索编号或名称" }).fill("温循箱");
    await page.getByRole("button", { name: /^站点/ }).click();
    await page.getByRole("option", { name: "南站", exact: true }).click();
    await page.getByRole("checkbox", { name: "使用中" }).check();

    const eq104Row = page.locator("#devBody tr").filter({ hasText: "EQ-104" });
    await expect(eq104Row).toBeVisible();
    await eq104Row.getByRole("button", { name: "详情" }).click();

    const drawer = page.getByRole("dialog");
    // 抽屉先显示加载中（内容区尚未出现）
    await expect(drawer).toHaveClass(/\bopen\b/);
    await expect(drawer.locator("#drawerMsg")).toBeVisible();
    await expect(drawer.locator("#drawerMsg")).toHaveText("加载中…");
    await expect(drawer.locator("#drawerBox")).toBeHidden();

    // 随后显示 EQ-104 的编号 / 名称 / 站点 / 状态 / 费用，每个字段分别绑定其标签
    await expect(drawer.locator("#drawerBox")).toBeVisible();
    await expect(drawer.locator("#drawerMsg")).toBeHidden();
    const field = (label) => drawer.locator("#drawerBasic p", { hasText: label });
    await expect(field("编号：")).toHaveText("编号：EQ-104");
    await expect(field("名称：")).toHaveText("名称：温循箱");
    await expect(field("站点：")).toHaveText("站点：南站");
    await expect(field("状态：")).toHaveText("状态：使用中");
    await expect(field("费用：")).toHaveText("费用：90元/小时");
  });

  await test.step("CASE_STEP_2", async () => {
    const drawer = page.getByRole("dialog");
    // 当前详情对象仍为 EQ-104（同名设备不得串用）
    await expect(drawer.getByRole("heading")).toContainText("EQ-104");
    await drawer.getByRole("tab", { name: "预约历史" }).click();
    await expect(drawer.getByRole("tab", { name: "预约历史" })).toHaveAttribute("aria-selected", "true");
    await expect(drawer.getByRole("tab", { name: "基本信息" })).toHaveAttribute("aria-selected", "false");

    const historyPanel = drawer.locator("#tabPanel");
    await expect(historyPanel).toContainText("无预约历史");
    await expect(historyPanel).not.toContainText("EQ-101");
    await expect(historyPanel).not.toContainText("R-001");
  });

  await test.step("CASE_STEP_3", async () => {
    const drawer = page.getByRole("dialog");
    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect(drawer).not.toHaveClass(/\bopen\b/);
    await expect(drawer).not.toBeInViewport();

    // 搜索、站点、状态多选、页码与选择保持原样
    await expect(page.getByRole("searchbox", { name: "搜索编号或名称" })).toHaveValue("温循箱");
    await expect(page.getByRole("button", { name: /^站点/ })).toHaveText("南站");
    await expect(page.getByRole("checkbox", { name: "空闲" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "使用中" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "维护" })).not.toBeChecked();
    await expect(page.locator("#pageInfo")).toContainText("第 1/1 页");
    await expect(page.locator("#selInfo")).toContainText("已选 0 项");
    await expect(page.locator("#devBody tr").filter({ hasText: "EQ-104" })).toBeVisible();
  });
});

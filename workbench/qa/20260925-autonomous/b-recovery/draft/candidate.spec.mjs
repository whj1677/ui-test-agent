import { test, expect } from "@playwright/test";

/**
 * NEW-002 遥测首次失败后重试成功并关闭
 * 场景: scene=retry & variant=normal
 *
 * 绑定入口: await page.goto(process.env.PROBE_URL)
 * 首次读取约 400ms 后失败（暂时无法读取），点击重试约 600ms 后读取成功。
 * 打开与重试读取期间“重试”按钮处于不可用状态（隐藏/禁用），失败后重试按钮可见且可用。
 */

const STATUS_READING = "读取中…";
const STATUS_FAILED = "暂时无法读取";
const STATUS_SUCCESS = "读取成功";
const EXPECTED_VOLTAGE = "750 V";
const EXPECTED_SAMPLE_TIME = "2026-09-24 10:00:00";

/**
 * CASE_STEP_2 的义务是“重试按钮禁用或不可见”（显式 OR），两条分支都必须断言自己命名的目标。
 *
 * 这里的重试按钮定位符必须是能解析“仍在 DOM 中但不可见”的控件：
 * 角色/可见性定位符会跳过不可见元素并等待其重新可见，从而在约 400ms 的读取窗口之后
 * 才得到结果，导致 OR 判定失真。因此使用该按钮自身的 DOM 标识来判定禁用或隐藏。
 */
async function expectRetryDisabledOrHidden(retryButton) {
  if (await retryButton.isDisabled()) {
    await expect(retryButton).toBeDisabled();
  } else {
    await expect(retryButton).toBeHidden();
  }
}

test("NEW-002 遥测首次失败后重试成功并关闭", async ({ page }) => {
  // 业务对象: 页面上的“遥测读取”场景区，以及其内部的“遥测详情”对话框。
  const telemetryRegion = page.getByRole("region", { name: "遥测读取" });
  const pagingRegion = page.getByRole("region", { name: "分页清单" });
  const wizardRegion = page.getByRole("region", { name: "维护申请预览" });
  const openButton = page.getByRole("button", { name: "查看遥测" });
  const dialog = page.getByRole("dialog", { name: "遥测详情" });
  const status = dialog.locator("#tStatus");
  // 读取窗口内需要判定“禁用或不可见”，故用可解析隐藏控件的 DOM 定位符
  const retryButton = dialog.locator("#tRetry");
  // 失败态下重试按钮可见，用名称绑定确认业务对象
  const visibleRetryButton = dialog.getByRole("button", { name: "重试" });
  const closeButton = dialog.getByRole("button", { name: "关闭" });

  await test.step("CASE_STEP_1", async () => {
    // 步骤1: 打开该用例绑定入口（scene=retry，variant=normal）
    await page.goto(process.env.PROBE_URL);
    // 仅显示遥测读取相关控件: 遥测读取区域可见，其它场景区不可见
    await expect(telemetryRegion).toBeVisible();
    await expect(pagingRegion).toBeHidden();
    await expect(wizardRegion).toBeHidden();
    await expect(page.locator("main section.view:visible")).toHaveCount(1);
    await expect(page.locator("main button:visible")).toHaveCount(1);
    // 按钮“查看遥测”可用
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    // 步骤2: 点击查看遥测
    await openButton.click();
    // 立即显示“读取中…”（首次读取约 400ms 后才失败，此处立刻读取当前状态）
    expect(((await status.textContent()) ?? "").trim()).toBe(STATUS_READING);
    // 重试按钮禁用或不可见（在同一读取窗口内判定）
    await expectRetryDisabledOrHidden(retryButton);
    // 出现 role=dialog 且 aria-label 为“遥测详情”
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-label", "遥测详情");
  });

  await test.step("CASE_STEP_3", async () => {
    // 步骤3: 等待约450毫秒，状态变为“暂时无法读取”
    await expect(status).toHaveText(STATUS_FAILED);
    // 重试按钮可见且可用
    await expect(visibleRetryButton).toBeVisible();
    await expect(visibleRetryButton).toBeEnabled();
  });

  await test.step("CASE_STEP_4", async () => {
    // 步骤4: 点击重试
    await visibleRetryButton.click();
    // 立即显示“读取中…”（重试约 600ms 后才成功，此处立刻读取当前状态）
    expect(((await status.textContent()) ?? "").trim()).toBe(STATUS_READING);
    // 重试按钮禁用
    await expect(retryButton).toBeDisabled();
  });

  await test.step("CASE_STEP_5", async () => {
    // 步骤5: 再等待约650毫秒，显示读取成功
    await expect(status).toHaveText(STATUS_SUCCESS);
    // 电压: 由字段标签“电压”定位其相邻的值元素，再与冻结值比较
    await expect(dialog.getByText("电压", { exact: true })).toBeVisible();
    await expect(dialog.locator('.kv > span:text-is("电压") + strong')).toHaveText(EXPECTED_VOLTAGE);
    // 采样时间: 由字段标签“采样时间”定位其相邻的值元素，再与冻结值比较
    await expect(dialog.getByText("采样时间", { exact: true })).toBeVisible();
    await expect(dialog.locator('.kv > span:text-is("采样时间") + strong')).toHaveText(EXPECTED_SAMPLE_TIME);
  });

  await test.step("CASE_STEP_6", async () => {
    // 步骤6: 点击关闭
    await closeButton.click();
    // 遥测详情 dialog 不可见
    await expect(dialog).toBeHidden();
  });
});

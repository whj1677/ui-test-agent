import { test, expect } from "@playwright/test";

/**
 * NEW-002 遥测首次失败后重试成功并关闭 (scene=retry&variant=normal)
 *
 * 绑定入口: await page.goto(process.env.PROBE_URL)
 * 首次读取失败约 400ms 后出现“暂时无法读取”，重试约 600ms 后读取成功。
 */

const STATUS_READING = "读取中…";
const STATUS_FAILED = "暂时无法读取";
const STATUS_SUCCESS = "读取成功";
const VOLTAGE_LABEL = "电压";
const SAMPLE_TIME_LABEL = "采样时间";
const EXPECTED_VOLTAGE = "750 V";
const EXPECTED_SAMPLE_TIME = "2026-09-24 10:00:00";

/**
 * 业务对象: 遥测详情 dialog 内的字段值。
 * 通过字段标签定位其紧随的值元素 (<span>电压</span><strong>750 V</strong>)。
 */
function valueOfField(dialog, label) {
  return dialog.locator(`.kv > span:text-is("${label}") + strong`);
}

/** 步骤2 的义务是“禁用或不可见”，两个分支都必须满足原义务。 */
async function expectRetryDisabledOrHidden(retryButton) {
  if (await retryButton.isDisabled()) return;
  await expect(retryButton).toBeHidden();
}

test("NEW-002 遥测首次失败后重试成功并关闭", async ({ page }) => {
  const telemetryRegion = page.getByRole("region", { name: "遥测读取" });
  const openButton = page.getByRole("button", { name: "查看遥测" });
  const dialog = page.locator("#dlg");
  const status = dialog.locator("#tStatus");
  const retryButton = dialog.locator("#tRetry");
  const closeButton = dialog.locator("#tClose");

  await test.step("CASE_STEP_1", async () => {
    // 打开该用例绑定入口（scene=retry，variant=normal）
    await page.goto(process.env.PROBE_URL);
    // 仅显示遥测读取相关控件: 只有遥测读取区域可见，其它场景视图不可见
    await expect(telemetryRegion).toBeVisible();
    await expect(page.locator("#pagingView")).toBeHidden();
    await expect(page.locator("#wizardView")).toBeHidden();
    await expect(page.locator("main section.view:visible")).toHaveCount(1);
    await expect(page.locator("main button:visible")).toHaveCount(1);
    // 按钮“查看遥测”可用
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    // 点击查看遥测
    await openButton.click();
    // 立即显示“读取中…”（首次读取在约400ms后才失败，因此这里做即时读取）
    expect(((await status.textContent()) ?? "").trim()).toBe(STATUS_READING);
    // 重试按钮禁用或不可见
    await expectRetryDisabledOrHidden(retryButton);
    // 出现 role=dialog 且 aria-label 为“遥测详情”
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-label", "遥测详情");
  });

  await test.step("CASE_STEP_3", async () => {
    // 等待约450毫秒: 由自动重试断言等待状态切换，不使用固定 sleep
    await expect(status).toHaveText(STATUS_FAILED);
    // 重试按钮可见且可用
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  await test.step("CASE_STEP_4", async () => {
    // 点击重试
    await retryButton.click();
    // 立即显示“读取中…”（重试在约600ms后才成功，因此这里做即时读取）
    expect(((await status.textContent()) ?? "").trim()).toBe(STATUS_READING);
    // 重试按钮禁用
    await expect(retryButton).toBeDisabled();
  });

  await test.step("CASE_STEP_5", async () => {
    // 再等待约650毫秒: 自动重试断言等待读取成功
    await expect(status).toHaveText(STATUS_SUCCESS);
    // 电压 750 V（按字段标签绑定值元素）
    await expect(valueOfField(dialog, VOLTAGE_LABEL)).toHaveText(EXPECTED_VOLTAGE);
    // 采样时间 2026-09-24 10:00:00
    await expect(valueOfField(dialog, SAMPLE_TIME_LABEL)).toHaveText(EXPECTED_SAMPLE_TIME);
  });

  await test.step("CASE_STEP_6", async () => {
    // 点击关闭
    await closeButton.click();
    // 遥测详情 dialog 不可见
    await expect(dialog).toBeHidden();
  });
});

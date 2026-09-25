import { test, expect } from "@playwright/test";

test("遥测首次失败后重试成功并关闭", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const telemetryRegion = page
    .getByRole("region")
    .filter({ has: page.getByRole("heading", { name: "遥测读取" }) });
  const viewButton = telemetryRegion.getByRole("button", { name: "查看遥测" });
  const detailDialog = page.getByRole("dialog", { name: "遥测详情" });
  const retryButton = detailDialog.getByRole("button", { name: "重试" });
  const closeButton = detailDialog.getByRole("button", { name: "关闭" });

  // 步骤2/步骤4 共用的“重试按钮禁用或不可见”判定（保留原始“禁用 或 不可见”的语义）
  async function expectRetryUnavailable() {
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeDisabled();
    } else {
      await expect(retryButton).toBeHidden();
    }
  }

  await test.step("CASE_STEP_1", async () => {
    await expect(telemetryRegion.getByRole("heading", { name: "遥测读取" })).toBeVisible();
    await expect(viewButton).toBeVisible();
    await expect(viewButton).toBeEnabled();
    await expect(telemetryRegion.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await test.step("CASE_STEP_2", async () => {
    await viewButton.click();
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText("读取中")).toBeVisible();
    await expectRetryUnavailable();
  });

  await test.step("CASE_STEP_3", async () => {
    await page.waitForTimeout(450);
    await expect(detailDialog.getByText("暂时无法读取")).toBeVisible();
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  await test.step("CASE_STEP_4", async () => {
    await retryButton.click();
    await expect(detailDialog.getByText("读取中")).toBeVisible();
    await expect(retryButton).toBeDisabled();
  });

  await test.step("CASE_STEP_5", async () => {
    await page.waitForTimeout(650);
    await expect(detailDialog.getByText("读取成功")).toBeVisible();
    await expect(
      detailDialog.getByText("电压", { exact: true }).locator("xpath=./following-sibling::strong")
    ).toHaveText("750 V");
    await expect(
      detailDialog.getByText("采样时间", { exact: true }).locator("xpath=./following-sibling::strong")
    ).toHaveText("2026-09-24 10:00:00");
  });

  await test.step("CASE_STEP_6", async () => {
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(detailDialog).toBeHidden();
  });
});

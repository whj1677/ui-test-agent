import { test, expect } from "@playwright/test";

test("KC-07 diag5: reset network requests", async ({ page }) => {
  const seen = [];
  page.on("request", (request) => {
    seen.push("REQ " + request.method() + " " + request.url());
  });
  page.on("response", (response) => {
    seen.push("RES " + response.status() + " " + response.url());
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(process.env.PROBE_URL);
  const before = seen.length;

  await page.getByRole("button", { name: "重置演示数据" }).click();
  await page.waitForTimeout(1500);

  expect(JSON.stringify(seen.slice(before))).toBe("DIAG5");
});

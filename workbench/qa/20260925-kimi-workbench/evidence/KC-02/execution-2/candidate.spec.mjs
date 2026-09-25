import { test, expect } from "@playwright/test";

const SEARCH_LABEL = "搜索编号或名称";
const DEVICE_TABLE_NAME = "设备列表";
const PAGER_PATTERN = /共\s*\d+\s*条，第\s*\d+\/\d+\s*页，每页\s*\d+\s*条/;
const STATUS_LABELS = ["空闲", "使用中", "维护"];
const ALL_DEVICE_NUMBERS = [
  "EQ-101",
  "EQ-102",
  "EQ-103",
  "EQ-104",
  "EQ-105",
  "EQ-106",
  "EQ-107",
  "EQ-108",
];

function searchBox(page) {
  return page.getByRole("searchbox", { name: SEARCH_LABEL });
}

function deviceTable(page) {
  return page.getByRole("table", { name: DEVICE_TABLE_NAME });
}

function pager(page) {
  return page.getByText(PAGER_PATTERN);
}

async function readPager(page) {
  const text = await pager(page).innerText();
  const match = /共\s*(\d+)\s*条，第\s*(\d+)\/(\d+)\s*页/.exec(text);
  if (match === null) {
    throw new Error(`无法解析分页信息: ${text}`);
  }
  return { total: Number(match[1]), page: Number(match[2]), pages: Number(match[3]) };
}

async function readColumn(page, columnIndex) {
  const cells = deviceTable(page).locator(`tbody tr td:nth-child(${columnIndex})`);
  const texts = await cells.allInnerTexts();
  return texts.map((text) => text.trim());
}

async function collectVisibleRows(page) {
  const nextButton = page.getByRole("button", { name: "下一页" });
  const rows = [];
  for (;;) {
    const numbers = await readColumn(page, 2);
    const statuses = await readColumn(page, 5);
    for (let index = 0; index < numbers.length; index += 1) {
      rows.push({ number: numbers[index], status: statuses[index] });
    }
    if (!(await nextButton.isEnabled())) {
      break;
    }
    const textBefore = await pager(page).innerText();
    await nextButton.click();
    await expect(pager(page)).not.toHaveText(textBefore);
  }
  return rows;
}

async function readCheckedStatuses(page) {
  const group = page.getByRole("group", { name: "状态多选" });
  const checked = [];
  for (const label of STATUS_LABELS) {
    if (await group.getByRole("checkbox", { name: label, exact: true }).isChecked()) {
      checked.push(label);
    }
  }
  return checked;
}

test("KC-02 编号模糊搜索不区分大小写", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await expect(deviceTable(page)).toBeVisible();

  await test.step("CASE_STEP_1", async () => {
    const search = searchBox(page);
    await search.fill("eq-10");
    await expect.soft(search).toHaveValue("eq-10");

    const state = await readPager(page);
    expect.soft(state.total).toBe(8);
    expect.soft(state.page).toBe(1);

    const rows = await collectVisibleRows(page);
    expect.soft(rows.map((row) => row.number)).toEqual(ALL_DEVICE_NUMBERS);
  });

  await test.step("CASE_STEP_2", async () => {
    const search = searchBox(page);
    await search.fill("");
    await expect.soft(search).toHaveValue("");
    await search.fill("EQ-106");
    await expect.soft(search).toHaveValue("EQ-106");

    const table = deviceTable(page);
    await expect.soft(table.locator("tbody tr")).toHaveCount(1);
    await expect.soft(table.locator("tbody tr td:nth-child(2)")).toHaveText("EQ-106");

    const state = await readPager(page);
    expect.soft(state.total).toBe(1);
    expect.soft(state.page).toBe(1);
    expect.soft(state.pages).toBe(1);
  });

  await test.step("CASE_STEP_3", async () => {
    const search = searchBox(page);
    await search.fill("eq-1");
    await expect.soft(search).toHaveValue("eq-1");

    const rows = await collectVisibleRows(page);
    const numbers = rows.map((row) => row.number);
    expect.soft(numbers).toEqual(ALL_DEVICE_NUMBERS);

    for (const number of numbers) {
      expect.soft(number.toLowerCase()).toContain("eq-1");
    }

    const checkedStatuses = await readCheckedStatuses(page);
    for (const row of rows) {
      expect.soft(checkedStatuses).toContain(row.status);
    }
  });
});

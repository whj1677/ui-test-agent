import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import http from 'node:http';
import { runtimeLocator, assertRowIdentity } from '../src/row-locator.mjs';
import { BrowserSession, snapshot, perform, checkAssertion } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { validateLocator } from '../src/plans.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const html = `<table aria-label="费率目录"><thead><tr><th>方案名称</th><th>单价</th><th>操作</th></tr></thead><tbody>
<tr><td>日间</td><td>0.68</td><td><button onclick="document.body.dataset.clicked='day'">查看详情</button></td></tr>
<tr><td>夜间</td><td>0.23</td><td><button onclick="document.body.dataset.clicked='night'">查看详情</button></td></tr>
</tbody></table>`;
const table = { kind: 'role', role: 'table', name: '费率目录', exact: true };
const row = { kind: 'row', table, key: { column: '方案名称', value: '夜间' } };
const button = { ...row, target: { kind: 'role', role: 'button', name: '查看详情', exact: true } };
const cell = { kind: 'cell', table, key: row.key, column: '单价' };
const reset = () => page.setContent(html);
const denies = async (code, locator = button) =>
  assert.rejects(runtimeLocator(page, locator).count(), { code });
try {
  validateLocator(button);
  validateLocator(cell);
  assert.throws(() => validateLocator({ ...button, target: cell }), { code: 'INVALID_LOCATOR' });
  await reset();
  assert.equal(await runtimeLocator(page, button.target).count(), 2);
  assert.equal(await runtimeLocator(page, button).count(), 1);
  await perform(page, { op: 'click', target: button }, 'http://localhost');
  assert.equal(await page.getAttribute('body', 'data-clicked'), 'night');
  const negative = await checkAssertion(
    page,
    { target: cell, check: 'text', expected: '0.32' },
    { timeout: 50 },
  );
  assert.equal(negative.passed, false, JSON.stringify(negative));
  assert.equal(negative.actual, '0.23');
  const captured = await snapshot(page);
  assert.equal(
    captured.controls.filter(
      (c) => c.locator?.kind === 'row' && c.locator.target?.name === '查看详情',
    ).length,
    2,
  );
  assert.ok(
    captured.controls.some(
      (c) =>
        c.locator?.kind === 'cell' && c.locator.key.value === '夜间' && c.locator.column === '单价',
    ),
  );

  const old = await runtimeLocator(page, button).elementHandle();
  await page.evaluate(() => {
    const b = document.querySelector('tbody');
    b.prepend(b.lastElementChild);
  });
  await assertRowIdentity(page, button, old); // reorder alone is safe: same key and node
  await page.evaluate(() => {
    document.querySelector('tbody tr').outerHTML = document.querySelector('tbody tr').outerHTML;
  });
  await assert.rejects(assertRowIdentity(page, button, old), { code: 'ROW_SCOPE_CHANGED' });
  await old.dispose();
  const changed = await runtimeLocator(page, button).elementHandle();
  await page.evaluate(() => {
    document.querySelector('tbody tr td').textContent = '别的记录';
  });
  await assert.rejects(assertRowIdentity(page, button, changed), { code: 'ROW_SCOPE_CHANGED' });
  await changed.dispose();
  await reset();
  await page.evaluate(() => {
    document
      .querySelector('tbody')
      .insertAdjacentHTML('beforeend', document.querySelector('tbody tr:last-child').outerHTML);
  });
  await denies('ROW_KEY_NOT_UNIQUE');
  await reset();
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', document.querySelector('table').outerHTML);
  });
  await denies('ROW_TABLE_NOT_UNIQUE');
  await page
    .locator('table')
    .last()
    .evaluate((e) => e.setAttribute('aria-label', '另一目录'));
  assert.equal(await runtimeLocator(page, button).count(), 1);
  await reset();
  await page.evaluate(() => {
    document.querySelector('tbody tr:last-child td:last-child').innerHTML +=
      '<button>查看详情</button>';
  });
  await denies('ROW_TARGET_NOT_UNIQUE');
  await reset();
  await page
    .locator('th')
    .last()
    .evaluate((e) => (e.textContent = '方案名称'));
  await denies('ROW_COLUMN_NOT_UNIQUE');
  for (const attr of ['aria-rowcount="10"', '']) {
    await reset();
    if (attr) await page.locator('table').evaluate((e) => e.setAttribute('aria-rowcount', '10'));
    else
      await page
        .locator('td')
        .first()
        .evaluate((e) => (e.colSpan = 2));
    await denies('ROW_TABLE_UNSUPPORTED');
  }
  await page.setContent(html.replace('<thead>', '<tbody>').replace('</thead><tbody>', ''));
  assert.equal(await runtimeLocator(page, button).count(), 1);
  console.log(
    'Row locator browser checks passed: scoped clicks/cells, wrong-price detection, identity, ambiguity, unsupported table denial.',
  );
} finally {
  await browser.close();
}

// Exercise the product discovery adapter, not just a standalone locator call.
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(
    req.headers.cookie?.includes('rowfixture=1')
      ? '<nav><button>退出登录</button></nav>' + html
      : `<input type="password"><button onclick="document.cookie='rowfixture=1;path=/';location.reload()">登录</button>`,
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const session = new BrowserSession({ headless: true });
const task = {
  id: 'row-discovery-fixture',
  target: `http://127.0.0.1:${server.address().port}/`,
  authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
};
const explorer = new DiscoveryBrowser(session, task);
try {
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '登录', exact: true }).click();
  await session.authenticate(task, { kind: 'role', role: 'button', name: '退出登录', exact: true });
  const observed = await explorer.open();
  const choices = observed.candidates.filter((c) => c.name === '查看详情');
  assert.equal(choices.length, 2);
  const night = choices.find((c) => c.locator.key.value === '夜间');
  assert.ok(night.row_context.includes('夜间'));
  await explorer.act({ candidate_id: night.candidate_id });
  assert.equal(await explorer.page.getAttribute('body', 'data-clicked'), 'night');
  const next = await explorer.observe();
  const stale = next.candidates.find(
    (c) => c.name === '查看详情' && c.locator.key.value === '夜间',
  );
  await explorer.page
    .locator('tbody tr')
    .last()
    .evaluate((e) => {
      e.outerHTML = e.outerHTML;
    });
  await assert.rejects(explorer.act({ candidate_id: stale.candidate_id }), (e) =>
    ['DISCOVERY_STALE_PAGE', 'ROW_SCOPE_CHANGED'].includes(e.code),
  );
  console.log(
    'Product discovery checks passed: two scoped candidates, correct record, stale DOM rejected.',
  );
} finally {
  await explorer.close();
  await session.close();
  await new Promise((resolve) => server.close(resolve));
}

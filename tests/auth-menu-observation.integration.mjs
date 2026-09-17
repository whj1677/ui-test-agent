import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession, snapshot } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';

async function fixture(t) {
  const navigation = `<nav><a href="/home">工作台</a><button aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');document.querySelector('#submenu').hidden=false">资产运营<span aria-hidden="true">›</span></button><button aria-expanded="false">报表中心<span aria-hidden="true">›</span></button><div id="submenu" hidden><a href="/catalog">计费中心</a></div></nav><button>退出登录</button>`;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!req.headers.cookie?.includes('fixture=1'))
      res.end(
        `<input type="password" aria-label="密码"><button onclick="document.cookie='fixture=1;path=/';location.href='/home'">登录</button>`,
      );
    else
      res.end(
        navigation +
          (req.url === '/catalog'
            ? '<h1>费率目录</h1><table><thead><tr><th>方案名称</th></tr></thead><tbody><tr><td>合成日间方案</td></tr></tbody></table>'
            : '<header>工作台</header><main><h1>工作台</h1></main>'),
      );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const task = {
    id: 'auth-menu-regression',
    target: `http://127.0.0.1:${server.address().port}/home`,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  const browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  await browser.open(task);
  return { browser, task };
}

test('duplicate home labels and decorative menu arrows allow automatic protected-page recognition and two-level discovery', async (t) => {
  const { browser, task } = await fixture(t);
  await browser.loginPage.getByRole('button', { name: '登录', exact: true }).click();
  assert.ok((await browser.loginPage.getByText('工作台', { exact: true }).count()) > 1);
  const marker = await browser.waitForAuthentication(task, { timeoutMs: 3500 });
  assert.equal(marker.kind, 'role');
  assert.equal(browser.authEvidence.source, 'VISIBLE_LOGOUT_AND_NAVIGATION');
  assert.equal(browser.authEvidence.stable_samples, 3);
  assert.equal(browser.authenticated, true);
  const owner = browser.loginContext;
  const explorer = new DiscoveryBrowser(browser, task);
  t.after(() => explorer.close());
  let view = await explorer.open();
  assert.deepEqual(view.snapshot.adapter_gaps, []);
  const asset = view.candidates.find((c) => c.name === '资产运营');
  assert.ok(asset, 'menu must be available to the model, not merely present in page text');
  assert.ok(!view.snapshot.controls.some((c) => c.name === '›'));
  view = await explorer.act({ candidate_id: asset.candidate_id });
  view = await explorer.act({
    candidate_id: view.candidates.find((c) => c.name === '计费中心').candidate_id,
  });
  assert.ok(view.snapshot.url.endsWith('/catalog'));
  assert.ok(view.snapshot.controls.some((c) => c.role === 'table'));
  assert.equal(explorer.step, 2);
  assert.equal(browser.loginContext, owner);
});

test('observable names honor labelledby, hidden decoration, nested text, and native role uniqueness', async (t) => {
  const { browser } = await fixture(t);
  await browser.loginPage.setContent(`<h1>共同名称</h1><nav>
    <button>共同名称<span aria-hidden="true">★</span></button>
    <button aria-labelledby="menu-label" aria-label="低优先级名称"><span>ignored</span></button>
    <span id="menu-label" hidden>联动菜单</span>
    <button><span>资产</span><span>管理</span><span style="display:none">密钥不应进名称</span></button>
    <button aria-label="图标菜单"><svg aria-hidden="true"><text>icon</text></svg></button>
    <span aria-hidden="true">›</span></nav>`);
  const shot = await snapshot(browser.loginPage);
  for (const name of ['共同名称', '联动菜单', '资产管理', '图标菜单'])
    assert.ok(
      shot.controls.some((c) => c.role === 'button' && c.name === name),
      JSON.stringify(shot),
    );
  assert.ok(!shot.controls.some((c) => /›|低优先级|密钥不应/.test(c.name)));
  assert.deepEqual(shot.adapter_gaps, []);
});

test('unmapped buttons and incorrect unique destinations are visible repair gaps, never rebound controls', async (t) => {
  const { browser } = await fixture(t);
  await browser.loginPage.setContent(
    '<nav><button>资产管理</button><button>报表中心</button></nav>',
  );
  const missing = await snapshot(browser.loginPage, {
    adapterSource: 'export function locate(element) { return null; }',
  });
  assert.equal(missing.controls.length, 0);
  assert.deepEqual(
    missing.adapter_gaps.map((g) => g.code),
    ['ADAPTER_MAPPING_MISSING', 'ADAPTER_MAPPING_MISSING'],
  );
  const wrong = await snapshot(browser.loginPage, {
    adapterSource:
      'export function locate(element) { return {kind:"role",role:"button",name:"报表中心",exact:true}; }',
  });
  assert.deepEqual(
    wrong.controls.map((c) => c.name),
    ['报表中心'],
  );
  assert.equal(wrong.adapter_gaps[0].code, 'ADAPTER_TARGET_IDENTITY_MISMATCH');
  const none = await snapshot(browser.loginPage, {
    adapterSource:
      'export function locate(element) { return {kind:"role",role:"button",name:"不存在",exact:true}; }',
  });
  assert.equal(none.controls.length, 0);
  assert.equal(none.adapter_gaps.length, 2);
});

test('public menu and hidden logout decoration cannot satisfy positive login evidence', async (t) => {
  const { browser, task } = await fixture(t);
  await browser.loginPage.setContent(
    '<nav><button>资产运营</button><button>报表中心</button></nav><button><span aria-hidden="true">退出登录</span>查看说明</button>',
  );
  await assert.rejects(() => browser.waitForAuthentication(task, { timeoutMs: 1500 }), {
    code: 'LOGIN_EVIDENCE_REQUIRED',
  });
  assert.equal(browser.authenticated, false);
});

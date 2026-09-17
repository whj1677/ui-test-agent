import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { uid } from '../src/common.mjs';

// Synthetic, isolated port-0 fixture; no model or product endpoints are used.
const received = [];
let externalHits = 0;
const assetHits = [];
const outside = http.createServer((request, response) => {
  if (request.url === '/fixture.css') {
    assetHits.push('css');
    response.setHeader('Content-Type', 'text/css');
    response.end('#asset-proof { color: rgb(1, 2, 3); }');
    return;
  }
  if (request.url === '/fixture.js') {
    assetHits.push('js');
    response.setHeader('Content-Type', 'application/javascript');
    response.end('window.fixtureCDNLoaded=true;');
    return;
  }
  externalHits++;
  response.end('outside');
});
await new Promise((resolve) => outside.listen(0, '127.0.0.1', resolve));
const external = `http://127.0.0.1:${outside.address().port}`;
const common = '<span data-testid="signed-in">已登录</span>';
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://fixture');
  received.push({ method: request.method, path: url.pathname });
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/login' && request.method === 'POST') {
    response.writeHead(302, {
      'Set-Cookie': 'fixture_session=yes; Path=/; HttpOnly',
      Location: '/home',
    });
    response.end();
    return;
  }
  if (!request.headers.cookie?.includes('fixture_session=yes')) {
    response.end(
      '<form action="/login" method="post"><input type="password"><button>进入演示</button></form>',
    );
    return;
  }
  if (url.pathname === '/api/query') {
    response.setHeader('Content-Type', 'application/json');
    response.end('{"rows":[]}');
    return;
  }
  if (url.pathname === '/api/save' || url.pathname === '/api/delete') {
    response.end('should never arrive');
    return;
  }
  if (url.pathname === '/assets') {
    response.end(
      `${common}<link rel="stylesheet" href="${external}/fixture.css"><script src="${external}/fixture.js"></script><h1 id="asset-proof">CDN 资源</h1><button type="button" data-testid="iframe" onclick="const frame=document.createElement('iframe');frame.src='${external}/framed';document.body.append(frame)">查看嵌入页</button><button type="button" data-testid="external-write" onclick="fetch('${external}/write',{method:'POST',mode:'no-cors',body:'fixture'}).catch(()=>{})">查看跨域写场景</button>`,
    );
    return;
  }
  if (url.pathname === '/home') {
    response.end(
      `${common}<h1>首页</h1><button type="button" aria-expanded="false" data-testid="menu" onclick="this.setAttribute('aria-expanded','true');document.querySelector('#links').hidden=false">业务菜单</button><nav id="links" hidden><a href="/catalog" data-testid="catalog-link">商品目录</a></nav><script>localStorage.setItem('fixture_auth','present');sessionStorage.setItem('fixture_session','present')</script>`,
    );
    return;
  }
  if (url.pathname === '/catalog') {
    response.end(
      `${common}<h1>商品目录</h1><button type="button" data-testid="add" onclick="document.querySelector('#editor').hidden=false">新增商品</button><button type="button" data-testid="edit" onclick="document.querySelector('#editor').hidden=false">编辑商品</button><button type="button" data-testid="filter" onclick="document.querySelector('#filter-panel').hidden=false">筛选</button><div id="filter-panel" hidden><input placeholder="商品名称"></div><div id="editor" role="dialog" hidden><h2>新增商品</h2><input placeholder="商品名称"><input type="password"><input type="file"><input type="checkbox"><button type="button" data-testid="save" onclick="window.saveDispatched=true;fetch('/api/save',{method:'POST'})">保存</button><button type="button" data-testid="delete" onclick="window.deleteDispatched=true;fetch('/api/delete',{method:'POST'})">删除</button><button type="button" onclick="document.querySelector('#editor').hidden=true">关闭</button></div><form><button data-testid="implicit-submit">新增隐式提交</button><button type="submit" data-testid="explicit-submit">查看并提交</button></form><a href="${external}/outside">外部详情</a><a href="/logout">登出</a><a href="/catalog?operation=delete">查看删除路由</a><a href="/files/report.csv" download>下载报表</a>`,
    );
    return;
  }
  if (url.pathname === '/query') {
    response.end(
      `${common}<h1>查询</h1><button type="button" data-testid="query" onclick="fetch('/api/query',{method:'POST'}).then(()=>document.querySelector('#rows').textContent='已查询')">查询</button><div id="rows"></div>`,
    );
    return;
  }
  if (url.pathname === '/hazards') {
    response.end(
      `${common}<button type="button" data-testid="write" onclick="fetch('/api/save?token=not-recorded',{method:'POST'}).catch(()=>{})">查看异常</button><button type="button" data-testid="get-write" onclick="fetch('/api/delete').catch(()=>{})">查看第二异常</button><button type="button" data-testid="cross" onclick="location.href='${external}/escape?token=not-recorded'">查看外部详情</button><button type="button" data-testid="dialog" onclick="alert('do not record secret')">查看原生窗口</button><button type="button" data-testid="popup" onclick="window.open('/catalog')">查看新窗口</button><button type="button" data-testid="download" onclick="const a=document.createElement('a');a.href='data:text/plain,private';a.download='fixture.txt';document.body.append(a);a.click()">查看附件</button>`,
    );
    return;
  }
  response.end(`${common}<h1>其他页面</h1>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const session = new BrowserSession({ headless: true });
const task = {
  id: uid(),
  target: origin + '/home',
  authorization: { nonproduction: true, writes: true, readOnlyEndpoints: [] },
};
const events = [],
  results = [];
let browser;
const select = (observation, testid) => {
  const c = observation.candidates.find(
    (candidate) => candidate.locator.kind === 'testid' && candidate.locator.value === testid,
  );
  assert.ok(c, `missing ${testid}`);
  return { candidate_id: c.candidate_id };
};
async function start(options = {}, selectedTask = task) {
  await browser?.close();
  browser = new DiscoveryBrowser(session, selectedTask, {
    onEvent: (event) => events.push(event),
    ...options,
  });
  return browser.open();
}
async function scenario(name, run) {
  await run();
  results.push(name);
}
async function rejects(operation, code) {
  await assert.rejects(operation, (error) => error.code === code, code);
}

try {
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '进入演示' }).click();
  await session.authenticate(task, { kind: 'testid', value: 'signed-in' });
  await scenario(
    'authenticated menu to page to add modal; save/delete/submit omitted',
    async () => {
      let observation = await start();
      assert.equal(session.browser.contexts().length, 2);
      assert.equal(
        await browser.page.evaluate(() => sessionStorage.getItem('fixture_session')),
        'present',
      );
      observation = await browser.act(select(observation, 'menu'));
      observation = await browser.act(select(observation, 'catalog-link'));
      assert.equal(observation.snapshot.title, '');
      assert.ok(observation.snapshot.text.includes('商品目录'));
      const forbidden = ['implicit-submit', 'explicit-submit', 'save', 'delete'];
      assert.ok(
        !observation.candidates.some((candidate) => forbidden.includes(candidate.locator.value)),
      );
      observation = await browser.act(select(observation, 'add'));
      assert.ok(observation.snapshot.controls.some((control) => control.name === '保存'));
      assert.ok(
        !observation.candidates.some((candidate) => forbidden.includes(candidate.locator.value)),
      );
      assert.ok(
        !observation.candidates.some(
          (candidate) =>
            candidate.name.includes('外部') ||
            candidate.name.includes('删除路由') ||
            candidate.name.includes('下载'),
        ),
      );
      await rejects(
        () => browser.act({ candidate_id: 'invented-save' }),
        'DISCOVERY_CANDIDATE_FORBIDDEN',
      );
      assert.equal(
        await browser.page.evaluate(() => !!(window.saveDispatched || window.deleteDispatched)),
        false,
      );
      assert.equal(
        received.filter((request) => request.path === '/api/save' || request.path === '/api/delete')
          .length,
        0,
      );
      const before = events.findIndex(
        (event) => event.type === 'DISCOVERY_ACTION_BEFORE' && event.name === '新增商品',
      );
      const after = events.findIndex(
        (event) => event.type === 'DISCOVERY_ACTION_AFTER' && event.name === '新增商品',
      );
      assert.ok(before >= 0 && after > before);
      assert.ok(events[before].url.endsWith('/catalog'));
    },
  );
  await scenario('fixed handle rejects DOM replacement during model wait', async () => {
    await start();
    const observation = await browser.navigate('/catalog');
    const action = select(observation, 'add');
    await browser.page
      .getByTestId('add')
      .evaluate(
        (element) =>
          (element.outerHTML =
            '<button type="button" data-testid="add" onclick="window.replacementDispatched=true">新增商品</button>'),
      );
    await rejects(() => browser.act(action), 'DISCOVERY_STALE_PAGE');
    assert.equal(await browser.page.evaluate(() => !!window.replacementDispatched), false);
  });
  await scenario(
    'read-only cross-origin CDN assets load; frame navigation and write remain blocked',
    async () => {
      await start();
      let observation = await browser.navigate('/assets');
      assert.equal(await browser.page.evaluate(() => window.fixtureCDNLoaded), true);
      assert.equal(
        await browser.page
          .locator('#asset-proof')
          .evaluate((element) => getComputedStyle(element).color),
        'rgb(1, 2, 3)',
      );
      assert.ok(assetHits.includes('css') && assetHits.includes('js'));
      await rejects(() => browser.act(select(observation, 'iframe')), 'OUTSIDE_TARGET_ORIGIN');
      await start();
      observation = await browser.navigate('/assets');
      await rejects(
        () => browser.act(select(observation, 'external-write')),
        'WRITE_NOT_AUTHORIZED',
      );
      assert.equal(externalHits, 0);
    },
  );
  await scenario(
    'unrelated clock and hover tooltip DOM changes preserve current candidate',
    async () => {
      const observation = await start();
      const action = select(observation, 'menu');
      await browser.page.evaluate(() => {
        const clock = document.createElement('div');
        clock.id = 'clock';
        clock.textContent = '09:01:00';
        document.body.append(clock);
        document.querySelector('[data-testid="menu"]').addEventListener(
          'pointerover',
          () => {
            const tooltip = document.createElement('div');
            tooltip.textContent = '菜单提示';
            document.body.append(tooltip);
          },
          { once: true },
        );
      });
      await browser.page
        .locator('#clock')
        .evaluate((element) => (element.textContent = '09:01:01'));
      const next = await browser.act(action);
      assert.ok(next.candidates.some((candidate) => candidate.locator.value === 'catalog-link'));
      assert.ok(next.snapshot.text.includes('菜单提示'));
    },
  );
  await scenario('dangerous target metadata change remains blocked', async () => {
    const observation = await start();
    const action = select(observation, 'menu');
    await browser.page.getByTestId('menu').evaluate((element) => {
      element.textContent = '删除全部';
      element.onclick = () => {
        window.dangerousDispatched = true;
      };
    });
    await rejects(() => browser.act(action), 'DISCOVERY_STALE_PAGE');
    assert.equal(await browser.page.evaluate(() => !!window.dangerousDispatched), false);
  });
  await scenario('page URL change during model wait rejects stale choice', async () => {
    const observation = await start();
    const action = select(observation, 'menu');
    await browser.page.evaluate(() => history.pushState({}, '', '/home#changed'));
    await rejects(() => browser.act(action), 'DISCOVERY_STALE_PAGE');
  });
  await scenario('intent callback replacement is rechecked before dispatch', async () => {
    const observation = await start({
      onEvent: async (event) => {
        events.push(event);
        if (event.type === 'DISCOVERY_ACTION_BEFORE')
          await browser.page
            .getByTestId('menu')
            .evaluate((element) => element.replaceWith(element.cloneNode(true)));
      },
    });
    await rejects(() => browser.act(select(observation, 'menu')), 'DISCOVERY_STALE_PAGE');
  });
  await scenario('intent persistence failure prevents click', async () => {
    const observation = await start({
      onEvent: (event) => {
        events.push(event);
        if (event.type === 'DISCOVERY_ACTION_BEFORE')
          throw new Error('credentials must never be included');
      },
    });
    await rejects(() => browser.act(select(observation, 'menu')), 'DISCOVERY_EVIDENCE_FAILED');
    assert.equal(await browser.page.getByTestId('menu').getAttribute('aria-expanded'), 'false');
  });
  await scenario('read-only POST requires explicit configuration', async () => {
    await start();
    const observation = await browser.navigate('/query');
    await rejects(() => browser.act(select(observation, 'query')), 'WRITE_NOT_AUTHORIZED');
    assert.equal(received.filter((request) => request.path === '/api/query').length, 0);
    const configured = structuredClone(task);
    configured.authorization.readOnlyEndpoints = [{ method: 'POST', path: '/api/query' }];
    await start({}, configured);
    const next = await browser.navigate('/query');
    await browser.act(select(next, 'query'));
    assert.equal(received.filter((request) => request.path === '/api/query').length, 1);
  });
  await scenario('unexpected write blocked with method/path only', async () => {
    await start();
    const observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'write')), 'WRITE_NOT_AUTHORIZED');
    const failure = events.findLast((event) => event.type === 'DISCOVERY_FAILED');
    assert.deepEqual(failure.blocked, { method: 'POST', path: '/api/save' });
    assert.equal(received.filter((request) => request.path === '/api/save').length, 0);
  });
  await scenario('dangerous GET blocked', async () => {
    await start();
    const observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'get-write')), 'DISCOVERY_DANGEROUS_ROUTE');
    assert.equal(received.filter((request) => request.path === '/api/delete').length, 0);
  });
  await scenario('cross-origin navigation blocked without external request', async () => {
    await start();
    const observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'cross')), 'OUTSIDE_TARGET_ORIGIN');
    assert.equal(externalHits, 0);
  });
  await scenario('native dialogs dismissed and popup closed', async () => {
    await start();
    let observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'dialog')), 'NATIVE_DIALOG_UNSUPPORTED');
    await start();
    observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'popup')), 'DISCOVERY_POPUP_BLOCKED');
    assert.ok(browser.context.pages().length <= 1);
  });
  await scenario('programmatic attachment click blocked before download', async () => {
    await start();
    const observation = await browser.navigate('/hazards');
    await rejects(() => browser.act(select(observation, 'download')), 'DISCOVERY_DISPATCH_BLOCKED');
  });
  await scenario('abort while waiting for intent blocks dispatch and preserves login', async () => {
    const controller = new AbortController();
    let intentResolve;
    const intent = new Promise((resolve) => {
      intentResolve = resolve;
    });
    const observation = await start({
      signal: controller.signal,
      onEvent: async (event) => {
        events.push(event);
        if (event.type === 'DISCOVERY_ACTION_BEFORE') {
          intentResolve();
          await new Promise(() => {});
        }
      },
    });
    const pending = browser.act(select(observation, 'menu'));
    await intent;
    controller.abort();
    await rejects(() => pending, 'STOPPED');
    assert.ok(!session.loginPage.isClosed());
    assert.equal(await session.loginPage.getByTestId('signed-in').count(), 1);
  });
  await scenario('timeout bounds an unresponsive intent callback', async () => {
    const observation = await start({
      timeoutMs: 1500,
      onEvent: async (event) => {
        if (event.type === 'DISCOVERY_ACTION_BEFORE') await new Promise(() => {});
      },
    });
    await rejects(() => browser.act(select(observation, 'menu')), 'DISCOVERY_TIMEOUT');
  });
  await scenario('max steps and repeated route loop are bounded', async () => {
    let observation = await start({ maxSteps: 1 });
    observation = await browser.act(select(observation, 'menu'));
    await rejects(() => browser.act(select(observation, 'catalog-link')), 'DISCOVERY_STEP_LIMIT');
    await start();
    await browser.navigate('/catalog');
    await browser.navigate('/catalog');
    await rejects(() => browser.navigate('/catalog'), 'DISCOVERY_LOOP_LIMIT');
  });
  await scenario(
    'dangerous and cross-origin source routes rejected before navigation',
    async () => {
      await start();
      await rejects(() => browser.navigate('/logout'), 'DISCOVERY_DANGEROUS_ROUTE');
      await rejects(() => browser.navigate('/catalog?action=delete'), 'DISCOVERY_DANGEROUS_ROUTE');
      await rejects(() => browser.navigate(external + '/outside'), 'OUTSIDE_TARGET_ORIGIN');
      assert.equal(externalHits, 0);
    },
  );
  await browser.close();
  assert.equal(session.browser.contexts().length, 1);
  assert.ok(session.authenticated);
  await session.loginPage.reload();
  assert.equal(await session.loginPage.getByTestId('signed-in').count(), 1);
  assert.equal(
    received.filter((request) => request.path === '/login' && request.method === 'POST').length,
    1,
  );
  assert.ok(!JSON.stringify(events).includes('not-recorded'));
  process.stdout.write(
    JSON.stringify({
      scope:
        'Real headless Chromium against isolated authenticated local fixtures; zero model or product requests',
      scenarios: results.length,
      results,
      login_count: 1,
      external_readonly_asset_requests: assetHits.length,
      external_navigation_or_write_requests: externalHits,
      write_requests: received.filter((request) =>
        ['/api/save', '/api/delete'].includes(request.path),
      ).length,
    }) + '\n',
  );
} finally {
  await browser?.close();
  await session.close();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => outside.close(resolve)),
  ]);
}

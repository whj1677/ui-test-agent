import http from 'node:http';

// Only synthetic, in-memory data. The deliberate mismatch and delayed state
// are test inputs, not changes made after seeing an execution result.
export async function startRecordingFixture() {
  let logins = 0;
  let item = null;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const send = (body) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(body);
    };
    if (url.pathname === '/login') {
      logins++;
      response.writeHead(303, {
        Location: '/',
        'Set-Cookie': 'fixture-session=local; HttpOnly; SameSite=Strict; Path=/',
      });
      return response.end();
    }
    if (!(request.headers.cookie ?? '').includes('fixture-session=local')) {
      return send(
        '<form action="/login" method="post"><h1>录像验证登录</h1><button>登录合成站点</button></form>',
      );
    }
    if (url.pathname === '/api/item') {
      if (request.method === 'POST') item = 'Video-Owned-001';
      if (request.method === 'DELETE') item = null;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify({ item }));
    }
    send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>录像对照夹具</title>
      <style>body{font:20px "Microsoft YaHei",sans-serif;margin:48px;color:#18324a}button,input,a{font:inherit;margin:10px;padding:12px}#ready{color:green}#lazy{margin-top:1000px;height:120px}</style></head><body>
      <header id="signed">本机合成用户</header><h1>录像证据验证</h1>
      <label>名称<input id="name" value="初值"></label><button id="action">执行一次</button>
      <a id="details" href="/details">查看详情</a><a id="home" href="/">返回列表</a>
      <p id="identity">对象：Video-Owned-001</p><p id="status">等待操作</p><p id="count">0</p><p id="location">${url.pathname === '/details' ? '详情页' : '列表页'}</p>
      <button id="create">创建测试记录</button><button id="delete">精确删除测试记录</button><div id="items"></div>
      <div id="lazy">等待进入视区</div><script>
      window.initialRootChildren = [...document.documentElement.children].map(e=>e.tagName);
      window.productEvents = [];
      document.querySelector('#action').addEventListener('pointerdown', e => {
        productEvents.push({kind:'pointer',trusted:e.isTrusted,x:e.clientX,y:e.clientY});
      });
      document.querySelector('#action').onclick = () => {
        const count = document.querySelector('#count');
        count.textContent = String(Number(count.textContent)+1);
        const finish = () => document.querySelector('#status').textContent = ${JSON.stringify(url.searchParams.has('defect') ? '错误状态' : '已完成')};
        ${url.searchParams.has('late') ? 'setTimeout(finish, 450);' : 'finish();'}
      };
      async function itemAction(method) {
        const body = await (await fetch('/api/item', {method})).json();
        const items = document.querySelector('#items'); items.replaceChildren();
        if(body.item) { const p=document.createElement('p'); p.id='owned-item'; p.textContent=body.item; items.append(p); }
      }
      document.querySelector('#create').onclick=()=>itemAction('POST');
      document.querySelector('#delete').onclick=()=>itemAction('DELETE');
      window.lazyHits = 0;
      new IntersectionObserver(entries => {if(entries.some(e=>e.isIntersecting)){window.lazyHits++;document.querySelector('#lazy').textContent='懒加载完成';}}).observe(document.querySelector('#lazy'));
      </script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get logins() {
      return logins;
    },
    get item() {
      return item;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

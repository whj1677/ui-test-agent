import http from 'node:http';
import { uid, escapeHTML } from './common.mjs';
import { caseHash, suggestObligations } from './plans.mjs';

// Synthetic products and tasks belong to this fixture, never to the execution core.
export async function startDemo({ port = 0 } = {}) {
  const tasks = new Map(),
    sessions = new Set();
  let logins = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'text/html; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    const signed = [...sessions].some((s) =>
      (req.headers.cookie ?? '').split('; ').includes('demo-session=' + s),
    );
    if (url.pathname === '/login' && req.method === 'POST') {
      const id = uid();
      sessions.add(id);
      logins++;
      res.setHeader('Set-Cookie', `demo-session=${id}; HttpOnly; SameSite=Strict; Path=/`);
      res.writeHead(303, { Location: '/catalog' });
      return res.end();
    }
    if (!signed)
      return send(
        200,
        shell(
          '<h1>合成演示站点</h1><p>仅包含本地测试数据。</p><form method="post" action="/login"><button>进入演示</button></form>',
        ),
      );
    if (url.pathname === '/api/tasks') {
      if (req.method === 'POST') {
        let body = '';
        for await (const b of req) {
          body += b;
          if (body.length > 4000) return send(413, '{}', 'application/json');
        }
        try {
          const { name } = JSON.parse(body);
          if (typeof name !== 'string' || !/^Agent-Task-[a-f0-9]{8}$/.test(name))
            return send(400, '{}', 'application/json');
          tasks.set(name, { name });
        } catch {
          return send(400, '{}', 'application/json');
        }
      }
      return send(200, JSON.stringify([...tasks.values()]), 'application/json');
    }
    if (url.pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
      tasks.delete(decodeURIComponent(url.pathname.slice(11)));
      return send(200, '{}', 'application/json');
    }
    const nav =
      '<header><strong data-testid="signed-in">演示用户</strong><nav><a href="/catalog">商品查询</a><a href="/tasks">任务管理</a></nav></header>';
    if (url.pathname === '/tasks')
      return send(
        200,
        shell(
          nav +
            `<h1>任务管理</h1><p>创建、验证并删除本轮专属任务。</p><label>任务名称 <input data-testid="task-name"></label><button data-testid="create-task">创建任务</button><p data-testid="task-message" role="status">就绪</p><small data-testid="tasks-ready">正在加载</small><div id="tasks"></div><script>
      const list=document.querySelector('#tasks');
      async function render(){const rows=await (await fetch('/api/tasks')).json();list.replaceChildren();for(const row of rows){const el=document.createElement('article');el.dataset.testid='task-'+row.name;const text=document.createElement('span');text.textContent=row.name;const b=document.createElement('button');b.textContent='删除';b.dataset.testid='delete-'+row.name;b.onclick=async()=>{await fetch('/api/tasks/'+encodeURIComponent(row.name),{method:'DELETE'});await render();};el.append(text,b);list.append(el);}document.querySelector('[data-testid=tasks-ready]').textContent='列表已加载';}
      document.querySelector('[data-testid=create-task]').onclick=async()=>{const name=document.querySelector('input').value;const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});document.querySelector('[role=status]').textContent=r.ok?'创建成功':'名称不符合演示规则';await render();};render();</script>`,
        ),
      );
    return send(
      200,
      shell(
        nav +
          `<h1>商品查询</h1><p>按商品名称筛选目录。</p><label>商品名称 <input data-testid="product-search"></label><button data-testid="search-products">查询</button><p data-testid="result-count">3 件商品</p><section data-testid="product-results">苹果 · 香蕉 · 牛奶</section><script>document.querySelector('button').onclick=()=>{const q=document.querySelector('input').value;const names=['苹果','香蕉','牛奶'].filter(n=>n.includes(q));document.querySelector('[data-testid=result-count]').textContent=names.length+' 件商品';document.querySelector('section').textContent=names.join(' · ')||'无匹配商品';};</script>`,
      ),
    );
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
    tasks,
    get logins() {
      return logins;
    },
    expire() {
      sessions.clear();
    },
    close: () => new Promise((r) => server.close(r)),
  };
}
function shell(body) {
  return (
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>UI Agent 合成演示</title><style>body{font:17px system-ui;background:#f3f6fa;color:#23314b;max-width:950px;margin:50px auto}header,article,section{padding:24px;background:white;border-radius:14px;margin:20px 0}nav{float:right}a{margin:0 12px;color:#246c59}button,input{font:inherit;padding:12px;margin:12px;border:1px solid #bccbc5;border-radius:8px}button{background:#185f50;color:white;cursor:pointer}article{display:flex;justify-content:space-between;align-items:center}</style>' +
    body +
    '</html>'
  );
}
const t = (value) => ({ kind: 'testid', value });
export function demoCases() {
  const name = 'Agent-Task-' + uid().slice(0, 8);
  const cases = [
    {
      case_id: 'CATALOG-001',
      title: '按名称查询商品',
      source_side: 'ui',
      preconditions: '已进入演示；目录包含苹果、香蕉和牛奶。',
      steps: [
        {
          step_id: 'S1',
          action: '商品名称输入苹果，点击查询。',
          expected: '查询结果只有苹果，数量为1件商品。',
          requires_click: true,
        },
      ],
    },
    {
      case_id: 'TASK-001',
      title: '创建任务并清理',
      source_side: 'ui',
      preconditions: `已进入演示；本轮任务 ${name} 不存在。`,
      steps: [
        {
          step_id: 'S1',
          action: `输入任务名称 ${name}，点击创建任务。`,
          expected: `显示创建成功，列表包含任务 ${name}。`,
          requires_click: true,
        },
      ],
    },
  ];
  // Fixture authors explicitly confirm these clauses; imported user cases must
  // obtain that confirmation through the console instead of this helper.
  for (const c of cases) c.steps = suggestObligations(c.steps);
  const plan = (c, entry, effect, actions, assertions, preconditions = [], cleanup = null) => ({
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: entry,
    data_effect: effect,
    preconditions,
    steps: [
      {
        step_id: 'S1',
        source_action: c.steps[0].action,
        source_expected: c.steps[0].expected,
        actions: actions.map((a, i) => ({ ...a, action_id: `S1-A${i + 1}` })),
        assertion_mode: 'simultaneous',
        within_ms: 8000,
        assertions: assertions.map((a, i) => ({
          ...a,
          obligation_ids: [c.steps[0].obligations[i].id],
        })),
      },
    ],
    cleanup: cleanup
      ? {
          ...cleanup,
          actions: cleanup.actions.map((a, i) => ({ ...a, action_id: `CLEANUP-A${i + 1}` })),
        }
      : null,
    notes: '预制演示计划，用于验证运行器，不代表真实 DeepSeek 规划结果。',
  });
  const plans = [
    plan(
      cases[0],
      '/catalog',
      'read_only',
      [
        {
          op: 'fill',
          target: t('product-search'),
          repair_anchor: { kind: 'label', value: '商品名称', exact: true },
          value: '苹果',
        },
        {
          op: 'click',
          target: t('search-products'),
          repair_anchor: { kind: 'role', role: 'button', name: '查询', exact: true },
        },
      ],
      [
        { target: t('product-results'), check: 'text', expected: '苹果', oracle_quote: '只有苹果' },
        {
          target: t('result-count'),
          check: 'text',
          expected: '1 件商品',
          oracle_quote: '数量为1件商品',
        },
      ],
      [{ target: t('product-results'), check: 'contains', expected: '苹果' }],
    ),
    plan(
      cases[1],
      '/tasks',
      'mutation',
      [
        {
          op: 'fill',
          target: t('task-name'),
          repair_anchor: { kind: 'label', value: '任务名称', exact: true },
          value: name,
        },
        {
          op: 'click',
          target: t('create-task'),
          repair_anchor: { kind: 'role', role: 'button', name: '创建任务', exact: true },
        },
      ],
      [
        {
          target: t('task-message'),
          check: 'text',
          expected: '创建成功',
          oracle_quote: '显示创建成功',
        },
        {
          target: t('task-' + name),
          check: 'contains',
          expected: name,
          oracle_quote: '列表包含任务 ' + name,
        },
      ],
      [
        { target: t('tasks-ready'), check: 'text', expected: '列表已加载' },
        { target: t('task-' + name), check: 'count', expected: 0 },
      ],
      {
        identity: name,
        ownership: [{ target: t('task-' + name), check: 'contains', expected: name }],
        actions: [{ op: 'click', target: t('delete-' + name) }],
        assertions: [{ target: t('task-' + name), check: 'count', expected: 0 }],
      },
    ),
  ];
  return {
    baseline: { schema_version: 'ui-agent-cases/v1', case_count: cases.length, cases },
    plans,
  };
}

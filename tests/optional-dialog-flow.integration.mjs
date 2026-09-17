import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { caseHash, suggestObligations, validatePlan } from '../src/plans.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { hash, uid } from '../src/common.mjs';

let mode = 'present',
  writes = 0;
const html = (
  show,
) => `<style>button{margin:20px;padding:15px}dialog::backdrop{background:#1238}</style><span data-testid="signed-in">测试用户</span>
<a href="/case">查看目录</a><button id="detail" onclick="document.querySelector('#details').showModal()">查看详情</button>
<dialog aria-label="方案详情" id="details"><p>日间方案</p><form method="dialog"><button>关闭</button></form></dialog>
${
  show && mode !== 'absent'
    ? `<dialog aria-label="使用提示" id="notice"><p>请查看目录</p><form method="dialog"><button>知道了</button></form></dialog>
<script>const notice=document.querySelector('#notice');
${mode === 'write' ? "notice.addEventListener('submit',()=>{fetch('/write',{method:'POST',body:'synthetic'}).catch(()=>{});navigator.sendBeacon('/write','synthetic')});" : ''}
${mode === 'delayed' ? 'setTimeout(()=>notice.showModal(),180)' : 'notice.showModal()'};</script>`
    : ''
}`;
const server = http.createServer((req, res) => {
  if (req.url === '/write') {
    writes++;
    res.writeHead(200);
    res.end('unexpected');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html(req.url === '/case'));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const task = {
  id: uid(),
  target: `http://127.0.0.1:${server.address().port}/`,
  authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  fixture: true,
};
const c = {
  case_id: 'CONDITION-FLOW',
  steps: suggestObligations([
    {
      step_id: '1',
      action: '若出现使用提示，点击知道了；若未出现则继续。',
      expected: '没有提示遮挡操作。',
    },
    { step_id: '2', action: '点击查看详情。', expected: '详情显示日间方案。' },
  ]),
};
const action = {
  action_id: 'dismiss',
  op: 'dismiss_optional',
  target: { kind: 'role', role: 'dialog', name: '使用提示', exact: true },
  value: '知道了',
};
const target = { kind: 'css', value: '#detail' };
const plan = {
  schema_version: 'ui-agent-plan/v2',
  case_id: c.case_id,
  case_hash: caseHash(c),
  entry_path: '/case',
  data_effect: 'read_only',
  preconditions: [],
  cleanup: null,
  steps: c.steps.map((s, i) => ({
    step_id: s.step_id,
    source_action: s.action,
    source_expected: s.expected,
    assertion_mode: 'simultaneous',
    within_ms: 800,
    actions: i ? [{ action_id: 'open', op: 'click', target }] : [action],
    assertions: [
      {
        target: i ? { kind: 'css', value: '#details' } : target,
        check: i ? 'contains' : 'unobstructed',
        expected: i ? '日间方案' : true,
        oracle_quote: s.obligations[0].text,
        obligation_ids: [s.obligations[0].id],
      },
    ],
  })),
};
task.baseline_sha256 = hash(c);
validatePlan(plan, c, task.target);
requirePlanSemantics(plan, c);
const directory = path.resolve('validation', 'optional-flow-' + Date.now());
await fs.mkdir(directory, { recursive: true });
const session = new BrowserSession({ headless: true });
let explorer;
const results = [];
try {
  await session.open(task);
  await session.authenticate(task, { kind: 'testid', value: 'signed-in' });
  for (mode of ['present', 'absent', 'delayed', 'write']) {
    const runDir = path.join(directory, mode),
      events = [];
    const fact = await session.execute(task, c, plan, runDir, { onEvent: (e) => events.push(e) });
    await fs.writeFile(path.join(runDir, 'facts.json'), JSON.stringify({ fact, events }, null, 2));
    assert.equal(
      fact.status,
      mode === 'write' ? 'BLOCKED_WRITE' : 'PASS_ASSERTIONS',
      `${mode}: ${fact.status} ${fact.error}`,
    );
    const receipt = fact.actions[0];
    if (mode === 'absent') {
      assert.equal(receipt.status, 'SKIPPED_NOT_PRESENT');
      assert.equal(receipt.dispatched, false);
      assert.ok(!events.some((e) => e.action_id === 'dismiss' && e.type === 'ACTION_STARTED'));
    } else if (mode !== 'write') {
      assert.equal(receipt.status, 'EXECUTED');
      assert.equal(receipt.condition.branch, 'PRESENT');
    }
    results.push({
      mode,
      status: fact.status,
      conditional_status: receipt?.status,
      dispatched: receipt?.dispatched,
    });
  }
  assert.equal(writes, 0, 'read-only network guard must abort fetch and beacon');
  for (mode of ['present', 'write']) {
    explorer = new DiscoveryBrowser(session, task, { maxSteps: 8, timeoutMs: 15000 });
    await explorer.open();
    explorer.beginCase(c);
    let o = await explorer.navigate('/case');
    const candidate = o.candidates.find((x) => x.kind === 'dismiss' && x.name === '知道了');
    assert.ok(candidate, JSON.stringify(o.candidates));
    assert.ok(!o.candidates.some((x) => x.name === '查看详情'), 'background is not eligible');
    if (mode === 'write')
      await assert.rejects(explorer.act({ candidate_id: candidate.candidate_id }), {
        code: 'WRITE_NOT_AUTHORIZED',
      });
    else {
      o = await explorer.act({ candidate_id: candidate.candidate_id });
      assert.ok(o.candidates.some((x) => x.name === '查看详情'));
      await explorer.act({
        candidate_id: o.candidates.find((x) => x.name === '查看详情').candidate_id,
      });
      assert.equal(await explorer.page.locator('#details').isVisible(), true);
    }
    results.push({
      mode,
      scope: 'discovery',
      outcome: mode === 'write' ? 'WRITE_BLOCKED' : 'NOTICE_CLOSED_DETAIL_DISCOVERED',
    });
    await explorer.close();
    explorer = null;
  }
  mode = 'present';
  explorer = new DiscoveryBrowser(session, task, { maxSteps: 8, timeoutMs: 15000 });
  await explorer.open();
  explorer.beginCase({ case_id: 'NO-AUTH', steps: [{ action: '查看详情' }] });
  const forbidden = await explorer.navigate('/case');
  assert.ok(
    !forbidden.candidates.some((x) => x.name === '知道了'),
    'not a global dismiss whitelist',
  );
  results.push({ scope: 'discovery', outcome: 'UNREQUESTED_DISMISS_NOT_OFFERED' });
  assert.equal(writes, 0);
  await fs.writeFile(
    path.join(directory, 'summary.json'),
    JSON.stringify(
      { scope: 'fixed protocol browser and discovery; no real model calls', writes, results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ directory, scenarios: results.length, writes, failed: 0 }));
} finally {
  await explorer?.close();
  await session.close();
  await new Promise((resolve) => server.close(resolve));
}

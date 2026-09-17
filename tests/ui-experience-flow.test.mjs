import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Store } from '../src/store.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { Controller } from '../src/controller.mjs';
import { start } from '../src/server.mjs';

test('product discovery collects across jobs; restart retrieves advice without expanding candidates', async (t) => {
  let writes = 0,
    changeIdentity = false;
  const fixture = http.createServer((req, res) => {
    if (req.method !== 'GET') writes++;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<meta charset="utf-8"><h1>合成已登录</h1><article aria-label="甲"><button onclick="window.visits=(window.visits||0)+1">详情</button></article><article aria-label="乙"><button>详情</button></article>' +
        (changeIdentity
          ? '<script>document.querySelector("button").addEventListener("pointerdown",()=>document.querySelector("article").setAttribute("aria-label","changed"),{once:true})</script>'
          : ''),
    );
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => fixture.close(resolve)));
  const origin = 'http://127.0.0.1:' + fixture.address().port;
  await fs.mkdir('validation', { recursive: true });
  const root = await fs.mkdtemp(path.resolve('validation/experience-flow-'));
  const store = new Store(root);
  await store.init();
  await store.acquireLock();
  t.after(() => store.releaseLock());
  const baseline = {
    cases: [
      {
        case_id: 'EXP-1',
        title: '独立合成范围定位',
        source_side: 'ui',
        preconditions: '位于合成页面',
        steps: [{ step_id: 'S1', action: '查看甲的详情', expected: '显示原对象' }],
      },
    ],
  };
  let id = await store.create({
    name: 'experience engineering only',
    target: origin,
    baseline,
    filename: 'synthetic.json',
  });
  const taskIds = [id];
  const before = await fs.readFile(path.join(store.dir(id), 'baseline.json'));
  const browser = new BrowserSession({ headless: true });
  t.after(() => browser.close());
  const inputs = [];
  const provider = {
    configured: () => true,
    json: async (prompt, input) => {
      inputs.push(structuredClone(input));
      assert.equal(input.purpose, 'case_ui_discovery');
      const candidate = input.candidates.find((c) => c.locator?.scope?.name === '甲');
      return {
        value: candidate
          ? {
              action: { candidate_id: candidate.candidate_id },
              reason: '合成替身选择原对象的当前范围候选',
            }
          : { done: true, reason: '合成替身结束技术观察，不代表业务通过' },
      };
    },
  };
  let controller = new Controller({ store, browser, provider, experienceMode: 'observe' });
  await controller.configure(id, { nonproduction: true, writes: false, readOnlyEndpoints: [] });
  await controller.openBrowser(id);
  await controller.authenticate(id, {
    kind: 'role',
    role: 'heading',
    name: '合成已登录',
    exact: true,
  });
  let firstRun = true;
  async function run({ expectedFailure = false } = {}) {
    if (!firstRun) {
      id = await store.create({
        name: 'fresh independent experience job',
        target: origin,
        baseline,
        filename: 'synthetic.json',
      });
      taskIds.push(id);
      await controller.configure(id, { nonproduction: true, writes: false, readOnlyEndpoints: [] });
      await controller.openBrowser(id);
      await controller.authenticate(id, {
        kind: 'role',
        role: 'heading',
        name: '合成已登录',
        exact: true,
      });
    }
    firstRun = false;
    inputs.length = 0;
    await controller.launch(id, 'discover', ['EXP-1']);
    await controller.active?.finished;
    const state = await store.read(id);
    assert.ok(
      !state.events.some((e) => e.type === 'JOB_FAILED'),
      JSON.stringify(state.events.filter((e) => e.type === 'JOB_FAILED')),
    );
    assert.equal(state.cases[0].discovery.status, expectedFailure ? 'BLOCKED' : 'CAPTURED');
    assert.equal(inputs.length, expectedFailure ? 1 : 2);
    assert.equal(state.cases[0].plan, null);
    assert.equal(state.cases[0].attempts.length, 0, 'not a business test execution');
    return state;
  }
  await t.test('three real discovery jobs quarantine then qualify one technical rule', async () => {
    for (let i = 0; i < 3; i++) {
      const state = await run();
      assert.ok(inputs.every((input) => !Object.hasOwn(input, 'ui_experience_advice')));
      const event = state.events.filter((e) => e.type === 'UI_EXPERIENCE_RECORDED').at(-1);
      assert.ok(event, 'real product receipt must reach the store');
      assert.equal(event.status, i < 2 ? 'QUARANTINED' : 'ELIGIBLE_NEXT_JOB');
    }
    const data = JSON.parse(await fs.readFile(path.join(root, 'ui-experience.json'), 'utf8'));
    assert.equal(data.records.length, 1);
    assert.equal(data.records[0].samples.length, 3);
  });
  await t.test(
    'new controller loads disk history; assist is advice, not candidate permission',
    async () => {
      controller = new Controller({ store, browser, provider, experienceMode: 'assist' });
      await run();
      const advice = inputs[0].ui_experience_advice;
      assert.equal(advice.kind, 'UI_ADVICE_NOT_EVIDENCE');
      assert.equal(advice.patterns[0].id, 'scoped_repeat');
      assert.equal(advice.patterns[0].experience, 'TECHNICALLY_VERIFIED_HISTORY');
      assert.equal(inputs[0].candidates.length, 2);
      assert.deepEqual(
        inputs[0].candidates.map((c) => c.locator.scope.name).sort(),
        ['乙', '甲'].sort(),
      );
      assert.equal(inputs[1].excluded_repeated_candidates, 1);
      const child = await promisify(execFile)(
        process.execPath,
        [
          '-e',
          `
        import('./src/ui-experience.mjs').then(async ({UiExperienceStore}) => {
          const [root, origin, snapshot] = process.argv.slice(1);
          const session = await new UiExperienceStore(root, {mode:'assist'}).begin({origin,runId:'separate-process'});
          process.stdout.write(JSON.stringify(session.retrieve(JSON.parse(snapshot)).matches));
        }).catch(() => process.exitCode=1);
      `,
          root,
          origin,
          JSON.stringify(inputs[0].current),
        ],
        { cwd: process.cwd(), windowsHide: true, timeout: 10000 },
      );
      const matches = JSON.parse(child.stdout);
      assert.ok(
        matches.some(
          (m) => m.id === 'scoped_repeat' && m.experience === 'TECHNICALLY_VERIFIED_HISTORY',
        ),
      );
    },
  );
  await t.test(
    'off does not update the existing store and keeps original model envelope',
    async () => {
      const bytes = await fs.readFile(path.join(root, 'ui-experience.json'));
      controller = new Controller({ store, browser, provider, experienceMode: 'off' });
      await run();
      assert.ok(inputs.every((input) => !Object.hasOwn(input, 'ui_experience_advice')));
      assert.deepEqual(await fs.readFile(path.join(root, 'ui-experience.json')), bytes);
    },
  );
  await t.test(
    'product counterexample revokes history and preserves the original action failure',
    async () => {
      controller = new Controller({ store, browser, provider, experienceMode: 'assist' });
      changeIdentity = true;
      let state;
      try {
        state = await run({ expectedFailure: true });
      } finally {
        changeIdentity = false;
      }
      assert.equal(
        inputs[0].ui_experience_advice.patterns[0].experience,
        'TECHNICALLY_VERIFIED_HISTORY',
      );
      assert.equal(state.cases[0].discovery.reason, 'WITHIN_SCOPE_CHANGED');
      const event = state.events.filter((e) => e.type === 'UI_EXPERIENCE_RECORDED').at(-1);
      assert.equal(event.status, 'REVOKED');
      assert.equal(event.outcome, 'COUNTEREXAMPLE');
      assert.ok(
        state.events.some(
          (e) => e.type === 'DISCOVERY_BLOCKED' && e.code === 'WITHIN_SCOPE_CHANGED',
        ),
      );
      controller = new Controller({ store, browser, provider, experienceMode: 'assist' });
      await run();
      assert.ok(
        inputs[0].ui_experience_advice.patterns.every(
          (p) => p.experience !== 'TECHNICALLY_VERIFIED_HISTORY',
        ),
      );
    },
  );
  await t.test(
    'actual corrupt store falls back while original discovery remains usable',
    async () => {
      await fs.writeFile(path.join(root, 'ui-experience.json'), '{synthetic-corruption');
      controller = new Controller({ store, browser, provider, experienceMode: 'assist' });
      const state = await run();
      assert.ok(inputs.every((input) => !Object.hasOwn(input, 'ui_experience_advice')));
      assert.equal(
        state.events.filter((e) => e.type === 'UI_EXPERIENCE_RECORDED').at(-1).status,
        'DISABLED',
      );
      assert.equal(
        await fs.readFile(path.join(root, 'ui-experience.json'), 'utf8'),
        '{synthetic-corruption',
      );
    },
  );
  assert.equal(writes, 0);
  for (const taskId of taskIds)
    assert.deepEqual(await fs.readFile(path.join(store.dir(taskId), 'baseline.json')), before);
  console.log(
    JSON.stringify({
      artifact: root,
      model: 'injected provider only',
      real_model_calls: 0,
      business_writes: writes,
    }),
  );
});

test('invalid experience config rejects before creating a data lock', async () => {
  const root = path.resolve('validation/invalid-experience-mode-' + Date.now());
  await assert.rejects(start({ port: 0, dataDir: root, experienceMode: 'unsafe-auto' }), {
    code: 'EXPERIENCE_MODE_INVALID',
  });
  assert.equal(
    await fs.access(path.join(root, '.writer.lock')).then(
      () => true,
      () => false,
    ),
    false,
  );
});

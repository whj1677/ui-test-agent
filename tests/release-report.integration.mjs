import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { BrowserSession } from '../src/browser.mjs';
import { demoCases, startDemo } from '../src/demo.mjs';
import { Store } from '../src/store.mjs';
import { report } from '../src/report.mjs';
import { hash, uid } from '../src/common.mjs';
import { caseHash, planHash } from '../src/plans.mjs';
import { readBuildInfo } from '../src/build-info.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactNames = ['report.html', 'missing-media.html'];
const manifestOf = (html) =>
  JSON.parse(
    html
      .match(/<pre id="report-manifest">([\s\S]*?)<\/pre>/)[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&'),
  );

// Optional loopback-only viewer for manual browser QA. It exposes exactly two
// generated reports, never a filesystem directory or a model/Agent endpoint.
if (process.argv[2] === 'serve') {
  const directory = await fs.realpath(path.resolve(process.argv[3] ?? ''));
  const validation = await fs.realpath(path.join(root, 'validation'));
  assert.equal(path.dirname(directory), validation);
  assert.match(path.basename(directory), /^report-media-[A-Za-z0-9]+$/);
  const files = new Map();
  for (const name of artifactNames) {
    const file = path.join(directory, name);
    assert.ok((await fs.lstat(file)).isFile());
    files.set('/' + name, await fs.readFile(file));
  }
  const server = http.createServer((req, res) => {
    const bytes = req.method === 'GET' ? files.get(req.url) : null;
    res.writeHead(bytes ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(bytes ?? 'Not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const timer = setTimeout(() => server.close(), 30 * 60_000);
  const close = () => {
    clearTimeout(timer);
    server.close();
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
  server.on('close', () => clearTimeout(timer));
  console.log(
    JSON.stringify({ directory, url: `http://127.0.0.1:${server.address().port}/report.html` }),
  );
} else {
  test(
    'offline report from actual fixed-plan Chromium executions (no model acceptance)',
    { timeout: 120_000 },
    async (t) => {
      const directory = await fs.mkdtemp(path.join(root, 'validation', 'report-media-'));
      const demo = await startDemo();
      const browser = new BrowserSession({ headless: true });
      t.after(async () => {
        await browser.close();
        await demo.close();
      });
      const original = demoCases();
      const cases = ['MATCH', 'MISMATCH', 'BLOCKED', 'UNRUN'].map((id) => ({
        ...structuredClone(original.baseline.cases[0]),
        case_id: 'MEDIA-' + id,
        title: {
          MATCH: '中文录像与匹配观测',
          MISMATCH: '故意不一致的合成预期',
          BLOCKED: '缺少前置条件时不执行',
          UNRUN: '尚未核对的合成用例',
        }[id],
      }));
      // Engineering fault fixture, authored independently of the frozen 24 cases.
      // Keep the query for apple but explicitly expect banana so real observations
      // must disagree. This is not a finding against the synthetic demo's business.
      cases[1].steps[0].expected = cases[1].steps[0].expected.replaceAll('苹果', '香蕉');
      for (const obligation of cases[1].steps[0].obligations)
        obligation.text = obligation.text.replaceAll('苹果', '香蕉');
      cases[2].preconditions = '页面应存在合成前置标记；该标记被夹具刻意省略。';
      const plans = cases.map((c, i) => {
        const plan = structuredClone(original.plans[0]);
        plan.case_id = c.case_id;
        plan.case_hash = caseHash(c);
        plan.steps[0].source_expected = c.steps[0].expected;
        if (i === 1) {
          plan.steps[0].assertions[0].expected = '香蕉';
          plan.steps[0].assertions[0].oracle_quote = '只有香蕉';
        }
        if (i === 2)
          plan.preconditions = [
            { target: { kind: 'testid', value: 'missing-prerequisite' }, check: 'visible' },
          ];
        return plan;
      });
      const store = new Store(path.join(directory, 'data'));
      await store.init();
      const build = await readBuildInfo();
      store.build = build;
      const id = await store.create({
        name: '中文报告与录像工程验收（非真实模型）',
        target: demo.url + '/catalog',
        baseline: { schema_version: 'ui-agent-cases/v1', case_count: cases.length, cases },
      });
      await store.update(id, (state) => {
        state.fixture = true;
        state.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
        state.report_context =
          '隔离的工程夹具：预制只读计划；不一致预期和缺少前置条件由夹具刻意设置，不计为真实模型或原24条用例验收。';
        state.cases.forEach((record, i) => {
          if (i === 3) return;
          record.plan = plans[i];
          record.plan_approved = true;
          record.reviewed = true;
          record.status = 'READY';
        });
      });
      const task = await store.read(id);
      const scope = await store.beginRun(id, {
        id: uid(),
        case_ids: cases.map((c) => c.case_id),
        case_hashes: Object.fromEntries(cases.map((c) => [c.case_id, caseHash(c)])),
        plan_hashes: Object.fromEntries(plans.slice(0, 3).map((p) => [p.case_id, planHash(p)])),
      });
      await browser.open(task);
      await browser.loginPage.getByRole('button', { name: '进入演示' }).click();
      await browser.authenticate(task, { kind: 'testid', value: 'signed-in' });
      const results = [];
      for (const [i, expected] of ['PASS_ASSERTIONS', 'FAIL_ASSERTION', 'BLOCKED_DATA'].entries()) {
        await t.test(cases[i].case_id + ' records ' + expected, async () => {
          const runId = uid();
          const result = await browser.execute(
            task,
            cases[i],
            plans[i],
            path.join(store.dir(id), 'runs', runId),
            {
              run_scope_id: scope.id,
              approved_plan_hash: planHash(plans[i]),
              onEvent: (event) =>
                store.recordExecutionEvent(id, runId, { ...event, run_scope_id: scope.id }),
            },
          );
          const receipt = await store.fact(id, result);
          await store.update(id, (state) => {
            state.cases[i].attempts.push(receipt);
            state.cases[i].status = result.status;
          });
          results.push(result);
          assert.equal(result.status, expected);
          if (i < 2) {
            assert.ok(result.media.some((m) => m.type === 'video'));
            assert.equal(result.assertions[0].actual, '苹果');
            assert.equal(result.assertions[0].passed, i === 0);
          } else {
            assert.equal(result.actions.length, 0);
            assert.equal(result.media.length, 0);
          }
          assert.equal(demo.tasks.size, 0);
        });
      }
      const html = await report(store, id);
      const manifest = manifestOf(html);
      await fs.writeFile(path.join(directory, 'report.html'), html, { flag: 'wx' });
      await t.test('self-contained HTML preserves failure, blocked and unrun states', async () => {
        assert.deepEqual(
          manifest.cases.map((c) => c.status),
          ['PASS_ASSERTIONS', 'FAIL_ASSERTION', 'BLOCKED_DATA', 'NOT_EXECUTED'],
        );
        assert.equal(manifest.counts.pass, 1);
        assert.equal(manifest.counts.fail, 1);
        assert.equal(manifest.counts.total, 4);
        assert.equal(manifest.counts.attempted, 3);
        assert.equal(manifest.delivery_status, 'COMPLETE');
        assert.equal((html.match(/<video controls/g) ?? []).length, 2);
        assert.ok(html.includes('data:video/webm;base64,'));
        assert.ok(html.includes('data:image/png;base64,'));
        assert.ok(!/<(?:script|link|img|video)[^>]*(?:src|href)=["']https?:/i.test(html));
      });
      const brokenRoot = path.join(directory, 'missing-media-data');
      await fs.cp(store.root, brokenRoot, { recursive: true, errorOnExist: true, force: false });
      const brokenStore = new Store(brokenRoot);
      const video = results[1].media.find((m) => m.type === 'video');
      const missing = path.join(brokenStore.dir(id), 'runs', results[1].id, video.file);
      assert.ok(missing.startsWith(brokenRoot + path.sep));
      await fs.unlink(missing); // Own copy only; original evidence remains intact.
      await t.test('missing video is visible partial evidence, not a passing result', async () => {
        const brokenHtml = await report(brokenStore, id);
        const broken = manifestOf(brokenHtml);
        assert.equal(broken.delivery_status, 'PARTIAL');
        assert.equal(broken.counts.pass, 1);
        assert.equal(broken.counts.fail, 1);
        assert.equal(broken.cases[1].status, 'FAIL_ASSERTION');
        assert.equal(broken.cases[1].evidence_status, 'PARTIAL');
        assert.ok(brokenHtml.includes('媒体证据不可用'));
        assert.equal((brokenHtml.match(/<video controls/g) ?? []).length, 1);
        await fs.writeFile(path.join(directory, 'missing-media.html'), brokenHtml, { flag: 'wx' });
        assert.equal(
          hash(await fs.readFile(path.join(store.dir(id), 'runs', results[1].id, video.file))),
          video.sha256,
        );
      });
      await fs.writeFile(
        path.join(directory, 'summary.json'),
        JSON.stringify(
          {
            scope:
              'Actual Chromium fixed synthetic plans; no model calls; HTML checks only until separate browser playback inspection.',
            build_id: build.build_id,
            task_id: id,
            directory,
            statuses: manifest.cases.map((c) => ({ case_id: c.case_id, status: c.status })),
            reports: await Promise.all(
              artifactNames.map(async (file) => ({
                file,
                sha256: hash(await fs.readFile(path.join(directory, file))),
              })),
            ),
            media: results.flatMap((r) => r.media.map((m) => ({ case_id: r.case_id, ...m }))),
            model_calls: 0,
            browser_playback: 'NOT_YET_VERIFIED',
          },
          null,
          2,
        ),
      );
      console.log(JSON.stringify({ directory, task_id: id, build_id: build.build_id }));
    },
  );
}

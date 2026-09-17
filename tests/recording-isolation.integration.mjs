import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { RecordingEvidence } from '../src/recording-evidence.mjs';
import { startRecordingFixture } from './fixture-recording.mjs';

const directory = path.resolve(
  process.env.RECORDING_VALIDATION_DIR || `validation/isolation-${Date.now()}`,
);
await fs.mkdir(directory, { recursive: true });
const site = await startRecordingFixture();
const session = new BrowserSession({ headless: true });
const task = {
  id: 'isolation',
  target: site.url,
  authorization: { writes: false, readOnlyEndpoints: [] },
};
const snapshots = [];
try {
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '登录合成站点' }).click();
  await session.authenticate(task, { kind: 'css', value: '#signed' });
  for (const enabled of [false, true]) {
    const context = await session.context(task);
    try {
      const page = await context.newPage();
      const recording = enabled
        ? new RecordingEvidence(
            page,
            { case_id: 'ISO', title: '独立字幕', steps: [{ step_id: 'S1' }] },
            { evidence_status: 'COMPLETE' },
          )
        : null;
      if (recording) await recording.install();
      await page.goto(site.url);
      const source = {
        step_id: 'S1',
        source_action: '操作说明专属文本',
        source_expected: '预期说明专属文本',
        index: 0,
      };
      if (recording) recording.step = source;
      const before = await page.evaluate(() => ({
        rootChildren: document.documentElement.childElementCount,
        bodyChildren: document.body.childElementCount,
        initialization: window.initialRootChildren,
      }));
      await page.evaluate(() => {
        window.externalMutations = 0;
        window.testObserver = new MutationObserver(
          (records) => (window.externalMutations += records.length),
        );
        window.testObserver.observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      });
      if (recording)
        await recording.show('准备操作', source.source_action, source.source_expected, '尚未判断');
      const changed = await page.evaluate(() => window.externalMutations);
      assert.equal(changed, 0, 'Caption update must stay inside its closed shadow tree');
      assert.equal(await page.getByText('预期说明专属文本', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: '执行一次', exact: true }).count(), 1);
      const geometry = await page.locator('#action').evaluate((element) => {
        const r = element.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).id,
        };
      });
      const bodyText = await page.locator('body').innerText();
      const htmlText = await page.locator('html').innerText();
      const handle = await page.locator('#action').elementHandle();
      if (recording) await recording.beforeAction({ action_id: 'A1', op: 'click' }, handle);
      await handle.click();
      await handle.dispose();
      const actual = await page.locator('#count').innerText();
      const productEvents = await page.evaluate(() => window.productEvents);
      if (recording) {
        const event = recording.fact.timeline.find((event) => event.kind === 'pointer');
        assert.equal(productEvents.length, 1);
        assert.equal(event.x, productEvents[0].x);
        assert.equal(event.y, productEvents[0].y);
        assert.equal(event.trusted_event, productEvents[0].trusted);
      }
      await page.locator('#lazy').scrollIntoViewIfNeeded();
      await page.getByText('懒加载完成', { exact: true }).waitFor();
      snapshots.push({
        enabled,
        before,
        geometry,
        bodyText,
        htmlText,
        actual,
        productEvents,
        lazyHits: await page.evaluate(() => window.lazyHits),
        cueMutations: changed,
      });
    } finally {
      await context.close();
    }
  }
  for (const key of ['geometry', 'bodyText', 'htmlText', 'actual', 'productEvents', 'lazyHits']) {
    assert.deepEqual(snapshots[0][key], snapshots[1][key], key);
  }
  assert.equal(snapshots[0].before.bodyChildren, snapshots[1].before.bodyChildren);
  // This explicitly preserves the counterexample: a document-level structural
  // inspection can enumerate the host. We do not claim arbitrary DOM invisibility.
  assert.equal(snapshots[1].before.rootChildren, snapshots[0].before.rootChildren + 1);
  await fs.writeFile(
    path.join(directory, 'isolation.json'),
    JSON.stringify(
      {
        validated: true,
        snapshots,
        boundary:
          'The host is enumerable. No React/Next hydration or arbitrary document-structure observer compatibility is claimed.',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      validated: true,
      directory,
      counterexample: 'Host changes documentElement children by one',
    }),
  );
} finally {
  await session.close();
  await site.close();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startTimingObservation } from '../server/build/timing-observer.mjs';

const browserOptions = { headless: true };
if (process.env.DSH_PROBE_BROWSER_EXECUTABLE) browserOptions.executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE;

const requirement = (overrides = {}) => ({
  id: 'CASE_STEP_1:正在加载设备列表…', step: 1, kind: 'visible_duration',
  target: '正在加载设备列表…', min_ms: 100, max_ms: 350,
  status: 'RUNTIME_REQUIRED', ...overrides,
});

const hiddenStatus = '<div role="status" style="display:none">正在加载设备列表…</div>';

async function run(browser, html, action, item = requirement()) {
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
    const observation = await startTimingObservation(page, [item]);
    if (action) await action(page);
    const results = await observation.finish();
    assert.equal(results.length, 1, 'one requirement must have one observer verdict');
    assert.equal(results[0].id, item.id, 'observer verdict must retain the obligation identity');
    return results[0];
  } finally { await page.close(); }
}

async function cycle(page, durations, gapMs = 30) {
  await page.evaluate(async ({ durations, gapMs }) => {
    const status = document.querySelector('[role="status"]');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (const duration of durations) {
      status.style.display = 'block';
      await wait(duration);
      status.style.display = 'none';
      await wait(gapMs);
    }
  }, { durations, gapMs });
}

test('trusted timing observer measures one visible cycle and rejects unproved cycles', async t => {
  const browser = await chromium.launch(browserOptions);
  try {
    await t.test('one approximately 180 ms cycle satisfies the frozen 100–350 ms window', async () => {
      const result = await run(browser, hiddenStatus, page => cycle(page, [180]));
      assert.equal(result.status, 'PASSED', JSON.stringify(result));
      assert.equal(result.cycles.length, 1);
      assert(result.observed_duration_ms >= 100 && result.observed_duration_ms <= 350, JSON.stringify(result));
    });

    await t.test('waiting 400 ms before IPC finish does not extend the visible interval', async () => {
      const result = await run(browser, hiddenStatus, async page => {
        await cycle(page, [180]);
        await page.waitForTimeout(400);
      });
      assert.equal(result.status, 'PASSED', JSON.stringify(result));
      assert(result.observed_duration_ms >= 100 && result.observed_duration_ms <= 350, JSON.stringify(result));
    });

    await t.test('approximately 450 ms exceeds an unchanged 250 ms upper bound', async () => {
      const result = await run(browser, hiddenStatus, page => cycle(page, [450]), requirement({ max_ms: 250 }));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert.equal(result.cycles.length, 1);
      assert(result.observed_duration_ms > 250, JSON.stringify(result));
    });

    await t.test('missing target at start cannot be manufactured later', async () => {
      const result = await run(browser, '<div>无提示</div>', async page => {
        await page.evaluate(() => { document.body.innerHTML = '<div role="status">正在加载设备列表…</div>'; });
        await page.evaluate(() => { document.querySelector('[role="status"]').style.display = 'none'; });
      });
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason, 'missing target must have a failure reason');
    });

    await t.test('initially visible target cannot count as a new loading cycle', async () => {
      const result = await run(browser, '<div role="status">正在加载设备列表…</div>', page =>
        page.evaluate(() => { document.querySelector('[role="status"]').style.display = 'none'; }));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });

    await t.test('duplicate same-name live regions are ambiguous', async () => {
      const result = await run(browser, `${hiddenStatus}${hiddenStatus}`, page => cycle(page, [180]));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });

    await t.test('a different prompt cannot satisfy the exact target', async () => {
      const wrong = await run(browser, '<div role="status" style="display:none">正在加载设备详情…</div>',
        page => cycle(page, [180]));
      assert.equal(wrong.status, 'FAILED', JSON.stringify(wrong));
      assert(wrong.reason);
    });

    await t.test('a completed cycle before this step cannot be reused', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(`<!doctype html><body>${hiddenStatus}</body>`);
        await cycle(page, [180]);
        const observation = await startTimingObservation(page, [requirement({
          id: 'CASE_STEP_2:正在加载设备列表…', step: 2,
        })]);
        const [result] = await observation.finish();
        assert.equal(result.status, 'FAILED', JSON.stringify(result));
        assert.equal(result.cycles.length, 0);
      } finally { await page.close(); }
    });

    await t.test('visible interval left open at step end is incomplete', async () => {
      const result = await run(browser, hiddenStatus, page =>
        page.evaluate(() => { document.querySelector('[role="status"]').style.display = 'block'; }));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });

    await t.test('two visible cycles cannot masquerade as one', async () => {
      const result = await run(browser, hiddenStatus, page => cycle(page, [140, 140]));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });

    await t.test('replacing the observed element invalidates its timing evidence', async () => {
      const result = await run(browser, hiddenStatus, page => page.evaluate(async () => {
        const original = document.querySelector('[role="status"]');
        original.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 90));
        const replacement = original.cloneNode(true);
        original.replaceWith(replacement);
        await new Promise(resolve => setTimeout(resolve, 90));
        replacement.style.display = 'none';
      }));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });

    await t.test('navigation loses the measured document', async () => {
      const result = await run(browser, hiddenStatus, page => page.goto('about:blank'));
      assert.equal(result.status, 'FAILED', JSON.stringify(result));
      assert(result.reason);
    });
  } finally { await browser.close(); }
});

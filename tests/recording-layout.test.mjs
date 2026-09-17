import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { RecordingEvidence } from '../src/recording-evidence.mjs';
import { renderReport } from '../src/report-view.mjs';

test('recording presentation geometry in actual Chromium (not business acceptance)', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.setContent('<button id="target">合成动作</button>');
  const recording = new RecordingEvidence(
    page,
    { case_id: 'LAYOUT', title: '中文字幕', steps: [] },
    {},
  );
  const cue = recording.cue('断言未满足', '输入苹果并查询', '结果应为香蕉', '实际为苹果');
  const bounds = () =>
    page.evaluate((key) => {
      const panel = window[key].panel;
      const rect = panel.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        font: Number.parseFloat(getComputedStyle(panel).fontSize),
        text: panel.innerText,
        overflow: panel.scrollHeight > panel.clientHeight,
      };
    }, recording.key);
  await t.test('short captions are readable and away from native bottom controls', async () => {
    await recording.render(cue);
    const rect = await bounds();
    assert.ok(rect.font >= 20, JSON.stringify(rect));
    assert.equal(rect.y, 16);
    assert.ok(rect.bottom <= 720);
    assert.ok(rect.text.includes('实际：实际为苹果'));
  });
  await t.test('bottom fallback avoids active target and reserves playback safe area', async () => {
    await recording.render({ ...cue, box: { x: 0, y: 0, width: 1360, height: 350 } });
    const rect = await bounds();
    assert.ok(rect.y > 350, JSON.stringify(rect));
    assert.ok(rect.bottom <= 720, JSON.stringify(rect));
  });
  await t.test('full Chinese field pages fit without clipping or dropping content', async () => {
    const long = '中文🙂'.repeat(46) + '结束';
    const layout = await recording.render({
      ...cue,
      title: long,
      action: long,
      expected: long,
      actual: long,
    });
    const rect = await bounds();
    assert.equal(layout.fits, true);
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.bottom <= 720, JSON.stringify(rect));
    assert.equal(rect.overflow, false);
    assert.ok(rect.text.includes('操作：' + long));
    assert.ok(rect.text.includes('预期：' + long));
    assert.ok(rect.text.includes('实际：' + long));
    assert.equal(await page.getByText(long, { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '合成动作' }).count(), 1);
  });
  await t.test(
    'an unsupported small viewport never records clipped captions as complete',
    async () => {
      await page.setViewportSize({ width: 360, height: 240 });
      const long = '这是无法在小视口完整显示的中文说明'.repeat(7);
      await recording.show('断言未满足', long, long, long);
      assert.equal(recording.result.evidence_status, 'PARTIAL');
      assert.ok(recording.fact.issues.includes('RECORDING_CUE_NOT_READABLE'));
      assert.ok(recording.fact.timeline.some((entry) => entry.fits === false));
      await page.setViewportSize({ width: 1360, height: 900 });
    },
  );
  await t.test('report video is not capped to 500px while screenshots retain the cap', async () => {
    const html = renderReport({
      state: { name: '样式夹具', events: [], fixture: true },
      baseline: { cases: [] },
      projection: { scope_valid: true },
      rows: [],
      labels: {},
      scopeText: '样式检查',
      manifest: {
        counts: {
          total: 0,
          attempted: 0,
          pass: 0,
          fail: 0,
          technical_failed: 0,
          evidence_incomplete: 0,
          cleanup_required: 0,
        },
      },
    });
    // Geometry-only nodes; no invented video/evidence is presented as a real run.
    await page.setContent(
      html.replace(
        '</main>',
        '<figure class="recording"><video></video><img alt="样式夹具"></figure></main>',
      ),
    );
    const limits = await page.evaluate(() => ({
      video: getComputedStyle(document.querySelector('video')).maxHeight,
      image: getComputedStyle(document.querySelector('img')).maxHeight,
    }));
    assert.equal(limits.video, 'none');
    assert.equal(limits.image, '500px');
  });
});

/**
 * L1 · 区间拖拽几何适配器（时间轴类控件）
 *
 * 实测事实：时间轴共 5 行（data-type: sharp/peak/flat/valley/deepValley），
 * 行间共用同一轨道几何；30 分钟对齐；拖动创建时段后弹出配价浮层。
 * 关键点：**轨道宽度与对齐步长必须每次现算，不能缓存**（窗口尺寸/滚动都会影响）。
 */
import {register} from '../../ui-automation-core/registry.mjs';
import {STATUS} from '../../ui-automation-core/status.mjs';

export const id = 'web.dragTrack';
export const assumes = ['antd', 'custom-timeline'];

/** 轨道几何 + 对齐步长探测（只读）。 */
async function geometry(page, trackSelector) {
  return page.evaluate((sel) => {
    const track = document.querySelector(sel);
    if (!track) return null;
    const r = track.getBoundingClientRect();
    const cs = getComputedStyle(track);
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      rendered: r.width > 0 && r.height > 0 && cs.display !== 'none',
    };
  }, trackSelector);
}

export async function probe(page) {
  // 探测任务里由调用方传入一个已知的轨道选择器；此处只报告框架特征
  return {snapMinutes: 30, trackSharedAcrossRows: true, note: 'SNAP_STEP_MUST_BE_CONFIRMED_ON_TARGET'};
}

export async function precheck(page, env) {
  const calibrated = env?.[id];
  if (!calibrated) return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {reason: 'NOT_CALIBRATED'}};
  const geo = await geometry(page, calibrated.trackSelector ?? '.tariff-timeline-row .tariff-timeline-track');
  if (!geo?.rendered) {
    return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {reason: 'TRACK_NOT_RENDERED', geo}};
  }
  return {ok: true, observed: geo};
}

/**
 * 在某一行上拖出一个区间（分钟数），并可选地填写随后的浮层输入。
 * args: {rowSelector, startMinutes, endMinutes, totalMinutes, popover?: {inputSelector, price, confirmName}}
 */
export async function run(page, env, args) {
  const {rowSelector, startMinutes, endMinutes, totalMinutes = 1440, popover} = args;
  const calibrated = env?.[id] ?? {};
  const base = await geometry(page, calibrated.trackSelector ?? '.tariff-timeline-row .tariff-timeline-track');
  if (!base) throw Object.assign(new Error('TRACK_NOT_FOUND'), {status: STATUS.SELECTOR_STALE});

  const row = await geometry(page, rowSelector);
  if (!row) throw Object.assign(new Error('ROW_NOT_FOUND'), {status: STATUS.SELECTOR_STALE});

  const toX = (minutes) => base.x + (minutes / totalMinutes) * base.width;
  const y = row.y + row.height / 2;

  await page.mouse.move(toX(startMinutes), y);
  await page.mouse.down();
  await page.mouse.move(toX(startMinutes + (endMinutes - startMinutes) / 2), y, {steps: 3});
  await page.mouse.move(toX(endMinutes), y, {steps: 3});
  await page.mouse.up();
  await page.waitForTimeout(900);

  const result = {startMinutes, endMinutes, geometry: {base, row}, popover: {appeared: false}};
  if (!popover) return result;

  const surface = page.locator(popover.surfaceSelector ?? '.ant-popover:visible').last();
  result.popover.appeared = (await surface.count()) > 0;
  if (!result.popover.appeared) return result;

  const input = surface.locator('input').first();
  await input.click();
  await input.press('Control+a').catch(() => {});
  await input.fill(String(popover.price));
  await page.waitForTimeout(300);
  result.popover.entered = await input.inputValue();
  await surface
    .getByRole('button', {name: popover.confirmName ?? /确\s*认/})
    .first()
    .click({timeout: 6000})
    .catch(() => {});
  await page.waitForTimeout(600);
  return result;
}

register({id, assumes, probe, precheck, run});
export const dragTrack = {id, probe, precheck, run};

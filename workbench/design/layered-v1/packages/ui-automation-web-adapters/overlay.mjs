/**
 * L1 · 弹层（弹窗/浮层）适配器
 *
 * 实测事实（两份证据都指向这里）：
 *  - 弹窗容器是 position:fixed，用 offsetParent 判"是否关闭"必然误判；
 *  - 页面上可能同时存在多个 .ant-modal-wrap（例如列表页筛选表单与新增弹窗），
 *    "最后一个可见的"才是当前弹窗，但"可见"的判据必须与 visibility 适配器一致；
 *  - Escape 会连同父弹窗一起关闭（native-dsh 的库在注释里知道这点，
 *    但 closeOverlays() 仍然按 Escape，属于同一层内判据不一致）。
 *
 * 因此关闭动作按"是否嵌套"选择策略，并且**永远优先点取消按钮**，不把 Escape 当默认。
 */
import {register} from '../../ui-automation-core/registry.mjs';
import {STATUS} from '../../ui-automation-core/status.mjs';

export const id = 'web.overlay';
export const assumes = ['antd-modal', 'antd-popover'];

/** 与 visibility 适配器同源的可见性判据：只认渲染尺寸 + display/visibility。 */
async function renderedBoxes(page, selector) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .map((el, index) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          index,
          rendered: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden',
          box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
          title: el.querySelector('.ant-modal-title')?.innerText?.trim() ?? null,
        };
      })
      .filter((entry) => entry.rendered);
  }, selector);
}

/** 标定：确认弹层选择器、当前打开的层数、取消按钮文案。只读。 */
export async function probe(page) {
  const boxes = await renderedBoxes(page, '.ant-modal-wrap');
  const title = boxes.length ? boxes[boxes.length - 1].title : null;
  const cancelText = boxes.length
    ? await page
        .locator('.ant-modal-wrap')
        .filter({has: page.locator('.ant-modal-title')})
        .last()
        .locator('button')
        .allInnerTexts()
        .then((texts) => texts.map((t) => t.replace(/\s+/g, '')).filter((t) => /取消|关闭/.test(t)))
        .catch(() => [])
    : [];
  return {modalSelector: '.ant-modal-wrap', cancelLabels: cancelText, openCount: boxes.length, lastTitle: title};
}

export async function precheck(page, env) {
  if (!env?.[id]) return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {reason: 'NOT_CALIBRATED'}};
  return {ok: true};
}

/** 当前最上层弹窗（按渲染尺寸判定，不按 offsetParent / style.display）。 */
export async function topmost(page) {
  const boxes = await renderedBoxes(page, '.ant-modal-wrap');
  if (!boxes.length) return null;
  return page.locator('.ant-modal-wrap').nth(boxes[boxes.length - 1].index);
}

/**
 * 关闭最上层弹窗：优先点取消按钮；只有调用方显式声明"允许 Escape"时才按 Escape。
 * args: {allowEscape?: boolean, maxLayers?: number}
 */
export async function closeAll(page, env, {allowEscape = false, maxLayers = 4} = {}) {
  const closed = [];
  for (let i = 0; i < maxLayers; i += 1) {
    const modal = await topmost(page);
    if (!modal) break;
    const cancel = modal.getByRole('button', {name: /取\s*消|关\s*闭/}).first();
    if ((await cancel.count()) > 0) {
      await cancel.click({timeout: 5000}).catch(() => {});
      closed.push({by: 'cancel'});
    } else if (allowEscape) {
      await page.keyboard.press('Escape');
      closed.push({by: 'escape'});
    } else {
      closed.push({by: 'none', reason: 'NO_CANCEL_BUTTON_AND_ESCAPE_NOT_ALLOWED'});
      break;
    }
    await page.waitForTimeout(500);
  }
  return {closed, remaining: (await renderedBoxes(page, '.ant-modal-wrap')).length};
}

register({id, assumes, probe, precheck, run: closeAll});
export const overlay = {id, probe, precheck, closeAll, topmost};

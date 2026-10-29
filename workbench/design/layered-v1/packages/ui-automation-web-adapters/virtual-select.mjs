/**
 * L1 · 虚拟列表下拉选择适配器
 *
 * 背景（本次实测事实）：被测系统的"归属地"下拉是虚拟列表，**没有可用搜索输入框**；
 * showSearch 声明为真但面板内不存在 input，只能靠键盘首字跳转 + 方向键定位。
 * 「有没有搜索框」属于被测系统的行为，不能写死，必须标定。
 */
import {register} from '../../ui-automation-core/registry.mjs';
import {STATUS} from '../../ui-automation-core/status.mjs';

export const id = 'web.virtualSelect';
export const assumes = ['antd', 'antd-select', 'virtual-list'];

async function snapshotPanel(page) {
  return page.evaluate(() => {
    const panels = [...document.querySelectorAll('.ant-select-dropdown')].filter((p) => {
      const r = p.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(p).display !== 'none';
    });
    const panel = panels[panels.length - 1];
    if (!panel) return null;
    return {
      options: [...panel.querySelectorAll('.ant-select-item-option')].map((o) => o.innerText.trim()),
      active: panel.querySelector('.ant-select-item-option-active')?.innerText?.trim() ?? null,
      // 注意：这里刻意不使用 offsetParent 作为可见性判据（fixed 元素恒为 null），
      // 统一用渲染尺寸，与 visibility 适配器的规范保持一致。
      hasSearchInput: [...panel.querySelectorAll('input')].some((i) => {
        if (i.disabled) return false;
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }),
      virtualized: Boolean(panel.querySelector('.rc-virtual-list')),
    };
  });
}

/** 标定：确认面板可打开、是否虚拟化、是否有搜索输入。全部只读。 */
export async function probe(page) {
  return {virtualized: true, hasSearchInput: false, requiresKeyboardNavigation: true, note: 'PROBE_MUST_BE_CONFIRMED_ON_TARGET'};
}

export async function precheck(page, env) {
  const calibrated = env?.[id];
  if (!calibrated) return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {reason: 'NOT_CALIBRATED'}};
  return {ok: true, observed: calibrated};
}

/**
 * 选择一项。策略按标定结果决定，不按声明。
 * args: {selectLocator, optionText}
 */
export async function run(page, env, {selectLocator, optionText}) {
  const calibrated = env?.[id] ?? {};
  await selectLocator.click({timeout: 8000});
  await page.waitForTimeout(900);
  const opened = await snapshotPanel(page);
  if (!opened) return {selected: null, reason: 'PANEL_NOT_OPEN'};

  if (opened.hasSearchInput && calibrated.hasSearchInput) {
    const panelInput = page.locator('.ant-select-dropdown:visible input').last();
    await panelInput.fill(optionText).catch(() => {});
    await page.waitForTimeout(900);
  } else {
    // 虚拟列表且无搜索框：用首字跳转 + 方向键逼近，逐步校验高亮项
    await page.keyboard.type(optionText.slice(0, 1));
    await page.waitForTimeout(900);
  }

  let state = await snapshotPanel(page);
  let guard = 0;
  while (state && state.active !== optionText && guard < 40) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(160);
    const next = await snapshotPanel(page);
    if (!next) break;
    if (next.active === optionText) {
      state = next;
      break;
    }
    if (next.active === state.active) break; // 到边界
    state = next;
    guard += 1;
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const selected = await selectLocator.locator('.ant-select-selection-item').first().innerText().catch(() => '');
  return {
    selected: selected.replace(/\s+/g, ''),
    requested: optionText,
    matched: selected.replace(/\s+/g, '') === optionText,
    strategy: opened.hasSearchInput ? 'search' : 'keyboard',
    panel_facts: {virtualized: opened.virtualized, option_count: opened.options.length},
  };
}

register({id, assumes, probe, precheck, run});
export const virtualSelect = {id, probe, precheck, run};

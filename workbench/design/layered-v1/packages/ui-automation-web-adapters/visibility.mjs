/**
 * L1 · 可见性适配器
 *
 * 为什么需要它：两个常见判据都有已知陷阱，且本项目实测中已经因此误判过。
 *   - el.offsetParent !== null   → position:fixed 元素恒为 null（本次实测的真实误判源）
 *   - style.display !== 'none'   → 挡不住祖先隐藏、visibility:hidden、零尺寸、opacity:0
 *
 * 做法：用被测页面里**天然存在**的已知隐藏/已知可见元素做标定，
 * 选出能同时给出正确"在/不在"的判据；标定不出来就退回保守模式并降置信度。
 * 禁止用测试脚本插入的节点当标定物 —— 那测的是插入的节点，不是被测栈的行为。
 */
import {register} from '../../ui-automation-core/registry.mjs';
import {STATUS} from '../../ui-automation-core/status.mjs';

export const id = 'web.visibility';
export const assumes = ['antd', 'any-dom'];

/** 在页面内计算一组候选判据的原始观测（只读）。 */
async function observe(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      rendered: r.width > 0 && r.height > 0,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      offsetParentNull: el.offsetParent === null,
      ariaHidden: el.closest('[aria-hidden="true"]') !== null,
    };
  }, selector);
}

/**
 * 标定：找到一对"确知隐藏 / 确知可见"的元素，验证候选判据。
 * 返回可在 run 阶段复用的判据名；标定不出唯一判据时返回 conservative 并降置信度。
 */
export async function probe(page) {
  const sample = await page.evaluate(() => {
    const pick = (predicate) => {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const hidden = cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0;
        if (predicate(hidden, el)) {
          const attr = el.getAttribute('data-probe-id');
          if (!attr) {
            el.setAttribute('data-probe-id', 'calib');
            return 'calib';
          }
        }
      }
      return null;
    };
    // 页面天然隐藏节点：优先 aria-hidden 容器或 antd 的隐藏测量行
    const hidden = document.querySelector('[aria-hidden="true"]');
    const visible = document.querySelector('body > div:not([aria-hidden="true"])');
    return {
      hiddenSelector: hidden ? (hidden.id ? `#${hidden.id}` : null) : null,
      visibleSelector: visible ? (visible.id ? `#${visible.id}` : null) : null,
      hasHiddenCandidate: Boolean(hidden),
      hasVisibleCandidate: Boolean(visible),
      pick: typeof pick,
    };
  });

  if (!sample.hasHiddenCandidate || !sample.hasVisibleCandidate) {
    // 标定物不足：不假装知道，降低置信度交给上层决定
    return {resolver: 'conservative', confidence: 'low', reason: 'NO_CALIBRATION_PAIR'};
  }

  const hiddenObs = sample.hiddenSelector ? await observe(page, sample.hiddenSelector) : null;
  const visibleObs = sample.visibleSelector ? await observe(page, sample.visibleSelector) : null;

  const candidates = {
    rendered: (o) => o.rendered,
    display: (o) => o.display !== 'none',
    offsetParent: (o) => !o.offsetParentNull,
  };

  const works = Object.entries(candidates).filter(([, fn]) => {
    const hiddenSays = hiddenObs ? fn(hiddenObs) : false;
    const visibleSays = visibleObs ? fn(visibleObs) : false;
    return hiddenSays === false && visibleSays === true;
  });

  if (works.length === 1) {
    return {resolver: works[0][0], confidence: 'high', calibrated_with: {hidden: hiddenObs, visible: visibleObs}};
  }
  return {
    resolver: 'conservative',
    confidence: 'low',
    reason: works.length === 0 ? 'NO_JUDGE_DISCRIMINATES' : 'MULTIPLE_JUDGES_AGREE',
    calibrated_with: {hidden: hiddenObs, visible: visibleObs},
  };
}

export async function precheck(page, env) {
  const resolver = env?.[id]?.resolver;
  if (!resolver) return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {reason: 'NOT_CALIBRATED'}};
  const alive = await page.evaluate(() => document.readyState !== 'loading').catch(() => false);
  return {ok: alive, status: STATUS.PRECHECK_FAILED, observed: {resolver, readyState: alive}};
}

/** 保守模式：要求多个条件同时成立，宁可漏判可见，也不误判。 */
function judge(observation, resolver) {
  switch (resolver) {
    case 'rendered':
      return observation.rendered;
    case 'display':
      return observation.display !== 'none' && observation.visibility !== 'hidden' && observation.rendered;
    case 'offsetParent':
      return !observation.offsetParentNull && observation.rendered;
    default:
      return observation.rendered && observation.display !== 'none' && observation.visibility !== 'hidden' && !observation.ariaHidden;
  }
}

export async function run(page, env, {selector}) {
  const observation = await observe(page, selector);
  if (!observation) return {visible: false, reason: 'NOT_FOUND'};
  const resolver = env?.[id]?.resolver ?? 'conservative';
  return {visible: judge(observation, resolver), resolver, observation};
}

register({id, assumes, probe, precheck, run});

export const visibility = {id, probe, precheck, run};

/**
 * 门禁 · 用例前置检查（零模型，在任何编写/执行之前运行）
 *
 * 存在的理由：009 的首次自测死在"名称输入框选错"上，随后又因目标环境不可达被取消；
 * 这两类失败都该在开始编写之前用几秒钟判定出来，而不是烧掉任务预算之后。
 *
 * 检查顺序（任一失败立即返回，不继续）：
 *   1. profile 准入
 *   2. 会话与登录态
 *   3. 目标可达性
 *   4. 入口导航可到达目标页
 *   5. 被用例引用的 target 逐条复核回执（matched / rendered）
 */
import {STATUS} from '../packages/ui-automation-core/status.mjs';
import {validateProfile} from './profile-admission.mjs';

const LOGIN_MARKERS = [/\/login\b/, /[?&]redirect=/, /请登录|登录已过期|令牌不能为空/];

/** 1+2：会话与登录态。绝不自作主张登录；判定为未登录即阻塞。 */
export async function checkSession(page, {expectedPath}) {
  const url = page.url();
  if (LOGIN_MARKERS.some((re) => re.test(url))) {
    return {ok: false, status: STATUS.BLOCKED_AUTH_REQUIRED, observed: {url}};
  }
  const body = await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 400)).catch(() => '');
  if (LOGIN_MARKERS.slice(2).some((re) => re.test(body))) {
    return {ok: false, status: STATUS.BLOCKED_AUTH_REQUIRED, observed: {url, body: body.slice(0, 120)}};
  }
  if (expectedPath && !url.includes(expectedPath)) {
    return {ok: false, status: STATUS.PRECHECK_FAILED, observed: {url, expectedPath}};
  }
  return {ok: true, observed: {url}};
}

/** 3：目标可达性（TCP/HTTP 层，不依赖页面渲染）。 */
export async function checkReachable(baseUrl, {timeoutMs = 5000} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(baseUrl, {signal: controller.signal, redirect: 'manual'});
    return {ok: response.status < 500, status: STATUS.BLOCKED_ENV_UNREACHABLE, observed: {status: response.status}};
  } catch (error) {
    return {ok: false, status: STATUS.BLOCKED_ENV_UNREACHABLE, observed: {error: String(error?.message ?? error)}};
  } finally {
    clearTimeout(timer);
  }
}

/** 5：按用例引用的 target 名逐条复核（把 matched>1 在动作前拦住）。 */
export async function checkTargets(page, profile, targetNames, resolveTarget) {
  const results = [];
  for (const name of targetNames) {
    const target = profile.targets?.[name];
    if (!target) {
      results.push({name, status: 'TARGET_UNKNOWN'});
      continue;
    }
    try {
      const locator = await resolveTarget(page, profile, name);
      const matched = await locator.count();
      const rendered = matched > 0 ? await locator.first().isVisible().catch(() => false) : false;
      results.push({
        name,
        matched,
        rendered,
        status: matched === 1 ? 'OK' : matched === 0 ? STATUS.SELECTOR_STALE : STATUS.SELECTOR_NOT_UNIQUE,
      });
    } catch (error) {
      results.push({name, status: STATUS.PRECHECK_FAILED, detail: String(error?.message ?? error)});
    }
  }
  const bad = results.filter((r) => r.status !== 'OK');
  return {ok: bad.length === 0, results, failures: bad};
}

/** 组合入口：任何一步失败都以阻塞返回，调用方不得继续。 */
export async function preflight({page, profile, caseTargets, resolveTarget, baseUrl, expectedPath}) {
  const admission = validateProfile(profile);
  if (!admission.ok) {
    return {ok: false, stage: 'profile-admission', status: STATUS.SELECTOR_STALE, errors: admission.errors};
  }
  const reachable = await checkReachable(baseUrl);
  if (!reachable.ok) return {ok: false, stage: 'reachability', ...reachable};
  const session = await checkSession(page, {expectedPath});
  if (!session.ok) return {ok: false, stage: 'session', ...session};
  const targets = await checkTargets(page, profile, caseTargets, resolveTarget);
  if (!targets.ok) return {ok: false, stage: 'targets', status: STATUS.SELECTOR_NOT_UNIQUE, ...targets};
  return {ok: true, warnings: admission.warnings};
}

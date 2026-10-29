/**
 * 原生 dsh 任务的前置预检（零模型、只读、不阻塞）
 *
 * 目的：在把任务交给模型之前，先把「明显会浪费整轮预算」的情况暴露出来：
 *   - 模块档案（module-profile.json）本身不合法：选择器匹配多个却没写收敛方式；
 *   - 登录态已经失效；
 *   - 目标环境不可达；
 *   - 档案里记录的选择器在真实页面上已经对不上（页面改版）。
 *
 * 设计约束（重要）：
 *   1. **只读**：不点击、不输入、不创建会话、不调用模型；只做结构读取与计数。
 *   2. **不 eval**：档案里的指针是给人看的表达式，预检**不执行**它。
 *      需要真实页面复核的目标，必须在档案里另外提供 `verify`（**纯 CSS 选择器**）。
 *   3. **不阻塞**：预检失败只记录并展示，不改变任务能否创建、也不改变业务判定。
 *      它是"提前告知"，不是新的门禁。
 *   4. **有时限**：任何一步超时都记成 unknown，不把超时当成失败。
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {validateProfile} from './profile-admission.mjs';

export const PROFILE_RELATIVE_PATH = 'module-profile.json';
const DEFAULT_TIMEOUT_MS = 20_000;
const LOGIN_MARKERS = [/\/login\b/, /[?&]redirect=/];

const result = (status, detail = {}) => ({status, ...detail});

/** 档案级静态检查：不存在则跳过（不是所有项目都还没建档案，静默跳过而不是报错）。 */
export async function staticPreflight(workspace) {
  const file = path.join(workspace, PROFILE_RELATIVE_PATH);
  let raw;
  try { raw = await fs.readFile(file, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return result('SKIPPED', {reason: 'PROFILE_ABSENT', file: PROFILE_RELATIVE_PATH});
    return result('UNKNOWN', {reason: 'PROFILE_UNREADABLE', detail: String(error.code || error.message)});
  }
  let profile;
  try { profile = JSON.parse(raw); }
  catch { return result('FAIL', {errors: [{code: 'PROFILE_JSON_INVALID'}], warnings: [], file: PROFILE_RELATIVE_PATH}); }

  // 预检场景用非严格模式：未标定/未知原语只是提示；
  // 「多匹配未收敛」「回执为 0」这类确定危险仍然是 FAIL。
  const admission = validateProfile(profile, {strict: false});
  if (!admission.ok) return result('FAIL', {errors: admission.errors, warnings: admission.warnings, file: PROFILE_RELATIVE_PATH});
  return result(admission.warnings.length ? 'WARN' : 'PASS', {errors: [], warnings: admission.warnings, file: PROFILE_RELATIVE_PATH,
    targets: Object.keys(profile.targets || {}).length, fingerprint: profile.fingerprint?.value ?? null});
}

/** 读取档案里可用于真实页面复核的目标：只接受 verify 为纯 CSS 的选择器。 */
export function cssTargets(profile) {
  const targets = [];
  for (const [name, target] of Object.entries(profile?.targets || {})) {
    if (typeof target?.verify === 'string' && target.verify.trim()) targets.push({name, selector: target.verify});
  }
  return targets;
}

/**
 * 有界等待：既防超时，也防被等待的 promise **直接抛错**。
 * 这一点在预检里很关键——预检本身不能成为任务启动的新故障点，
 * 所以任何失败都必须转成结果对象，而不是向上抛。
 */
async function bounded(promise, timeoutMs) {
  let timer;
  const guard = new Promise(resolve => { timer = setTimeout(() => resolve({timedOut: true}), timeoutMs); });
  const wrapped = Promise.resolve(promise).catch(error => ({failed: String(error?.code || error?.message || error).slice(0, 120)}));
  try { return await Promise.race([wrapped, guard]); }
  finally { clearTimeout(timer); }
}

/**
 * 运行期预检：复用任务已附加的浏览器，只看不改。
 * 返回 {status, checks[], errors[], warnings[]}；任何失败都不抛，由调用方决定如何展示。
 */
export async function runtimePreflight({ workspace, baseUrl, cdpEndpoint, chromium, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const checks = [];
  const push = (name, status, detail = {}) => checks.push({name, status, ...detail});

  // 1) 目标可达性（Node 侧，不依赖浏览器）
  if (baseUrl) {
    const outcome = await bounded((async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(baseUrl, {signal: controller.signal, redirect: 'manual'});
        return {status: response.status < 500 ? 'PASS' : 'FAIL', http_status: response.status};
      } catch (error) {
        return {status: 'FAIL', detail: String(error?.name || error?.message || error).slice(0, 80)};
      } finally { clearTimeout(timer); }
    })(), 8000);
    if (outcome?.timedOut) push('reachability', 'UNKNOWN', {detail: 'TIMEOUT'});
    else push('reachability', outcome.status, outcome);
  } else push('reachability', 'UNKNOWN', {detail: 'NO_BASE_URL'});

  // 2) 浏览器与登录态；3) 档案目标复核
  if (!cdpEndpoint || typeof chromium?.connectOverCDP !== 'function') {
    push('session', 'UNKNOWN', {detail: 'NO_ATTACHED_BROWSER'});
    return {status: summarize(checks), checks};
  }

  const attach = await bounded((async () => {
    const browser = await chromium.connectOverCDP(cdpEndpoint);
    return browser;
  })(), timeoutMs);
  if (attach?.timedOut) {
    push('session', 'UNKNOWN', {detail: 'ATTACH_TIMEOUT'});
    return {status: summarize(checks), checks};
  }
  if (attach?.failed || !attach) {
    push('session', 'UNKNOWN', {detail: attach?.failed ? `ATTACH_FAILED:${attach.failed}` : 'ATTACH_FAILED'});
    return {status: summarize(checks), checks};
  }

  let browser = attach;
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()?.[0];
    if (!page) { push('session', 'UNKNOWN', {detail: 'NO_PAGE'}); return {status: summarize(checks), checks}; }

    const currentUrl = page.url();
    const onLoginPage = LOGIN_MARKERS.some(re => re.test(currentUrl));
    push('session', onLoginPage ? 'FAIL' : 'PASS', {url: redactUrl(currentUrl), detail: onLoginPage ? 'LOGIN_PAGE' : null});

    // 档案目标复核（仅 verify 声明的纯 CSS 选择器）
    let profile = null;
    try { profile = JSON.parse(await fs.readFile(path.join(workspace, PROFILE_RELATIVE_PATH), 'utf8')); } catch { /* 无档案则跳过 */ }
    const targets = cssTargets(profile);
    if (!targets.length) {
      push('targets', 'SKIPPED', {detail: 'NO_VERIFIABLE_TARGETS'});
    } else {
      const observed = await bounded(page.evaluate((list) => list.map(item => ({
        name: item.name,
        matched: document.querySelectorAll(item.selector).length,
      })), targets).catch(error => ({failed: String(error?.message || error).slice(0, 120)})), timeoutMs);
      if (observed?.timedOut) push('targets', 'UNKNOWN', {detail: 'TIMEOUT'});
      else if (observed?.failed) push('targets', 'UNKNOWN', {detail: observed.failed});
      else {
        const mismatched = observed.filter(item => item.matched !== 1);
        push('targets', mismatched.length ? 'FAIL' : 'PASS', {checked: observed.length, mismatched});
      }
    }
  } finally {
    // 只断开 CDP 连接，不关闭浏览器——它属于任务与登录会话。
    await Promise.resolve(browser.close?.()).catch(() => {});
  }
  return {status: summarize(checks), checks};
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) if (key !== 'token') url.searchParams.delete(key);
    if (url.searchParams.has('token')) url.searchParams.set('token', '[已隐藏]');
    return url.href;
  } catch { return String(value).slice(0, 200); }
}

function summarize(checks) {
  if (checks.some(check => check.status === 'FAIL')) return 'FAIL';
  if (checks.some(check => check.status === 'UNKNOWN')) return 'WARN';
  if (checks.some(check => check.status === 'WARN')) return 'WARN';
  return 'PASS';
}

/** 合并静态与运行期结果，供页面展示；不改变任何判定。 */
export function combinePreflight(staticResult, runtimeResult) {
  if (!staticResult && !runtimeResult) return null;
  return {
    schema: 'workbench/native-dsh-preflight-v1',
    at: new Date().toISOString(),
    blocking: false,
    status: [staticResult?.status, runtimeResult?.status].includes('FAIL') ? 'FAIL'
      : [staticResult?.status, runtimeResult?.status].some(status => status === 'WARN' || status === 'UNKNOWN') ? 'WARN' : 'PASS',
    static: staticResult ?? null,
    runtime: runtimeResult ?? null,
  };
}

/**
 * L1 · 标定与前置检查框架
 *
 * 每个 L1 原语必须导出：
 *   id        唯一标识
 *   assumes   失效标签（指纹/驱动变化时按标签作废），不是注释
 *   probe     (page) => env | null     零副作用标定，只在探测任务里跑
 *   precheck  (page, env) => {ok, ...} 每次动作前执行，不通过必须走阻塞分支
 *   run       (page, env, args) => 结果 真实动作
 *
 * 设计约束：probe 只读；probe 失败 = 该原语本次不可用，禁止猜测降级。
 */
import {STATUS, blocked, ok} from './status.mjs';

const registry = new Map();

export function register(primitive) {
  for (const key of ['id', 'assumes', 'probe', 'precheck', 'run']) {
    if (!(key in primitive)) throw new Error(`PRIMITIVE_INVALID:${primitive.id ?? '?'}:${key}`);
  }
  if (!Array.isArray(primitive.assumes) || primitive.assumes.length === 0) {
    throw new Error(`PRIMITIVE_INVALID:${primitive.id}:assumes 必须是非空数组（失效标签）`);
  }
  registry.set(primitive.id, primitive);
  return primitive;
}

export function get(id) {
  const primitive = registry.get(id);
  if (!primitive) throw new Error(`PRIMITIVE_UNKNOWN:${id}`);
  return primitive;
}

export function all() {
  return [...registry.values()];
}

/** 只对命中标签的原语做标定 —— 页面升级时不必全量重探。 */
export function matching(assumesTags = []) {
  return all().filter((primitive) => primitive.assumes.some((tag) => assumesTags.includes(tag)));
}

/**
 * 探测任务用：对指定标签（或全部）的原语做只读标定。
 * 产出的 env 写入 module-profile.json 的 calibration 段。
 */
export async function probeAll(page, {assumesTags = null} = {}) {
  const targets = assumesTags ? matching(assumesTags) : all();
  const calibration = {};
  const failures = [];
  for (const primitive of targets) {
    try {
      const env = await primitive.probe(page);
      if (env === null || env === undefined) {
        failures.push({id: primitive.id, status: STATUS.PRECHECK_FAILED, reason: 'PROBE_RETURNED_NULL'});
        continue;
      }
      calibration[primitive.id] = env;
    } catch (error) {
      failures.push({id: primitive.id, status: STATUS.PRECHECK_FAILED, reason: String(error?.message ?? error)});
    }
  }
  return {calibration, failures, ok: failures.length === 0};
}

/**
 * 用例任务用：执行一个原语。前置不通过 → 返回阻塞，绝不继续动作。
 * 这样 SELECTOR_NOT_UNIQUE / PRECHECK_FAILED 会在动作之前暴露，
 * 而不是在第 19 分钟以一个超时形式出现。
 */
export async function runPrimitive(page, id, args, {env = {}} = {}) {
  const primitive = get(id);
  const pre = await primitive.precheck(page, env);
  if (!pre?.ok) {
    return blocked(pre?.status ?? STATUS.PRECHECK_FAILED, `precheck failed: ${id}`, pre?.observed ?? null);
  }
  try {
    return ok(await primitive.run(page, env, args));
  } catch (error) {
    if (error?.status) return blocked(error.status, String(error.message), error.observed ?? null);
    throw error;
  }
}

/**
 * 指针调用辅助：L2 profile 里的 pointer 用本函数执行，禁止在 L2 里裸写定位。
 * purpose 用于在回执里记录语义（例如 'name_input_in_modal'），不参与匹配。
 */
export function pointer(page, root, expression) {
  void root;
  void expression;
  throw new Error('NOT_IMPLEMENTED: 由 case-runner 注入受控的指针解析器');
}

/** 回执：任何 target 被"使用"之前先取得一次实测证据。 */
export async function receipt(locator) {
  const matched = await locator.count();
  if (matched === 0) return {matched, rendered: false};
  const first = locator.first();
  const rendered = await first.isVisible().catch(() => false);
  const box = await first.boundingBox().catch(() => null);
  return {matched, rendered, box: box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] : null};
}

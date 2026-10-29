/**
 * 门禁 · L2 profile 准入校验
 *
 * 这是替换 native-dsh 现有 `filesystem.stat('page-facts.md')` 存在性门禁的最小改动，
 * 也是本次 008/009 连续失败的直接解药：
 *   - 每条 target 必须有 pointer + assumes + 实测回执；
 *   - matched > 1 且没有写明收敛方式（known_trap / 已限定 scope）的指针拒绝启用；
 *   - 被引用的 L1 原语必须已在 calibration 中标定成功。
 *
 * 返回 {ok, errors, warnings}；ok=false 时调用方必须拒绝启用该 profile，
 * 并生成 probe-module 任务，而不是把用例丢给模型重猜。
 *
 * 说明：本文件在 workbench 内保持**自包含**，不依赖设计原型目录里的模块。
 * 失败码按需要就地声明，语义与设计原型中的 status.mjs 一致。
 */

/** 与设计原型 status.mjs 对齐的失败码（此处只需用到这几个）。 */
const STATUS = {
  PRECHECK_FAILED: 'PRECHECK_FAILED',
  SELECTOR_NOT_UNIQUE: 'SELECTOR_NOT_UNIQUE',
  SELECTOR_STALE: 'SELECTOR_STALE',
};

/** 当前工作台尚未装载 L1 适配器注册表；空集合表示"本批不额外要求原语已标定"。 */
const DEFAULT_PRIMITIVES = [];

const REQUIRED_TARGET_FIELDS = ['assumes', 'pointer', 'verified'];

/**
 * @param {object} profile
 * @param {{primitives?: Array<{id: string}>, strict?: boolean}} options
 *   strict=true（默认）：未标定、未知原语、字段缺失都算 error —— 用于"启用档案"的场景。
 *   strict=false：这些降级为 warning，只保留**确定危险**的项为 error
 *   （多匹配未收敛、回执为 0、schema 不对）—— 用于"提前告知但不阻塞"的预检场景。
 */
export function validateProfile(profile, {primitives = DEFAULT_PRIMITIVES, strict = true} = {}) {
  const errors = [];
  const warnings = [];
  const report = (code, detail) => (strict ? errors : warnings).push({code, detail});

  if (profile?.schema !== 'ui-automation/module-profile-v1') {
    errors.push({code: 'PROFILE_SCHEMA', detail: profile?.schema ?? null});
    return {ok: false, errors, warnings};
  }

  // 1) 指纹缺失 → 尚未标定
  if (!profile.fingerprint?.value) {
    report(STATUS.SELECTOR_STALE, 'fingerprint.value 为空：该模块尚未标定');
  }

  // 2) 被引用的 L1 原语必须标定成功
  const primitiveIds = new Set(primitives.map((p) => p.id));
  const calibrated = new Set(Object.entries(profile.calibration ?? {}).filter(([, v]) => v).map(([k]) => k));
  for (const target of Object.values(profile.targets ?? {})) {
    const interaction = target?.interaction;
    if (!interaction) continue;
    if (!primitiveIds.has(interaction)) {
      report('PRIMITIVE_UNKNOWN', interaction);
    } else if (!calibrated.has(interaction)) {
      report(STATUS.PRECHECK_FAILED, `原语未标定：${interaction}`);
    }
  }

  // 3) 每条 target 的字段与回执
  for (const [name, target] of Object.entries(profile.targets ?? {})) {
    // 档案由人维护，可能混入说明性字段；非对象条目直接跳过，不让畸形输入把校验器打挂。
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      warnings.push({code: 'TARGET_NOT_OBJECT', detail: name});
      continue;
    }
    for (const field of REQUIRED_TARGET_FIELDS) {
      if (!(field in target)) report('TARGET_FIELD_MISSING', `${name}.${field}`);
    }
    const matched = target?.verified?.matched;
    if (typeof matched !== 'number') {
      report('RECEIPT_MISSING', `${name} 缺少实测回执（matched）`);
      continue;
    }
    if (matched === 0) {
      // 回执为 0 通常是"选择器已经对不上"。但有些目标本来就只在特定状态存在
      // （例如校验错误提示），这类必须显式声明 conditional，否则仍按确定问题处理。
      if (target.conditional === true) {
        warnings.push({code: 'CONDITIONAL_TARGET', detail: `${name} 允许 0 匹配（已声明 conditional）`});
      } else {
        errors.push({code: STATUS.SELECTOR_STALE, detail: `${name} 回执为 0 匹配`});
      }
    }
    // 关键规则：多匹配必须有收敛说明（这条在任何场景都是 error）
    if (matched > 1 && !target.known_trap && !target.scoped) {
      errors.push({
        code: STATUS.SELECTOR_NOT_UNIQUE,
        detail: `${name} 匹配 ${matched} 个且未写明收敛方式（known_trap 或 scoped）`,
      });
    }
    if (matched > 1 && (target.known_trap || target.scoped)) {
      warnings.push({code: 'NARROWED_POINTER', detail: `${name} 通过收敛说明使用，matched=${matched}`});
    }
    // 断言类正则的双向风险（本次实测中真实出现过）
    if (typeof target.pointer === 'string' && /完整覆盖.*\|.*没有完整|完整覆盖\|/.test(target.pointer)) {
      warnings.push({code: 'BIDIRECTIONAL_PATTERN', detail: `${name} 的正则可能同时命中正反两种提示`});
    }
  }

  // 4) 清理能力未确认时的持久化风险
  if (profile.cleanup?.unverified_at) {
    warnings.push({
      code: 'CLEANUP_UNVERIFIED',
      detail: '该模块清理接口未确认可用；任何持久化用例必须先确认清理方案，否则会产生残留数据',
    });
  }

  return {ok: errors.length === 0, errors, warnings};
}

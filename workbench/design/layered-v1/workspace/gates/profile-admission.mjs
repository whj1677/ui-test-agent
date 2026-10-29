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
 */
import {STATUS} from '../packages/ui-automation-core/status.mjs';
import {all as allPrimitives} from '../packages/ui-automation-core/registry.mjs';

const REQUIRED_TARGET_FIELDS = ['assumes', 'pointer', 'verified'];

export function validateProfile(profile, {primitives = allPrimitives()} = {}) {
  const errors = [];
  const warnings = [];

  if (profile?.schema !== 'ui-automation/module-profile-v1') {
    errors.push({code: 'PROFILE_SCHEMA', detail: profile?.schema ?? null});
    return {ok: false, errors, warnings};
  }

  // 1) 指纹缺失 → 未标定，不得启用
  if (!profile.fingerprint?.value) {
    errors.push({code: STATUS.SELECTOR_STALE, detail: 'fingerprint.value 为空：该模块尚未标定'});
  }

  // 2) 被引用的 L1 原语必须标定成功
  const primitiveIds = new Set(primitives.map((p) => p.id));
  const calibrated = new Set(Object.entries(profile.calibration ?? {}).filter(([, v]) => v).map(([k]) => k));
  for (const target of Object.values(profile.targets ?? {})) {
    const interaction = target?.interaction;
    if (!interaction) continue;
    if (!primitiveIds.has(interaction)) {
      errors.push({code: 'PRIMITIVE_UNKNOWN', detail: interaction});
    } else if (!calibrated.has(interaction)) {
      errors.push({code: STATUS.PRECHECK_FAILED, detail: `原语未标定：${interaction}`});
    }
  }

  // 3) 每条 target 的字段与回执
  for (const [name, target] of Object.entries(profile.targets ?? {})) {
    for (const field of REQUIRED_TARGET_FIELDS) {
      if (!(field in (target ?? {}))) errors.push({code: 'TARGET_FIELD_MISSING', detail: `${name}.${field}`});
    }
    const matched = target?.verified?.matched;
    if (typeof matched !== 'number') {
      errors.push({code: 'RECEIPT_MISSING', detail: `${name} 缺少实测回执（matched）`});
      continue;
    }
    if (matched === 0) {
      errors.push({code: STATUS.SELECTOR_STALE, detail: `${name} 回执为 0 匹配`});
    }
    // 关键规则：多匹配必须有收敛说明
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

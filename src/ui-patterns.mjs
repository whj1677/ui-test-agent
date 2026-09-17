// Authored technical advice, never learned page prose, locators or business answers.
export const PATTERN_VERSION = 'ui-patterns/1';
const patterns = [
  {
    id: 'dialog_layers',
    feature: 'dialogs',
    title: '弹窗与遮挡',
    checks: '重新观察当前弹窗、目标所属层和实际命中对象；DOM顺序及z-index不证明最上层。',
    advice: '只使用原用例允许且当前候选提供的关闭动作；缺少层级或对象证据时继续采证，不猜关闭。',
    counterexample: '关闭了同名的底层窗口，或关闭后原目标仍被其他层遮挡。',
  },
  {
    id: 'scoped_repeat',
    feature: 'scoped_repeat',
    title: '同名控件的语义范围',
    checks: '核对原对象的容器身份、范围内唯一目标以及当前对象是否变化。',
    advice: '同名目标优先检查当前已观察的范围绑定；不取第一个，不用历史容器名生成定位。',
    counterexample: '唯一且可编辑的同名控件属于另一个业务对象。',
  },
  {
    id: 'async_collection',
    feature: 'collection',
    title: '列表与分页',
    checks: '核对当前条件、加载状态、记录身份和分页状态；重复渲染也可能增加控件数。',
    advice: '只选择当前允许的查询或分页候选；数据是否正确仍由原用例预期判定。',
    counterexample: '新DOM节点只是重复旧记录，或显示的是另一查询条件的结果。',
  },
  {
    id: 'future_fields',
    feature: 'inputs',
    title: '表单与未来控件',
    checks: '区分当前已观察控件和后续步骤的未知控件；仅有表单不证明存在向导。',
    advice: '历史经验不能补成未来DOM事实；不能为采证提前填写或推进业务表单，保留现有审批边界。',
    counterexample: '另一页面有同名字段，但当前步骤尚未出现该字段。',
  },
];
export const PATTERN_IDS = Object.freeze(patterns.map((p) => p.id));
export const EXPERIENCE_NOTICE =
  'UI经验仅为技术检查建议，不是DOM事实、业务答案或权限；不得生成定位器、改变原Case/审批、扩充候选/预算。历史核验次数不是收益证明。';

// Only booleans leave this projection. Names/values are not persisted or echoed.
export function uiFeatures(snapshot) {
  const controls = Array.isArray(snapshot?.controls) ? snapshot.controls.slice(0, 300) : [];
  const names = new Map();
  for (const c of controls) {
    if (typeof c?.name !== 'string' || typeof c.role !== 'string') continue;
    const key = JSON.stringify([c.role, c.name.slice(0, 500)]);
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  return {
    dialogs: controls.some((c) => c?.role === 'dialog' || typeof c?.dialog_context === 'string'),
    scoped_repeat: controls.some(
      (c) =>
        c?.locator?.kind === 'within' &&
        c.locator.target &&
        typeof c.name === 'string' &&
        (names.get(JSON.stringify([c.role, c.name.slice(0, 500)])) ?? 0) > 1,
    ),
    collection: controls.some((c) => ['table', 'listitem', 'article'].includes(c?.role)),
    inputs: controls.some((c) =>
      ['textbox', 'combobox', 'checkbox', 'radio', 'spinbutton'].includes(c?.role),
    ),
  };
}
export function structureKey(features) {
  return ['dialogs', 'scoped_repeat', 'collection', 'inputs']
    .map((k) => (features[k] === true ? '1' : '0'))
    .join('');
}
export function retrievePatterns(features, verified = new Set()) {
  return patterns
    .filter((p) => features[p.feature] === true)
    .map((p, index) => ({ ...p, index, verified: verified.has(p.id) }))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || a.index - b.index)
    .slice(0, 3)
    .map(({ index, feature, verified: used, ...p }) => ({
      ...p,
      version: PATTERN_VERSION,
      evidence: 'ADVICE_NOT_PAGE_FACT',
      experience: used ? 'TECHNICALLY_VERIFIED_HISTORY' : 'AUTHORED_PATTERN_ONLY',
    }));
}

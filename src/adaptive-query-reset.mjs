// Permission is from the CURRENT immutable original step. DOM context is a
// separate dispatch prerequisite, not a substitute for this source binding.
export function isQueryResetStep(action, expected = '') {
  if (typeof action !== 'string' || typeof expected !== 'string') return false;
  if (
    /不要|不得|不能|禁止|无需|不再|勿|避免|不是|而非|没有|不应|别|未|如果|若|否则|\b(?:not|never|avoid|unless|if|when)\b|don['’]t/iu.test(
      action,
    )
  )
    return false;
  if (
    /重置.{0,8}(?:数据|记录|账号|密码)|清空.{0,8}(?:数据|记录)|\breset\s+(?:data|records|account|password)/iu.test(
      action + '\n' + expected,
    )
  )
    return false;
  const clauses = action.split(/[，,。；;\n]/u).map((part) => part.trim());
  const explicit = clauses.some(
    (clause) =>
      /^(?:点击|click)\s*(?:查询(?:区|条件|表单)(?:内|中)?(?:的)?\s*)?[「“"']?(?:重置|reset)[」”"']?(?:按钮)?[.]?$/iu.test(
        clause,
      ) ||
      /^(?:点击\s*)?[「“"']?重置(?:查询|搜索|筛选|过滤)(?:条件)?[」”"']?(?:按钮)?$/u.test(clause),
  );
  if (!explicit) return false;
  return (
    /查询|搜索|筛选|过滤|\b(?:query|search|filter)\b/iu.test(action) ||
    /(?:查询|搜索|筛选|过滤)(?:条件|结果)?|(?:清空|清除|恢复|重置).{0,6}条件|条件.{0,8}(?:清空|清除|恢复|重置)/iu.test(
      expected,
    )
  );
}

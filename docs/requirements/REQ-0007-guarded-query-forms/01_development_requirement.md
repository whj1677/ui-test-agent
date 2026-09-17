<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0007 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0007-01 | 已确认 | 仅补充非生产原生GET查询表单；当前原action正向查询及字段字面值绑定，不从预期/页面/模型推导授权。 | 两种冻结页面筛选可通过产品候选完成，原文和页面不改。 | 有限查询词和字段值，不能变成通用表单提交能力。 |
| DR-0007-02 | 已确认 | 唯一查询按钮、同源安全action/self目标、少量可见非敏感text/search/单选select；拒绝隐藏、外置、未知和业务表单。 | 方法/按钮覆盖属性/敏感字段/重复及混合业务按钮反例无候选，输入值仍固定。 | GET不是纯读证明；保留网络路由和已有授权保护。 |
| DR-0007-03 | 已确认 | 原用例字段条件齐备才提供点击；派发前及点击到submit重核form/button/field身份、结构与值，仅该按钮一次可信submit。 | 换form/action/value/节点/submitter、隐式/重复提交被拒，finally清理许可。 | 不自动requestSubmit或脚本代点，不允许业务POST/写授权升级。 |
| DR-0007-04 | 已确认 | 保存修复前失败及最终专项/受影响/程序回归，需求先建、修复独立Git同步。 | 保留原24例17文件摘要和旧4179；结果、统计、commit可追溯。 | 本机组件能力不代替真实模型、完整用例或发布验收。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

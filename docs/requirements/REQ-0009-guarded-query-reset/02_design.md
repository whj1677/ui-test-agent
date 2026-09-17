<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0009 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0009-01 | DR-0009-01 | 已确认 | 查询原文绑定 | 使用queryFormBinding确认原查询与当前字段值，再提取独立重置原句；保留两份步骤与引用。 |
| DD-0009-02 | DR-0009-02 | 已确认 | 查询表单资格 | 复用queryFormFacts而不删除全局危险词重置；仅精确原生查询重置分支越过名称规则。 |
| DD-0009-03 | DR-0009-03 | 已确认 | 事件时重新核验 | reset没有submitter，不宣称能识别所有事件因果；凭原点击、同form、完整实时签名与一次窗口限定，保留独立网络护栏。 捕获阶段拒绝采用统一block路径，清空permit/querySubmit/queryReset/dialogSubmit；已有blocked状态拒绝所有后续事件。 |
| DD-0009-04 | DR-0009-04 | 已确认 | 限定验证及同步 | 本包不包含多步表单/知识库，不重启4179，不触碰旧任务，不换路径调用被拒绝的模型。 集成替身识别已观察locator的基础目标时核对dialog身份，返回计划仍克隆完整范围定位；增加范围保留断言。仅修阻塞本轮验证的测试，不改变产品或冻结验收资产。 |

## 接口与数据流

- 原Case查询字段绑定+精确重置原句→已核验表单与唯一native reset→opaque query_reset候选→现场身份/字段签名→一次reset事件→新页面观察。
- 模型仍只能返回当前candidate_id；新kind描述窄能力，不新增任意op/selector/value/脚本入口。query与query_reset分开事件许可，不互相授权。

## 模块文档影响

- 更新docs/modules/release_runtime.md的探索查询边界，src/query-forms.mjs、src/discovery-browser.mjs及DISCOVERY_PROMPT受影响；无前端UI或数据迁移。

## 风险与回滚

- 仅精确原生reset；同名普通button和业务表单继续不支持，不能将候选缺失写成用例错误。
- 浏览器捕获检查异常必须显式拦截，不能只抛错；保留当前全局危险名称/路径与网络控制。
- 独立提交可定位回退；不删除历史失败、不重置数据/预算、不自动部署到4179。

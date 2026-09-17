# 需求索引

- [REQ-0011-recording-caption-readability](REQ-0011-recording-caption-readability/current_state.md)：REQ-0001实测子问题；修复新录像字幕与底部控制条相交、报告缩放过小，保留原执行与事实语义。

- [REQ-0010-candidate-file-integrity](REQ-0010-candidate-file-integrity/current_state.md)：REQ-0001子问题；说明损坏仍被自检报摘要一致，限定增加清单元数据/路径集合/逐文件核验，不代替签名或发布验收。

- [REQ-0009-guarded-query-reset](REQ-0009-guarded-query-reset/current_state.md)：REQ-0001子问题；原查询后“重置”可见但无候选，仅补原文绑定且核验身份的原生查询重置，保留业务重置禁令。

- [REQ-0008-multistep-plan-grounding](REQ-0008-multistep-plan-grounding/current_state.md)：REQ-0001子问题；多步表单未来控件缺少计划证据。仅设计，待选择一次审批未观察原文定位或新页面后再次审批；不扩大探索业务操作。

- [REQ-0007-guarded-query-forms](REQ-0007-guarded-query-forms/current_state.md)：REQ-0001子问题；submit型查询使输入和点击候选缺失，增加原文绑定的受限GET查询及一次submit现场核验；不开放业务提交。

- [REQ-0006-case-bound-reading-actions](REQ-0006-case-bound-reading-actions/current_state.md)：REQ-0001子问题；分页/说明/读取重试入口可见但不进探索候选，增加原文绑定与现场重验，保留表单和网络边界。

- [REQ-0005-semantic-scope-locators](REQ-0005-semantic-scope-locators/current_state.md)：REQ-0001子问题；重复卡片/列表按钮被全页唯一校验丢弃，新增受限语义范围及身份复核，冻结夹具不改。

- [REQ-0004-multi-ui-fixtures](REQ-0004-multi-ui-fixtures/current_state.md)：REQ-0001子包；原8保留，三种结构24例复杂UI与独立真值，夹具自检不代替Agent验收。

- [REQ-0003-state-file-coordination](REQ-0003-state-file-coordination/current_state.md)：REQ-0001子问题；实际并发回归暴露Windows状态替换EPERM，协调本进程读写并验证有界失败。

- [REQ-0002-wrapped-label-controls](REQ-0002-wrapped-label-controls/current_state.md)：REQ-0001子问题；嵌套标签控件观察/查询绑定与缺口报告，先复现再修复。

- [REQ-0001-release-readiness](REQ-0001-release-readiness/current_state.md)：用户新设持续发布目标；先需求、逐问题修复/验证/Git同步，多界面真实模型与安全/安装/独立操作证据齐备才可判内部试用就绪。

- [REQ-20260916-internal-beta](REQ-20260916-internal-beta/current_state.md)：已授权实施；身份、同站点清理保护和安装恢复入口已做工程验证。真实模型、干净 Windows 和独立人员验收未齐全，候选待验。
- [REQ-20260916-checkpoints](REQ-20260916-checkpoints/current_state.md)：原步骤内分段检查，工程实现与限定验证完成；真实模型效果和真实业务验收未验证。

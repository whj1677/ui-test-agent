# 需求索引

- [REQ-0015-manual-complex-lab](REQ-0015-manual-complex-lab/current_state.md)：独立复杂合成网站与18有效/4待澄清/2已知缺陷用例；Kimi编写、Codex核验，用户手动测试Agent，不修改旧验收集。

- [REQ-0013-discovery-observability](REQ-0013-discovery-observability/current_state.md)：探索规划衔接、可展开的候选排除诊断与300项内分区采集已实现；627项非暂停工程回归及本机注入联调完成。权限/审批不变，真实模型收益另验，4179及旧包未切换。

- [REQ-0012-ui-experience-memory](REQ-0012-ui-experience-memory/current_state.md)：有限经验库已接入并完成本机工程验证；默认只记录，同名范围定位可积累可信经验，真实模型收益对照未运行，不绕过多步表单审批。

- [REQ-0011-recording-caption-readability](REQ-0011-recording-caption-readability/current_state.md)：REQ-0001实测子问题；修复新录像字幕与底部控制条相交、报告缩放过小，保留原执行与事实语义。

- [REQ-0010-candidate-file-integrity](REQ-0010-candidate-file-integrity/current_state.md)：REQ-0001子问题；说明损坏仍被自检报摘要一致，限定增加清单元数据/路径集合/逐文件核验，不代替签名或发布验收。

- [REQ-0009-guarded-query-reset](REQ-0009-guarded-query-reset/current_state.md)：REQ-0001子问题；原查询后“重置”可见但无候选，仅补原文绑定且核验身份的原生查询重置，保留业务重置禁令。

- [REQ-0008-multistep-plan-grounding](REQ-0008-multistep-plan-grounding/current_state.md)：用户已选A，一次批准完整固定计划；未来字段以原文意图标记、执行时核验向导步骤及所属表单，614项工程回归完成；不扩大探索业务操作，不以工程计划代替真实模型验收。

- [REQ-0007-guarded-query-forms](REQ-0007-guarded-query-forms/current_state.md)：REQ-0001子问题；submit型查询使输入和点击候选缺失，增加原文绑定的受限GET查询及一次submit现场核验；不开放业务提交。

- [REQ-0006-case-bound-reading-actions](REQ-0006-case-bound-reading-actions/current_state.md)：REQ-0001子问题；分页/说明/读取重试入口可见但不进探索候选，增加原文绑定与现场重验，保留表单和网络边界。

- [REQ-0005-semantic-scope-locators](REQ-0005-semantic-scope-locators/current_state.md)：REQ-0001子问题；重复卡片/列表按钮被全页唯一校验丢弃，新增受限语义范围及身份复核，冻结夹具不改。

- [REQ-0004-multi-ui-fixtures](REQ-0004-multi-ui-fixtures/current_state.md)：REQ-0001子包；原8保留，三种结构24例复杂UI与独立真值，夹具自检不代替Agent验收。

- [REQ-0014-runtime-binding](REQ-0014-runtime-binding/current_state.md)：默认关闭的只读运行时绑定试点已实现并完成本机工程验证；先输入审查，再批准意图，运行时查验当前目标；真实模型与发布验收未完成。

- [REQ-0003-state-file-coordination](REQ-0003-state-file-coordination/current_state.md)：REQ-0001子问题；实际并发回归暴露Windows状态替换EPERM，协调本进程读写并验证有界失败。

- [REQ-0002-wrapped-label-controls](REQ-0002-wrapped-label-controls/current_state.md)：REQ-0001子问题；嵌套标签控件观察/查询绑定与缺口报告，先复现再修复。

- [REQ-0001-release-readiness](REQ-0001-release-readiness/current_state.md)：用户新设持续发布目标；先需求、逐问题修复/验证/Git同步，多界面真实模型与安全/安装/独立操作证据齐备才可判内部试用就绪。

- [REQ-20260916-internal-beta](REQ-20260916-internal-beta/current_state.md)：已授权实施；身份、同站点清理保护和安装恢复入口已做工程验证。真实模型、干净 Windows 和独立人员验收未齐全，候选待验。
- [REQ-20260916-checkpoints](REQ-20260916-checkpoints/current_state.md)：原步骤内分段检查，工程实现与限定验证完成；真实模型效果和真实业务验收未验证。

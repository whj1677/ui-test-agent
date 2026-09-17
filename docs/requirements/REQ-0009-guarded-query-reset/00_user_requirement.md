<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0009 用户需求

## 原始输入

> 承接REQ-0001用户确认的发布目标、问题修复和逐项Git同步。冻结原WORK-002第2步为“点击「重置」”，期望查询字段恢复默认并返回列表；本包只修该类查询重置候选缺失，不扩大为业务数据重置。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0009-01 | 已确认 | 原查询后重置筛选不再要求维护者手工介入，且设备重置/业务清空仍拒绝。 | 沿用原Case/目标/权限与预算，仅已核验原生查询表单；固定原文，不改预期。 | 冻结查询重置链路及身份/事件/网络反例有实际证据，修复独立Git同步。 |

## 已确认事实

- 状态卡：阶段=正式实现；目标=限定查询重置候选；输入=冻结WORK-002与当前DOM/源码；交付=限定修复、回归证据、独立提交；不做=业务重置/多步审批/知识库；停止=本包修复验证同步或真实阻塞。
- 修复前Chromium从首页经产品候选选择区域东区、优先级高并查询，实际显示WO-105；页面存在可见BUTTON/type=reset/FORM，但候选中重置数量0，预期1。进程退出1，业务mutations为空；日志validation/release-query-reset-before.log。
- DANGEROUS_NAME包含重置/reset；candidateKind无限定例外，queryFormFacts只接受查询submit按钮作为按钮目标。现有GET查询能力不等于重置已支持。
- 事件序列反例实际失败：原重置按钮onmousedown触发另一表单reset，另一表单被阻止但原表单随后仍重置1次；期望0。validation/REQ-0009-latch-before.log，1测试1失败0跳过。需首个拒绝立即清空许可并锁住同操作后续事件；不只在动作结束后报错。
- 首轮新增测试日志REQ-0009-reset-first.log保留6个TAP失败（含父项）：两处测试夹具问题是直接getByLabel不适配嵌套select，以及测试按钮id=reset遮蔽form.reset，使重复/填入中reset反例没有实际触发。改用产品快照读字段值和非遮蔽测试ID，不修改冻结页面或业务预期。
- 最终产品源码下程序回归已执行516项、0失败/跳过。首次3文件浏览器集成2成功1失败，失败是tests/discovery.integration.mjs的注入模型只认顶层testid；实际记录已含新增任务dialog内within→testid的任务名称/负责人，替身因误判继续点新增直至候选去重后抛错。证据validation/REQ-0009-integration.log及validation/discovery-qU3L7y/mock-model-calls.json/summary.json；不是实际DeepSeek连接故障。
- 最终产品源码冻结后的非暂停程序回归516项、0失败/跳过（含新增38项TAP检查），日志validation/REQ-0009-runtime.log。固定原WORK-002从首页查询并重置恢复默认，未修改冻结17文件/24例摘要。
- 浏览器集成首轮browser与reliability两文件成功，discovery失败记录保留。兼容within后的第一次测试替身修订遗漏scope-only定位没有target，失败保留validation/REQ-0009-discovery-after.log；加可选目标检查与正反例后，discovery单独复验退出0，日志validation/REQ-0009-discovery-final.log。3个文件分别有成功执行证据，不能把首轮组合结果改写为全成功。
- 最终discovery合成联调在validation/discovery-WYgASn保存11次注入模型请求、菜单/弹窗自主候选探索、2份计划、UI批准和2条只读执行事实；仅手动登录1次、业务写请求0、语义验收仍待评审。实际DeepSeek请求0，不能计为真实模型或发布验收。
- REQ-0009-related.log保留89通过1失败：该失败是测试误读SELECT.current_value，实际观察协议使用selected_label；已按原“全部”预期核验，不改变产品或原用例。

## 推断与待确认

- 按钮名称和GET不能证明黑盒处理器无副作用；本包限定DOM、原文、一次事件与网络边界，不宣称任意站点纯读安全。
- 不需改变原业务预期或完整计划审批；REQ-0008的互斥产品选择仍独立等待。

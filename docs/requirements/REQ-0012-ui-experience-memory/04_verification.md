<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0012 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0012-01 | DR-0012-01 | 已确认 | 单元测试通过 | 四类目录匹配、确定性及数据/长度边界 | 真实单元正反例；无原页面/Case内容、未知模式或可执行动作。 | 命令：node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs；退出码：0；测试数量：39；失败数量：0；跳过数量：0；证据：validation/REQ-0012-targeted.log | node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs | 0 | 39 | 0 | 0 | validation/REQ-0012-targeted.log |
| VT-0012-02 | DR-0012-02 | 已确认 | 集成测试通过 | 真实浏览器回执与错误奖励/重复尝试反例 | 原目标/范围/阻挡前后事实；假增量/错对象/超过时间窗口/缺证据不计成功。 | 命令：node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs；退出码：0；测试数量：39；失败数量：0；跳过数量：0；证据：validation/REQ-0012-targeted.log | node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs | 0 | 39 | 0 | 0 | validation/REQ-0012-targeted.log |
| VT-0012-03 | DR-0012-03 | 已确认 | 集成测试通过 | 持久化隔离/晋升/撤回/重放与损坏容错 | 真实目录/重启、原子写故障及超限输入；原历史摘要保持。 | 命令：node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs；退出码：0；测试数量：39；失败数量：0；跳过数量：0；证据：validation/REQ-0012-targeted.log | node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs | 0 | 39 | 0 | 0 | validation/REQ-0012-targeted.log |
| VT-0012-04 | DR-0012-04 | 已确认 | 集成测试通过 | 产品集成与三模式边界 | 产品observe写入、assist命中/撤回；off/observe输入/候选不变，降级仍保留失败。注入模型只验协议。 | 命令：node --test tests/ui-experience-flow.test.mjs；退出码：0；测试数量：7；失败数量：0；跳过数量：0；证据：validation/REQ-0012-flow-revocation.log | node --test tests/ui-experience-flow.test.mjs | 0 | 7 | 0 | 0 | validation/REQ-0012-flow-revocation.log |
| VT-0012-05 | DR-0012-05 | 已确认 | 未运行 | 真实模型配对对照及发布回归 | 冻结版本/分组、原始事实、相同预算/成本/介入记录；正确终态不退化后才讨论效率，样本不足声明不确定。 | 真实模型策略限制仍在，工程结果不能证明本项。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/preparation.test.mjs：validation/REQ-0012-preparation-timing.log，12项0失败0跳过；调度及原预期边界验证，初始失败/调整依据见本包00_user_requirement的已确认事实。
- 命令：node tests/runtime-regression.mjs：validation/REQ-0012-delivery-final.log，593项0失败0跳过；同一产品构建的完整工程回归，TTL测试独立性补强前，受影响最终专项另记collector。
- 命令：node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs tests/preparation.test.mjs：validation/REQ-0012-final-targeted.log，52项0失败0跳过，包含独立TTL正向前置；与593项重叠不相加。仅记录检查因把VT02的失败反例要求字样识别为实际运行失败而拒绝，修正文案区分要求与结果，原失败日志保留；未修改测试判定。
- 命令：node tests/runtime-regression.mjs：validation/REQ-0012-runtime-first.log，592项0失败0跳过；随后补充产品撤回测试7项0失败0跳过，两者范围重叠不相加。
- 命令：UI_AGENT_EXPERIENCE=assist node tests/discovery.integration.mjs：validation/REQ-0012-assist-verified.log，退出0；discovery-OSGtLa保存模型协议/诊断/事实；11次注入调用，其中4次含建议、2次是计划，原审批后两条只读断言满足、业务写请求0。不是真实模型结果。
- 命令：node acceptance/check.mjs：冻结24例/17文件未变，只证明原合成资产摘要。正式sync/collector/checker记录当前实际结果。
- 环境：Windows/Node22.19.0/真实Chromium/独立localhost和validation数据；4179未重启、不改旧任务。真实模型调用0。

## 结论

- 经验闭环已实际接入并经本机工程反例验证；只对scoped_repeat进行可信技术正反馈，其余为人工编写的观察建议。
- 默认observe不改变模型输入；assist仅排序和提示，不扩充候选/预算/权限/原预期。真实模型泛化和效率收益未验证，父发布目标未完成。
- VT01-03共用targeted.log的39项结果，不能按VT累加。覆盖目录无正文回显、JSON回执伪造/重放、隔离/冻结/撤回/TTL/版本/损坏/未知字段/链接/外部替换/原子rename失败/并发写。未宣称所有容量边界已压力验收。
- 保留REQ-0012-no-dispatch-before.log中未实际派发却误记正向的失败；修复后idle与页面合成事件UNKNOWN。错误对象COUNTEREXAMPLE、DOM增长/目标消失UNKNOWN。
- flow-first.log首次6项中3失败，原因是测试复用同任务已有采证检查点；改为独立新任务验证，不关闭产品复用。最终flow-revocation.log为7项0失败0跳过，包含独立Node进程重载、产品反证撤回且WITHIN_SCOPE_CHANGED原错误保留、off和损坏回退；所有baseline字节不变，业务写请求0。

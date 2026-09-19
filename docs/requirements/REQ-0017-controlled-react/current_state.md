<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：19
- 最后更新：2026-09-20

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0017-01 | 已确认 | 只读列表/查询/分页/详情自主完成操作和完整检查，技术缺口有界恢复，不依赖外部Code Agent现场救场。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0017-01 | 已确认 | 业务合同与完整检查 |
| DR-0017-02 | 已确认 | 结构化缺口与有界ReAct恢复 |
| DR-0017-03 | 已确认 | 执行时观察与受控技术绑定 |
| DR-0017-04 | 已确认 | 主流程状态与证据 |
| DR-0017-05 | 已确认 | 冻结正反例与独立验证 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0017-01 | DR-0017-01 | 已确认 | 业务合同与完整检查 |
| DD-0017-02 | DR-0017-02 | 已确认 | 版本19：新自适应row_count必须由当前原预期字面行/记录数量支持同一数值；序号/前后缀、字段个数、时间、否定/条件/上下界不作精确总数，字段为空不作空表。原编号范围或位置/前缀矩阵exact_rows需原同值总数依据，不删除合法位置/字段/明确数量。有限数字/中文数词语法，模糊语法不猜；字面匹配仍不能证明总体范围或对象正确，独立审查保持。旧固定路径不变，候选不自动修改、实际差异不重放。沿用v18可信当前步骤能力事实/联合纠错及原预算。 |
| DD-0017-03 | DR-0017-03 | 已确认 | 执行时观察与受控技术绑定；版本11新增scope内原生唯一dt/dd只读字段定位definition，禁止动作/跨域/值反选。 |
| DD-0017-04 | DR-0017-04 | 已确认 | 主流程状态与证据 |
| DD-0017-05 | DR-0017-05 | 已确认 | 冻结正反例与独立验证 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0017-01 | DR-0017-01 / DD-0017-01 | 已实现 | 业务合同与完整检查 |
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 已实现 | 版本19实现精确行数的当前原文字面数值来源，及编号范围/位置前缀不得额外闭合总体的校验；纯函数、真实Chromium控制器注入纠错与受影响工程回归、后续真实产品结果分别记录。沿用v18能力事实与联合反馈，不改原文/历史/旧固定路径，不增重试和期限。 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 版本11实现没有HTML属性的原生dt/dd只读definition绑定，含重名/诱饵/错位及未修改manual-lab验证；真实产品效果另列。未来写入绑定仍待修复。 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 版本10同步登录后的父阶段，当前prepare/run使用对应界面流程；失败状态、原事实与未执行边界保持。 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 进行中 | 扩展原24例完整分类验证与成对新合成故障页；冻结输入/真值，实际运行、审查反例和记录所有未完成，不以参考脚本替代Agent结果。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=3 tests/adaptive-prefix-cardinality.test.mjs tests/adaptive-position-reset.test.mjs tests/adaptive-position-recovery.test.mjs tests/adaptive-extra-constraints.test.mjs tests/adaptive-extra-constraints.execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-capabilities.test.mjs tests/adaptive-capabilities.execution.test.mjs tests/adaptive-semantic-boundary.test.mjs tests/adaptive-review.test.mjs tests/table-assertion.test.mjs tests/plan-quality.test.mjs；退出码：0；测试数量：327；失败数量：0；跳过数量：0；证据：validation/req0017/v19-final-regression.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-05 | DR-0017-05 | 人工待确认 | 冻结正反例与独立验证 | 命令：node --test --test-concurrency=1 expanded-lab/verify.test.mjs expanded-lab/grading.test.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：60；失败数量：0；跳过数量：0；证据：validation/req0017/v9-fixture-verified.log |

## 人工待确认项

- [ ] 版本10首批状态、批次隔离和部分字段观察修复完成1212项工程回归；真实新32例尚未完整复验。导航路径否定、整区域误断言、范围声明、120秒期限、负向遮挡和未来写入绑定仍待解决，不因工程项通过声称全部修复。免重复Key与合成登录基础见REQ-0016版本2，初次迁移已完成。
- [ ] 版本9验证已收口，但完整业务覆盖未达到：32条均尝试相应流程，6准备失败无正式执行，新故障对照未触及故障目标。434调用/83分3.715秒，未使用扩时。BLOCK_NOW：字段级采集/绑定、合法入口及同名作用域、范围声明与预期区分、一动作往返与120秒期限冲突、父/子任务状态不同步、单例JSON错误终止批次、写入未来页面预绑定限制。运行源码保持冻结，须按通用能力修复后复验，不改旧结果或原预期。
- [ ] VALIDATE：版本8本轮3/3不证明重复稳定性。真实模型未提出额外row_count，因此新的提前拒绝/纠错分支仅有工程注入反例证据；应另行故障对照验证详情整区域contains在错字段或诱饵值下不会误报，不能从当前正常页面推断该能力。
- [ ] 历史版本8：用户“再进行一轮测试吧”授权的一轮100调用/15分钟已使用，实际78调用/521.384秒；当时已结束。版本9扩大验证依最新明确请求另行建账，未续用或篡改版本8记录。
- [ ] VALIDATE（历史版本6发现）：无活动测试时login-confirmation会自动走旧探索入口；当时停止该分支并计入4次调用。当前版本7复测未走该分支，未在冻结版本中顺便修改登录流程。

## 本轮禁止实现内容

- 不得修改冻结用例/预期/选集换取通过。
- 不得任意代码执行、未知写入、未知派发重放、跨对象修定位、跨时刻拼同时证据。
- 不得把模型审查/预置计划/注入回复/回放/工程测试计为自主产品验收。

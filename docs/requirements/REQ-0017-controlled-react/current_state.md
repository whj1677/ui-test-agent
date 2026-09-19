<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：22
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
| DD-0017-02 | DR-0017-02 | 已确认 | 版本22扩展现有table_unchanged来源识别：明确表格/列表内容与本步骤操作前完全一致/相同，以及未应用条件，同一函数用于提前捕获、计划来源和完整覆盖。排除否定/条件/例子/选择分支、上一步/历史/操作后/外部标准和仅记录数关系；不一般性解释任意同义词。运行器基线绑定、实际矩阵比较和差异不重试保持，不能事后捕获或用当前固定值代替关系。v20审查反馈/旧来源守卫继续保持。 |
| DD-0017-03 | DR-0017-03 | 已确认 | 执行时观察与受控技术绑定；版本11新增scope内原生唯一dt/dd只读字段定位definition，禁止动作/跨域/值反选。 |
| DD-0017-04 | DR-0017-04 | 已确认 | 主流程状态与证据 |
| DD-0017-05 | DR-0017-05 | 已确认 | 版本21独立留出8例：Kimi仅基于新合成真值著作HTML与用例，无产品源码/旧测试输入。冻结前核对作者错项并记录，冻结后不按Agent失败改原题。固定4198、六资产SHA和原11资产同时核验，heldout独立suite保持all原32；server不暴露答案/源码，模型只得该组原用例及现场观察。无登录站点只用首页标记建立会话，不为Agent提供业务定位器/计划；全部只读，共享调用/期限与官方供应商保持。参考18场景和工程注入不计产品，真实正常完成/指定差异/技术失败分开。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0017-01 | DR-0017-01 / DD-0017-01 | 已实现 | 业务合同与完整检查 |
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 已实现 | 版本22实现明确同一步操作前表格一致来源识别及20单元/2控制器注入场景；209项受影响工程完成。页签/排序另批处理，原冻结留出未复验，不把工程结果当产品通过。 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 版本11实现没有HTML属性的原生dt/dd只读definition绑定，含重名/诱饵/错位及未修改manual-lab验证；真实产品效果另列。未来写入绑定仍待修复。 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 版本10同步登录后的父阶段，当前prepare/run使用对应界面流程；失败状态、原事实与未执行边界保持。 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 进行中 | 版本21已完成独立8例资产冻结与隔离编排接入、25项参考/工程验证；真实留出和同构建稳定性继续进行。原32流程、旧失败和写入仅准备边界保留。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=3 tests/table-invariant-source.test.mjs tests/table-invariant-source.execution.test.mjs tests/table-invariant.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs；退出码：0；测试数量：209；失败数量：0；跳过数量：0；证据：validation/req0017/v22-regression.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-05 | DR-0017-05 | 人工待确认 | 冻结正反例与独立验证 | 命令：node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs；退出码：0；测试数量：25；失败数量：0；跳过数量：0；证据：validation/req0017/v21-final-regression.log |

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

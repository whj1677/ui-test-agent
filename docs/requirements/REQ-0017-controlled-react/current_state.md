<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：9
- 最后更新：2026-09-19

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
| DD-0017-02 | DR-0017-02 | 已确认 | 结构化缺口与有界ReAct恢复 版本8：所有自适应片段使用同一来源/身份/断言语义守卫；仅完整性义务允许在未结束时待补，不允许已提供的非法断言先执行。固定计划默认完整校验不变。 |
| DD-0017-03 | DR-0017-03 | 已确认 | 执行时观察与受控技术绑定 |
| DD-0017-04 | DR-0017-04 | 已确认 | 主流程状态与证据 |
| DD-0017-05 | DR-0017-05 | 已确认 | 冻结正反例与独立验证 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0017-01 | DR-0017-01 / DD-0017-01 | 已实现 | 业务合同与完整检查 |
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 已实现 | 已统一片段执行前与完成态语义校验，派发前精确反馈额外行数断言；305项受影响工程验证保留。冻结后另行授权的版本8真实原三例均完整通过；本轮没有触发额外行数候选拒绝分支，不能把成功归因为该分支已在真实模型中验证。 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 执行时观察与受控技术绑定 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 主流程状态与证据 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 进行中 | 扩展原24例完整分类验证与成对新合成故障页；冻结输入/真值，实际运行、审查反例和记录所有未完成，不以参考脚本替代Agent结果。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-05 | DR-0017-05 | 人工待确认 | 冻结正反例与独立验证 | 命令：node --test --test-concurrency=1 expanded-lab/verify.test.mjs expanded-lab/grading.test.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：60；失败数量：0；跳过数量：0；证据：validation/req0017/v9-fixture-verified.log |

## 人工待确认项

- [ ] 版本9验证已收口，但完整业务覆盖未达到：32条均尝试相应流程，6准备失败无正式执行，新故障对照未触及故障目标。434调用/83分3.715秒，未使用扩时。BLOCK_NOW：字段级采集/绑定、合法入口及同名作用域、范围声明与预期区分、一动作往返与120秒期限冲突、父/子任务状态不同步、单例JSON错误终止批次、写入未来页面预绑定限制。运行源码保持冻结，须按通用能力修复后复验，不改旧结果或原预期。
- [ ] VALIDATE：版本8本轮3/3不证明重复稳定性。真实模型未提出额外row_count，因此新的提前拒绝/纠错分支仅有工程注入反例证据；应另行故障对照验证详情整区域contains在错字段或诱饵值下不会误报，不能从当前正常页面推断该能力。
- [ ] 历史版本8：用户“再进行一轮测试吧”授权的一轮100调用/15分钟已使用，实际78调用/521.384秒；当时已结束。版本9扩大验证依最新明确请求另行建账，未续用或篡改版本8记录。
- [ ] VALIDATE（历史版本6发现）：无活动测试时login-confirmation会自动走旧探索入口；当时停止该分支并计入4次调用。当前版本7复测未走该分支，未在冻结版本中顺便修改登录流程。

## 本轮禁止实现内容

- 不得修改冻结用例/预期/选集换取通过。
- 不得任意代码执行、未知写入、未知派发重放、跨对象修定位、跨时刻拼同时证据。
- 不得把模型审查/预置计划/注入回复/回放/工程测试计为自主产品验收。

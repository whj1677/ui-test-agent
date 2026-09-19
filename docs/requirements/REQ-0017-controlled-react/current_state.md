<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：8
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
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 已实现 | 已统一片段执行前与完成态语义校验，派发前精确反馈额外行数断言；新增控制器/真实浏览器回归并纳入305项受影响工程验证，未追加真实模型调用。 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 执行时观察与受控技术绑定 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 主流程状态与证据 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 部分实现 | 冻结正反例与独立验证 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs；退出码：0；测试数量：305；失败数量：0；跳过数量：0；证据：validation/req0017/v8-targeted.log |
| VT-0017-05 | DR-0017-05 | 无法运行 | 冻结正反例与独立验证 | 版本7限定真实运行实际2/3完整通过，任务40da64d7-b2b2-4cd0-8e17-57b7a4aaf074，66调用/420.143秒。V01四步13断言、V02四步18断言通过；V03一步完成，分页测量后被累计语义校验拒绝，详情未执行。无法运行指V03未能完整跑通，不是未执行。验证收据validation/req0017/v7-real-result.json；脱敏结论real-model-v7-result.md。更广异构及独立验收仍未齐备。 |

## 人工待确认项

- [ ] VALIDATE：版本8统一语义入口的工程反例已验证；真实模型是否根据提前反馈修正候选并完成原V03仍需新的限定复验，不能把注入回复当自主能力。
- [ ] 此前版本7一轮100调用/15分钟授权已使用，实际66调用/420.143秒；本次只进行源码修复与本机工程验证，不续跑外部API。4179当前连接拒绝且本轮未启动，新代码下次启动生效。
- [ ] VALIDATE（历史版本6发现）：无活动测试时login-confirmation会自动走旧探索入口；当时停止该分支并计入4次调用。当前版本7复测未走该分支，未在冻结版本中顺便修改登录流程。

## 本轮禁止实现内容

- 不得修改冻结用例/预期/选集换取通过。
- 不得任意代码执行、未知写入、未知派发重放、跨对象修定位、跨时刻拼同时证据。
- 不得把模型审查/预置计划/注入回复/回放/工程测试计为自主产品验收。

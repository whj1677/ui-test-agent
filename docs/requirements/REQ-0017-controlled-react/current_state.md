<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：5
- 最后更新：2026-09-18

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
| DD-0017-02 | DR-0017-02 | 已确认 | 结构化缺口与有界ReAct恢复 |
| DD-0017-03 | DR-0017-03 | 已确认 | 执行时观察与受控技术绑定 |
| DD-0017-04 | DR-0017-04 | 已确认 | 主流程状态与证据 |
| DD-0017-05 | DR-0017-05 | 已确认 | 冻结正反例与独立验证 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0017-01 | DR-0017-01 / DD-0017-01 | 已实现 | 业务合同与完整检查 |
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 已实现 | 结构化缺口与有界ReAct恢复 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 执行时观察与受控技术绑定 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 主流程状态与证据 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 部分实现 | 冻结正反例与独立验证 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log |
| VT-0017-05 | DR-0017-05 | 无法运行 | 冻结正反例与独立验证 | 真实模型已实际执行，但原三例不能完整运行：版本5任务ab79abfc-fdc8-4bc1-a311-1528ce7a6106，0/3整例通过、3技术失败，42调用（直接测试38+登录确认意外探索4）。V01/V03缺口未补齐且重复片段而停止，V02审查自相矛盾。状态“无法运行”指不能完整跑通，不表示未启动；保留本机原始事实与报告，工程262项不能替代此验收。 |

## 人工待确认项

- [ ] BLOCK_NOW：部分片段审查的缺失义务没有持续提供给下一次规划；completed只保存fragment，成功片段后清除correction。需设计并验证显式未完成义务反馈、首次重复片段有界纠错及矛盾审查的保守回退，不能仅继续增加格式重试。
- [ ] 后续实现/真实模型验证尚未执行。本轮授权的追加一轮已使用，不再新建API复测。
- [ ] VALIDATE：无活动测试时login-confirmation会自动走旧探索入口。本轮已停止该分支并计入4次调用；未在冻结版本中顺便修改登录流程。

## 本轮禁止实现内容

- 不得修改冻结用例/预期/选集换取通过。
- 不得任意代码执行、未知写入、未知派发重放、跨对象修定位、跨时刻拼同时证据。
- 不得把模型审查/预置计划/注入回复/回放/工程测试计为自主产品验收。

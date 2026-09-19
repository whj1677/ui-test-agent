<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 已确认 | 集成测试通过 | 业务合同与完整检查 | 原步骤/输入/对象/预期/顺序/时机保持；表格字段矩阵和明确编号区间全覆盖，25字段同一DOM观察，遗漏中段不得通过。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs；退出码：0；测试数量：373；失败数量：0；跳过数量：0；证据：validation/req0017/v7-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs | 0 | 373 | 0 | 0 | validation/req0017/v7-targeted.log |
| VT-0017-02 | DR-0017-02 | 已确认 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 计划缺项或缺证不得直接撤销已确认用例；真正业务歧义由隔离输入审查判断；补证先于重复生成，预算/无进展终止保持。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs；退出码：0；测试数量：373；失败数量：0；跳过数量：0；证据：validation/req0017/v7-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs | 0 | 373 | 0 | 0 | validation/req0017/v7-targeted.log |
| VT-0017-03 | DR-0017-03 | 已确认 | 集成测试通过 | 执行时观察与受控技术绑定 | 同一批准只读动作派发前观察/探测/等价绑定；身份/字段/作用域/顺序/期限不变；未知派发和断言差异不重放、不改预期。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs；退出码：0；测试数量：373；失败数量：0；跳过数量：0；证据：validation/req0017/v7-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs | 0 | 373 | 0 | 0 | validation/req0017/v7-targeted.log |
| VT-0017-04 | DR-0017-04 | 已确认 | 集成测试通过 | 主流程状态与证据 | 显示当前目标/观察/恢复/停止原因，不新增逐定位审批；旧批准不静默扩权，旧任务不改。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs；退出码：0；测试数量：373；失败数量：0；跳过数量：0；证据：validation/req0017/v7-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs | 0 | 373 | 0 | 0 | validation/req0017/v7-targeted.log |
| VT-0017-05 | DR-0017-05 | 已确认 | 无法运行 | 冻结正反例与独立验证 | 保留原3例和24例/17文件，增加异构留出及故障对照；至少两轮真实模型验证另列，技术救场/漏报/误停/调用耗时分列。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 版本7限定真实运行实际2/3完整通过，任务40da64d7-b2b2-4cd0-8e17-57b7a4aaf074，66调用/420.143秒。V01四步13断言、V02四步18断言通过；V03一步完成，分页测量后被累计语义校验拒绝，详情未执行。无法运行指V03未能完整跑通，不是未执行。验证收据validation/req0017/v7-real-result.json；脱敏结论real-model-v7-result.md。更广异构及独立验收仍未齐备。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 命令：node tests/model-flow.integration.mjs
- 命令：node --test tests/manual-lab-readonly.test.mjs
- 环境：Windows/Node/独立Chromium；版本7运行构建980e41888c3a0ccb425c9c7e53dfa49ebd3d8ac3f049c29645cba415aa6c3a78，官方DeepSeek deepseek-flash，localhost4196原合成三例。结束active=null、登录VERIFIED。

## 结论

- 版本7工程373项历史证据保留，不重跑或累计。最新限定真实模型66调用、420.143秒、2条完整通过及1条技术失败；不是最终产品验收。原步骤和旧失败不改，媒体33份SHA核对一致。
- 版本6同一组受影响工程回归270项通过（0失败/取消/跳过，554779.033毫秒），原24例/17文件冻结检查保持。最终collector及文档检查退出码0；不与历史版本或各VT重复累计。本轮未调用真实模型，4179仍运行版本5，未重启或清除内存Key。
- 版本5受影响工程回归262项全部通过，443409.2257毫秒；各VT引用同一份证据，不累加。版本4全量1165是历史基线，未重跑新版全量。
- 版本4真实51调用、0/3整例通过；版本5追加真实42调用、0/3整例通过。修复的局部反例工程通过，但自主执行目标未达成，不具备发布或人工验收交接条件。
- 首次版本5collector已实际运行262项且退出码0；其附带文档检查因设计/追踪视图未同步失败，修复事实源视图后单独复检，保留首次检查失败记录。

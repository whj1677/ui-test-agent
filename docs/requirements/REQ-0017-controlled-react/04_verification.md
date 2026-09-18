<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 已确认 | 集成测试通过 | 业务合同与完整检查 | 原步骤/输入/对象/预期/顺序/时机保持；表格字段矩阵和明确编号区间全覆盖，25字段同一DOM观察，遗漏中段不得通过。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs | 0 | 262 | 0 | 0 | validation/req0017/v5-targeted.log |
| VT-0017-02 | DR-0017-02 | 已确认 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 计划缺项或缺证不得直接撤销已确认用例；真正业务歧义由隔离输入审查判断；补证先于重复生成，预算/无进展终止保持。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs | 0 | 262 | 0 | 0 | validation/req0017/v5-targeted.log |
| VT-0017-03 | DR-0017-03 | 已确认 | 集成测试通过 | 执行时观察与受控技术绑定 | 同一批准只读动作派发前观察/探测/等价绑定；身份/字段/作用域/顺序/期限不变；未知派发和断言差异不重放、不改预期。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs | 0 | 262 | 0 | 0 | validation/req0017/v5-targeted.log |
| VT-0017-04 | DR-0017-04 | 已确认 | 集成测试通过 | 主流程状态与证据 | 显示当前目标/观察/恢复/停止原因，不新增逐定位审批；旧批准不静默扩权，旧任务不改。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs；退出码：0；测试数量：262；失败数量：0；跳过数量：0；证据：validation/req0017/v5-targeted.log | node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs | 0 | 262 | 0 | 0 | validation/req0017/v5-targeted.log |
| VT-0017-05 | DR-0017-05 | 已确认 | 未运行 | 冻结正反例与独立验证 | 保留原3例和24例/17文件，增加异构留出及故障对照；至少两轮真实模型验证另列，技术救场/漏报/误停/调用耗时分列。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 版本4真实复验51调用，原三例0/3完整通过。V01/V02技术失败，V03错误目标上的断言差异不能认定业务缺陷；原事实保留。版本5修复后尚未真实复验；已获额外一轮100调用/15分钟授权。工程结果与模型结果分列。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 命令：node tests/model-flow.integration.mjs
- 命令：node --test tests/manual-lab-readonly.test.mjs
- 环境：Windows/Node/隔离真实Chromium，工程回归文件并发4；当前4179仍为版本4 cdd326252f4a，待版本5定向工程回归后切换，不改运行中的测试源码。

## 结论

- 版本5受影响工程回归262项全部通过，443409.2257毫秒；各VT引用同一份证据，不累加。版本4全量1165是历史基线，未重跑新版全量。
- 版本4真实51调用，0/3整例通过；版本5新增回放不等于自主模型验收。
- 首次版本5collector已实际运行262项且退出码0；其附带文档检查因设计/追踪视图未同步失败，修复事实源视图后单独复检，保留首次检查失败记录。

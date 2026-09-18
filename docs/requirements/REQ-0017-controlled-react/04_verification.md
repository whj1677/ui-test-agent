<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 已确认 | 集成测试通过 | 业务合同与完整检查 | 原步骤/输入/对象/预期/顺序/时机保持；表格字段矩阵和明确编号区间全覆盖，25字段同一DOM观察，遗漏中段不得通过。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：1165；失败数量：0；跳过数量：0；证据：validation/req0017/final-governance-v4-r2.log | node tests/runtime-regression.mjs | 0 | 1165 | 0 | 0 | validation/req0017/final-governance-v4-r2.log |
| VT-0017-02 | DR-0017-02 | 已确认 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 计划缺项或缺证不得直接撤销已确认用例；真正业务歧义由隔离输入审查判断；补证先于重复生成，预算/无进展终止保持。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：1165；失败数量：0；跳过数量：0；证据：validation/req0017/final-governance-v4-r2.log | node tests/runtime-regression.mjs | 0 | 1165 | 0 | 0 | validation/req0017/final-governance-v4-r2.log |
| VT-0017-03 | DR-0017-03 | 已确认 | 集成测试通过 | 执行时观察与受控技术绑定 | 同一批准只读动作派发前观察/探测/等价绑定；身份/字段/作用域/顺序/期限不变；未知派发和断言差异不重放、不改预期。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：1165；失败数量：0；跳过数量：0；证据：validation/req0017/final-governance-v4-r2.log | node tests/runtime-regression.mjs | 0 | 1165 | 0 | 0 | validation/req0017/final-governance-v4-r2.log |
| VT-0017-04 | DR-0017-04 | 已确认 | 集成测试通过 | 主流程状态与证据 | 显示当前目标/观察/恢复/停止原因，不新增逐定位审批；旧批准不静默扩权，旧任务不改。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：1165；失败数量：0；跳过数量：0；证据：validation/req0017/final-governance-v4-r2.log | node tests/runtime-regression.mjs | 0 | 1165 | 0 | 0 | validation/req0017/final-governance-v4-r2.log |
| VT-0017-05 | DR-0017-05 | 已确认 | 未运行 | 冻结正反例与独立验证 | 保留原3例和24例/17文件，增加异构留出及故障对照；至少两轮真实模型验证另列，技术救场/漏报/误停/调用耗时分列。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 版本3用户真实模型轮次bc122ba6-d48c-48b0-8364-e881067caded原三例均TECHNICAL_FAILED（17调用，登录VERIFIED）。版本4全量工程1165项通过，包含表格关系33项及实际失败回复回放；真实模型尚未重跑，不能据此宣称自主能力通过。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 命令：node tests/model-flow.integration.mjs
- 命令：node --test tests/manual-lab-readonly.test.mjs
- 环境：Windows/Node/独立测试数据及端口/Chromium；工程回归文件并发4，保留产品内部并发测试；4179已切换到冻结构建cdd326252f4a，真实复验前不修改服务源码

## 结论

- 1165为版本4同一全量工程回归的去重总数；各验证项引用同一份证据，定向回归为其子集，不相加。保留此前失败及取消日志，不计通过；工程回放/注入回复不是真实模型自主能力证据。
- 版本3实际模型三例技术失败，版本4模型复验待完成；不具备发布结论。

<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0043 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0043-01 | DR-0043-01 | 已确认 | 单元测试通过 | 集中式有界日志、隐私过滤及写入隔离 | 工程注入正反例、唯一正式4322导出与离线导出分开；用户电脑历史故障不作通过。 同一92项回归集合重复引用，不累加计数；全量首轮1397通过/5失败已保留，5项响应替身兼容错误修复后对应20项与最终92项均通过。 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log | node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs | 0 | 92 | 0 | 0 | workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-02 | DR-0043-02 | 已确认 | 单元测试通过 | 启动、请求与任务全链路正常/异常记录 | 工程注入正反例、唯一正式4322导出与离线导出分开；用户电脑历史故障不作通过。 同一92项回归集合重复引用，不累加计数；全量首轮1397通过/5失败已保留，5项响应替身兼容错误修复后对应20项与最终92项均通过。 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log | node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs | 0 | 92 | 0 | 0 | workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-03 | DR-0043-03 | 已确认 | 单元测试通过 | DSH、浏览器、Office和网页异常诊断 | 工程注入正反例、唯一正式4322导出与离线导出分开；用户电脑历史故障不作通过。 同一92项回归集合重复引用，不累加计数；全量首轮1397通过/5失败已保留，5项响应替身兼容错误修复后对应20项与最终92项均通过。 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log | node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs | 0 | 92 | 0 | 0 | workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-04 | DR-0043-04 | 已确认 | 集成测试通过 | 网页和离线可导出诊断包 | 工程注入正反例、唯一正式4322导出与离线导出分开；用户电脑历史故障不作通过。 同一92项回归集合重复引用，不累加计数；全量首轮1397通过/5失败已保留，5项响应替身兼容错误修复后对应20项与最终92项均通过。 | 命令：node workbench/qa/20261030-diagnostics-system/verify-official.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/official-verified.log | node workbench/qa/20261030-diagnostics-system/verify-official.mjs | 0 | 1 | 0 | 0 | workbench/qa/20261030-diagnostics-system/official-verified.log |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent
- 命令：npm test
- 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs
- 命令：node workbench/qa/20261030-diagnostics-system/verify-official.mjs
- 命令：node workbench/scripts/export-diagnostics.mjs
- 环境：Windows/Node22，唯一正式4322；本机原配置和数据目录身份保持；无模型调用、无业务变更。

## 结论

- 全
- 量
- 首
- 轮
- 1
- 3
- 9
- 7
- 通
- 过
- 5
- 失
- 败
- ，
- 原
- 失
- 败
- 保
- 留
- ；
- 响
- 应
- 替
- 身
- 兼
- 容
- 错
- 误
- 修
- 复
- 后
- 2
- 0
- 项
- 和
- 最
- 终
- 9
- 2
- 项
- 均
- 通
- 过
- ；
- 正
- 式
- 页
- 面
- 与
- 离
- 线
- 导
- 出
- 通
- 过
- ，
- 用
- 户
- 现
- 场
- 仍
- 待
- 部
- 署
- 复
- 现
- 。

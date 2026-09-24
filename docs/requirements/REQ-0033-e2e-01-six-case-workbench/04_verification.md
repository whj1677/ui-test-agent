<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0033 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0033-01 | DR-0033-01 | 等待人工核对 | 集成测试通过 | 工作台真实导入、候选Harness生成、六次试跑、媒体访问和重启读回完整闭环。 | 区分真实Harness调用和产品运行与工程样例；保留命令、退出码、测试统计、产品运行ID、媒体及预算。 | 命令：cd workbench; npm test; node tests/e2e01-preflight.integration.mjs；退出码：0；测试数量：89；失败数量：0；跳过数量：0；证据：workbench/docs/E2E_01_ACCEPTANCE_REPORT.md；六条实际运行ID、失败步骤、媒体和7/7启动账本详见报告；工程预检不计产品结果 | cd workbench; npm test; node tests/e2e01-preflight.integration.mjs | 0 | 89 | 0 | 0 | workbench/docs/E2E_01_ACCEPTANCE_REPORT.md；六条实际运行ID、失败步骤、媒体和7/7启动账本详见报告；工程预检不计产品结果 |
| VT-0033-02 | DR-0033-01 | 已确认 | 未运行 | 已提交源码的干净导出工程回归；AUTH及QA分别归属，不能替代产品或人工验收。 | 确定源码SHA、导出完整性、锁文件安装、当前命令退出码及测试数；零模型。 | 待代码集成提交后执行，见workbench/docs/BASELINE_CLOSE_20260924.md。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm test
- 命令：node tests/e2e01-preflight.integration.mjs
- 命令：node --test tests/project-case-build-input.test.mjs tests/project-case-build-run.test.mjs tests/m4a-query-case.test.mjs
- 环境：Node锁定依赖；TEST-SITE-01本机端口4320；工作台独立数据目录workbench/.local/six-case-e2e；DeepSeek DSH 0.1.6-alpha.2与Browser Use 0.1.6-alpha.2。

## 结论

- 工程测试89/89通过；三份真实Harness候选及六条实际运行已形成3正常通过、3指定业务失败；媒体与重启读回完成，等待真人核对，不自动批准。

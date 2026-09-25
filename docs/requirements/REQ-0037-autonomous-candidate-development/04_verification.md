<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 已确认 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令退出码、版本哈希、工具结果、调用计数及逐步状态 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log | node --test workbench/tests/*.test.mjs | 0 | 120 | 0 | 0 | workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 已确认 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 真实工具记录、执行报告、覆盖核查与相同候选哈希；不得仅靠绿色或模型自报 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json | node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair | 0 | 2 | 1 | 0 | workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 已确认 | 未运行 | 本批B工具反馈、原B弱断言拦截、语义边界、唯一新B及三种独立验证 | 生产MCP实际反馈；离线旧报告成功仍阻止弱断言；真实禁用/隐藏/不存在边界；正常/故障/隔离语义反例同稿哈希 | 工程125/125退出0已执行；新B正在运行，结果待记录。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm test
- 命令：npm --prefix ../harness-probe test
- 环境：Windows Node22、锁定Playwright1.62.1、DSH0.1.6-alpha.2；独立测试端口，日常4322不变。

## 结论

- 工作台最终collector回归见当前日志；Harness24/24退出0；锁定DSH零模型插件检查通过。
- 真实逻辑任务2/2，Harness2次，工具57次，开发执行3次+最终验证4次。A恢复完成，B仍有缺口；不得自动批准。
- 旧核心108项失败未修复/未重跑；AUTH扩展、任意环境接入、自动恢复不在本批完成范围。

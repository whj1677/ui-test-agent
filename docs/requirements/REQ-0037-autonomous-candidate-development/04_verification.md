<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 已确认 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令退出码、版本哈希、工具结果、调用计数及逐步状态 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log | node --test workbench/tests/*.test.mjs | 0 | 120 | 0 | 0 | workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 已确认 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 真实工具记录、执行报告、覆盖核查与相同候选哈希；不得仅靠绿色或模型自报 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json | node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair | 0 | 2 | 1 | 0 | workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 已确认 | 集成测试通过 | 真实工具链贯通、原稿单次工程执行和真实恢复独立验收 | 零模型真实工具协议和浏览器执行；哈希绑定与越界拒绝；业务语义仍人工核对 | b-recovery/manifest.json与engineering-tool-chain.json、original/report.json；真实3开发+3最终，额外原稿1次共7业务执行。工程工作台127/127、Harness24/24；候选等待人工核对。 | - | - | - | - | - | - |
| VT-0037-04 | DR-0037-01 | 已确认 | 人工待确认 | 固定产品条件下两条陌生流程从零生成及独立故障验证 | 首稿/工具记录/正常与故障报告、完整包哈希、维护者逐项语义核查；不自动批准 | 命令：node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-unfamiliar/manifest.json | node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b | 0 | 2 | 0 | 0 | workbench/qa/20260925-unfamiliar/manifest.json |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm test
- 命令：npm --prefix ../harness-probe test
- 环境：Windows Node22、锁定Playwright1.62.1、DSH0.1.6-alpha.2；独立测试端口，日常4322不变。

## 结论

- 工作台最终collector回归见当前日志；Harness24/24退出0；锁定DSH零模型插件检查通过。
- 真实逻辑任务2/2，Harness2次，工具57次，开发执行3次+最终验证4次。A恢复完成，B仍有缺口；不得自动批准。
- 旧核心108项失败未修复/未重跑；AUTH扩展、任意环境接入、自动恢复不在本批完成范围。

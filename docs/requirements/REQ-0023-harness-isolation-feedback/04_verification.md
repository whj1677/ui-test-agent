<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0023 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0023-01 | DR-0023-01 | 已确认 | 人工待确认 | 文件、网络、凭据允许/禁止隔离审计。 | 确定性命令、退出码、逐项布尔事实和脱敏JSON | audit:isolation运行ID isolation-2026-09-21T01-58-18-774Z-adfd2b02，退出码2；三类隔离均false，公开摘要见harness-probe/evidence/m2b-isolation-summary.json | - | - | - | - | - | - |
| VT-0023-02 | DR-0023-02 | 已确认 | 未运行 | 唯一一次Harness反馈修订启动与产物。 | 隔离总门、启动计数、steps、工具调用、usage、墙钟和候选哈希 | 隔离总门失败；Harness启动0次，模型相关计数不适用，无新候选 | - | - | - | - | - | - |
| VT-0023-03 | DR-0023-03 | 已确认 | 未运行 | 同一修订候选正常与最小反例验证。 | 两份Playwright结构化报告、相同候选哈希和配置摘要 | 隔离总门失败且无新候选，按停止条件未执行 | - | - | - | - | - | - |
| VT-0023-04 | DR-0023-01 / DR-0023-02 / DR-0023-03 | 已确认 | 人工待确认 | 历史资产、敏感信息、Git提交和远端SHA核对。 | 哈希、变更清单、扫描及远端查询 | M2-A两候选和M1批准脚本按基线字节核对；脱敏报告与分支同步待最终Git核对 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：harness-probe
- 命令：npm ci --ignore-scripts
- 命令：npm test
- 命令：npm run audit:isolation
- 环境：Windows宿主；不修改公司安全策略；真实模型总门默认关闭。

## 结论

- 工程测试16项无失败；真实隔离审计退出码2，文件、网络、凭据隔离均不满足；按总门停止且未启动模型。

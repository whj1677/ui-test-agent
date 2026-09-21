<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0023 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0023-01 | DR-0023-01 | 已确认 | 人工待确认 | 文件、网络、凭据允许/禁止隔离审计。 | 确定性命令、退出码、逐项布尔事实和脱敏JSON | audit:isolation运行ID isolation-2026-09-21T01-58-18-774Z-adfd2b02，退出码2；三类隔离均false，公开摘要见harness-probe/evidence/m2b-isolation-summary.json | - | - | - | - | - | - |
| VT-0023-02 | DR-0023-02 | 已确认 | 人工待确认 | 唯一一次Harness反馈修订启动与产物。 | 风险接受记录、启动计数、steps、工具调用、usage、墙钟和候选哈希 | Harness启动1次，31.703秒，8 steps，9/30工具调用（浏览器5），候选SHA-256 5277F2E3...C5450；请求数/usage未知 | - | - | - | - | - | - |
| VT-0023-03 | DR-0023-03 | 已确认 | 人工待确认 | 同一修订候选正常与最小反例验证。 | 两份Playwright结构化报告、相同候选哈希和配置摘要 | 正常1/1通过；独立PROBE-41反例1/1断言不符；前后哈希一致，候选未批准 | - | - | - | - | - | - |
| VT-0023-04 | DR-0023-01 / DR-0023-02 / DR-0023-03 | 已确认 | 人工待确认 | 历史资产、敏感信息、Git提交和远端SHA核对。 | 哈希、变更清单、扫描及远端查询 | M2-A两候选和M1批准脚本按基线字节核对；脱敏报告与分支同步待最终Git核对 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：harness-probe
- 命令：npm test
- 命令：npm run revise:feedback
- 命令：node src/verify-feedback-candidate.mjs
- 环境：Windows宿主；独立Git忽略任务目录；用户已接受无OS级文件/网络隔离残余风险；不修改公司安全策略。

## 结论

- 原隔离审计失败事实保留；唯一修订候选完成正常与独立反例技术验证，但未登记为批准资产。

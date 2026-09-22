<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0029 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0029-01 | DR-0029-01 | 已确认 | 集成测试通过 | 真实解析与生产组装逐项保留 HOLD-Q1 前置条件、数据、S01-S03 动作及预期，反例资料不进入模型输入。 | 真实命令、退出码、测试统计和产物路径 | workbench npm test 69/69；M4-A 原生包与生产 attempt 文件测试通过，反例资料不进入模型输入。 | - | - | - | - | - | - |
| VT-0029-02 | DR-0029-01 / DR-0029-02 | 已确认 | 集成测试通过 | 实际 CLI/配置/任务目录完成零模型测试，验证任务身份、依赖一致、报告媒体登记和当前 task_id 等待。 | 真实命令、退出码、测试统计和产物路径 | npm run test:m4a-cli-preflight 退出码0；真实 Playwright CLI 完成正常/反例夹具、结构化报告与三类媒体；Harness 0次。 | - | - | - | - | - | - |
| VT-0029-03 | DR-0029-02 / DR-0029-03 | 已确认 | 无法运行 | 真实Web初始建例（必要时一次定向修订）、正常与既定反例执行、媒体查看、重启读回及逐义务技术核查。 | 真实任务ID、候选哈希、原始报告、媒体索引、Web证据和调用记账 | 原任务 build-20260922014848-604af86d 首次模型请求 HTTP 404。用户新增授权后，flash任务 build-20260922022951-0e638858 生成候选 CA3819EF...B6914；正常1条通过、反例1条取得期望3条/实际6条，但步骤标题未使用精确CASE_STEP标记，整体候选验证失败；两组媒体和重启读回完成。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：独立 worktree codex/test-workbench-m4a-query-case 的 workbench 与 harness-probe 子工程。
- 命令：npm test（workbench）
- 命令：npm test（harness-probe）
- 命令：node tests/m4a-query-case-real.integration.mjs（仅前置全部通过后，最多一次初始和一次有依据修订）
- 环境：Windows 本机；Node.js 22；Playwright 1.62.1；专用 Git 忽略任务目录。

## 结论

- 工程验证通过；原 deepseek-v4-pro 调用 HTTP 404。新增独立 deepseek-flash 授权完成1次生成，候选业务断言正常通过且反例发生真实差异，但步骤精确标记契约不满足，未进入人工首审。

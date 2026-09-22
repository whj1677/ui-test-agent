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
| VT-0029-04 | DR-0029-03 / DR-0029-04 | 已确认 | 集成测试通过 | 零模型验证版本化步骤映射、失败归属、原文件完整性、派生记录和Web重启读回，并对已有候选完成逐义务只读核查。 | 单元夹具、真实Playwright CLI临时样例、原报告哈希、Web截图和登记前后哈希 | workbench 78/78、harness-probe 24/24；真实Playwright临时样例1条通过；project-case-step-title-v2正确映射原三步且反例错误归属CASE_STEP_3；原候选/两报告/task/授权哈希不变；S03未断言expected_records任务名称列，补充结论BUSINESS_REVIEW_GAPS。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：独立 worktree codex/test-workbench-m4a-query-case 的 workbench 与 harness-probe 子工程。
- 命令：npm test（workbench）
- 命令：npm test（harness-probe）
- 命令：node tests/m4a-query-case-real.integration.mjs（仅前置全部通过后，最多一次初始和一次有依据修订）
- 命令：node tests/step-title-compat-cli.integration.mjs（零模型临时Playwright样例）
- 命令：node tests/m4a-step-compat-offline.integration.mjs（只读原报告与Web读回，不执行业务候选）
- 环境：Windows 本机；Node.js 22；Playwright 1.62.1；专用 Git 忽略任务目录。

## 结论

- 工程验证通过；原 deepseek-v4-pro 调用 HTTP 404。新增独立 deepseek-flash 授权完成1次生成；旧精确标题失败保留。补充离线评估按v2规则映射三步并将反例错误归属S03，但发现S03未断言测试数据中的任务名称列，尚不可进入人工首审。

<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0029 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0029-01 | 已确认 | 以现有项目用例、build task 和验证链路支持 HOLD-Q1 显式环境，完整冻结并向模型传递正常业务输入。 | 生产组装出的 task.md、case-snapshot.json 与 attempt 输入逐项保留原字段，且不含反例入口、故障说明或 oracle。 | 不按 HOLD-Q1 结果常量改写通用判定器；反例资料只在控制器侧。 |
| DR-0029-02 | 已确认 | 有限启动真实 Harness，并以同一候选完成正常与既定反例的独立 Playwright 验证。 | 每次运行有独立报告、截图、录像与 Trace；候选哈希前后一致；零测试、加载失败和任意超时不计为指定缺陷检出。 | 初始最多1次；仅明确候选错误时允许1次修订；达限停止。 |
| DR-0029-03 | 已确认 | 项目Web展示候选、步骤映射、正常/反例原始结果与媒体，并完成原义务技术核查。 | S01-S03 每项要求分别核查覆盖与遗漏；最终状态最多为等待人工首审；重启后记录可读且不重放。 | AI技术核查不登记为真人首审，不手工修改 task.json 拼接结果。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

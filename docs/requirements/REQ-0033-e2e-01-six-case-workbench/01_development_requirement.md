<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0033 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0033-01 | 技术验证通过，等待人工核对 | 接通受限的工作台Harness任务、正常/配对试跑、项目运行查询及媒体回传，并保留历史数据和预算。 | 工程接口与作用域通过相关测试；三份真实Harness候选和六条实际运行、媒体及重启读回已核对；剩余人工候选核对不由系统代判。 | 不复制参考候选，不改业务预期，不用工程运行充当产品运行，不更改墨白视觉基线。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

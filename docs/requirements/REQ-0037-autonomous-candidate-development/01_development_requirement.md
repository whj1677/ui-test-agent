<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 | 反馈入上下文、失败可继续、取消/预算停止、改字节必须复测；A恢复与B从零通过生产路径，最终正常和指定故障独立验证。 | 工具不接受命令、URL或磁盘路径；执行器无模型密钥，故障答案不回传。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

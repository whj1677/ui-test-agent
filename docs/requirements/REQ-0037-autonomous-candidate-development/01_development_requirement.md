<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 | 反馈入上下文、失败可继续、取消/预算停止、改字节必须复测；A恢复与B从零通过生产路径，最终正常和指定故障独立验证。 | 冻结业务输入/预期/批准资产不变；原生文件工具限本任务开发目录；任意shell、外部依赖和越界入口关闭；执行器无模型密钥；非系统级强隔离。 |
| DR-0037-02 | 已实现 | 用例版本关联自主候选；经精确范围授权复用执行器进行独立技术试跑，保留旧记录；复用中文步骤与受控媒体路由。 | 跨项目/版本/哈希不符拒绝；完整helper快照、重复请求仅一次、取消；现场截图/原录像/步骤回放/Trace各run隔离；旧素材缺项明确。 | 不设置approved获得资格；仅已登记本机冻结站点按需新端口；0建例模型；不接受任意URL/命令。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

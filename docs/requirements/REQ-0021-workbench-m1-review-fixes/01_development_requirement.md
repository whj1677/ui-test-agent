<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0021 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0021-01 | 已确认 | 前端以明确状态保存环境选择，周期刷新不得重置，启动请求必须使用该状态；正常入口、活动运行禁用和历史查看保持。 | 选择fault后等待至少两次1秒轮询仍为fault，点击启动的请求参数与新运行记录环境均为fault。 | 不增加前端框架或静态伪运行数据。 |
| DR-0021-02 | 已确认 | 区分原始Playwright测试事实与整体有效通过，完整性失败、取消、中断、进程异常、报告异常均不得complete_pass=true。 | 正常通过保持true；INTEGRITY_FAILED等非正常终态在原报告passed时仍为false并保留playwright_status、测试状态和错误事实。 | 使用临时夹具或模拟报告，不篡改批准脚本。 |
| DR-0021-03 | 已确认 | errorFacts仅在同时取得明确期望值和实际值时分类为ASSERTION_MISMATCH；缺元素、严格匹配冲突和未取得实际值须保留可核对的技术类型或待分析事实。 | 补齐缺元素、严格匹配冲突、未取得实际值及H111/H106值比较反例；不把所有超时归为同一技术错误，不使用模型补判。 | 保留原消息、期望/实际字段和PENDING_ANALYSIS归因。 |
| DR-0021-04 | 已确认 | 整体complete_pass必须同时要求现有必需媒体截图、录像和Trace齐全；证据缺失不改变原始测试状态或错误事实。 | 全缺、缺截图、缺录像、缺Trace均为evidence_status=INCOMPLETE且complete_pass=false；三类齐全的正常绿色报告仍为true；原始失败与五种非正常终态仍为false。 | 仅复用现有MEDIA_TYPES和三类必需集合，不新增证据格式或信任机制。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。

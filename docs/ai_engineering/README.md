<!-- ai-engineering-context:start -->
# AI 工程上下文入口

项目：`ui-test-agent`

默认按影响轻量处理，见 08_ai_workflow.md。小任务只读相关代码、事实和测试；正式需求或交付才读取 requirements / FIX 及全套治理规则。

## 文档索引

| 文件 | 类型 | 用途 | 读取时机 |
|---|---|---|---|
| `00_project_brief.md` | 工程事实 | 项目概要、技术栈和目录概览 | 首次接触、只读咨询 |
| `01_architecture.md` | 工程事实 | 架构、模块边界和主要数据流 | 架构、接口、核心行为变更 |
| `02_rules.md` | 工程事实 | 工程规则和团队约定 | 代码修改前 |
| `03_interfaces.md` | 工程事实 | 接口、协议、配置和环境变量 | 接口、配置、数据结构变更 |
| `04_build_test.md` | 工程事实 | 构建、测试、启动和 CI 线索 | 实现、测试、验证前 |
| `05_decisions_log.md` | 工程事实 | 决策记录 | 重要方案变更 |
| `06_known_issues.md` | 工程事实 | 已知问题、风险和排障经验 | 排障、回归风险评估 |
| `07_code_model.md` | 工程事实 | 代码模型索引和模块文档规则 | 查找模块和调用链 |
| `08_ai_workflow.md` | AI 工作流入口 | 日常需求开发、验证证据和交付审查规则 | 影响代码、测试、配置、接口或验收标准的任务 |


## 按需入口

- 日常流程：08_ai_workflow.md。
- 局部修复默认只保留源码、测试与结果说明；仅在明确要求留档或确需后续追踪时更新 docs/changes/daily.md。
- 正式需求/交付：docs/requirements/README.md、当前 REQ；旧 FIX 保留正式兼容。
- 安装检查：python scripts/check_ai_context.py --installation-only，不能作为交付凭证。
<!-- ai-engineering-context:end -->

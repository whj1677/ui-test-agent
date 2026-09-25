<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 v4修复：浏览器管理的.playwright-mcp目录仅作只读观察证据，不进入执行文件清单且禁止模块导入；getElementById纳入既有只读DOM支持。 v5真实快照文件由锁定browser_snapshot的filename参数生成，仅允许受控单文件yml；恢复授权保留旧task_id/原稿哈希/运行器提交及实际正常页结果。 v6仅新增独立合成站、冻结正常用例、环境授权和生产入口验证驱动；产品源码/提示/政策不改，无新用例编号特判。 | 任务控制器负责权限范围、预算与证据，停止扩建helper/分支语义门禁；原要求的语义交由独立核对。 |
| DD-0037-02 | DR-0037-02 | 已确认 | BuildTaskManager新增候选试跑调度，复用WorkbenchStore新run与verifyWorkbenchCandidate/step observer/replay；任务本体只读。以project/case/version/content/task/candidate/bundle/environment及lane授权，run作为持久幂等请求回执；旧媒体以只读视图纠正类型与run归属。 | 无需重新建例或人工批准来试跑；业务结果与证据状态分开；沿用原用例详情和运行组件，不新建执行器。 |
| DD-0037-03 | DR-0037-03 | 已确认 | normal-only环境只独立运行正常入口；exploratory注册独立预算，不修改旧receipt；同一4322服务和fresh-b数据内通过UI新建独立项目导入24例。 | 去掉为正常页面虚构故障的要求，让Agent自行迭代但保留独立验收和终止边界。 |

## 接口与数据流

- 已登记项目/用例版本/环境授权→生产建例API→同一Harness会话→任务MCP工具→锁定Playwright执行快照→原始错误及步骤反馈→最终哈希冻结→正常/故障独立验证。
- 用例详情GET automation→已登记manifest与身份→POST candidate-trials（持久request_id）→完整包独立快照→现有verify与步骤现场采集→WorkbenchStore新run→项目执行记录/媒体GET；旧自主task不写回。

## 模块文档影响

- 更新docs/modules/test-workbench.md，build管理器/存储、工具桥、执行器复用、必要API与页面读回。
- v8：development-task支持显式normal-only，authorization新增exploratory新授权档；web-v2仅把自主状态与技术计数分层；运行入口和证据见workbench/qa/20260925-kimi-workbench/REPORT.md。

## 风险与回滚

- 权限守卫和静态候选限制并非强OS沙箱；无法判清业务差异时报告待分析，不无限修绿。默认停在等待人工核对。

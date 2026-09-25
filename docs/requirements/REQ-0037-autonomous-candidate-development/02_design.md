<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 v4修复：浏览器管理的.playwright-mcp目录仅作只读观察证据，不进入执行文件清单且禁止模块导入；getElementById纳入既有只读DOM支持。 v5真实快照文件由锁定browser_snapshot的filename参数生成，仅允许受控单文件yml；恢复授权保留旧task_id/原稿哈希/运行器提交及实际正常页结果。 | 任务控制器负责权限范围、预算与证据，停止扩建helper/分支语义门禁；原要求的语义交由独立核对。 |

## 接口与数据流

- 已登记项目/用例版本/环境授权→生产建例API→同一Harness会话→任务MCP工具→锁定Playwright执行快照→原始错误及步骤反馈→最终哈希冻结→正常/故障独立验证。

## 模块文档影响

- 更新docs/modules/test-workbench.md，build管理器/存储、工具桥、执行器复用、必要API与页面读回。

## 风险与回滚

- 权限守卫和静态候选限制并非强OS沙箱；无法判清业务差异时报告待分析，不无限修绿。默认停在等待人工核对。

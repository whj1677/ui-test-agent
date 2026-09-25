<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 任务管理器持有有界开发会话，锁定DSH经本机MCP调用read_draft/write_draft/self_test/read_evidence/submit_candidate；草稿多次写入，每次执行先保存不可变快照与哈希。 | 控制器只管范围、预算、状态、证据与提交条件，不代替模型诊断或修断言；独立最终验证在Harness结束后进行。 |

## 接口与数据流

- 已登记项目/用例版本/环境授权→生产建例API→同一Harness会话→任务MCP工具→锁定Playwright执行快照→原始错误及步骤反馈→最终哈希冻结→正常/故障独立验证。

## 模块文档影响

- 更新docs/modules/test-workbench.md，build管理器/存储、工具桥、执行器复用、必要API与页面读回。

## 风险与回滚

- 权限守卫和静态候选限制并非强OS沙箱；无法判清业务差异时报告待分析，不无限修绿。默认停在等待人工核对。

<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0024-01 | DR-0024-01 | 已确认 | 新增固定任务模板API和独立build task存储，不复用批准资产run语义。 | 避免把候选与批准资产混为一类。 |
| DD-0024-02 | DR-0024-02 / DR-0024-04 | 已确认 | 使用持久化阶段预算账本、单活动BuildManager及显式start/revise/stop路由；本次复验另用固定ID的单次初始授权账本，并只在Harness process_spawn时消耗。 | 刷新或新task ID不能重置模型预算，新增复验授权也不能挪用原阶段剩余修订额度。 |
| DD-0024-03 | DR-0024-02 / DR-0024-03 | 已确认 | workbench适配层复用harness-probe的进程、事件和验证原语，业务层只负责编排与记账。 | 不整体搬运一次性探针，也不修改Harness核心。 |
| DD-0024-04 | DR-0024-03 / DR-0024-04 | 已确认 | 工具证据、候选和测试报告分类登记；页面只显示登记摘要与候选代码，原始工具文件默认不公开。 | 保证可追溯且限制本地文件读取面。 |
| DD-0024-05 | DR-0024-02 / DR-0024-05 | 已确认 | attempt使用追加式脱敏生命周期记录；子进程区分exit/close并有界等待流收尾，重启将活动任务和RUNNING attempt收口为INTERRUPTED。 | 在不引入守护平台的情况下保留最后可观察事实，避免状态矛盾、静默异常和自动重放。 |

## 接口与数据流

- Web固定模板 -> POST build task冻结输入 -> 显式start -> BuildManager独立目录 -> Harness适配 -> 候选索引 -> Playwright正常/反例 -> 分离状态与人工核对。
- 验证失败 -> 用户显式revise一次 -> 新独立attempt工作区只复制任务、上一候选和实际错误 -> 新版本保留旧版本。

## 模块文档影响

- 新增workbench build API、页面、持久化和测试；更新workbench README并新增M2-C脱敏验收报告。
- 本次无需模块文档变更，原因：单次复验授权、按task_id等待和媒体登记只影响workbench独立子工程，其接口、运行与停止边界已由workbench/README.md、本REQ设计和新复验报告共同维护，不改变原产品src/public模块契约。

## 风险与回滚

- 无OS级文件/网络隔离仍是已接受残余风险，独立目录和路径校验不是沙箱。
- 真实模型产出可能验证失败；按预算保留结果并停止，不以刷新或新任务重试。
- 删除新增build模块和页面区块可回滚；M1批准执行链、M2历史资产不改。

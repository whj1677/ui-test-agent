<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 当前状态

- 需求标题：Coding Agent任务内自主自测与有界修订

## 元数据

- 需求状态：部分实现：任务内自主自测接通，A恢复验证完成，B候选语义及指定差异证据未通过
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-09-25

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0037-01 | 已确认 | 观察→草稿→实际自测→反馈→有限修复→冻结最终候选，普通脚本错误无需人工逐轮诊断。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 任务管理器持有有界开发会话，锁定DSH经本机MCP调用read_draft/write_draft/self_test/read_evidence/submit_candidate；草稿多次写入，每次执行先保存不可变快照与哈希。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0037-01 | DR-0037-01 / DD-0037-01 | 部分实现 | 实现有界任务MCP自测闭环，先工程回归再执行两条真实任务，保留首稿/修订/最终证据并推送。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json |

## 人工待确认项

- [ ] B第4步禁用义务弱化、步骤5无法提取实际读数；本批预算停止，不代写或重抽。
- [ ] 候选均未人工批准；工具反馈信息不足及语义覆盖仍需后续单独任务处理。

## 本轮禁止实现内容

- 不代写产品候选、不改预期、不读故障答案修正常脚本、不按新task_id重置预算、不自动批准。

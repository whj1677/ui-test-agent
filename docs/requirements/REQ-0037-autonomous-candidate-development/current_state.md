<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 当前状态

- 需求标题：Coding Agent任务内自主自测与有界修订

## 元数据

- 需求状态：开发能力调整工程验证完成；业务语义保留独立核对，无自动批准
- 治理分级：G2
- 当前版本：3
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
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0037-01 | DR-0037-01 / DD-0037-01 | 部分实现 | 实现有界任务MCP自测闭环，先工程回归再执行两条真实任务，保留首稿/修订/最终证据并推送。 |
| TK-0037-02 | DR-0037-01 / DD-0037-01 | 部分实现 | 保留B质量修订历史；按方向修正放开受控开发能力、绑定完整文件束并完成零模型工程验证。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 集成测试通过 | 受控开发能力、完整文件束及B历史证据核对 | capabilities-workbench.log 127/127，capabilities-harness.log 24/24，capabilities-preflight.log零模型原生文件读写编辑；B真实验证绑定d04dee0，非新能力模型成绩。 |

## 人工待确认项

- [ ] 旧B语义缺陷保留历史；新B候选仅技术验证完成，未人工批准。
- [ ] 新开发能力只经零模型工程验证，未新增模型正确率证据。
- [ ] 任意命令/JS调试、系统强隔离、通用语义证明仍不提供。

## 本轮禁止实现内容

- 不代写产品候选、不改预期、不读故障答案修正常脚本、不按新task_id重置预算、不自动批准。

<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 当前状态

- 需求标题：Coding Agent任务内自主自测与有界修订

## 元数据

- 需求状态：24条真实自主建例流程已执行；18独立技术通过、6失败保留；原要求核查分层，候选未批准
- 治理分级：G2
- 当前版本：8
- 最后更新：2026-09-25

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0037-01 | 已确认 | 观察→草稿→实际自测→反馈→有限修复→冻结最终候选，普通脚本错误无需人工逐轮诊断。 |
| UN-0037-02 | 已确认 | 从用例详情查看已有自主候选并显式零模型试跑，新运行中文步骤与媒体可用。 |
| UN-0037-03 | 已确认 | 将24条Kimi用例导入工作台，由真实Coding Agent逐条自主建例执行；前台展示任务完成情况，Harness自主决定交付时机。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 |
| DR-0037-02 | 已实现 | 用例版本关联自主候选；经精确范围授权复用执行器进行独立技术试跑，保留旧记录；复用中文步骤与受控媒体路由。 |
| DR-0037-03 | 已实现 | 显式仅正常入口验收和探索额度；自主任务状态展示 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 v4修复：浏览器管理的.playwright-mcp目录仅作只读观察证据，不进入执行文件清单且禁止模块导入；getElementById纳入既有只读DOM支持。 v5真实快照文件由锁定browser_snapshot的filename参数生成，仅允许受控单文件yml；恢复授权保留旧task_id/原稿哈希/运行器提交及实际正常页结果。 v6仅新增独立合成站、冻结正常用例、环境授权和生产入口验证驱动；产品源码/提示/政策不改，无新用例编号特判。 |
| DD-0037-02 | DR-0037-02 | 已确认 | BuildTaskManager新增候选试跑调度，复用WorkbenchStore新run与verifyWorkbenchCandidate/step observer/replay；任务本体只读。以project/case/version/content/task/candidate/bundle/environment及lane授权，run作为持久幂等请求回执；旧媒体以只读视图纠正类型与run归属。 |
| DD-0037-03 | DR-0037-03 | 已确认 | normal-only环境只独立运行正常入口；exploratory注册独立预算，不修改旧receipt；同一4322服务和fresh-b数据内通过UI新建独立项目导入24例。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0037-01 | DR-0037-01 / DD-0037-01 | 部分实现 | 实现有界任务MCP自测闭环，先工程回归再执行两条真实任务，保留首稿/修订/最终证据并推送。 |
| TK-0037-02 | DR-0037-01 / DD-0037-01 | 部分实现 | 保留B质量修订历史；按方向修正放开受控开发能力、绑定完整文件束并完成零模型工程验证。 |
| TK-0037-03 | DR-0037-02 / DD-0037-02 | 已完成 | 接入候选查看/显式试跑与媒体；原FRESH-B实际正常/故障、浏览器播放拖动下载、刷新重启核查及零模型配置指南。 |
| TK-0037-04 | DR-0037-03 / DD-0037-03 | 已实现 | 完成正常入口模式、探索档、状态展示、24条保真UI导入及真实自主建例；逐条独立核查和证据收口，业务失败保留 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 集成测试通过 | 真实工具链贯通、原稿单次工程执行和真实恢复独立验收 | b-recovery/manifest.json与engineering-tool-chain.json、original/report.json；真实3开发+3最终，额外原稿1次共7业务执行。工程工作台127/127、Harness24/24；候选等待人工核对。 |
| VT-0037-04 | DR-0037-01 | 人工待确认 | 固定产品条件下两条陌生流程从零生成及独立故障验证 | 命令：node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-unfamiliar/manifest.json |
| VT-0037-05 | DR-0037-02 | 集成测试通过 | 已有候选完整包与用例身份、幂等/取消/媒体工程验证及原数据真实浏览器试跑 | 命令：node workbench/scripts/accept-candidate-trial.mjs --execute；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-candidate-trial/manifest.json |
| VT-0037-06 | DR-0037-03 | 人工待确认 | 工作台138项工程及真实DSH零模型链路；24真实任务已结束，18独立执行通过/6失败保留，语义核查14完整/其余分层，候选未批准 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：138；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-kimi-workbench/engineering.log |

## 人工待确认项

- [ ] 当前有限DOM读取仍拒绝forEach/push、JSON.stringify等合理表达式；站点脚本读取尝试也被拒，未扩展白名单。
- [ ] 原稿已通过后Agent自行改稿引入失败，不能把所有修改称为必要修复；有限核查只是提示，不是语义证明。
- [ ] 状态等待未单独验证严格450/650毫秒期限；本次不等于通用稳定性或候选人工批准。

## 本轮禁止实现内容

- 不代写产品候选、不改预期、不读故障答案修正常脚本、不按新task_id重置预算、不自动批准。

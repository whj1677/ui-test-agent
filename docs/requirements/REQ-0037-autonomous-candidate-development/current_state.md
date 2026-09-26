<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 当前状态

- 需求标题：Coding Agent任务内自主自测与有界修订

## 元数据

- 需求状态：v10第二轮独立真实UI与一次从头建例已验；取消展示问题已修复并同路径复测，候选未批准，验收限本轮范围
- 治理分级：G2
- 当前版本：10
- 最后更新：2026-09-25

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0037-01 | 已确认 | 观察→草稿→实际自测→反馈→有限修复→冻结最终候选，普通脚本错误无需人工逐轮诊断。 |
| UN-0037-02 | 已确认 | 从用例详情查看已有自主候选并显式零模型试跑，新运行中文步骤与媒体可用。 |
| UN-0037-03 | 已确认 | 将24条Kimi用例导入工作台，由真实Coding Agent逐条自主建例执行；前台展示任务完成情况，Harness自主决定交付时机。 |
| UN-0037-04 | 已确认 | 主管分派及独立验收，在预算内完成诊断D01-D10涉及的现有功能修复。 |
| UN-0037-05 | 已确认 | 新增独立子Agent真实浏览器测试，由主管第三方验收，发现问题后定向修复复测。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 |
| DR-0037-02 | 已实现 | 用例版本关联自主候选；经精确范围授权复用执行器进行独立技术试跑，保留旧记录；复用中文步骤与受控媒体路由。 |
| DR-0037-03 | 已实现 | 显式仅正常入口验收和探索额度；自主任务状态展示 |
| DR-0037-04 | 已确认 | 开发保真、恢复完整种子及反馈/失败分层 |
| DR-0037-05 | 已确认 | 运行收口、存储故障、取消互斥和认证并发 |
| DR-0037-06 | 已确认 | 唯一入口、测试命令和服务构建身份 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 v4修复：浏览器管理的.playwright-mcp目录仅作只读观察证据，不进入执行文件清单且禁止模块导入；getElementById纳入既有只读DOM支持。 v5真实快照文件由锁定browser_snapshot的filename参数生成，仅允许受控单文件yml；恢复授权保留旧task_id/原稿哈希/运行器提交及实际正常页结果。 v6仅新增独立合成站、冻结正常用例、环境授权和生产入口验证驱动；产品源码/提示/政策不改，无新用例编号特判。 |
| DD-0037-02 | DR-0037-02 | 已确认 | BuildTaskManager新增候选试跑调度，复用WorkbenchStore新run与verifyWorkbenchCandidate/step observer/replay；任务本体只读。以project/case/version/content/task/candidate/bundle/environment及lane授权，run作为持久幂等请求回执；旧媒体以只读视图纠正类型与run归属。 |
| DD-0037-03 | DR-0037-03 | 已确认 | normal-only环境只独立运行正常入口；exploratory注册独立预算，不修改旧receipt；同一4322服务和fresh-b数据内通过UI新建独立项目导入24例。 |
| DD-0037-04 | DR-0037-04 | 已确认 | 原稿与helper首次自测前受完整包校验；提交自动记录有限审查而非自动审批；失败分类及可执行业务差异一次独立复核；耗尽反馈与重复尝试有界 |
| DD-0037-05 | DR-0037-05 | 已确认 | 终态不可倒退；后台错误锁存并拒绝新任务；准备/执行/收口互斥；关闭先拒接；同scope登录浏览器无泄漏 |
| DD-0037-06 | DR-0037-06 | 已确认 | 默认工程测试不另起工作台/模型；正式功能仅4322；每次新run/task绑定已加载源码及脱敏配置身份；有限真实UI旅程及报告 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0037-01 | DR-0037-01 / DD-0037-01 | 部分实现 | 实现有界任务MCP自测闭环，先工程回归再执行两条真实任务，保留首稿/修订/最终证据并推送。 |
| TK-0037-02 | DR-0037-01 / DD-0037-01 | 部分实现 | 保留B质量修订历史；按方向修正放开受控开发能力、绑定完整文件束并完成零模型工程验证。 |
| TK-0037-03 | DR-0037-02 / DD-0037-02 | 已完成 | 接入候选查看/显式试跑与媒体；原FRESH-B实际正常/故障、浏览器播放拖动下载、刷新重启核查及零模型配置指南。 |
| TK-0037-04 | DR-0037-03 / DD-0037-03 | 已实现 | 完成正常入口模式、探索档、状态展示、24条保真UI导入及真实自主建例；逐条独立核查和证据收口，业务失败保留 |
| TK-0037-05 | DR-0037-04 / DD-0037-04 | 已实现 | 开发保真、恢复完整种子及反馈/失败分层；职责：repair_development |
| TK-0037-06 | DR-0037-05 / DD-0037-05 | 已实现 | 运行收口、存储故障、取消互斥和认证并发；职责：repair_runtime / repair_auth_tests / supervisor |
| TK-0037-07 | DR-0037-06 / DD-0037-06 | 已实现 | 唯一入口、测试命令和服务构建身份；职责：repair_auth_tests / supervisor |
| TK-0037-08 | DR-0037-06 / DD-0037-06 | 已实现 | 第二轮独立真实浏览器验收及取消状态展示定向修复；执行者browser_acceptance_round2，主管独立复核。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 集成测试通过 | 真实工具链贯通、原稿单次工程执行和真实恢复独立验收 | b-recovery/manifest.json与engineering-tool-chain.json、original/report.json；真实3开发+3最终，额外原稿1次共7业务执行。工程工作台127/127、Harness24/24；候选等待人工核对。 |
| VT-0037-04 | DR-0037-01 | 人工待确认 | 固定产品条件下两条陌生流程从零生成及独立故障验证 | 命令：node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-unfamiliar/manifest.json |
| VT-0037-05 | DR-0037-02 | 集成测试通过 | 已有候选完整包与用例身份、幂等/取消/媒体工程验证及原数据真实浏览器试跑 | 命令：node workbench/scripts/accept-candidate-trial.mjs --execute；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-candidate-trial/manifest.json |
| VT-0037-06 | DR-0037-03 | 人工待确认 | 工作台138项工程及真实DSH零模型链路；24真实任务已结束，18独立执行通过/6失败保留，语义核查14完整/其余分层，候选未批准 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：138；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-kimi-workbench/engineering.log |
| VT-0037-07 | DR-0037-04 | 集成测试通过 | 原稿与helper首次自测前受完整包校验；提交自动记录有限审查而非自动审批；失败分类及可执行业务差异一次独立复核；耗尽反馈与重复尝试有界 | 命令：node workbench/qa/20260925-reliability/verify-model-results.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/model-results.json |
| VT-0037-08 | DR-0037-05 | 集成测试通过 | 终态不可倒退；后台错误锁存并拒绝新任务；准备/执行/收口互斥；关闭先拒接；同scope登录浏览器无泄漏 | 命令：node workbench/qa/20260925-reliability/verify-active-cancel.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/active-cancel.json |
| VT-0037-09 | DR-0037-06 | 集成测试通过 | 默认工程测试不另起工作台/模型；正式功能仅4322；每次新run/task绑定已加载源码及脱敏配置身份；有限真实UI旅程及报告 | 命令：npm run test:official；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/official-readiness-final.json |
| VT-0037-10 | DR-0037-06 | 集成测试通过 | 独立真实UI旅程、一次有界从头建例、主管语义核对与取消展示复验 | 命令：node workbench/qa/20260925-independent-ui/verify-round2.mjs batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9 batch-c5bfa41e-131e-444e-b4ff-c13aa4f62411 batch-036f6471-e080-41be-a066-be03a8a7c5a2 report-52201e00c26f334a826ef5129d7f7e2214657f2c build-20260925142505-0fc7ce0d；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-independent-ui/supervisor/verification.log |

## 人工待确认项

- [ ] 当前有限DOM读取仍拒绝forEach/push、JSON.stringify等合理表达式；站点脚本读取尝试也被拒，未扩展白名单。
- [ ] 原稿已通过后Agent自行改稿引入失败，不能把所有修改称为必要修复；有限核查只是提示，不是语义证明。
- [ ] 状态等待未单独验证严格450/650毫秒期限；本次不等于通用稳定性或候选人工批准。

## 本轮禁止实现内容

- 不代写产品候选、不改预期、不读故障答案修正常脚本、不按新task_id重置预算、不自动批准。

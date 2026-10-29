<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 当前状态

- 需求标题：Coding Agent任务内自主自测与有界修订

## 元数据

- 需求状态：v16原生悬浮控制条正式加载；CASE-02真人示范经恢复DSH自测、审查、独立复验及正式技术试跑，候选待人工批准；首轮传输失败保留
- 治理分级：G2
- 当前版本：16
- 最后更新：2026-09-29

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0037-01 | 已确认 | 观察→草稿→实际自测→反馈→有限修复→冻结最终候选，普通脚本错误无需人工逐轮诊断。 |
| UN-0037-02 | 已确认 | 从用例详情查看已有自主候选并显式零模型试跑，新运行中文步骤与媒体可用。 |
| UN-0037-03 | 已确认 | 将24条Kimi用例导入工作台，由真实Coding Agent逐条自主建例执行；前台展示任务完成情况，Harness自主决定交付时机。 |
| UN-0037-04 | 已确认 | 主管分派及独立验收，在预算内完成诊断D01-D10涉及的现有功能修复。 |
| UN-0037-05 | 已确认 | 新增独立子Agent真实浏览器测试，由主管第三方验收，发现问题后定向修复复测。 |
| UN-0037-06 | 已确认 | 提高用例脚本质量，补齐编写、自测、独立覆盖/预期审查、修复、再测及独立复验反馈闭环。 |
| UN-0037-07 | 已确认 | 在仅使用DeepSeek产品接入的前提下，对比无工具审查和独立DSH受控工具审查的脚本质量、人工介入与消耗。 |
| UN-0037-08 | 已确认 | 完善现有自动故障反馈、带证据定向修订和独立复验，人工反馈为补充。 |
| UN-0037-09 | 已确认 | 人工在特定浏览器演示操作，帮助DSH编写与修复自动化脚本，明确原断言，真实验收后整理无用代码。 |
| UN-0037-10 | 已确认 | 支持人工登录后录制、独立控制窗和一步多个断言检查对象，复用登录态生成和测试。 |
| UN-0037-11 | 已确认 | 在业务浏览器前保持可拖动、可收起的置顶控制条，减少切窗和逐步指导，核对对象能辨认。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0037-01 | 部分实现 | 复用现有BuildTaskManager、BuildTaskStore和verifyWorkbenchCandidate，提供绑定任务的自测工具、预算与哈希证据；Agent自主分析错误。 |
| DR-0037-02 | 已实现 | 用例版本关联自主候选；经精确范围授权复用执行器进行独立技术试跑，保留旧记录；复用中文步骤与受控媒体路由。 |
| DR-0037-03 | 已实现 | 显式仅正常入口验收和探索额度；自主任务状态展示 |
| DR-0037-04 | 已确认 | 开发保真、恢复完整种子及反馈/失败分层 |
| DR-0037-05 | 已确认 | 运行收口、存储故障、取消互斥和认证并发 |
| DR-0037-06 | 已确认 | 唯一入口、测试命令和服务构建身份 |
| DR-0037-07 | 已实现 | 绑定精确候选与原用例的独立质量审查、共享预算的修复反馈及提交前独立复验。 |
| DR-0037-08 | 已实现 | 显式实验审查模式、独立DSH只读审查工具、共享资源预算及可追溯成对比较。 |
| DR-0037-09 | 已实现并完成限定验证 | 服务端冻结运行反馈证据，前后端自测返回结构化诊断；界面按失败来源展示修订或恢复建议。 |
| DR-0037-10 | 已实现；真人示范经恢复DSH自测、审查、独立复验和正式技术试跑，候选待人工批准 | 专用浏览器人工示范录制、步骤与原断言核对、冻结示范接入DSH生成修订并保留原验证链。 |
| DR-0037-11 | 已实现；正式登录恢复已复验，过期与换账号真人验收待验 | 认证示范与会话复用 |
| DR-0037-12 | 已实现；正式窗口交互有限验证 | 独立录制控制窗 |
| DR-0037-13 | 已实现；真人多目标示范已确认 | 多目标断言点选与框选 |
| DR-0037-14 | 工程已实现并正式加载；置顶/拖动/收起及直接框选取消后暂停获用户有限实操确认；CASE-02 DSH技术验证通过，候选未批准 | 原生置顶控制条及可辨认的核对对象 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0037-01 | DR-0037-01 | 已确认 | 复用原生read/read_image/write/edit，self_test与预置node --check由受控入口执行；DOM只读表达式、catch诊断、截图、本地ESM helper可用；提交冻结完整文件清单及哈希；语义诊断为可选，不自动证明或批准。 v4修复：浏览器管理的.playwright-mcp目录仅作只读观察证据，不进入执行文件清单且禁止模块导入；getElementById纳入既有只读DOM支持。 v5真实快照文件由锁定browser_snapshot的filename参数生成，仅允许受控单文件yml；恢复授权保留旧task_id/原稿哈希/运行器提交及实际正常页结果。 v6仅新增独立合成站、冻结正常用例、环境授权和生产入口验证驱动；产品源码/提示/政策不改，无新用例编号特判。 |
| DD-0037-02 | DR-0037-02 | 已确认 | BuildTaskManager新增候选试跑调度，复用WorkbenchStore新run与verifyWorkbenchCandidate/step observer/replay；任务本体只读。以project/case/version/content/task/candidate/bundle/environment及lane授权，run作为持久幂等请求回执；旧媒体以只读视图纠正类型与run归属。 |
| DD-0037-03 | DR-0037-03 | 已确认 | normal-only环境只独立运行正常入口；exploratory注册独立预算，不修改旧receipt；同一4322服务和fresh-b数据内通过UI新建独立项目导入24例。 |
| DD-0037-04 | DR-0037-04 | 已确认 | 原稿与helper首次自测前受完整包校验；提交自动记录有限审查而非自动审批；失败分类及可执行业务差异一次独立复核；耗尽反馈与重复尝试有界 |
| DD-0037-05 | DR-0037-05 | 已确认 | 终态不可倒退；后台错误锁存并拒绝新任务；准备/执行/收口互斥；关闭先拒接；同scope登录浏览器无泄漏 |
| DD-0037-06 | DR-0037-06 | 已确认 | 默认工程测试不另起工作台/模型；正式功能仅4322；每次新run/task绑定已加载源码及脱敏配置身份；有限真实UI旅程及报告 |
| DD-0037-07 | DR-0037-07 | 已确认 | 共享无工具独立DeepSeek审查器读取原用例、完整候选及可信证据，不接受作者coverage自证；校验结构、原文引用与位置，NO_FINDINGS/REPAIR_REQUIRED/NEEDS_ANALYSIS均非批准。submit冻结前把缺口送回同一DSH；正常单入口UI/后端独立复验亦位于可编辑期。记录每次调用与哈希、同输入缓存、预算预占；修改后重测重审。 |
| DD-0037-08 | DR-0037-08 | 已确认 | A为现有fresh-context无工具DeepSeek审查；B为工具白名单约束的独立DSH，读取冻结数据并经原执行器申请同稿复验，输出仍经原schema/引用/位置校验。显式选择随准备、确认和任务身份冻结，缺省A。通过同步审查及统一MCP等待上限接入，总任务截止不延长。 |
| DD-0037-09 | DR-0037-09 | 已确认 | 共享failure-feedback投影现有受信执行记录，保守分类并保留逐步预期/实际；UI和后端分别保存由服务端生成的revision_evidence快照。既有同会话自测与独立复验继续生效，现有列表和反馈表单展示证据而不新增页面体系。 |
| DD-0037-10 | DR-0037-10 | 已确认实施边界 | 独立有界示范会话、受控浏览器与不可变人工核对快照，仅以不可信动作定位提示进入既有Coding Agent输入。沿用原业务断言、授权、资源、自测及独立验证。 |
| DD-0037-11 | DR-0037-11 | 已确认实施边界 | 已有环境目录解析为稳定公开配置摘要，验证角色和账号摘要；登录态仅内存，失效停录，再登录显式恢复。 |
| DD-0037-12 | DR-0037-12 | 已确认实施边界 | 正式4322同源小窗口，显式打开，开始/暂停/选步/选断言/停止；主窗口保持所有权，弹窗关闭尽力暂停并轮询补偿。 |
| DD-0037-13 | DR-0037-13 | 已确认实施边界 | 同一步多个DOM定位提示，框选1至20个候选原子接收；过大/画布/跨框架范围提示重选；逐项核对可剔除，旧单目标快照仍可读。 |
| DD-0037-14 | DR-0037-14 | 已确认实施边界 | 独立C# WinForms原生TopMost控制条，由工作台用系统.NET编译器构建并管理自己的子进程；固定本地HTTP仅当前示范，前端显式打开，保留网页备用。 |

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
| TK-0037-09 | DR-0037-07 / DD-0037-07 | 已实现并完成限定验证 | 共享质量审查+UI/后端同会话反馈+预算及状态展示；工程反例与唯一4322真实验收，由主管独立收口。 |
| TK-0037-10 | DR-0037-08 / DD-0037-08 | 已实现并完成限定比较 | 实现实验审查器和UI/后端选择接线；冻结四对输入，在原4322运行并独立比较，不中途调参。 |
| TK-0037-11 | DR-0037-09 / DD-0037-09 | 已实现并完成限定验证 | UI与后端服务端运行绑定、共享失败反馈和DSH上下文接线 |
| TK-0037-12 | DR-0037-09 / DD-0037-09 | 已实现并完成限定验证 | 原执行列表与反馈表单的证据展示、分组和恢复建议 |
| TK-0037-13 | DR-0037-09 / DD-0037-09 | 限定验收已执行；运行级环境阻塞未验证 | 定向回归、原4322真实修订/复跑/环境分支验收及主管独立核对 |
| TK-0037-14 | DR-0037-10 / DD-0037-10 | 已实现；19事件真人示范经恢复DSH自测、审查、独立复验及正式技术试跑，候选待人工批准；首轮传输失败保留 | 人工示范录制内核、工作台入口、冻结输入集成与有限真实验收，末尾清理本轮无消费者代码。 |
| TK-0037-15 | DR-0037-11 / DD-0037-11 | 已实现，正式登录恢复至VALID/PAUSED；过期、换号和后续DSH认证链待验 | 认证示范与会话复用及必要反例、正式入口验证 |
| TK-0037-16 | DR-0037-12 / DD-0037-12 | 已实现，工程与部分正式界面已复验；真人整链路待验 | 独立录制控制窗及必要反例、正式入口验证 |
| TK-0037-17 | DR-0037-13 / DD-0037-13 | 已实现；19事件真人多目标示范经主管核对，恢复DSH独立复验及正式技术试跑已执行，候选未批准 | 多目标断言点选与框选及必要反例、正式入口验证 |
| TK-0037-18 | DR-0037-14 / DD-0037-14 | 工程已实现并正式加载；用户确认可见/拖动/收起/切回仍置顶及直接框选取消后暂停；CASE-02技术试跑已执行 | 原生控制条、进程生命周期和入口接线，集中核对对象可读；定向工程及正式验证 |

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
| VT-0037-11 | DR-0037-07 | 单元测试通过 | 质量审查来源/身份与预算反例 | 命令：npm test；退出码：0；测试数量：374；失败数量：0；跳过数量：0；证据：workbench/qa/20260928-script-quality/unit-release-check.log |
| VT-0037-12 | DR-0037-07 | 集成测试通过 | 同会话修复与真实缺陷保留 | 原4322：后端分页P9同一Harness内2自测、审查REPAIR_REQUIRED→NO_FINDINGS及1次独立复验（三步均成功、2HTTP）；UI/后端搜索保持真实业务断言失败与后步未执行。早期P6/P7漏报及P8格式错误均原样保留、未确认。详见workbench/qa/20260928-script-quality/acceptance.md与session-summary.json。 |
| VT-0037-13 | DR-0037-07 | 集成测试通过 | 正式4322有限真实验收 | 7次真实DSH会话、120工具、12自测、12付费质量审查、6独立复验；四种UI/后端正常与故障场景通过原4322页面发起。主管读取完整最终候选/计划、原要求、失败实值和媒体；4条原用例/SUT/环境保持。新候选不自动批准；合成样本不代表客户或发布验收。见workbench/qa/20260928-script-quality/acceptance.md。 |
| VT-0037-14 | DR-0037-08 | 单元测试通过 | 实验模式、独立审查工具和总预算工程验证 | 命令：npm test；退出码：0；测试数量：385；失败数量：0；跳过数量：0；证据：workbench/qa/20260928-reviewer-ab/engineering.log |
| VT-0037-15 | DR-0037-08 | 人工待确认 | 原4322四对自主运行及主管独立比较 | 8次真实工作流已执行，主管独立比较完成；A/B各3/4最终稿通过原用例义务核对且有同稿独立证据，包含正确保留的业务失败，不是业务通过率。A UI搜索作者错误终止和B后端搜索错误改稿均保留。所有候选未自动批准；人工待确认指候选批准边界，不表示本轮比较未执行。证据：workbench/qa/20260928-reviewer-ab/acceptance.md、adjudication.json、result-summary.json及raw目录。 |
| VT-0037-16 | DR-0037-09 | 单元测试通过 | 服务端身份反例与反馈保真工程验证 | 命令：node --test workbench/tests/failure-feedback.test.mjs workbench/tests/backend-feedback.test.mjs workbench/tests/feedback-view.test.mjs workbench/tests/execution-list.test.mjs workbench/tests/backend-view.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/development-session.test.mjs workbench/tests/candidate-quality-review.test.mjs；退出码：0；测试数量：77；失败数量：0；跳过数量：0；证据：workbench/qa/20260928-feedback-loop/engineering-final.log |
| VT-0037-17 | DR-0037-09 | 人工待确认 | 原4322前后端反馈界面及版本绑定 | 正式4322真实浏览器UI/后端原失败反馈及取消；UI预检携带run和完整包身份，后端表单POST正确但拦截未提交。另经正式API新建带原run证据的唯一DRAFT、持久哈希重算一致；错配请求422拒绝。见workbench/qa/20260928-feedback-loop/ui-acceptance*.json、bound-draft-result.json、rejected-mismatch-result.json。未批准或执行新DRAFT。 |
| VT-0037-18 | DR-0037-09 | 人工待确认 | 真实修订及三类失败有限验收 | 一次真实DSH plan-d6693ec6-a38d-4d27-92a3-30d87ce94c66，1启动/9工具/1自测/1审查/1独立复验，91.075秒。人工给定断言跨步诊断，新稿归回第一步并保留第二步原义务；同SHA自测/复验第一步FAILED、第二步NOT_RUN。原用例、旧稿和SUT未改，新稿DRAFT未批准。源稿无正式run，因此此会话不带run_id，与正式run绑定持久化分别验收。环境仅实际不可达目标预检422，非运行级环境分类E2E。主管核对见workbench/qa/20260928-feedback-loop/adjudication.json、REPORT.md。最终补身份元数据的源码5bf4426仅工程与正式服务重启核验，没有重开模型。 |
| VT-0037-19 | DR-0037-10 | 集成测试通过 | 人工示范辅助自动化有限验收 | 命令：node --test workbench/tests/demonstrations.test.mjs workbench/tests/demonstration-generation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：16；失败数量：0；跳过数量：0；证据：workbench/qa/20260928-human-demonstration/supervisor-final-core-regression.log |
| VT-0037-20 | DR-0037-11 | 人工待确认 | 认证示范与会话复用 | 命令：node --test workbench/tests/demonstrations.test.mjs workbench/tests/demonstration-auth.test.mjs workbench/tests/demonstration-generation.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/project-target-access.test.mjs；退出码：0；测试数量：41；失败数量：0；跳过数量：0；证据：workbench/qa/20260929-demonstration-controls/supervisor-core-auth.log |
| VT-0037-21 | DR-0037-12 | 人工待确认 | 独立录制控制窗 | 命令：node --test workbench/tests/demonstrations.test.mjs workbench/tests/demonstration-view.test.mjs；退出码：0；测试数量：18；失败数量：0；跳过数量：0；证据：workbench/qa/20260929-demonstration-controls/supervisor-legacy-regression.log |
| VT-0037-22 | DR-0037-13 | 集成测试通过 | 多目标断言点选与框选 | 命令：node --test workbench/tests/demonstration-browser.test.mjs workbench/tests/demonstration-selection.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：13；失败数量：0；跳过数量：0；证据：workbench/qa/20260929-demonstration-controls/supervisor-browser-router.log |
| VT-0037-23 | DR-0037-14 | 集成测试通过 | 原生悬浮控制条完整任务流 | 命令：node --test workbench/tests/demonstration-floating-native.test.mjs workbench/tests/demonstration-view.test.mjs；退出码：0；测试数量：10；失败数量：0；跳过数量：0；证据：workbench/qa/20260929-demonstration-controls/supervisor-assertion-entry.log |

## 人工待确认项

- [ ] 当前有限DOM读取仍拒绝forEach/push、JSON.stringify等合理表达式；站点脚本读取尝试也被拒，未扩展白名单。
- [ ] 原稿已通过后Agent自行改稿引入失败，不能把所有修改称为必要修复；有限核查只是提示，不是语义证明。
- [ ] 状态等待未单独验证严格450/650毫秒期限；本次不等于通用稳定性或候选人工批准。
- [ ] v11模型第二意见仍会误漏报或过度推断原文；程序断言清单有助检出集合漏检但不是语义证明。干净Windows、客户真实协议及通用复杂场景未由本轮新增验证，便携包仍是此前版本。
- [ ] v12限定比较：B没有提高本批最终稿可核对数量；UI搜索的新增多页分支未动态验证。后端B出现断言跨步移动及中间审查漏检；UI A错误终止根因未定位且generation_status残留RUNNING。保留A默认，按需B路由和人工反馈页面为后续事项。
- [ ] v13边界：环境不可达仅正式目标登记预检422，当前无环境阻塞正式运行样本，运行列表分组只有工程验证。单例定向修订含主管诊断，不能推断普遍通过率或完全自主诊断收益。最后身份元数据小修未追加真实模型会话。
- [ ] v14当前阻塞：两次专用Edge的Windows控制均无法可信识别URL而停止，2份空草稿已STOPPED/0事件/未确认。正式界面空草稿禁用、互斥、托管重启及工程反例已验证，非空真人录制→冻结确认→真实DSH→正式批次仍未验。等待真人按USER-GUIDE示范或受支持控制恢复；不绕过限制，不伪造录制，不将云平台6条独立批次结果替代此链路。

## 本轮禁止实现内容

- 不代写产品候选、不改预期、不读故障答案修正常脚本、不按新task_id重置预算、不自动批准。

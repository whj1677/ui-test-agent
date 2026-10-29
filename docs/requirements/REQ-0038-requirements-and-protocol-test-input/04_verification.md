<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0038 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0038-01 | DR-0038-01 | 已确认 | 人工待确认 | 输入、完整性与范围 | 只有PRD、只有MRD、两份互补/重复/冲突、有图/无图、DOCX正文/表格/部分读取；未读区域形成覆盖缺口，不能标来源完整；可选ZIP增强单独安排，不占首批主链。 | 补齐轮正式4322：真实DOCX六单元格及位置/hash读取，含SDT/altChunk明确PARTIAL、越界ZIP拒绝，伪造quote与segment拒绝，图片双同意任一缺失拒绝且0模型。JPEG真实视觉输入及五观察独立看图核对。Word内嵌图和所有跨运行时组合未验证。见completion/acceptance-inputs.md、review-vision-B.md。 本轮正文JPEG内嵌图已完成有限正式API/真实浏览器/1次真实模型验证，PNG仅域测试；外链/页眉页脚保持未分析。候选有无依据提前校验预期，保留待审未确认。详见workbench/qa/20260926-docx-embedded/README.md。 v22扩展：Markdown互补/冲突两场景及新普通DOCX同义正文+协议已正式上传READ，9次真实模型记录。原Python生成DOCX因Node字节不同在上传前拦截，新Node合成文件不代表原保护文档兼容已修复。见case-design/REPORT.md、inputs-node-docx.json。 | - | - | - | - | - | - |
| VT-0038-02 | DR-0038-02 | 已确认 | 人工待确认 | 不补造用例真值 | PRD/MRD同源产生两组用例，各自目标可追溯；不复制换标签；协议缺失不冒充业务缺失，有协议但缺预期仍待确认；无图不补页面规则。 | 命令：node --test tests/model-transport.test.mjs tests/diagnostic-profile.test.mjs workbench/tests/requirements-documents.test.mjs workbench/tests/requirements-domain.test.mjs workbench/tests/requirements-export.test.mjs workbench/tests/requirements-integration.test.mjs workbench/tests/requirements-model.test.mjs workbench/tests/requirements-design-quality.test.mjs workbench/tests/requirements-view.test.mjs workbench/tests/requirements-images.test.mjs workbench/tests/requirements-embedded-images.test.mjs workbench/tests/requirements-quality.test.mjs workbench/tests/requirements-quality-workflow.test.mjs；退出码：0；测试数量：103；失败数量：0；跳过数量：0；证据：workbench/qa/20260928-case-quality-gate/engineering-final-code.log | node --test tests/model-transport.test.mjs tests/diagnostic-profile.test.mjs workbench/tests/requirements-documents.test.mjs workbench/tests/requirements-domain.test.mjs workbench/tests/requirements-export.test.mjs workbench/tests/requirements-integration.test.mjs workbench/tests/requirements-model.test.mjs workbench/tests/requirements-design-quality.test.mjs workbench/tests/requirements-view.test.mjs workbench/tests/requirements-images.test.mjs workbench/tests/requirements-embedded-images.test.mjs workbench/tests/requirements-quality.test.mjs workbench/tests/requirements-quality-workflow.test.mjs | 0 | 103 | 0 | 0 | workbench/qa/20260928-case-quality-gate/engineering-final-code.log |
| VT-0038-03 | DR-0038-03 | 已确认 | 人工待确认 | 确认与导出 | 两组分别确认和导出，无混类；专用确认和旧导入/PATCH来源门禁；类型/引用/确认/绑定状态往返保真；旧无类型和hash不改写。 资料与两组用例均归当前项目，不隐式跨项目共享。 | 旧两轮分类型Excel/JSON与A原样Excel重复回导证据继续有效；补齐轮新候选经正式UI人工确认，原8项目project.json摘要不变，B四个原case/版本保留。未复跑未变的全部导出组合。 v22正式UI分别确认未登录UI/BE各1条，4份分类Excel/JSON实际下载HTTP200；主管解包/解析核对类型、版本、步骤预期及来源，后端导出待协议绑定。原12项目/124用例哈希保持。见case-design/round-confirm-export、adjudication.json。 B冲突UI确认禁用；主管一次负向确认实际HTTP400/REQUIREMENT_GLOBAL_ISSUE_UNRESOLVED，项目和设计摘要不变。QA误预期422已按既有400映射更正解释，仅只读复核，未重复POST。见conflict-confirm-negative.json。 | - | - | - | - | - | - |
| VT-0038-04 | DR-0038-04 | 已确认 | 人工待确认 | 协议设计与准备条件 | 无协议但业务依据充分的后端用例确认导出且待绑定；后补协议逐步映射原用例，纯技术映射新binding不改旧用例/导出，业务冲突产生待核对新候选；部分映射不使整条可运行；绑定完整仍核对执行器/环境/数据/脚本，版本变化重检适用。 列表摘要与当前批次/筛选范围一致，失败/阻塞/未执行分开；同报错仅候选同因，选中失败集合批量反馈/复跑保留逐项结果和历史，原脚本复跑零模型并核对版本/条件。 当前项目ID/名称持续可见，统计/筛选/批量动作限本项目；切换项目清空选择与旧筛选，跨项目数据不隐式合并。 | B后补新合成协议并完整绑定原case版本，原冲突及旧binding保留；后端HTTP计划进入原单条/项目批次、结果列表和下载报告。错误断言/500/超时/取消及异常筛选、反馈带入有正式证据。后端多计划模型修订未实现，批量零模型运行已验。 v22对该后端case v1补原合成协议，真实UI草稿v1及完整确认v2、HTTP201；原case版本/hash及旧导出不变，GET execution_ready=false。协议确认不是执行通过。见case-design/round-binding/final.json。 | - | - | - | - | - | - |
| VT-0038-05 | DR-0038-05 | 已确认 | 人工待确认 | 首种协议运行 | 在同一工作台验收已有用例直接进入、单条/选中/项目执行、修订与从头重生成的输入差异、零模型复跑、用例/脚本版本适用性、部分执行与逐项阻塞、旧历史保留；正常/业务错误/权限/状态变化/协议定义的异步超时/清理另有工程反例与授权非生产证据。 | 命令：npm test；退出码：0；测试数量：342；失败数量：0；跳过数量：0；证据：workbench/qa/20260927-kimi-remediation/dsh-skills-1.1-engineering.log | npm test | 0 | 342 | 0 | 0 | workbench/qa/20260927-kimi-remediation/dsh-skills-1.1-engineering.log |
| VT-0038-06 | DR-0038-06 | 已确认 | 集成测试通过 | 按项目汇总各当前用例版本的最新正式执行结果并导出固定离线HTML报告，跨批次重试保留历史。 | 最新失败不被历史成功遮盖；未测/新版本未测/运行中/取消/阻塞可见；配置、角色和软件版本分组；步骤与媒体同run，快照冻结。 工程反例与正式4322浏览器/实际文件核验分开记录。 | 2026-09-29 v29：项目报告默认每条当前用例版本最新一次正式记录，分实际目标/配置/角色/软件版本，保留缺测、最新失败与执行中；旧单次/批次快照保持。正式4322浏览器生成并下载云平台8例（6原始通过2未执行）和库存3例（2原始通过1未执行），11例选取独立交叉核对一致，61个截图附件逐项同run及SHA/字节校验。15项目、302原运行ID、27旧报告JSON/HTML摘要不变，新增3报告含1迭代快照。配置界面解释被测系统及来源/归属/地址/登录要求；当前多配置实际选取已验，单配置隐藏分支仅代码核对。最终核心14/14及原报告5/5成功，与首轮38项有重叠不相加；既有修订测试REVISION_RUN_NOT_FINISHED及历史治理问题保留，不作全工程或发布结论。0产品模型调用/业务新执行，证据workbench/qa/20260929-project-latest/REPORT.md。 | - | - | - | - | - | - |
| VT-0038-07 | DR-0038-07 | 已确认 | 集成测试通过 | 在项目配置中创建或选择固定测试环境，UI 与 HTTP 各固定一个入口；本项目生成、示范及执行必须使用对应入口，不再在操作弹窗中自由切换。 | 未配置不自动默认；服务端拒绝不同目标、跨项目目标及配置摘要变化；CAS 与在途任务保护环境修改；新 UI 脚本冻结环境摘要，旧脚本按原环境证据核验，无法证明时要求重新生成；旧用例、环境、计划、授权、运行和报告不覆写。 专项反例与正式4322实际界面/API分别留证。 | v41项目固定环境限定验证完成：38项专项/受影响单元测试，17个JS语法检查；正式4322验证未配置无默认与阻塞、GUI保存UI/HTTP绑定、刷新和原实例托管重启后r1保持、脚本准备就绪且无目标选择框、示范/HTTP计划固定目标；6类直接API反例被拒绝。当前项目6条确认用例及项目响应、原脚本操作/计划/示范/运行/报告保持，业务模型0次、业务执行0次。证据workbench/qa/20261004-project-environment/REPORT.md；独立原子写入并发和旧脚本身份边界由单元反例验证，不冒充真实业务执行。新建目标沿用原受限注册逻辑，本轮正式GUI绑定已有目标；复杂登录及真人录制未验。 | - | - | - | - | - | - |
| VT-0038-08 | DR-0038-02 / DR-0038-03 / DR-0038-08 | 已确认 | 集成测试通过 | 用例质量和生成状态：明确数据、分页与可达前置，旧坏用例修订建议，候选问题和生成进度可读。 | 实际命令、退出码、统计和日志；正式4322真实浏览器/执行身份与代表性产物。缺测明确，不以模拟代替产品验收。 | 受控来源用例修订及审阅已实现。正式旧项目3条同case形成v2，v1正文和摘要保留；37项修订相关工程检查以及连续v2修订验证已执行。正式STANDARD仅1请求、20,483 tokens生成4 UI/4 BE，29引用有效；主管逐条审阅8条后6次受控PATCH修正数据/前置/过宽标题，最终r9、PENDING_REVIEW、确认0。真实界面无需人工刷新展示终态；最终生成按钮相关31/31 exit0。协议缺失仍待补，不能保证通用可达性或完整PRD覆盖。证据：workbench/qa/20260930-human-remediation/case-quality/formal-old-case-v2.md、candidate-patches-applied.json、generation-active-targeted-tests.log；workbench/qa/20260930-human-remediation/generation-terminal-auto.dom.txt、generation-reviewed-draft-final.dom.txt。 | - | - | - | - | - | - |
| VT-0038-09 | DR-0038-05 / DR-0038-08 | 已确认 | 集成测试通过 | 执行选择和失败证据：适用版本的就绪资格、中文原因和反馈适用范围；可信实际值采集/未知；修正终结记录测试夹具。 | 实际命令、退出码、统计和日志；正式4322真实浏览器/执行身份与代表性产物。缺测明确，不以模拟代替产品验收。 | 版本资格、中文阻塞原因、失败证据与反馈适用范围已实现。正式混合批次3条零模型运行：UI分页通过，UI与BE小写搜索保留真实失败；UI actual=[]与soft matcher采集来源可追溯，BE只发1GET、第二业务步骤NOT_RUN。主管在真实界面核验列表、失败细节和冻结反馈绑定后取消，未假称执行反馈模型修复。终结记录夹具修正；最新完整工程529/529 exit0。未知或歧义实际值仍标未知。证据：workbench/qa/20260930-human-remediation/execution-ux/OFFICIAL-ORIGINAL-RESULT.md、workbench/qa/20260930-human-remediation/mixed-execution-list-fixed.dom.txt、feedback-confirmation-fixed.dom.txt、backend-feedback-boundary-fixed.dom.txt、unit-tests-revision-final.log。 | - | - | - | - | - | - |
| VT-0038-10 | DR-0038-04 / DR-0038-05 / DR-0038-08 | 已确认 | 集成测试通过 | 后端Content-Type断言与独立反例；协议/HTTP计划可读审阅，保持旧计划兼容和明确技术确认。 | 实际命令、退出码、统计和日志；正式4322真实浏览器/执行身份与代表性产物。缺测明确，不以模拟代替产品验收。 | Content-Type媒体类型断言、请求/业务断言审阅卡片及backend Skill1.2.0已实现。真实DSH仅1会话生成P2，自测、静态审查、独立复验各1次、同执行SHA，主管查看并确认技术计划。正式4个零模型批次复用P2：正确JSON头和合法charset各2GET/48项通过；错误/缺失头各首GET仅header失败、另20项业务断言通过，后续请求未发送。固定正文不改，目标已恢复correct。原P1及确切旧Skill兼容校验保留。本轮未发生DSH失败后修复，不声称验证自修复或量化Skills收益；HTTP计划技术确认不等于产品批准。证据：workbench/qa/20260930-human-remediation/backend/OFFICIAL-DSH-RUN.md、HEADER-BATCH-RESULT.md、p2-confirmed.json；workbench/qa/20260930-human-remediation/backend-p2-review.dom.txt、header-missing-detail.dom.txt。 | - | - | - | - | - | - |
| VT-0038-11 | DR-0038-06 / DR-0038-07 / DR-0038-08 | 已确认 | 集成测试通过 | 人工示范入口与名称、报告范围区分、资格说明；保留固定历史与同范围来源身份。 | 实际命令、退出码、统计和日志；正式4322真实浏览器/执行身份与代表性产物。缺测明确，不以模拟代替产品验收。 | 示范入口/冻结名称/真实步骤数量、报告范围和资格说明已修复。最后示范相关26/26 exit0，正式界面确认既有5步19事件示范及可读列表；本轮未重做真人登录、原生悬浮或录制。主管真实操作保存并下载2份项目最新报告，每条当前用例版本仅1行：混合项目2通过2失败；新图书项目最新头缺失失败1、未执行3，不回退旧通过。JSON/HTML与正式下载摘要一致，媒体内嵌且资格/产品未批准分开。独立离线文件渲染未验。证据：workbench/qa/20260930-human-remediation/demonstration-final-tests.log、demonstration-history-fixed.dom.txt、demonstration-confirmed-fixed.dom.txt、mixed-latest-report.json/.html、header-latest-report.json/.html。 | - | - | - | - | - | - |
| VT-0038-12 | DR-0038-02 / DR-0038-05 / DR-0038-06 / DR-0038-08 | 已确认 | 集成测试通过 | 主管核验实际改动并运行受影响/完整工程清单；同一正式实例加载、真实模型/正常/缺陷/协议反例及报告复验，版本化修订并确认数据保留。 | 实际命令、退出码、统计和日志；正式4322真实浏览器/执行身份与代表性产物。缺测明确，不以模拟代替产品验收。 | 主管已检查实际diff、关键源码、冻结执行体和正式界面。最新完整工程529/529、最后受影响31/31和26/26均exit0，存在重叠不相加。独立正式只读收口408/408 exit0：16旧项目/307旧记录ID可读，32旧报告JSON和HTML摘要不变，3旧用例v1正文相等、v1/v2摘要与P1/P2执行摘要重算一致，7新正式运行与2最新报告的选择/实际结果独立核对。当前同一4322已加载258源码、SHA ff9d5ff642536e25e379d5fbc445f04058b435de7d082b8a6e50aeea3b8ea905，service-b3afb1a5-3d28-42a5-a458-b3af5208ec23，原config489efb5f/data bf511e89保持，服务空闲。307记录只核对ID保留，不声称逐字节全数据不变。通用语义保证、真实云平台全链路、鉴权/写接口、干净机器、第二设备及发布未验。证据：workbench/qa/20260930-human-remediation/final-readonly-facts.log、demonstration-source-loaded.json、REPORT.md。 | - | - | - | - | - | - |
| VT-0038-13 | DR-0038-08 | 已确认 | 人工待确认 | 项目、导入导出、资料格式/图像、版本与保存取消的真实界面验收 | 当前正式4322界面/API、真实供应商请求/DSH记录、冻结输入/版本与原始结果；不以历史或模拟工程结果代替本轮产品验收。 | 本轮已执行，范围状态：部分验收；人工待确认表示整体验收尚未批准，并非未运行。真实GUI保存v2与只读v1历史；Excel13导入/重复0新增，API同源副本1/幂等及原v2保全；真实PNG/JPEG/DOCX输入；来源受控修订仅创建/编辑/取消，未确认或并发。见coverage.json P/I组及project-metadata-saved.json。 权威覆盖 ../../../workbench/qa/20261001-full-acceptance/coverage.json；综合报告 ../../../workbench/qa/20261001-full-acceptance/全功能验收报告.md。 | - | - | - | - | - | - |
| VT-0038-14 | DR-0038-08 | 已确认 | 人工待确认 | 真实PRD/MRD前后端生成、增强审查、未决/冲突、引用和确认质量 | 当前正式4322界面/API、真实供应商请求/DSH记录、冻结输入/版本与原始结果；不以历史或模拟工程结果代替本轮产品验收。 | 本轮已执行，范围状态：已执行，发现阻断；人工待确认表示整体验收尚未批准，并非未运行。STANDARD真实1请求18候选逐条语义审查选6；CHECKED真实4请求完成但RECHECK校验失败、六候选被阻断；原文分类/可读性缺陷单列；生成GUI取消无候选写入。known186031tokens不是DSH用量。见model-execution-ledger.json与standard-root-audit.json。 权威覆盖 ../../../workbench/qa/20261001-full-acceptance/coverage.json；综合报告 ../../../workbench/qa/20261001-full-acceptance/全功能验收报告.md。 | - | - | - | - | - | - |
| VT-0038-15 | DR-0038-08 | 已确认 | 人工待确认 | UI/后端真实DSH编写、自测审查复验、协议后补和失败反馈 | 当前正式4322界面/API、真实供应商请求/DSH记录、冻结输入/版本与原始结果；不以历史或模拟工程结果代替本轮产品验收。 | 本轮已执行，范围状态：已执行，发现问题；人工待确认表示整体验收尚未批准，并非未运行。真实UI/BE DSH A/B审查与自测复验；UI冻结失败反馈S2保留原断言仍失败，重生成实际取消；BE人工反馈P3完成但原run冻结UI入口缺失；隔离P1审查漏掉薄弱基线，主管反馈后P2补按编号读回，确认正式105断言符合预期。见feedback-task-current.json、backend-p3-independent-verification.json、namespace-p2-confirmed.json。 权威覆盖 ../../../workbench/qa/20261001-full-acceptance/coverage.json；综合报告 ../../../workbench/qa/20261001-full-acceptance/全功能验收报告.md。 | - | - | - | - | - | - |
| VT-0038-16 | DR-0038-08 | 已确认 | 人工待确认 | 执行/取消/媒体/示范/登录/报告/配置与重启的真实操作验收 | 当前正式4322界面/API、真实供应商请求/DSH记录、冻结输入/版本与原始结果；不以历史或模拟工程结果代替本轮产品验收。 | 本轮已执行，范围状态：部分验收；人工待确认表示整体验收尚未批准，并非未运行。GUI混合2条符合、项目6条部分运行后取消保留阻塞/NOT_RUN；每例最新三报告6行，最新失败/取消不回退；HTML附件hash符合，浏览器落盘未验；正式API托管重启成功并GUI读回。录制/框选/原生浮窗尚无可信本轮操作证据，独立媒体关联/高亮/取消列表文案/720px侧栏有问题。见问题清单.md、namespace-fault-summary.json、project-latest-final-verification.json。 权威覆盖 ../../../workbench/qa/20261001-full-acceptance/coverage.json；综合报告 ../../../workbench/qa/20261001-full-acceptance/全功能验收报告.md。 | - | - | - | - | - | - |
| VT-0038-17 | DR-0038-08 | 已确认 | 人工待确认 | 运行时与授权边界、当前工程检查、历史保全和完整覆盖问题结论 | 当前正式4322界面/API、真实供应商请求/DSH记录、冻结输入/版本与原始结果；不以历史或模拟工程结果代替本轮产品验收。 | 本轮已执行，范围状态：部分验收；人工待确认表示整体验收尚未批准，并非未运行。工程531项0失败0跳过，最终旧数据/报告保全432检查0失败；SDK/DLL真实LICENSED及坏签名拒绝保持原许可；依赖静态检查exit0，旧portable校验exit1；换主板/干净PC、新包未验。51组覆盖有限结论与问题清单完成，不计全功能或发布批准；治理执行见governance-results.json。 权威覆盖 ../../../workbench/qa/20261001-full-acceptance/coverage.json；综合报告 ../../../workbench/qa/20261001-full-acceptance/全功能验收报告.md。 | - | - | - | - | - | - |
| VT-0038-18 | DR-0038-08 | 已确认 | 集成测试通过 | F01/F05：严格增强审查契约及诊断、固定业务值与独立数据表述、真实普通和增强模型复验 | 修复目录中的实际正式4322 GUI/API/模型/媒体/归档与工程日志；原生和物理缺测分别列出。 | ../../../workbench/qa/20261001-full-remediation/修复验收报告.md；同来源增强4阶段真实DeepSeek请求完成、6候选保持冲突待审；普通1请求10候选由主管逐项核对固定8记录、来源与独立数据。不能解释为任意资料语义通过。checked-current.json、checked-semantic-review.json、standard-current.json、standard-root-review.json。 | - | - | - | - | - | - |
| VT-0038-19 | DR-0038-08 | 已确认 | 人工待确认 | F06/F07：Skills逐记录锚定/独立查询和后端原运行反馈绑定，真实DSH及正式HTTP复跑 | 修复目录中的实际正式4322 GUI/API/模型/媒体/归档与工程日志；原生和物理缺测分别列出。 | ../../../workbench/qa/20261001-full-remediation/修复验收报告.md；Skills1.3逐记录锚定/独立查询与真实反例工程检查已执行；后端失败GUI冻结原run反馈→真实DSH自测/B审查/独立验证→P4人工确认→正式2HTTP/62断言运行成功、模型0，原失败保留。另一隔离写入P3两次自测成功后改了计划，900秒超时，未完成同hash复审/独立验证；不确认、不借旧审查。backend-rework-confirmed-final.json、main-runs-after-highlight.json、namespace-skills13-current.json、namespace-skills13-terminal.dom.txt。 | - | - | - | - | - | - |
| VT-0038-20 | DR-0038-08 | 已确认 | 集成测试通过 | F02/F04：独立验证媒体按不可变清单关联，DOM重排高亮及真实分页录像复验 | 修复目录中的实际正式4322 GUI/API/模型/媒体/归档与工程日志；原生和物理缺测分别列出。 | ../../../workbench/qa/20261001-full-remediation/修复验收报告.md；独立验证和原正式运行20媒体逐项SHA/字节核对，GUI原视频及回放可播；新正式3步分页零模型运行成功，另10媒体核对一致。24原始Trace帧中11→12、18→19橙框随5→3→5行正确移动到翻页按钮，无错框还书。原始视频readyState4/error null并实际播放。media-byte-verification.json、highlight-media-verification.json、highlight-frames/、highlight-original-video.json。 | - | - | - | - | - | - |
| VT-0038-21 | DR-0038-08 | 已确认 | 集成测试通过 | F08–F12：来源导入限制、取消状态、720px鼠标键盘导航、空搜索恢复及后端候选默认分组 | 修复目录中的实际正式4322 GUI/API/模型/媒体/归档与工程日志；原生和物理缺测分别列出。 | ../../../workbench/qa/20261001-full-remediation/修复验收报告.md；正式GUI核对最新取消记录/720高侧栏鼠标与Tab-Enter设置入口/搜索无结果清空恢复/后端唯一候选默认分组并保持人工切换。跨项目来源导入实际公共API400拒绝且项目字节不变，错误文案核对原项目限制；GUI文件重传NOT_RUN，不能冒充界面上传验收。sidebar-keyboard-navigation.json、search-keyboard-restored.dom.txt、cancelled-detail.dom.txt、backend-only-default.dom.txt、cross-project-rejection.json。 | - | - | - | - | - | - |
| VT-0038-22 | DR-0038-08 | 已确认 | 无法运行 | F03与收口：长路径打包、冻结当前包的字节验证、历史保全、工程检查与明确发布缺口 | 修复目录中的实际正式4322 GUI/API/模型/媒体/归档与工程日志；原生和物理缺测分别列出。 | ../../../workbench/qa/20261001-full-remediation/修复验收报告.md；Windows长路径构建已修。r4 ZIP独立清单/SHA与Windows原生解压后30625文件严格校验成功；223源码项对照为222相同、1客户授权策略有意替换。包content摘要effa7ff7...与服务source摘要6a037f45...口径不同，不相等也不互相代替。正式4322第三次托管重启保留原数据/配置。安装自检被WindowsPowerShell执行策略拒绝，后续安装Key/DSH/浏览器/DLL运行、干净PC/第二主板NOT_RUN。原16项目、314记录ID、34报告对保全432检查0失败。collector实际npm回归536项失败0/跳过0；collector及全项目checker均退出1，发布治理未通过。portable-r4-archive-verification.json、portable-r4-native-verification.log、package-source-comparison.json、portable-r4-runtime.log、original-preservation-final.json、unit-final.log、governance-final.log。 | - | - | - | - | - | - |
| VT-0038-23 | DR-0038-08 | 已确认 | 集成测试通过 | 后端受控提交编排、当前SHA与覆盖契约、脱敏工具诊断和界面阶段 | workbench/qa/20261001-remediation-round2实际命令、正式GUI/模型/HTTP、包和历史证据；没有物理条件不计通过。 40工程测试；P4真实DSH生成/自测/B工具审查/独立复验同SHA，主管固定字段核对17项。旧P3超时保留；不主张统计成功率。 | 命令：node --test workbench/tests/backend-quality-loop.test.mjs workbench/tests/backend-harness-protocol.test.mjs workbench/tests/backend-harness-acceptance.test.mjs workbench/tests/backend-harness-diagnostic.test.mjs；退出码：0；测试数量：40；失败数量：0；跳过数量：0；证据：workbench/qa/20261001-remediation-round2/backend-targeted.log | node --test workbench/tests/backend-quality-loop.test.mjs workbench/tests/backend-harness-protocol.test.mjs workbench/tests/backend-harness-acceptance.test.mjs workbench/tests/backend-harness-diagnostic.test.mjs | 0 | 40 | 0 | 0 | workbench/qa/20261001-remediation-round2/backend-targeted.log |
| VT-0038-24 | DR-0038-08 | 已确认 | 集成测试通过 | 包内Node私有运行时/诊断/启动与当前用户DPAPI兼容桥，保持已有配置凭据 | workbench/qa/20261001-remediation-round2实际命令、正式GUI/模型/HTTP、包和历史证据；没有物理条件不计通过。 20工程测试与原生加密读回/错误凭据/已有文件不覆盖/受管链接迁移。旧PS读取器的普通策略执行被系统拒绝，互读缺测单列，不绕过策略。 | 命令：node --test workbench/tests/native-runtime.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/portable-package.test.mjs；退出码：0；测试数量：20；失败数量：0；跳过数量：0；证据：workbench/qa/20261001-remediation-round2/native-targeted-fixed.log | node --test workbench/tests/native-runtime.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/portable-package.test.mjs | 0 | 20 | 0 | 0 | workbench/qa/20261001-remediation-round2/native-targeted-fixed.log |
| VT-0038-25 | DR-0038-08 | 已确认 | 集成测试通过 | 新冻结便携包的完整性与路径/依赖/浏览器/凭据运行复验 | workbench/qa/20261001-remediation-round2实际命令、正式GUI/模型/HTTP、包和历史证据；没有物理条件不计通过。 新ZIP30629文件独立/包内Node完整性检查；227源码项对照226一致+1客户策略。602依赖、包内浏览器和插件、无全局PATH、DPAPI实际运行；仅工程准备，无第二工作台/真实用户授权/模型请求，独立干净PC与第二主板未验。 | 实际命令：node workbench/qa/20261001-remediation-round2/portable-runtime-probe.mjs；退出码0；无TAP计数，数量未解析。日志workbench/qa/20261001-remediation-round2/portable-r1-runtime-probe.log。新ZIP30629文件独立/包内Node完整性检查；227源码项对照226一致+1客户策略。602依赖、包内浏览器和插件、无全局PATH、DPAPI实际运行；仅工程准备，无第二工作台/真实用户授权/模型请求，独立干净PC与第二主板未验。 | - | - | - | - | - | - |
| VT-0038-26 | DR-0038-08 | 已确认 | 集成测试通过 | 原4322复杂后端真实DSH、正式执行与UI/报告/工程回归、历史保全和收口 | workbench/qa/20261001-remediation-round2实际命令、正式GUI/模型/HTTP、包和历史证据；没有物理条件不计通过。 唯一正式4322；P4 GUI正式96断言通过，500/超时/取消与延迟后精确清理通过；原S1 GUI三步复跑与录像，项目最新固定快照。全量工程/历史保全/最终治理在最终报告分别记录；不称全功能产品批准。 | 正式4322 GUI新P4生成/主管确认/两次限定正常复跑；96业务及清理断言、16HTTP，模型复跑0；500/超时/执行中取消按实际状态且精确清理。UI原S1三步复跑与原始录像实际播放；项目最新取消和最新成功固定快照分开保存。npm --prefix workbench test实际545成功、0失败/跳过，unit-final-r2.log与delivery-evidence-unit-run.md；首轮543/545和未复现的策略测试异常保留。仅本轮范围，非全功能产品/发布批准。详见workbench/qa/20261001-remediation-round2/修复验收报告.md及round2-evidence-ledger.json。 | - | - | - | - | - | - |
| VT-0038-27 | DR-0038-08 | 已确认 | 人工待确认 | 第三轮51组逐项真实全功能验收 | 第三轮51组台账与真实证据已收口：限定验证23、部分21、有问题6、原生物理未验1。PRD/MRD生成全量截断、CHECKED复审契约及范围漂移、UI空筛选清空验证遗漏、目标名称报告丢失、可变包stage字节异常保留。6主DSH/7审查DSH会话；7个已知usage请求189911tokens，DSH请求及总费用未知。正式10运行5正常通过/3注入故障失败/1超时/1主动取消，运行模型0。后台反馈P2真实修订成功、UI反馈识别待分析，未伪造独立复验或自动批准。14原始媒体与同一14报告附件SHA匹配。自动同4322重启旧19项目346运行身份42报告JSON/HTML保全489核验0失败；新3项目16运行身份6报告恢复。current_evidence仅记本轮真实545项工程回归，不代表51组或产品通过。全表、模型账本、问题和限制见workbench/qa/20261001-full-acceptance-round3。 | 命令：npm --prefix workbench test；退出码：0；测试数量：545；失败数量：0；跳过数量：0；证据：workbench/qa/20261001-full-acceptance-round3/unit-round3.log | npm --prefix workbench test | 0 | 545 | 0 | 0 | workbench/qa/20261001-full-acceptance-round3/unit-round3.log |
| VT-0038-28 | DR-0038-08 | 已确认 | 人工待确认 | 第四轮发布目标修复与真实模型全面复验 | 原4322新模型生成及审查、UI/后端正式执行、故障清理、最新报告、录制与凭据授权及包核验分别留痕；全量分区失败/取消/中断保留已完成请求及草稿；原生物理、干净PC、第二主板未验不能算发布通过。 第四轮实际证据：普通全量UI/BE两请求均完成；选定CHECKED四阶段契约成功且冲突保持；真实全量取消保留16UI草稿及usage、拒绝不完整确认；9DSH主/9审查启动，12已知usage请求252460tokens，底层总量/金额未知；新A UI修复与BE trim同稿自测/审查/独立复验后正式零模型执行，B AND执行与A/B无判别重置反例保留待分析。B真实审查另出现上游MALFORMED_RESPONSE，诊断脱敏而非绕过。4正式技术运行、16媒体、最新报告3已执行1NOT_RUN；22旧项目362运行身份48报告JSON及42旧HTML保全。当前便携ZIP与独立解压30631文件核对，同机DPAPI/私有PATH与激活门探测；工作stage失败保留，原生物理/干净PC/另一主板仍未验。556项只为工程证据；完整记录及51组历史与新验边界见workbench/qa/20261001-release-goal-round4。 v39继续：ALL实际两请求均完成，独立PNG与DOCX嵌入JPEG均按身份校验；11UI/10后端均未确认，冲突保留。B新真实审查曾返回NO_FINDINGS；补持久化后再次真实B发现完整编号不能判别包含与等值，不能以A或旧技术执行覆盖此缺口。原无效JSON失败及旧报告不覆盖。收件诊断仅摘要、大小、固定方法/工具名、状态，不保存原始参数或凭据。最终结果以closeout/第四轮收口报告.md及逐文件归档为准。 本轮新B最新稿为NEEDS_ANALYSIS，未确认未正式执行；旧成功仅技术记录。原生工具因URL策略停止，未伪造物理操作；旧19事件真人录制完整保留。229源码文件与运行源摘要/客户包、30631 ZIP字节逐项核对；20源/测试文件增量归档采用已核对的基线，旧混合工程未整体合并。治理失败保留，不批准发布。 | 命令：npm --prefix workbench test；退出码：0；测试数量：558；失败数量：0；跳过数量：0；证据：workbench/qa/20261001-release-goal-round4/closeout/unit-delivery-closeout.log | npm --prefix workbench test | 0 | 558 | 0 | 0 | workbench/qa/20261001-release-goal-round4/closeout/unit-delivery-closeout.log |
| VT-0038-29 | DR-0038-09 | 已确认 | 单元测试通过 | 主流程渐进展示、状态恢复及正式4322交互检查 | 84项专项单元0失败0跳过；正式4322实际DOM、截图、输入切换恢复、展开与取消；10类项目资源哈希保持。当前1280x720桌面无整页横向溢出；窄屏实际交互NOT_RUN，不能视作该项已验收。业务模型、业务执行与人工确认均0次。见workbench/qa/20261004-workflow-simplification/REPORT.md；完整治理结果与产品/发布验收独立。 | 命令：node --test workbench/tests/requirements-view.test.mjs workbench/tests/requirements-integration.test.mjs workbench/tests/requirements-quality-workflow.test.mjs workbench/tests/backend-view.test.mjs workbench/tests/batches.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/product-v21.test.mjs；退出码：0；测试数量：84；失败数量：0；跳过数量：0；证据：workbench/qa/20261004-workflow-simplification/unit-tests.log | node --test workbench/tests/requirements-view.test.mjs workbench/tests/requirements-integration.test.mjs workbench/tests/requirements-quality-workflow.test.mjs workbench/tests/backend-view.test.mjs workbench/tests/batches.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/product-v21.test.mjs | 0 | 84 | 0 | 0 | workbench/qa/20261004-workflow-simplification/unit-tests.log |
| VT-0038-30 | DR-0038-10 | 已确认 | 人工待确认 | 项目基础环境与登录接入的限定验证 | 105项专项工程：104成功、0失败、1项旧影子工作台测试保持跳过；另39项受影响回归成功，两组无重叠。正式4322实际配置表单、批量确认与缺项提示、协议导入/自动准备、原6用例及环境不变、重启原数据/配置和源码摘要一致。前端有效会话复用/失效、批次取消与身份变更以离线反例验证；真实模型、外部登录、窄屏交互及产品验收NOT_RUN。详情见workbench/qa/20261005-project-first-workflow/REPORT.md。 | 命令：node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs；退出码：0；测试数量：105；失败数量：0；跳过数量：1；证据：workbench/qa/20261005-project-first-workflow/unit-final.log | node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs | 0 | 105 | 0 | 1 | workbench/qa/20261005-project-first-workflow/unit-final.log |
| VT-0038-31 | DR-0038-11 | 已确认 | 人工待确认 | 前端集中批量生成的限定验证 | 105项专项工程：104成功、0失败、1项旧影子工作台测试保持跳过；另39项受影响回归成功，两组无重叠。正式4322实际配置表单、批量确认与缺项提示、协议导入/自动准备、原6用例及环境不变、重启原数据/配置和源码摘要一致。前端有效会话复用/失效、批次取消与身份变更以离线反例验证；真实模型、外部登录、窄屏交互及产品验收NOT_RUN。详情见workbench/qa/20261005-project-first-workflow/REPORT.md。 | 命令：node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs；退出码：0；测试数量：105；失败数量：0；跳过数量：1；证据：workbench/qa/20261005-project-first-workflow/unit-final.log | node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs | 0 | 105 | 0 | 1 | workbench/qa/20261005-project-first-workflow/unit-final.log |
| VT-0038-32 | DR-0038-12 | 已确认 | 人工待确认 | 协议自动准备与后端批量生成的限定验证 | 105项专项工程：104成功、0失败、1项旧影子工作台测试保持跳过；另39项受影响回归成功，两组无重叠。正式4322实际配置表单、批量确认与缺项提示、协议导入/自动准备、原6用例及环境不变、重启原数据/配置和源码摘要一致。前端有效会话复用/失效、批次取消与身份变更以离线反例验证；真实模型、外部登录、窄屏交互及产品验收NOT_RUN。详情见workbench/qa/20261005-project-first-workflow/REPORT.md。 | 命令：node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs；退出码：0；测试数量：105；失败数量：0；跳过数量：1；证据：workbench/qa/20261005-project-first-workflow/unit-final.log | node --test workbench/tests/project-environments.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/development-auth-binding.test.mjs workbench/tests/auth-login-preflight.test.mjs workbench/tests/auth-concurrency.test.mjs workbench/tests/auth-session-request-policy.test.mjs workbench/tests/candidate-trials.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/backend-batches.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs | 0 | 105 | 0 | 1 | workbench/qa/20261005-project-first-workflow/unit-final.log |
| VT-0038-33 | DR-0038-13 | 已确认 | 单元测试通过 | 第二版前端与精确运行范围的限定工程/正式4322交互验证 | 专项状态/范围/离页反例单元；正式桌面与720px无越界、空项目、所选范围、准备资料移除、示范入口、历史批次；数据保全；不计真实模型或业务执行通过。 | 命令：node --test workbench/tests/execution-ux.test.mjs workbench/tests/batch-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/requirements-view.test.mjs workbench/tests/feedback-view.test.mjs workbench/tests/execution-notes.test.mjs workbench/tests/demonstration-route-guard.test.mjs workbench/tests/backend-view.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20261008-v2-frontend/collector-tests.log | node --test workbench/tests/execution-ux.test.mjs workbench/tests/batch-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/requirements-view.test.mjs workbench/tests/feedback-view.test.mjs workbench/tests/execution-notes.test.mjs workbench/tests/demonstration-route-guard.test.mjs workbench/tests/backend-view.test.mjs | 0 | 120 | 0 | 0 | workbench/qa/20261008-v2-frontend/collector-tests.log |
| VT-0038-34 | DR-0038-02 / DR-0038-05 / DR-0038-13 | 已确认 | 单元测试通过 | 全功能检查与已复现局部修复的限定工程/正式流程验证 | 最终100受影响工程检查、正式生成/运行/登录示范/媒体报告、54组实际或未验状态、旧26项目130资源保全。F08及未验范围不判通过；工程数量不与495重叠集合相加。 | 命令：node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/requirements-view.test.mjs workbench/tests/bindings-navigation.test.mjs workbench/tests/report-navigation.test.mjs workbench/tests/reports.test.mjs workbench/tests/authorization-navigation.test.mjs workbench/tests/backend-harness-startup-cleanup.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/quality-review-mode.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/execution-notes-entry.test.mjs workbench/tests/execution-notes.test.mjs；退出码：0；测试数量：100；失败数量：0；跳过数量：0；证据：workbench/qa/20261008-full-functional/final-affected-tests.tap | node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/requirements-view.test.mjs workbench/tests/bindings-navigation.test.mjs workbench/tests/report-navigation.test.mjs workbench/tests/reports.test.mjs workbench/tests/authorization-navigation.test.mjs workbench/tests/backend-harness-startup-cleanup.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/quality-review-mode.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/execution-notes-entry.test.mjs workbench/tests/execution-notes.test.mjs | 0 | 100 | 0 | 0 | workbench/qa/20261008-full-functional/final-affected-tests.tap |
| VT-0038-35 | DR-0038-02 / DR-0038-05 / DR-0038-13 | 已确认 | 单元测试通过 | 阶段拒绝/修订、运行编号、字段关联反例、非空说明及正式后端自动链验证 | 119专项工程检查；正式4322旧不兼容输入调用前拒绝；显式v2、新环境及完整真实模型/审查/独立复验；运行3条含精确清理与公共基线不变。非空文本不证明语义，错误说明另记录主管实际核查，模型失败保留。 | 命令：node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/backend-case-stages.test.mjs workbench/tests/backend-namespace-prefix.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/requirements-model.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/candidate-quality-review.test.mjs workbench/tests/backend-record-assertion.test.mjs；退出码：0；测试数量：119；失败数量：0；跳过数量：0；证据：workbench/qa/20261008-backend-stage-fix/final-affected-tests.tap | node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/backend-case-stages.test.mjs workbench/tests/backend-namespace-prefix.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/requirements-model.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/candidate-quality-review.test.mjs workbench/tests/backend-record-assertion.test.mjs | 0 | 119 | 0 | 0 | workbench/qa/20261008-backend-stage-fix/final-affected-tests.tap |
| VT-0038-36 | DR-0038-14 | 已确认 | 集成测试通过 | 协议排版、查询白名单与输入、网络写入结果、原始数组关联、严格价格反例及正式模型闭环 | 限定3条实际复杂场景及8项收口核验；173项去重工程检查另列，不相加。真实候选字节/协议/运行身份、31项目155资源及本地业务基线对照；详见workbench/qa/20261008-cloud-optimization/REPORT.md。普通写入、真实鉴权、全功能重跑及产品/发布验收未覆盖。 | 命令：node --test workbench/qa/20261008-cloud-optimization/verify-delivery.test.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20261008-cloud-optimization/final-integration-precheck.log | node --test workbench/qa/20261008-cloud-optimization/verify-delivery.test.mjs | 0 | 8 | 0 | 0 | workbench/qa/20261008-cloud-optimization/final-integration-precheck.log |
| VT-0038-37 | DR-0038-15 | 已确认 | 人工待确认 | 54组当前功能与关键真实链路全面验收 | 已实际执行并发现6类未解问题，整体验收未通过；现有状态枚举用人工待确认承载非通过结论，不能解读为尚未运行或仅待签字。54组：23限定验证、21部分、7问题关联组、2仅工程、1未执行，功能组重叠不计算通过率。工程762项760通过2失败。current_evidence的8项只核对证据一致性，不能替代产品验收。详见workbench/qa/20261008-final-acceptance/REPORT.md和COVERAGE.md。 | 命令：node --test workbench/qa/20261008-final-acceptance/verify-evidence.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20261008-final-acceptance/closure-verification.log | node --test workbench/qa/20261008-final-acceptance/verify-evidence.mjs | 0 | 8 | 0 | 0 | workbench/qa/20261008-final-acceptance/closure-verification.log |
| VT-0038-38 | DR-0038-16 | 已确认 | 集成测试通过 | 巡检工单六条前端生成恢复、状态和真实模型限定验证；完整产品未验收 | 专项单元检查+正式4322真实模型生成/审查/运行+原数据保全；详见workbench/qa/20261009-generation-recovery/REPORT.md。 | 命令：node --test workbench/qa/20261009-generation-recovery/verify-acceptance.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-generation-recovery/delivery-verification.log | node --test workbench/qa/20261009-generation-recovery/verify-acceptance.mjs | 0 | 8 | 0 | 0 | workbench/qa/20261009-generation-recovery/delivery-verification.log |
| VT-0038-39 | DR-0038-17 | 已确认 | 集成测试通过 | 集中核对成功/部分失败/重载与前端示范直达、原项目保全 | 纯函数及模拟接口测试；正式4322新建合成QA项目确认真实人工计划，原用户项目仅查看；记录0新增模型和0业务执行。 | 命令：node --test workbench/tests/project-workflow-view.test.mjs workbench/tests/backend-bulk-review.test.mjs workbench/tests/backend-view.test.mjs workbench/tests/execution-ux.test.mjs；退出码：0；测试数量：76；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-bulk-review-demo/delivery-verification.log | node --test workbench/tests/project-workflow-view.test.mjs workbench/tests/backend-bulk-review.test.mjs workbench/tests/backend-view.test.mjs workbench/tests/execution-ux.test.mjs | 0 | 76 | 0 | 0 | workbench/qa/20261009-bulk-review-demo/delivery-verification.log |
| VT-0038-40 | DR-0038-18 | 已确认 | 集成测试通过 | 整窗录像真实画面、身份和异常收尾、历史保全及页面播放 | 录制真实测试浏览器并抽帧检查，专项单元和正式4322原脚本运行，模型0次。 | 命令：node --test workbench/tests/window-recorder.test.mjs workbench/tests/window-recording-view.test.mjs workbench/tests/execution-ux.test.mjs workbench/tests/candidate-trials.test.mjs；退出码：0；测试数量：48；失败数量：0；跳过数量：1；证据：workbench/qa/20261009-browser-window-recording/delivery-verification.log | node --test workbench/tests/window-recorder.test.mjs workbench/tests/window-recording-view.test.mjs workbench/tests/execution-ux.test.mjs workbench/tests/candidate-trials.test.mjs | 0 | 48 | 0 | 1 | workbench/qa/20261009-browser-window-recording/delivery-verification.log |
| VT-0038-41 | DR-0038-19 | 已确认 | 集成测试通过 | 时间线身份/边界拒绝、媒体联动与全屏、最大化录像真实运行 | 聚焦工程检查、正式4322真实播放和最大化窗口新运行；原数据和旧录像哈希保持。 | 命令：node --test workbench/tests/window-timeline.test.mjs workbench/tests/window-recorder.test.mjs workbench/tests/window-recording-view.test.mjs workbench/tests/execution-ux.test.mjs workbench/tests/candidate-trials.test.mjs；退出码：0；测试数量：68；失败数量：0；跳过数量：1；证据：workbench/qa/20261009-replay-sync/delivery-verification.log | node --test workbench/tests/window-timeline.test.mjs workbench/tests/window-recorder.test.mjs workbench/tests/window-recording-view.test.mjs workbench/tests/execution-ux.test.mjs workbench/tests/candidate-trials.test.mjs | 0 | 68 | 0 | 1 | workbench/qa/20261009-replay-sync/delivery-verification.log |
| VT-0038-42 | DR-0038-15 | 已确认 | 人工待确认 | 验收已执行但未通过，等待是否修复的人工决定；不能据本字段推断未执行或批准。逐项检查当前功能并给出本机试用结论，真实模型及当前执行独立于历史记录；缺陷和未验部分明确。 本轮真实模型与正式页面结论未通过；工程命令工作目录workbench，工程852/856通过、4失败。报告与完整边界见workbench/qa/20261009-release-acceptance/REPORT.md。 | 唯一正式4322，当前源码身份、真实API/浏览器、模型任务/候选/批次/媒体和日志；不以工程绿代替业务验收。 | 命令：node qa/20261009-release-acceptance/engineering/run-reviewed-tests.mjs；退出码：1；测试数量：856；失败数量：4；跳过数量：0；证据：workbench/qa/20261009-release-acceptance/engineering/runner-console.log | node qa/20261009-release-acceptance/engineering/run-reviewed-tests.mjs | 1 | 856 | 4 | 0 | workbench/qa/20261009-release-acceptance/engineering/runner-console.log |
| VT-0038-43 | DR-0038-15 | 已确认 | 人工待确认 | A01-A08本轮限定技术复验有实际证据，产品业务核对及完整发布批准仍待人工。UI02从诊断v3按有效反馈形成S5，正常/替代提示通过，步骤1故障保留完整实际预期差异且精确清理；UI01步骤4故障清理、后端3步和增强设计均分别列证。19文件195项工程通过；保全42项目520旧记录16空间，新记录26条单列。 | 唯一正式4322；所有原失败、原用例、旧候选保留；current_evidence仅只读审计已保存原始Trace，0代表该命令不执行新业务测试，不是整个工程0用例通过。业务运行、自测、模型审查和人工确认分开记录；完整发布和另一电脑未验。 | 命令：python -X utf8 workbench/qa/20261010-acceptance-fixes/audit-ui02-traces.py；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261010-acceptance-fixes/evidence-trace-audit.log | python -X utf8 workbench/qa/20261010-acceptance-fixes/audit-ui02-traces.py | 0 | 0 | 0 | 0 | workbench/qa/20261010-acceptance-fixes/evidence-trace-audit.log |
| VT-0038-44 | DR-0038-15 | 已确认 | 人工待确认 | 本轮测试已实际执行，限定技术主流程通过，但两处业务检查完整性发现未处理，因此完整发布不判通过。人工待确认表示发布与业务核对待处理，不表示未执行。生成首次结构错误、故障FAILED、取消NOT_RUN和QA检查器错误全部保留；正常报告只含指定两条。 | 唯一正式4322与冻结源码；current_evidence为只读复核已保存证据，0表示该命令不再执行新业务测试；实际886工程、真实模型、自测、独立运行和人工确认分开记录。另一电脑、真人物理浮窗与全量客户业务NOT_RUN。 | 命令：node workbench/qa/20261010-cleanup-release/audit-delivery.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261010-cleanup-release/audit-delivery.log | node workbench/qa/20261010-cleanup-release/audit-delivery.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261010-cleanup-release/audit-delivery.log |
| VT-0038-45 | DR-0038-20 | 已确认 | 人工待确认 | 限定技术流程已实际验证：896项工程全清单后，对真实模型发现作限定修复并通过54项相关检查；正式4322四轮真实DSH实际读取Word/Markdown的7个片段和1张图片，完成追问、补充与修订。最终前后端各2条Excel下载并正式导入预览保持分类、动作与预期，无自动入库。页面单次发送、刷新恢复、历史与下载有证据。人工待确认仅表示实际业务核对与用户使用验收，不表示技术流程未运行。 | 唯一正式4322、同配置及数据目录；44原项目和新增空用例QA项目的45份用例投影保持。来源隔离、取消和中断恢复含工程反例，不外推真人全过程。current_evidence只读复核已保存证据，0表示不再执行新业务测试；详见workbench/qa/20261010-case-assistant/REPORT.md。生成用例未执行，不代表客户业务验收。 | 命令：node workbench/qa/20261010-case-assistant/audit-delivery.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261010-case-assistant/audit-delivery.log | node workbench/qa/20261010-case-assistant/audit-delivery.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261010-case-assistant/audit-delivery.log |
| VT-0038-46 | DR-0038-21 | 已确认 | 人工待确认 | 实际验证为部分完成：Excel格式与待确认状态往返、工程67项和4条前端只读路径通过。真实DSH共3轮，首轮完成14条草稿；后两轮加强步骤修订均因工具JSON错误失败，未判完整通过。人工待确认不表示技术验证未执行，也不表示修订已成功。 | 唯一正式4322原配置数据；原46项目与旧失败对话保持。首轮漏014/多004-B及操作问题如实记录，步骤加强后尚无完整模型结果；不保证业务正确性，不外推脚本执行。current_evidence仅复核保存证据，非新增模型或业务测试。 | 命令：node workbench/qa/20261010-draft-excel/audit.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261010-draft-excel/audit.log | node workbench/qa/20261010-draft-excel/audit.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261010-draft-excel/audit.log |
| VT-0038-47 | DR-0038-22 | 已确认 | 人工待确认 | 已完成本次技术修复验证：81工程项含真实DSH离线故障链，正式4322真实模型14条与两份Excel下载/导入预览、原数据保全。业务预期与部分步骤仍由工程师核对，非完整产品发布验收。 | 工程故障注入与真实模型分开记录；原46项目、两段失败历史原样保留；不判业务语义通过。 | 命令：node workbench/qa/20261010-dsh-json-recovery/audit.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261010-dsh-json-recovery/audit.log | node workbench/qa/20261010-dsh-json-recovery/audit.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261010-dsh-json-recovery/audit.log |
| VT-0038-48 | DR-0038-15 | 已确认 | 无法运行 | 既定6UI与6API从导入、环境协议、真实脚本生成、自测修复到执行录像及固定报告的完整流程。 | 本轮真实模型调用和冻结脚本/计划、运行与逐义务核对分列；原项目/执行记录/空间保持；所有未通过项如实保留。 | workbench/qa/20261011-real-model-acceptance/REPORT.md；ui-revision-final.json及独立复核记录UI02截断（finish_reason=length），不回退；available-run-summary.json记录5UI+6API同批次通过、执行model_calls=0；available-results-verification.json记录15项通过；preservation.json记录49原项目、557原执行、16原空间保全及零新增残留。产品source.field提示契约补丁专项23/23通过，保持严格校验。首次失败、五空间人工精确清理和QA驱动适配尝试均保留。 | - | - | - | - | - | - |
| VT-0038-49 | DR-0038-23 | 已确认 | 集成测试通过 | 无需身份接口的配置保存、人工登录与页面拒绝、Cookie/localStorage复用、API兼容和正式4322页面。 | 工程浏览器用独立被测夹具；功能联调使用现有4322同配置同数据；真实云平台只验证可配置与等待登录，业务和实模NOT_RUN。 | 命令：node --test --test-concurrency=1 workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/auth-browser-page.test.mjs；退出码：0；测试数量：46；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-manual-login/final-core.log | node --test --test-concurrency=1 workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/project-auth-targets.test.mjs workbench/tests/auth-browser-page.test.mjs | 0 | 46 | 0 | 0 | workbench/qa/20261013-manual-login/final-core.log |
| VT-0038-50 | DR-0038-24 | 已确认 | 集成测试通过 | 批量核对原子/CAS/内容保护，待确认项目入口可见，确认后多条生成预览、选定范围与旧数据保全。 | 工程测试与正式4322实际页面分列；仅合成项目由Agent核对，真实用例不由Agent代确认；真人独立确认记录保留。实际模型和云平台执行NOT_RUN，保全时间与人工变更分列。 | 命令：node --test --test-concurrency=1 workbench/tests/case-review-lifecycle.test.mjs workbench/tests/project-batch-entry.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/script-operations.test.mjs；退出码：0；测试数量：71；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-batch-workflow/engineering.log | node --test --test-concurrency=1 workbench/tests/case-review-lifecycle.test.mjs workbench/tests/project-batch-entry.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/script-operations.test.mjs | 0 | 71 | 0 | 0 | workbench/qa/20261013-batch-workflow/engineering.log |
| VT-0038-51 | DR-0038-25 | 已确认 | 集成测试通过 | 预检一次扫描及跨请求新鲜事实，慢预检首屏与门槛，合并视图双向范围/正文确认保护、正式73条加载与原数据保全。 | 工程故障注入与正式4322实际页面/计时分列；实际模型和真实业务NOT_RUN。 | 命令：node --test --test-concurrency=1 workbench/tests/project-loading.test.mjs workbench/tests/workspace-merged-view.test.mjs workbench/tests/preflight-task-snapshot.test.mjs workbench/tests/case-review-lifecycle.test.mjs workbench/tests/project-batch-entry.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/script-operations.test.mjs workbench/tests/batches.test.mjs；退出码：0；测试数量：98；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-workspace-loading/engineering-final.log | node --test --test-concurrency=1 workbench/tests/project-loading.test.mjs workbench/tests/workspace-merged-view.test.mjs workbench/tests/preflight-task-snapshot.test.mjs workbench/tests/case-review-lifecycle.test.mjs workbench/tests/project-batch-entry.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/script-operations.test.mjs workbench/tests/batches.test.mjs | 0 | 98 | 0 | 0 | workbench/qa/20261013-workspace-loading/engineering-final.log |
| VT-0038-52 | DR-0038-26 | 已确认 | 集成测试通过 | 无刷新认证监控、图标非致命阻断、异常证据读取/篡改拒绝、原越界保护与单条真实生成链。 | 工程测试与正式4322真实模型结果分列，原业务预期与旧失败记录保全。 | 命令：node --test workbench/qa/20261013-generation-blockers/verify-live.test.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-generation-blockers/live-acceptance.log | node --test workbench/qa/20261013-generation-blockers/verify-live.test.mjs | 0 | 5 | 0 | 0 | workbench/qa/20261013-generation-blockers/live-acceptance.log |
| VT-0038-53 | DR-0038-27 | 已确认 | 集成测试通过 | 67工程项、正式登录聚焦与会话保全、72例弹窗和原1741文件保全。 | 真实4322交互与用户登录确认、记录及哈希；不代替整批业务生成。 | 命令：node --test workbench/qa/20261013-bulk-monitor/verify-live.test.mjs；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-bulk-monitor/live-acceptance.log | node --test workbench/qa/20261013-bulk-monitor/verify-live.test.mjs | 0 | 4 | 0 | 0 | workbench/qa/20261013-bulk-monitor/live-acceptance.log |
| VT-0038-54 | DR-0038-28 | 已确认 | 集成测试通过 | 慢提交即时反馈/重复点击拒绝、健康超时与恢复、实际原实例批次和已服务静态资源检查。 | 35专项模拟与正式4322只读4项分列；真实提交迟缓未新发模型复现，不宣称原72条业务生成成功。 | 命令：node --test workbench/qa/20261013-bulk-submit/verify-live.test.mjs；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-bulk-submit/live-acceptance.log | node --test workbench/qa/20261013-bulk-submit/verify-live.test.mjs | 0 | 4 | 0 | 0 | workbench/qa/20261013-bulk-submit/live-acceptance.log |
| VT-0038-55 | DR-0038-29 | 已确认 | 集成测试通过 | 快速模式完整通过、失败与篡改拒绝、旧模式兼容、同域导航身份隔离、前置受阻、真实一条生成及直接运行。 | 单条真实生成、自测、直接运行已验证；第一次复跑失败真实保留，经S5有界加载等待修订后通过，字段和操作断言保留。AI审核0、人工确认NOT_REQUIRED、独立复验0。正式4322结果/媒体HTTP读取和哈希一致，复用自测仅一条历史来源。工程147通过、0失败、1旧影子工作台测试跳过；1741原文件不变。整批完成与长期稳定性未宣称，见workbench/qa/20261013-fast-generation/REPORT.md。 | 命令：node --test workbench/qa/20261013-fast-generation/verify-live.test.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-fast-generation/live-acceptance.log | node --test workbench/qa/20261013-fast-generation/verify-live.test.mjs | 0 | 5 | 0 | 0 | workbench/qa/20261013-fast-generation/live-acceptance.log |
| VT-0038-56 | DR-0038-30 | 已确认 | 单元测试通过 | 观察门控反例、作用域与篡改失效、失败边界及原4322两条失败用例复验。 | 62专项通过；正式4322源码指纹、服务/项目入口4只读检查通过。90旧脚本与项目完整保全。真实两条复验NOT_RUN：AUTH_LOGIN_TARGET_UNREACHABLE；直连TCP与无代理HTTP均超时，用户确认暂时无法恢复。整体真实验收未完成。 | 命令：node --test workbench/tests/development-exploration.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/development-convergence-integration.test.mjs workbench/tests/development-navigation-hints.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-session.test.mjs workbench/tests/development-capabilities.test.mjs workbench/tests/development-transport-retry.test.mjs workbench/tests/harness-provider-address.test.mjs；退出码：0；测试数量：62；失败数量：0；跳过数量：0；证据：workbench/qa/20261013-generic-generation/engineering-final.log | node --test workbench/tests/development-exploration.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/development-convergence-integration.test.mjs workbench/tests/development-navigation-hints.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-session.test.mjs workbench/tests/development-capabilities.test.mjs workbench/tests/development-transport-retry.test.mjs workbench/tests/harness-provider-address.test.mjs | 0 | 62 | 0 | 0 | workbench/qa/20261013-generic-generation/engineering-final.log |
| VT-0038-57 | DR-0038-31 | 已确认 | 单元测试通过 | 交付dsh模块导出Skill及数据型技术资料协议 | 68项专项通过；dsh实际源码侧导出约232秒，正式UI导入2页面56控件，22来源文件哈希匹配；A无资料与B资料任务已验证冻结。导出抽查有配置页placeholder错误及时间轴遗漏，部署版本未知，不宣称事实全正确。另29长输入/进程专项通过，完整stdin避免ENAMETOOLONG，真实修复后B模型已启动；详见本轮QA记录。 终态汇总见workbench/qa/20261014-source-handoff-ab/REPORT.md；去重工程合计97通过见engineering-final.log。 | 命令：node --test workbench/tests/frontend-handoff-contract.test.mjs workbench/tests/frontend-handoffs.test.mjs workbench/tests/frontend-handoffs-ui.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/development-technical-context.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/generation-recovery.test.mjs workbench/tests/demonstration-generation.test.mjs；退出码：0；测试数量：68；失败数量：0；跳过数量：0；证据：workbench/qa/20261014-source-handoff-ab/engineering.log | node --test workbench/tests/frontend-handoff-contract.test.mjs workbench/tests/frontend-handoffs.test.mjs workbench/tests/frontend-handoffs-ui.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/development-technical-context.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/generation-recovery.test.mjs workbench/tests/demonstration-generation.test.mjs | 0 | 68 | 0 | 0 | workbench/qa/20261014-source-handoff-ab/engineering.log |
| VT-0038-58 | DR-0038-31 | 已确认 | 单元测试通过 | 正式工作台导入/启用与任务冻结上下文接入 | 68项专项通过；dsh实际源码侧导出约232秒，正式UI导入2页面56控件，22来源文件哈希匹配；A无资料与B资料任务已验证冻结。导出抽查有配置页placeholder错误及时间轴遗漏，部署版本未知，不宣称事实全正确。另29长输入/进程专项通过，完整stdin避免ENAMETOOLONG，真实修复后B模型已启动；详见本轮QA记录。 终态汇总见workbench/qa/20261014-source-handoff-ab/REPORT.md；去重工程合计97通过见engineering-final.log。 | 命令：node --test workbench/tests/frontend-handoff-contract.test.mjs workbench/tests/frontend-handoffs.test.mjs workbench/tests/frontend-handoffs-ui.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/development-technical-context.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/generation-recovery.test.mjs workbench/tests/demonstration-generation.test.mjs；退出码：0；测试数量：68；失败数量：0；跳过数量：0；证据：workbench/qa/20261014-source-handoff-ab/engineering.log | node --test workbench/tests/frontend-handoff-contract.test.mjs workbench/tests/frontend-handoffs.test.mjs workbench/tests/frontend-handoffs-ui.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/development-technical-context.test.mjs workbench/tests/development-fast-task.test.mjs workbench/tests/development-locator-hints.test.mjs workbench/tests/generation-recovery.test.mjs workbench/tests/demonstration-generation.test.mjs | 0 | 68 | 0 | 0 | workbench/qa/20261014-source-handoff-ab/engineering.log |
| VT-0038-59 | DR-0038-31 | 已确认 | 未运行 | 研发真实dsh导出及TC-TPL-008/009有无资料对比 | 真实命令、正式实例/任务ID、用例与资料摘要、耗时与失败证据；工程检查不替代真实环境。 | 完整008/009配对未完成：008 A耗时1201492ms无READY；008 B耗时933862ms无READY，三次自测失败证据及正式notes保留；旧009两组用户转向后不再自动排队。独立试验另记workbench/qa/20261014-direct-dsh/REPORT.md：Codex008严格验证4668ms通过；dsh009两轮累计469895ms、56工具调用、7尝试，纠错后严格验证通过；同SHA无模型复跑6203ms通过，0模型调用。独立试验不计入工作台配对成功率；不自动恢复旧批次。 | - | - | - | - | - | - |
| VT-0038-60 | DR-0038-32 | 已确认 | 未运行 | 底座故障反例、共享失效检测与6条原用例同模型A/B | 工程日志、冻结范围与摘要、每轮模型和自测证据、同稿无模型复跑；原始失败/阻塞保留。 | 进行中：workbench/qa/20261014-dsh-foundation-ab/；模板列表接口独立确认HTTP200业务500服务未找到，运行范围须如实反映前置。 | - | - | - | - | - | - |
| VT-0038-61 | DR-0038-33 | 已确认 | 无法运行 | 执行器反例与停止限制、010/014一会话真实生成和第二条事实复用 | 冻结输入、每次源码/结果、模型调用、第一条事实与第二条增量耗时，独立同稿复跑与零主管改稿。 实际边界：工程5项通过，两例真实业务NOT_RUN，dsh会话spawn EPERM，复用收益未验证；见本轮REPORT及Grok会诊。 | 命令：node --test workbench/qa/20261014-dsh-slim-two/verify-evidence.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261014-dsh-slim-two/engineering-checks.log | node --test workbench/qa/20261014-dsh-slim-two/verify-evidence.mjs | 0 | 5 | 0 | 0 | workbench/qa/20261014-dsh-slim-two/engineering-checks.log |
| VT-0038-62 | DR-0038-34 | 已确认 | 测试失败 | 外部执行正常/反例、源码绑定与终态，010/014真实编写与复用 | 请求/响应、源码版本、模型日志、真实结果和独立复跑，保留失败并按停止条件收口 实际结果：3探测通过，010初测及一次自主修复均定位失败，014未运行；证据核对5项通过仅为工程证据，不代表业务成功。原始请求/响应、失败稿和截图见本轮REPORT。 | 命令：node --test workbench/qa/20261014-dsh-file-execution/verify-evidence.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261014-dsh-file-execution/engineering-checks.log | node --test workbench/qa/20261014-dsh-file-execution/verify-evidence.mjs | 0 | 5 | 0 | 0 | workbench/qa/20261014-dsh-file-execution/engineering-checks.log |
| VT-0038-63 | DR-0038-35 | 已确认 | 单元测试通过 | 原生会话续接、幂等/取消/失败证据及正式两批真实测试 | 工程反例与正式4322真实模型证据分开；66工程检查通过，公开过程、失败媒体与同会话续接已核对。真实用例0/2通过：008三次失败后末次超时取消；009一次定位失败，随后目标环境不可达而停止。009首测82.861秒仅为首次自测延迟，不是通过耗时或总体成功率。0主管业务改稿；未增加AI审查/人工确认/强制重复执行。008取消末次无最终截图和trace；009后续稿未复验。原用例文件摘要不变。安装包与干净机未验。见workbench/qa/20261014-native-dsh-integration/REPORT.md和final-round-state.json。 | 命令：node --test workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/native-dsh-workspace-runtime.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs；退出码：0；测试数量：66；失败数量：0；跳过数量：0；证据：workbench/qa/20261014-native-dsh-integration/collected-native-checks-final.log | node --test workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/native-dsh-workspace-runtime.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs | 0 | 66 | 0 | 0 | workbench/qa/20261014-native-dsh-integration/collected-native-checks-final.log |
| VT-0038-64 | DR-0038-36 | 已确认 | 集成测试通过 | 诊断隔离反例与原项目DSH四条修订真实浏览器验证 | 工程反例、正式4322可见分类、原用例不变和实际脚本/录像/trace对照分别记录 | workbench/qa/20261015-dsh-diagnostic-gate/REPORT.md：49工程项通过；原4322真实诊断拒绝/显式诊断不计通过；同项目DSH三批32次执行（24正式、8诊断），四条最终程序通过且本次AI覆盖支持。原用例与历史保全，0主管业务改稿；真人首审与独立反例NOT_RUN，未发布。 全库文档检查因历史状态/混合变更未通过，非专项业务失败，保留日志不改无关历史。 | - | - | - | - | - | - |
| VT-0038-65 | DR-0038-37 | 已确认 | 集成测试通过 | 主控制台原10条DSH脚本/结果/证据显示验收 | 专项工程反例+正式4322真实浏览器脚本/媒体/历史可见+数据保全，禁止新模型或业务执行；本轮补充结果：其余后端6/前端55去重共111工程项；真实4322浏览器10条源码及run SHA一致、截图显示与录像播放、诊断12不计通过，27失败保留；3224历史文件+21业务文件保全通过。见本轮REPORT.md。 | 命令：node --test workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/workspace-merged-view.test.mjs；退出码：0；测试数量：50；失败数量：0；跳过数量：0；证据：workbench/qa/20261015-dsh-main-console/regression.log | node --test workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/workspace-merged-view.test.mjs | 0 | 50 | 0 | 0 | workbench/qa/20261015-dsh-main-console/regression.log |
| VT-0038-66 | DR-0038-38 | 已确认 | 人工待确认 | 原生DSH证据合同与10条冻结脚本真实浏览器复跑 | 原10条在正式4322真实Edge复跑，首批10PASS但001窗口2158ms缺口；001同原稿补跑FAILED（可见模板0<2），最新9PASS/1FAIL。16步原动作/预期一致、每步有可信主实际，316断言实际251已采/65未安全采；最新10整窗与时间线完整。ui-ten-results.json确认10页30媒体，ui-playback-check.json确认007定位/高亮/切换；全屏NOT_VERIFIED。audit.log 355项通过且旧3224run文件/21业务文件不变、12诊断隔离。详见workbench/qa/20261015-native-evidence-replay/REPORT.md；审计通过不等于业务全通过或全部人工验收完成。 | 命令：node workbench/qa/20261015-native-evidence-replay/audit.mjs --verify；退出码：0；测试数量：355；失败数量：0；跳过数量：0；证据：workbench/qa/20261015-native-evidence-replay/audit.log | node workbench/qa/20261015-native-evidence-replay/audit.mjs --verify | 0 | 355 | 0 | 0 | workbench/qa/20261015-native-evidence-replay/audit.log |
| VT-0038-67 | DR-0038-39 | 已确认 | 未运行 | 新10条同项目DSH脚本编写效果与主控制台真实浏览器验证 | 范围TC-TPL-014、016、017、019、020、021、022、024、025、026。保存各条用例/脚本/完整包身份、模型与正式/诊断执行记录、首次落盘观测时间/首自测/总耗时、首次与最终业务结果；以新10条为固定分母，024无授权园区单列前置阻塞。完成后真实4322逐条核对脚本正文/结果/证据，保持v77原10条和失败历史；未完成不形成通过结论。 | 准备阶段未完成：两次正式提交均0run/0event，原10条与v77结论保持；第二次RUNNING/finished_at矛盾见pre-restart-preparation-failure.json。QA副本并发rename复现15/16已尝试写入EPERM；协调后8读一轮+20写6.312s全成功，持续8读15s仅6写完成、0错误、14未完成，不能宣称性能提升。manager/reruns/console最终39/39见preparation-io-fix-tests.log，前端31/31通过；属于工程修复证据。旧shutdown拒绝后监督进程退出，旧PID核对与孤儿锁保全已完成；启动器CheckOnly通过，但实际冷启动被自动审批阻止，等待用户执行restore-formal-workbench.ps1恢复原4322。尚未正式重验修复或产生新10条业务结果/速度/可见性结论。全部路径位于workbench/qa/20261015-native-next10，见REPORT.md。 恢复前metrics快照为IN_PROGRESS：新0formal/0诊断/0冻结稿，024为BLOCKED_PRECONDITION、其余9NOT_RUN；原10case/原6tasks/来源包未变，工作区19/19原脚本公共库等未变。证据为pre-startup-recovery-metrics.json与original-workspace-preservation-before-recovery.json；当前0/10不是已完成实验的业务通过率。 | - | - | - | - | - | - |
| VT-0038-68 | DR-0038-40 | 已确认 | 单元测试通过 | 启动配置在实际启动进程内显式准备与回读 | fixture验证false到true、字段保全、幂等、CheckOnly无写、失败阻断；不写真实AppData，不启动服务或模型。 本轮边界：PS7与WinPS5配置fixture及启动只读检查；未写真实AppData、未启动正式服务；独立代码复审未发现阻断。 后续正式验收：用户执行修复后的恢复命令成功启动原4322，源码与数据目录身份核对通过；实际服务进程原生DSH另报NATIVE_DSH_MODEL_CREDENTIAL_REQUIRED。见workbench/qa/20261015-formal-view-check/REPORT.md；当前结构化证据仍保留上述13项工程原始结果。 | 命令：node --test workbench/tests/model-config.test.mjs workbench/tests/start-config.test.mjs；退出码：0；测试数量：13；失败数量：0；跳过数量：0；证据：workbench/qa/20261015-native-next10/model-config-tests-final.log | node --test workbench/tests/model-config.test.mjs workbench/tests/start-config.test.mjs | 0 | 13 | 0 | 0 | workbench/qa/20261015-native-next10/model-config-tests-final.log |
| VT-0038-69 | DR-0038-41 | 已确认 | 单元测试通过 | 已授权任务内非执行稿件和前置阻塞独立登记及展示 | 已建立任务fixture覆盖授权/幂等/路径依赖/版本/并发/取消/损坏/转义及blocked稿可见且0run0pass0诊断；模型、浏览器、执行器调用均应未发生。 本轮边界：稿件授权、快照依赖、幂等、取消/执行互斥、同时间新旧稿排序、裸run文件ID隔离、篡改拒绝及UI过滤/转义；模型/浏览器/执行器拒绝调用的非执行fixture。真实DSH登记与正式4322界面未验。 后续正式验收：原10脚本/16步/30媒体可查看，9通过1失败与12诊断隔离保持；正式数据0登记稿件，不能据此宣称真实DSH登记或未执行稿件样本已验。见workbench/qa/20261015-formal-view-check/REPORT.md。 | 命令：node --test workbench/tests/native-dsh-drafts.test.mjs workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-reruns.test.mjs workbench/tests/native-dsh-console.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/project-workflow-view.test.mjs；退出码：0；测试数量：115；失败数量：0；跳过数量：0；证据：workbench/qa/20261015-dsh-workbench-repair/drafts-tests.log | node --test workbench/tests/native-dsh-drafts.test.mjs workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-reruns.test.mjs workbench/tests/native-dsh-console.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/project-workflow-view.test.mjs | 0 | 115 | 0 | 0 | workbench/qa/20261015-dsh-workbench-repair/drafts-tests.log |
| VT-0038-70 | DR-0038-42 | 已确认 | 集成测试通过 | 整窗帧转发与业务worker同步计算解耦 | 同机真实浏览器工程样例记录改前后采集间隙/帧数/退出清理；无云平台或模型调用、无影子工作台；工程样例不代替正式4322业务验收。 本轮边界：本机工程Edge和冻结复跑fixture；20/20录制单测另见专项报告。相同2600ms同步忙循环最大间隙2652→151ms，39实帧完整播放，无丢帧；不是正式4322或原001业务成功路径复验。 后续正式验收：旧007整窗录像播放到30.8秒结尾并验证步骤定位，旧30媒体均能加载；未重新录制，不代表新帧管道在云平台业务中复验通过。见workbench/qa/20261015-formal-view-check/REPORT.md。 | 命令：node --test --test-name-pattern="real local fixture" workbench/tests/native-dsh-evidence.test.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261015-window-pipe/native-fixture-tests.log | node --test --test-name-pattern="real local fixture" workbench/tests/native-dsh-evidence.test.mjs | 0 | 1 | 0 | 0 | workbench/qa/20261015-window-pipe/native-fixture-tests.log |
| VT-0038-71 | DR-0038-43 | 已确认 | 集成测试通过 | 凭据文件跨启动进程视图一致与原生共享来源 | 保留process/显式DSH_HOME优先级；DPAPI稳定用户目录优先，仅不存在时兼容旧目录；失败不换源；密钥不入日志，当前已有密文仅复制且不覆盖；实际正式model_available与native运行时可用，真实DSH登记成功；健康接口未直接暴露credential_source。共享凭据8项、路径11项、入口6项、重启22项分组日志及安全密文迁移见workbench/qa/20261016-native-draft-registration/REPORT.md。 | 命令：node --test workbench/tests/native-dsh-runtime.test.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-native-draft-registration/native-runtime-tests.log | node --test workbench/tests/native-dsh-runtime.test.mjs | 0 | 8 | 0 | 0 | workbench/qa/20261016-native-draft-registration/native-runtime-tests.log |
| VT-0038-72 | DR-0038-44 | 已确认 | 集成测试通过 | 仅登记现有稿件的受控任务与正式可见性 | 正式4322真实Edge提交本地合成UI-WO-04 v2的原稿登记，13.477秒完成；主控可展开并载入冻结正文，页面正文SHA与原稿一致，稿件NOT_RUN/NOT_CAPTURED/counts=false，无新run；96项工程检查及本轮REPORT.md、local-browser-proof.json和截图另证。用户追加本地范围前发生001无执行登记，单列而不冒充合成用例。未测试新业务生成速度、业务成功率或发布。 | 命令：node workbench/qa/20261016-native-draft-registration/local-synthetic-audit.mjs --verify；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-native-draft-registration/local-synthetic-preservation-after.json | node workbench/qa/20261016-native-draft-registration/local-synthetic-audit.mjs --verify | 0 | 0 | 0 | 0 | workbench/qa/20261016-native-draft-registration/local-synthetic-preservation-after.json |
| VT-0038-73 | DR-0038-45 | 已确认 | 人工待确认 | 六条执行与接入限定验证完成；人工操作体验未达标，不签发整体通过 | 正式4322真实Edge：六条本轮正文SHA与执行快照一致、24步实际、18视频加载，01整窗实播结尾/步骤定位。DSH两任务同会话327/327帧可读；首次5/6，最新6/6；9正式=6PASS+3ERROR，3诊断/旧NOT_RUN稿不计通过。488断言213有安全实际、275缺失；COMPLETE仅为每步和媒体门槛。8项工程回归通过，原152文件及16空间保全，0新增空间遗留。报告含6张关键截图；业务首审/独立反例/真人全屏未验，人工体验未达标。详见workbench/qa/20261016-native-local-six/REPORT.md和内嵌截图HTML；报告整页file预览被浏览器策略拒绝，截图逐张检查，不冒充整页渲染验收。 | 命令：node workbench/qa/20261016-native-local-six/verify-final.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-native-local-six/verification-final.log | node workbench/qa/20261016-native-local-six/verify-final.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261016-native-local-six/verification-final.log |
| VT-0038-74 | DR-0038-46 | 已确认 | 集成测试通过 | 实际值、入口和摘要三项修复及六原稿复跑限定验证；非整体人工体验或发布批准 | 正式4322原数据配置、真实Edge：6原包6/6通过，0模型、0业务生成/改稿；127.475秒，24步，488/488步骤内断言实际（213原实参/结果＋275 AFTER_MATCHER DOM观测），18媒体切换播放、06整窗实播结尾及步骤2定位。默认旧播放器0、旧选择器均在折叠历史区；生成入口直达DSH，原稿复跑不误标生成。88工程项通过。原3任务278文件、7业务源、16空间保持，238新源/证据字节核对，0新增空间遗留；6张关键截图见workbench/qa/20261016-native-six-repair/REPORT.md。未归属准备观测不计步骤，诊断与未执行稿不计通过；独立反例/真人首审/发布未验，整窗固定视口空白及原速较快保留，不称整体体验通过。 | 命令：node workbench/qa/20261016-native-six-repair/verify-final.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-native-six-repair/verification-final.log | node workbench/qa/20261016-native-six-repair/verify-final.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261016-native-six-repair/verification-final.log |
| VT-0038-75 | DR-0038-47 | 已确认 | 集成测试通过 | 六原稿随包往返导入可见、SHA保持且NOT_RUN/零通过，兼容和拒绝反例 | v83完成携带/登记/查看/再导出的限定验证：原生DSH六前端稿随JSON真实浏览器导入，6正文SHA与50冻结文件引用保持；重复导入0新增，6 NOT_RUN/0通过，原458文件保全，120工程项通过。导入稿直接复跑未接通、历史后端/旧候选迁移未覆盖，非整体发布。 正式4322原配置数据，真实Edge下载文件及Chromium上传/预览/确认，6稿正文逐份真实加载。含截图报告workbench/qa/20261016-script-package/REPORT.md；Excel仅工程往返，无新模型或业务执行。 | 命令：node workbench/qa/20261016-script-package/verify.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-script-package/verification.log | node workbench/qa/20261016-script-package/verify.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261016-script-package/verification.log |
| VT-0038-76 | DR-0038-48 | 已确认 | 集成测试通过 | 导入六稿零模型直接复跑、完整证据、状态隔离与源保全。正式4322真实浏览器最终6/6通过，121.105秒，24步/488实际/18媒体；首批证据不完整历史保留，总12次执行。114工程项单独计数，6份NOT_RUN登记与诊断不计通过。 | 原六业务稿不改写；目标项目环境独立绑定并确认；六脚本正文SHA和完整包逐字节核对，六份源内容/24步预期实际/18媒体由真实浏览器确认，06整窗步骤定位及播至结尾；475基线和182首批文件保持。报告：workbench/qa/20261016-imported-six-rerun/REPORT.md。人工首审、云平台及整体发布未验收。 | 命令：node workbench/qa/20261016-imported-six-rerun/verify-final.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-imported-six-rerun/verification-final.log | node workbench/qa/20261016-imported-six-rerun/verify-final.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261016-imported-six-rerun/verification-final.log |
| VT-0038-77 | DR-0038-49 | 已确认 | 集成测试通过 | 受管原生DSH安装/路径持久化/启动及版本文件范围、原六稿真实浏览器复验 | v85两个P1完成本机限定修复验证：原生DSH0.2.0-rc.2在workbench/native独立锁定安装，初始化持久化受管路径且其他配置/试跑字节保持；原4322受控重启后实际使用受管包，版本0.1.0-native.20261016.1与加载源码一致。完整便携候选57378文件逐字节及离线doctor核验，源范围308项，程序候选与本轮差异分开冻结，未清理其他未提交改动。55个唯一工程项最终通过，初始失败/修复复验日志保留。六原稿一批6/6通过，119.765秒，24步/488实际/18媒体真实浏览器可看，整窗定位及播至结尾；845文件和前两批保持，6 NOT_RUN登记/诊断不计通过，0模型/业务改稿。第二电脑、独立首审及整体发布未验，P2/P3文档门禁不在本轮修复范围。 报告与关键截图：workbench/qa/20261016-native-runtime-delivery/REPORT.md；delivery-scope.json/this-task.patch给出本轮基线差异，完整ZIP与source-manifest绑定版本及SHA，公开授权策略生成差异明示。 | 命令：node workbench/qa/20261016-native-runtime-delivery/audit.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-native-runtime-delivery/audit-final.log | node workbench/qa/20261016-native-runtime-delivery/audit.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261016-native-runtime-delivery/audit-final.log |
| VT-0038-78 | DR-0038-50 | 已确认 | 集成测试通过 | 六项门禁修复反例、历史保全、完整交付检查与正式4322六原稿复跑 | v86六项交付工具修复与限定复验完成：显式范围/冻结基线、测试失败状态、按执行行/证据块校验；35项定向检查通过，历史成绩与既有改动保留。复测前正式交付检查exit0；原4322同六原稿一批6/6、123.025秒、0模型，24步/488实际/18媒体可看，06整窗定位及结尾核对，1033原文件/前三批任务不变；6未执行登记及诊断不计通过。最终门禁结论见本轮delivery_evidence和日志；未发布、第二电脑及独立首审未验。 报告及五张关键截图：workbench/qa/20261016-delivery-gates/REPORT.md。 | 命令：node --test workbench/qa/20261016-delivery-gates/audit.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261016-delivery-gates/audit-before-closeout.log | node --test workbench/qa/20261016-delivery-gates/audit.mjs | 0 | 1 | 0 | 0 | workbench/qa/20261016-delivery-gates/audit-before-closeout.log |
| VT-0038-79 | DR-0038-51 | 已确认 | 集成测试通过 | 作用域/摘要等价与篡改反例，真实浏览器点击耗时对比 | 仅当前修复、当前4322与原数据的日志和真实浏览器截图；不计业务运行通过 | 原4322真实Edge点击7563→1932ms各1样本；3次API中位数5963→用例摘要685ms，原完整响应逐字节一致；engineering-recovery-final.log工程46/46，页面证据见REPORT，冷启动当前未通过。 | - | - | - | - | - | - |
| VT-0038-80 | DR-0038-51 | 已确认 | 集成测试通过 | 启动单实例及未知占用保护、分段耗时与真实快捷方式验收 | 真实PS5桌面原快捷方式同时两次启动，17198ms，1服务、原配置/数据、DSH可用；历史PS5启动失败及BOM读取器首次失败均保留。旧29.314秒为重叠启动日志近似值，不是严格A/B。 | 命令：node --test workbench/qa/20261019-performance-repair/desktop-result.test.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261019-performance-repair/oct20-desktop-result.log | node --test workbench/qa/20261019-performance-repair/desktop-result.test.mjs | 0 | 1 | 0 | 0 | workbench/qa/20261019-performance-repair/oct20-desktop-result.log |
| VT-0038-81 | DR-0038-51 | 已确认 | 集成测试通过 | 失效/活动/损坏锁反例，脚本与结果证据可读及原文件哈希保全 | 仅当前修复、当前4322与原数据的日志和真实浏览器截图；不计业务运行通过 | 停止前原4322受控加载后的DSH由HOME_BUSY恢复RUNNING；活动/损坏/失效/并发锁工程检查通过。正式只读3项审计及真实Edge查看旧六稿24步骤/488实际/18媒体通过，历史失败和NOT_RUN不变；7857原持久化文件保全。非新增业务通过，当前服务停机不覆盖之前验收事实。 | - | - | - | - | - | - |
| VT-0038-82 | DR-0038-52 | 已确认 | 集成测试通过 | 双视图基线保全、左右同步回放及真实桌面冷启动 | 原4322当前源码/配置/数据、完整历史响应逐字节及六原稿旧证据只读审计；7857文件保全另见oct20-preservation.log；真实Edge布局/原脚本5573字/整窗播放至2.5s及失败/NOT_RUN见oct20-browser-verification.json。最终交付检查另以delivery_evidence实际命令结果为准。 | 命令：node --test workbench/qa/20261019-performance-repair/oct20-audit.mjs；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：workbench/qa/20261019-performance-repair/oct20-formal-audit.log | node --test workbench/qa/20261019-performance-repair/oct20-audit.mjs | 0 | 3 | 0 | 0 | workbench/qa/20261019-performance-repair/oct20-formal-audit.log |
| VT-0038-83 | DR-0038-53 | 已确认 | 测试失败 | 从桌面启动至用例和脚本导出回导的真实模型端到端流程 | v89真实模型完整流程限定测试完成：桌面冷启动16.982 秒，原4322/配置/数据保持；真实模型两轮设计10条59步、Excel回导一致；DSH在同一任务795.372 秒独立编写及自修后10/10正式通过且证据完整，首次证据完整5/10。原稿无模型复跑9/10（MAT-002等待竞态失败）、回导原稿无模型复跑10/10但仅9/10证据完整（MAT-005整窗异常），脚本/文件包SHA保持。工程全量1117项中5失败保留，不宣称交付全绿或发布；诊断与10份未执行登记不计通过。 全量工程5失败如实保留，限定只读审计成功不替代全量失败；详细业务执行/证据/回导结论见本轮REPORT。 | 命令：npm --prefix workbench test；退出码：1；测试数量：1117；失败数量：5；跳过数量：0；证据：workbench/qa/20261020-full-model-acceptance/engineering-full.log | npm --prefix workbench test | 1 | 1117 | 5 | 0 | workbench/qa/20261020-full-model-acceptance/engineering-full.log |
| VT-0038-84 | DR-0038-54 | 已确认 | 集成测试通过 | 固定全量、原4322同十稿及导出回导复跑与历史保全 | v90限定修复完成：DSH自行修订原十稿，原项目零模型10/10通过及证据完整（280.143秒），导出回导同稿10/10完整（266.464秒），两组各59步/143实际值。步骤契约执行前检查、按钮状态实际采集、原范围导航、录制窗口保护及有界恢复已加载原4322；真实最小化故障注入通过。固定工程全量1119通过/0失败/0跳过；旧业务/工程失败及本轮3条自测证据缺口保留，不改成绩。配置/数据根、旧用例、稿件和媒体保全，首审/独立反例/云平台/发布未验。 四项独立审计不替代工程1119项或真实浏览器业务执行；详见REPORT与各阶段日志/截图。 | 命令：node workbench/qa/20261020-p1-repair/acceptance.mjs final-audit；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20261020-p1-repair/acceptance-final-audit.log | node workbench/qa/20261020-p1-repair/acceptance.mjs final-audit | 0 | 4 | 0 | 0 | workbench/qa/20261020-p1-repair/acceptance-final-audit.log |
| VT-0038-85 | DR-0038-55 | 已确认 | 集成测试通过 | 同十稿独立13反例及正常前后对照 | 13变异均需指定步骤业务断言真实预期/实际差异、原稿SHA相同、非运行异常；正常两轮各10完整，截图及媒体可读；历史不改 | 命令：node workbench/qa/20261020-independent-counterexamples/acceptance.mjs final；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20261020-independent-counterexamples/acceptance-final.log | node workbench/qa/20261020-independent-counterexamples/acceptance.mjs final | 0 | 4 | 0 | 0 | workbench/qa/20261020-independent-counterexamples/acceptance-final.log |
| VT-0038-86 | DR-0038-56 | 已确认 | 集成测试通过 | 全量分批及登录恢复、取消、版本环境漂移与入口可见 | 41条一次提交按20/20/1同会话，失败保留、取消及漂移不启动后续，缺登录无空任务；真实页面按钮无遮挡并一次提交63条 | 命令：node --test --test-concurrency=1 workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/native-dsh-registration-mode.test.mjs workbench/tests/project-workflow-view.test.mjs；退出码：0；测试数量：96；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-electricity-full/engineering-batches.log | node --test --test-concurrency=1 workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/native-dsh-registration-mode.test.mjs workbench/tests/project-workflow-view.test.mjs | 0 | 96 | 0 | 0 | workbench/qa/20261022-electricity-full/engineering-batches.log |
| VT-0038-87 | DR-0038-56 | 已确认 | 人工待确认 | 原始78条真实电价全量验证 | 原稿来源与正文不变，15条歧义待确认；63条每条真实执行或阻塞解释，旧任务与媒体不改，关键截图 | final-metrics-verified.json：原78条中最新34运行通过/7失败/22未执行阻塞/15待澄清。4次真实模型批调用，85分41秒；41条最新技术证据完整，未完成全量业务首审或独立反例，不改为全通过。 | - | - | - | - | - | - |
| VT-0038-88 | DR-0038-57 | 已确认 | 集成测试通过 | 重复生成入口恢复原任务 | 活动对话恢复与并发创建保护、草稿和项目隔离工程反例；正式4322重复进入仍同任务ID且不新增模型调用 | 命令：node workbench/qa/20261022-electricity-full/acceptance.mjs checked；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-electricity-full/acceptance-checked.log | node workbench/qa/20261022-electricity-full/acceptance.mjs checked | 0 | 5 | 0 | 0 | workbench/qa/20261022-electricity-full/acceptance-checked.log |
| VT-0038-89 | DR-0038-58 | 已确认 | 集成测试通过 | 模板字段、导航示例及正式下载回传 | 真实浏览器下载文件SHA与产物一致，主表0候选、层级自动识别，示例不入库，动作/预期对齐及下拉和冻结表头检查 | 命令：node workbench/qa/20261022-electricity-full/acceptance.mjs checked；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-electricity-full/acceptance-checked.log | node workbench/qa/20261022-electricity-full/acceptance.mjs checked | 0 | 5 | 0 | 0 | workbench/qa/20261022-electricity-full/acceptance-checked.log |
| VT-0038-90 | DR-0038-59 | 已确认 | 单元测试通过 | 完整工程回归、挂起定位及必要夹具/运行器修复 | 实际工程/安装/正式浏览器结果，历史业务成绩不变，限制如实列出 | 命令：node workbench/scripts/run-unit-checks.mjs；退出码：0；测试数量：1237；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-delivery-readiness/engineering-final.log | node workbench/scripts/run-unit-checks.mjs | 0 | 1237 | 0 | 0 | workbench/qa/20261022-delivery-readiness/engineering-final.log |
| VT-0038-91 | DR-0038-59 | 已确认 | 集成测试通过 | 交付依赖本地化、模板随包及当前版本/精确候选验证 | 实际工程/安装/正式浏览器结果，历史业务成绩不变，限制如实列出 | 命令：node --test workbench/qa/20261022-delivery-readiness/verify-artifacts.mjs；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-delivery-readiness/artifact-check-r2.log | node --test workbench/qa/20261022-delivery-readiness/verify-artifacts.mjs | 0 | 4 | 0 | 0 | workbench/qa/20261022-delivery-readiness/artifact-check-r2.log |
| VT-0038-92 | DR-0038-59 | 已确认 | 无法运行 | 独立目录安装诊断和原4322真实浏览器交付主流程验收 | 实际工程/安装/正式浏览器结果，历史业务成绩不变，限制如实列出 | 命令：node workbench/qa/20261022-delivery-readiness/check-formal.mjs；退出码：1；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-delivery-readiness/formal-healthcheck.log | node workbench/qa/20261022-delivery-readiness/check-formal.mjs | 1 | 0 | 0 | 0 | workbench/qa/20261022-delivery-readiness/formal-healthcheck.log |
| VT-0038-93 | DR-0038-60 | 已确认 | 单元测试通过 | 启动时限一致性、阶段诊断及超时反例工程验证 | 只证明工程预算包含关系、脱敏阶段日志及限时失败清理；实际原4322启动瓶颈及冷启动后耗时未验证。 | 命令：node --test workbench/tests/startup-budget.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/native-dsh-runtime.test.mjs；退出码：0；测试数量：23；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-startup-security/startup-unit.log | node --test workbench/tests/startup-budget.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/native-dsh-runtime.test.mjs | 0 | 23 | 0 | 0 | workbench/qa/20261022-startup-security/startup-unit.log |
| VT-0038-94 | DR-0038-60 | 已确认 | 集成测试通过 | 传递依赖安全修复、实际协议与安装回归 | 实际本机MCP会话、跨源重定向拒绝、有效/异常ZIP64及图像渲染；四组独立安装已完成，不等于DSH真实模型验收。 | 命令：node --test workbench/tests/dependency-security.test.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-startup-security/security-unit-zip64.log | node --test workbench/tests/dependency-security.test.mjs | 0 | 6 | 0 | 0 | workbench/qa/20261022-startup-security/security-unit-zip64.log |
| VT-0038-95 | DR-0038-60 | 已确认 | 无法运行 | 完整工程、候选归档和正式4322交付边界复核 | 工程1249/1249、四组独立锁定安装与321文件包核对已完成；原4322不可达、启动审批阻塞，加载后真实浏览器/模型验收NOT_RUN。 首次交付收集器在基线核验返回1并保留：同一历史source_cases.txt随父进程读取上下文变化，Node及其子Python结果与冻结基线一致、直接Python不同；具体系统机制未确定。保持原基线、历史文件与规则，在冻结基线相同上下文复核，最终以本轮交付证据和实际收集日志为准；正式4322及整体验收仍未完成。 | 命令：node workbench/qa/20261022-startup-security/check-formal.mjs；退出码：1；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-startup-security/formal-healthcheck.log | node workbench/qa/20261022-startup-security/check-formal.mjs | 1 | 0 | 0 | 0 | workbench/qa/20261022-startup-security/formal-healthcheck.log |
| VT-0038-96 | DR-0038-61 | 已确认 | 集成测试通过 | 录像全屏/放大/像素缩放及退出恢复 | 工程浏览器27项含真实元素系统全屏、拒绝/不支持回退、原始像素缩放；recorded-player-check.json记录历史真实视频1942×1150、位置/倍速/FAILED不变。正式4322另记NOT_RUN。 | 命令：node --test workbench/tests/window-recording-view.test.mjs workbench/tests/native-evidence-view.test.mjs；退出码：0；测试数量：27；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-startup-security/player-unit.log | node --test workbench/tests/window-recording-view.test.mjs workbench/tests/native-evidence-view.test.mjs | 0 | 27 | 0 | 0 | workbench/qa/20261022-startup-security/player-unit.log |
| VT-0038-97 | DR-0038-59 | 已确认 | 集成测试通过 | 真实工程回归暴露的整窗最小化恢复瞬态修复 | 既有最小化故障注入实际恢复、完整帧和不重置时间轴；不可恢复状态仍拒绝完整 | 命令：node workbench/scripts/run-unit-checks.mjs；退出码：0；测试数量：1249；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-startup-security/engineering-recorder-fixed.log | node workbench/scripts/run-unit-checks.mjs | 0 | 1249 | 0 | 0 | workbench/qa/20261022-startup-security/engineering-recorder-fixed.log |
| VT-0038-98 | DR-0038-62 | 已确认 | 集成测试通过 | 启动拒绝边界、原4322前台恢复和桌面冷启动验收 | 实际原始工具与CUA/桌面执行证据见本轮REPORT；此命令只核对六组证据、同源包和保全事实，共用6项不累加。仅本机限定验收；系统物理Esc未验、模型只读不计业务通过、干净Windows/业务首审/电价完整验收未完成。 | 命令：node --test workbench/qa/20261022-final-delivery/verify-final.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-final-delivery/delivery-verify.log | node --test workbench/qa/20261022-final-delivery/verify-final.mjs | 0 | 6 | 0 | 0 | workbench/qa/20261022-final-delivery/delivery-verify.log |
| VT-0038-99 | DR-0038-62 | 已确认 | 集成测试通过 | 正式Edge录像与真实DSH模型验收、历史保全和交付问题清单 | 实际原始工具与CUA/桌面执行证据见本轮REPORT；此命令只核对六组证据、同源包和保全事实，共用6项不累加。仅本机限定验收；系统物理Esc未验、模型只读不计业务通过、干净Windows/业务首审/电价完整验收未完成。 | 命令：node --test workbench/qa/20261022-final-delivery/verify-final.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-final-delivery/delivery-verify.log | node --test workbench/qa/20261022-final-delivery/verify-final.mjs | 0 | 6 | 0 | 0 | workbench/qa/20261022-final-delivery/delivery-verify.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：npm --prefix workbench test（工程执行结果、退出码、数量及日志摘要见delivery_evidence.md；完整产品VT仍按下表分别验收）
- 命令：node workbench/scripts/verify-official-workbench.mjs --output workbench/qa/20260926-req0038-completion/official-current.json
- 命令：正式4322浏览器操作与completion下有范围的API验收脚本，目标4401仅为被测服务
- 命令：node --test tests/model-transport.test.mjs tests/core.test.mjs tests/telemetry.test.mjs tests/diagnostic-profile.test.mjs workbench/tests/requirements-model.test.mjs（v22输出额度修复定向67项，不替代候选语义评审）
- 命令：node workbench/qa/20260928-case-design/adjudicate.mjs（正式4322只读核对生成记录、来源版本、确认导出绑定与原项目保全，exit0）
- 命令：node workbench/qa/20260928-case-quality-gate/adjudicate.mjs（同期实际9请求/阶段/来源/参数/旧历史独立核对，exit0；修复后非AB另列）
- 命令：node --test --test-concurrency=1 workbench/tests/project-target-access.test.mjs workbench/tests/development-network-failure.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/execution-list.test.mjs（v26最终定向检查，实际结果见delivery_evidence.md与final-engineering.log）
- 命令：node --test workbench/qa/20260930-human-remediation/execution-ux/preservation-final.test.mjs workbench/qa/20260930-human-remediation/official-outcomes-final.test.mjs（本轮实际只读408/408 exit0）
- 命令：node workbench/qa/20261001-full-acceptance/verify-namespace-faults.mjs（原4322冻结计划实际故障/清理验收，exit0）
- 命令：python -X utf8 workbench/qa/20261001-full-acceptance/validate-acceptance-records.py（本轮只读台账一致性验证，exit0）
- 命令：npm --prefix workbench test（本轮最终collector实际执行，计数/退出码见unit-final.log与delivery_evidence.md，不叠加历史或定向计数）
- 命令：node --test workbench/tests/execution-ux.test.mjs workbench/tests/batch-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/generation-progress.test.mjs workbench/tests/requirements-view.test.mjs workbench/tests/feedback-view.test.mjs workbench/tests/execution-notes.test.mjs workbench/tests/demonstration-route-guard.test.mjs workbench/tests/backend-view.test.mjs
- 命令：node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/requirements-view.test.mjs workbench/tests/bindings-navigation.test.mjs workbench/tests/report-navigation.test.mjs workbench/tests/reports.test.mjs workbench/tests/authorization-navigation.test.mjs workbench/tests/backend-harness-startup-cleanup.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/quality-review-mode.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/execution-notes-entry.test.mjs workbench/tests/execution-notes.test.mjs
- 命令：node --import ./workbench/qa/20261008-full-functional/engineering/readonly-engineering-guard.mjs --test workbench/tests/backend-case-stages.test.mjs workbench/tests/backend-namespace-prefix.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-manager.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/requirements-model.test.mjs workbench/tests/backend-harness-contract.test.mjs workbench/tests/backend-quality-loop.test.mjs workbench/tests/candidate-quality-review.test.mjs workbench/tests/backend-record-assertion.test.mjs
- 命令：node --test workbench/qa/20261008-cloud-optimization/verify-delivery.test.mjs
- 命令：node --test workbench/qa/20261009-generation-recovery/verify-acceptance.mjs
- 命令：node workbench/qa/20261009-generation-recovery/verify-live-ui.mjs
- 命令：node --test --test-concurrency=1 workbench/tests/candidate-quality-review.test.mjs
- 命令：node workbench/qa/20261011-real-model-acceptance/backend-confirm-ui.mjs confirm --root-approved --reviewer=<负责人>
- 命令：node workbench/qa/20261011-real-model-acceptance/run-available.mjs start-ui --root-approved
- 命令：node workbench/qa/20261011-real-model-acceptance/verify-available.mjs verify
- 命令：node workbench/qa/20261011-real-model-acceptance/preservation.mjs
- 命令：node --test workbench/qa/20261013-fast-generation/verify-live.test.mjs
- 命令：node workbench/qa/20261015-native-evidence-replay/audit.mjs --verify（正式4322只读审计355/355，exit0；业务与交互结果另见本轮REPORT.md）
- 命令：node workbench/qa/20261016-native-local-six/verify-final.mjs（只读核对六条本轮证据/冻结源/UI保存事实，exit0；不执行新模型或业务）
- 命令：node --test --test-concurrency=1 workbench/tests/native-locator-observation.test.mjs workbench/tests/native-evidence-view.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs（80通过，view-tests-final.log）
- 命令：node --test --test-concurrency=1 workbench/tests/native-dsh-evidence.test.mjs workbench/tests/native-evidence-plugin.test.mjs（8通过，evidence-tests.log）
- 命令：node workbench/qa/20261016-native-six-repair/verify-final.mjs（只读限定复核，不执行新模型或业务）
- 命令：node --test --test-concurrency=1 workbench/tests/case-script-package.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-csv-import.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/native-dsh-manager.test.mjs workbench/tests/native-dsh-ui-routes.test.mjs workbench/tests/project-workflow-view.test.mjs（120项通过，tests-final.log）
- 命令：node workbench/qa/20261016-script-package/verify.mjs（只读核对现有数据，不执行模型或业务）
- 命令：node --test --test-concurrency=1 workbench/tests/native-imported-reruns.test.mjs workbench/tests/native-dsh-reruns.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/case-script-package.test.mjs workbench/tests/native-evidence-view.test.mjs workbench/tests/native-dsh-evidence.test.mjs workbench/tests/native-evidence-plugin.test.mjs workbench/tests/window-recorder.test.mjs workbench/tests/window-timeline.test.mjs（114通过/0失败/0跳过，workbench/qa/20261016-imported-six-rerun/engineering-with-evidence-fix.log；工程证据）
- 命令：node workbench/qa/20261016-imported-six-rerun/verify-final.mjs（只读限定复核，不执行模型或业务）
- 命令：npm ci --omit=dev --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org（cwd=workbench/native，按锁重建；native-install-clean.log）
- 命令：node --test --test-concurrency=1 workbench/tests/native-install-delivery.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/start-config.test.mjs workbench/tests/model-config.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/license-runtime-identity.test.mjs workbench/tests/native-imported-reruns.test.mjs workbench/tests/native-dsh-evidence.test.mjs（55项含首轮1失败；受影响17项和运行时7项复验均通过，日志保留，不合计成72个不同测试）
- 命令：node workbench/qa/20261016-native-runtime-delivery/audit.mjs（只读审计，exit0，无模型或业务执行）
- 命令：node workbench/qa/20261016-native-runtime-delivery/verify-final.mjs（最终只读收口复核）
- 命令：python -B -X utf8 scripts/test_ai_context_delivery.py；node --test workbench/qa/20261016-delivery-gates/audit.mjs；原4322真实浏览器同六稿零模型复验；最终sync/collector/checker实际日志见本轮REPORT。
- 命令：v87: node --test workbench/tests/native-dsh-console.test.mjs workbench/tests/native-console-view.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/native-dsh-host-lock.test.mjs workbench/tests/start-config.test.mjs workbench/tests/supervisor-reliability.test.mjs（工程46/46通过；冷启动实际失败与恢复审批阻断独立保留，详见20261019-performance-repair/REPORT.md）
- 环境：唯一4322工作台、原启动器/配置及fresh25-b数据根
- 环境：合成A复杂UI与B真实HTTP台账目标；没有客户真实项目
- 环境：v26本机云平台原Vue组件/原Java模板20源码/MySQL合成租户；外置静态入口3100与网关18080，唯一工作台4322。完整微服务/真实登录权限未接入。
- 环境：v32仍唯一4322，原fresh25-b/config保留；原合成图书4462与外置只读响应头代理4463为被测服务，非旁路工作台。
- 环境：v47唯一正式4322、原fresh25-b及配置保持；原云平台本地切片3100/18080/19041/MySQL13306为被测对象，合成租户非生产身份。
- 环境：v49正式4322原fresh25-b及配置；4460巡检工单公开合成目标，非第二工作台。
- 环境：v77唯一正式4322、原fresh25-b与电价管理从零10条项目；真实Edge复跑原冻结包，0模型生成/修订、0业务改稿。
- 环境：v81唯一正式4322原fresh25-b，复用巡检工单项目的6条UI v2；4460为本地公开合成被测服务；云平台暂停，业务脚本均由DSH编写。
- 环境：v84唯一正式4322原启动配置及fresh25-b；刚导入六稿项目project-f2e576ca-7d7f-45d3-9037-3acfdd812316绑定本地合成4460/inspection/，无认证；真实有界Edge执行，原导入v1完整包不改写。
- 环境：v85原正式4322、原fresh25-b/配置与本地4460；目标project-f2e576ca-7d7f-45d3-9037-3acfdd812316。工程内原生0.2.0-rc.2；0.1.0-native.20261016.1完整候选仅离线校验，未启动副本，未执行云平台或模型生成。

## 结论

- v
- 8
- 5
- 两
- 个
- P
- 1
- 完
- 成
- 本
- 机
- 限
- 定
- 修
- 复
- 验
- 证
- ：
- 原
- 生
- D
- S
- H
- 0
- .
- 2
- .
- 0
- -
- r
- c
- .
- 2
- 在
- w
- o
- r
- k
- b
- e
- n
- c
- h
- /
- n
- a
- t
- i
- v
- e
- 独
- 立
- 锁
- 定
- 安
- 装
- ，
- 初
- 始
- 化
- 持
- 久
- 化
- 受
- 管
- 路
- 径
- 且
- 其
- 他
- 配
- 置
- /
- 试
- 跑
- 字
- 节
- 保
- 持
- ；
- 原
- 4
- 3
- 2
- 2
- 受
- 控
- 重
- 启
- 后
- 实
- 际
- 使
- 用
- 受
- 管
- 包
- ，
- 版
- 本
- 0
- .
- 1
- .
- 0
- -
- n
- a
- t
- i
- v
- e
- .
- 2
- 0
- 2
- 6
- 1
- 0
- 1
- 6
- .
- 1
- 与
- 加
- 载
- 源
- 码
- 一
- 致
- 。
- 完
- 整
- 便
- 携
- 候
- 选
- 5
- 7
- 3
- 7
- 8
- 文
- 件
- 逐
- 字
- 节
- 及
- 离
- 线
- d
- o
- c
- t
- o
- r
- 核
- 验
- ，
- 源
- 范
- 围
- 3
- 0
- 8
- 项
- ，
- 程
- 序
- 候
- 选
- 与
- 本
- 轮
- 差
- 异
- 分
- 开
- 冻
- 结
- ，
- 未
- 清
- 理
- 其
- 他
- 未
- 提
- 交
- 改
- 动
- 。
- 5
- 5
- 个
- 唯
- 一
- 工
- 程
- 项
- 最
- 终
- 通
- 过
- ，
- 初
- 始
- 失
- 败
- /
- 修
- 复
- 复
- 验
- 日
- 志
- 保
- 留
- 。
- 六
- 原
- 稿
- 一
- 批
- 6
- /
- 6
- 通
- 过
- ，
- 1
- 1
- 9
- .
- 7
- 6
- 5
- 秒
- ，
- 2
- 4
- 步
- /
- 4
- 8
- 8
- 实
- 际
- /
- 1
- 8
- 媒
- 体
- 真
- 实
- 浏
- 览
- 器
- 可
- 看
- ，
- 整
- 窗
- 定
- 位
- 及
- 播
- 至
- 结
- 尾
- ；
- 8
- 4
- 5
- 文
- 件
- 和
- 前
- 两
- 批
- 保
- 持
- ，
- 6
-  
- N
- O
- T
- _
- R
- U
- N
- 登
- 记
- /
- 诊
- 断
- 不
- 计
- 通
- 过
- ，
- 0
- 模
- 型
- /
- 业
- 务
- 改
- 稿
- 。
- 第
- 二
- 电
- 脑
- 、
- 独
- 立
- 首
- 审
- 及
- 整
- 体
- 发
- 布
- 未
- 验
- ，
- P
- 2
- /
- P
- 3
- 文
- 档
- 门
- 禁
- 不
- 在
- 本
- 轮
- 修
- 复
- 范
- 围
- 。

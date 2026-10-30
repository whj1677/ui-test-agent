- [REQ-0025 v4 可恢复删除用例](REQ-0025-workbench-m3a-case-import-export/current_state.md)：用例库新增单条/所选删除、已删除列表及恢复；20项相关工程检查与正式4322取消、单条/批量删除恢复、刷新验证通过。2原用例完整版本/来源恢复，79个其他项目不变；正式交付检查受其他任务并行变更阻断，本轮未重打安装包。见[验证记录](../../workbench/qa/20261030-case-delete/REPORT.md)。

- [REQ-0043 跨电脑运行诊断日志与脱敏导出](REQ-0043-runtime-diagnostics/current_state.md)：实现及本机工程/正式4322导出验证完成；部署后需用户电脑复现，合并打包保持等待。

- [REQ-0042 v2 三项继续修复](REQ-0042-architecture-review/current_state.md)：CSP、助手来源核对、宿主锁PID身份已修复；1387工程、32 Harness、正式页面18/18、下载4/4、媒体10/10及UI/HTTP实际执行与零模型复跑通过；来源语义与未覆盖现场边界见[复验报告](REQ-0042-architecture-review/followup-review.md)。

- [REQ-0001 v18 受保护文档真实生成与Excel下载](REQ-0001-release-readiness/current_state.md)：修复生成准备重解析原件ZIP的问题；正式4322真实生成前端6/后端6条并经网页按钮下载，55步骤/75有效引用核对通过，54项相关检查通过。v3完整包包含修复，业务确认和真实WPS仍待验证。见[本轮记录](../../workbench/qa/20261029-protected-document-retest/REPORT.md)。

- [REQ-0001 v17 受保护Word真实复验](REQ-0001-release-readiness/current_state.md)：修复Office制表符空段落误报，正式4322助手读取原件102有效段，普通与受保护上传接口通过，43项工程检查通过；更新完整安装器，真实WPS未验。见[本轮记录](../../workbench/qa/20261029-protected-document-retest/REPORT.md)。

- [REQ-0001 v16 Word/WPS 助手与完整安装器](REQ-0001-release-readiness/current_state.md)：用户取消增量包交付，完整包内置当前运行环境及助手自动读取后备；72项相关检查和原4322普通DOCX上传通过，实际安装及最终门禁见[本轮记录](../../workbench/qa/20261028-office-upgrade/REPORT.md)。接收电脑的受保护Word/WPS兼容性仍待验证。

- [REQ-0001 v13 Inno安装与真实模型验证](REQ-0001-release-readiness/current_state.md)：安装、快捷方式、DSH执行、助手生成及三轮重启通过；首次网页保存后自动启用尚未闭环。[验证记录](../../workbench/qa/20261028-inno-installer/REPORT.md)。

- [REQ-0001 v11 跨电脑助手启动与资料准备修复](REQ-0001-release-readiness/current_state.md)：49项定向、1302项固定工程及原4322正常文档上传/资料选择通过；候选归档字节验证通过，原始stage检查失败、远端及企业保护文档Office后备未验/未实现。旧交付与失败保留。

- [REQ-0001 v10 Edge 报告直载](REQ-0001-release-readiness/current_state.md)：预览直接读取固定报告，不依赖可能停滞的子框网络导航；验证见[本轮证据](../../workbench/qa/20261028-edge-root-cause/REPORT.md)。

- [REQ-0001 v9 Edge 报告预览自动恢复](REQ-0001-release-readiness/current_state.md)：子框导航受阻时自动加载原快照，保留样式、目录和媒体；新包及限定验证见[本轮证据](../../workbench/qa/20261028-edge-preview/REPORT.md)。

- [REQ-0001 v8 报告预览与交付范围](REQ-0001-release-readiness/current_state.md)：报告加入加载提示、重试和直接打开；保持旧快照，交付范围和新包验收以本轮记录为准。
- [REQ-0036 v12 报告修复与全量验证](REQ-0036-ui-ux-01-workbench-usability-review/current_state.md)：1284项工程、UI6/HTTP6真实模型执行及全部冻结复跑通过；报告12条全部纳入，78附件校验；64旧项目、16旧空间和原失败快照保留。[本轮证据](../../workbench/qa/20261027-report-remediation/REPORT.md)。

# 需求索引

- [REQ-0001 v14 网页首次模型启用](REQ-0001-release-readiness/current_state.md)：网页启用、新EXE实际安装及桌面快捷方式、真实DSH/冷启动后助手和三次重启限定验证完成，原工作台66项目及原配置/数据根已恢复；最终门禁见本轮日志，不代表干净Windows或完整产品发布。见[本轮记录](../../workbench/qa/20261028-web-model-activation/REPORT.md)。
- [REQ-0036 v11 桌面真实功能续验](REQ-0036-ui-ux-01-workbench-usability-review/current_state.md)：固定清单复跑1275/1275、空项目修复相关40项、正式4322合成UI/API模型执行及零模型原稿复跑通过；发现P1项目报告漏计原生UI结果，整体未通过。62原项目保留。[验证报告](../../workbench/qa/20261027-functional-validation/REPORT.md)。

- [REQ-0036 v10 现代桌面测试控制台](REQ-0036-ui-ux-01-workbench-usability-review/current_state.md)：GitHub浅色视觉、紧凑项目索引与配置/弹窗交互已实现；60项相关工程回归、正式4322桌面检查与独立视觉审查通过，原配置/数据根指纹保持。用户明确手机端不考虑。本轮模型/业务运行0、不发布；全项目交付门禁受既有范围声明与混合工作区阻塞，未改写旧基线。[本轮报告](../../workbench/qa/20261027-modern-console/REPORT.md)。

- [REQ-0001 v6 工程师免设备许可试用](REQ-0001-release-readiness/current_state.md)：按用户要求，本次源程序和完整便携包取消设备许可证与激活，模型密钥和任务权限保留。原4322加载.20261026.1、DSH正常；1272项固定工程及空许可目录启动检查通过。更新PDF/HTML手册、源码归档和原模板，旧交付包与历史失败不覆盖。新设备激活不再是本版前置，干净Windows与完整业务验收仍未完成。[本轮说明](../../workbench/qa/20261026-no-device-license/REPORT.md)。

- [REQ-0001 v5 工程师试用打包与代码归档](REQ-0001-release-readiness/current_state.md)：完整Windows x64便携程序、7页PDF/离线HTML试用手册、原格式Excel模板与含未提交修改的源码快照已制作。包内全新解压、离线诊断、独立配置准备及原4322只读查看有实际证据；默认模型关闭，许可证按设备单独申请。保留旧失败及14VT，不宣称干净Windows/完整业务/系统全屏已通过，不自动公开发布。[本轮交付与验证](../../workbench/qa/20261026-engineer-release/REPORT.md)。

- [REQ-0001 v4 DSH公开回复阅读](REQ-0001-release-readiness/current_state.md)：v4阅读体验限定验收完成：原4322加载.4最终源码、原配置/数据同指纹、DSH RUNNING。既有217条公开记录352/352帧不变，默认先展示本次读取最新回复及对应输入，2张真实表格分别4/6行，完整历史217项/180工具记录可展开；原文及输入逐字等于原GET结果。定位按钮处理固定工具栏遮挡并聚焦可见最新标题，原始HTML/链接/图片仅文字、无远程资源元素。18项定向及1270项固定工程全通过，5组产物核对通过；新.4-r2包321文件同当前字节，旧.3安装失败/包/日志和旧成绩不变。13个DSH工作区文件及原配置同字节，27625旧资产中仅Host锁变化，旧13+99VT不变。本轮0模型调用/0业务运行/0业务稿生成，无云平台。干净Windows/新设备许可、当前电价首审/独立反例及完整业务验收仍未完成；系统全屏沿用上轮拒绝/窗口放大可用的限制，未宣称发布通过。 [截图与限定验收报告](../../workbench/qa/20261022-conversation-readability/REPORT.md)。

- [REQ-0001 v3 完整安装器验收](REQ-0001-release-readiness/current_state.md)：v3本机限定安装验收完成：根安装器显式绝对RuntimeHome传递、默认兼容及运行中保护；完整首轮实际发现PS5初始化脚本UTF8缺少BOM解析失败，保留失败包/日志。修复编码标识与驱动器相对路径边界；20项PS5/PS7定向回归及1263项固定工程检查通过。新r2包321文件在全新解压/独立RuntimeHome真实四锁ci、浏览器检查、初始化及诊断完成；首轮已从空缓存下载Chromium/Headless/FFmpeg，修复重试明确复用该新缓存。恢复原桌面快捷方式4322冷启动19.214秒，单实例、原配置/数据同指纹、DSH RUNNING；真实Edge复核窗口放大/150%/退出、旧脚本/结果/证据及诊断未执行排除；本次系统全屏被Edge拒绝并回退，不记全屏通过，与v95成功记录同时保留。无业务执行/生成、无新增模型调用；真实模型已在前阶段v95完成。用户确认暂无干净Windows，干净设备/新许可激活、独立人工首审、当前电价反例及完整业务验收仍未完成；非发布批准。 [报告与问题清单](../../workbench/qa/20261022-full-installer/REPORT.md)。

- [REQ-0038 v95 原4322恢复与正式交付验收](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v95限定正式验收完成：被拒的是执行工具创建额外隐藏PowerShell包装进程的整段命令，本机规则无匹配拒绝、宿主具体理由未公开，不能断言为有理由的Auto-review拒绝。未改策略，由同一工具直接跟踪原正式启动器前台模式恢复4322；再由原桌面快捷方式实际进程冷启动15.430秒、连续打开两次仍单实例，原配置/数据及加载源码身份一致、DSH RUNNING。正式Edge全屏/150%/200%与退出按钮已验，一次退出前后1.115秒/0.5倍速保持；窗口放大Esc已验、系统物理Esc仍未验。真实DSH仅可查看模式1轮22秒、7次只读工具成功，回复在主工作台和冷启动后可读，不计业务通过。13个原工作区文件同字节；27625旧资产中27621同字节，4个会话/缓存/运行锁变化登记；原97个VT与脚本/失败/媒体保留。本轮0业务执行、0脚本生成，云平台暂停。干净Windows安装、当前电价稿首审/反例和完整业务验收仍未完成，非整体发布批准。 [报告、截图与最终问题清单](../../workbench/qa/20261022-final-delivery/REPORT.md)。

- [REQ-0038 v94 启动、依赖与录像查看修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v94本地限定修复完成，正式验收受阻：录像增加系统全屏、失败时铺满窗口回退、原始像素及150%/200%缩放，历史1942×1150录像组件实测保留14.074444秒位置及2倍速、原FAILED不变；27项播放器检查通过。启动时限改为外60秒/内30秒/UI90秒并加脱敏阶段计时，23项检查通过；未取得实际冷启动后耗时。传递依赖修复后两组npm审计各0，6项实际协议/ZIP64/图像检查通过，原0.8.2恶意ZIP64超时、0.8.3拒绝。完整142文件1249项通过，初14失败及后1录制瞬态失败日志保留；整窗恢复仍校验原尺寸与捕获间隔。候选0.1.0-native.20261022.2共321文件同SHA独立安装/初始化/诊断通过，DSH主版本及二进制不变。原27625资产相对v93无新增变化、旧VT和34通过7失败22未执行15待澄清不变。正式4322仍不可达，原启动器恢复被自动审批blocked by policy拒绝且无具体理由，未绕过；本轮代码加载、正式真实浏览器及模型验收NOT_RUN，云平台暂停，不能宣称整体可交付。 [报告与组件截图](../../workbench/qa/20261022-startup-security/REPORT.md)。 首次交付收集器在基线核验返回1并保留：同一历史source_cases.txt随父进程读取上下文变化，Node及其子Python结果与冻结基线一致、直接Python不同；具体系统机制未确定。保持原基线、历史文件与规则，在冻结基线相同上下文复核，最终以本轮交付证据和实际收集日志为准；正式4322及整体验收仍未完成。

- [REQ-0038 v93 工程师交付候选](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v93本地工程与交付包限定验证完成，整体验收受阻：140文件清单1237项全通过、无跳过；原挂起和2项夹具失败日志保留。新模板随包，公共许可客户端10文件同字节移入vendor，四组锁定依赖在独立解压目录实际安装/初始化/诊断通过。版本0.1.0-native.20261022.1仍PENDING_ACCEPTANCE。云平台按用户要求停止运行/重试；既有34通过7失败22未执行15待澄清不变。正式4322正常重载后监督进程报SERVICE_START_TIMEOUT，原入口恢复启动被自动审批blocked by policy拒绝且未给具体理由，未绕过；本轮加载后真实浏览器验收未运行。依赖审计原生DSH与旧Harness各12项风险待评估，不宣称可正式发布。 交付收集器增加显式正数context-timeout参数，默认120秒保持；本次大快照用600秒完整检查，不更改规则、失败退出码或业务成绩，原120秒超时与检查失败日志保留。

- [REQ-0038 v92 原始电价全量处理、生成恢复与工程师模板](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v92限定修复与真实全量处理完成：正式4322原配置/数据恢复；原Excel78条完整导入，15条歧义仍待确认；其余63条一次提交按20/20/20/3共享会话处理，85分41秒，41条有正式运行（最新34通过、7失败），22条前置阻塞，不作78条全通过。41条最新976断言实际值、330媒体/源码文件摘要核验完整。生成入口恢复原对话及原生DSH任务，185工程回归和正式真实模型创建竞态/跨入口恢复已验；模板补齐UI/BACKEND及多级导航逐步示例，正式下载回传识别正常，空模板0候选。原73项目、14838原文件字节、旧任务/旧验证成绩保留；4个运行缓存/锁/全局环境目录登记变化如实记录。业务首审、独立反例、授权园区与收益独立台账仍不足，整体交付目标未签收，未提交发布。 [本轮报告](../../workbench/qa/20261022-electricity-full/REPORT.md)。

- [REQ-0038 v91 同十稿独立反例验证](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v91限定独立反例完成：原10稿正常10/10，但13反例初轮仅检出7、漏检6；原结果保留。真实DSH自行修订003/004/005/006/010与公共读回函数，原业务预期不变；新冻结族正常/13反例/恢复正常同SHA、0模型复跑，最终13/13在指定业务断言发现差异，前后两组各10/10且证据完整。反例仍真实FAILED，未执行步骤仍不计通过；历史、旧稿、媒体、配置数据保全。DSH自测1次整窗启动最小化缺口保留，尚非真人首审、云平台或发布验收。 [关键截图与逐条失败证据](../../workbench/qa/20261020-independent-counterexamples/REPORT.md)。

- [REQ-0038 v90 三个P1与整窗录像修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v90限定修复完成：DSH自行修订原十稿，原项目零模型10/10通过及证据完整（280.143秒），导出回导同稿10/10完整（266.464秒），两组各59步/143实际值。步骤契约执行前检查、按钮状态实际采集、原范围导航、录制窗口保护及有界恢复已加载原4322；真实最小化故障注入通过。固定工程全量1119通过/0失败/0跳过；旧业务/工程失败及本轮3条自测证据缺口保留，不改成绩。配置/数据根、旧用例、稿件和媒体保全，首审/独立反例/云平台/发布未验。 [本轮报告](../../workbench/qa/20261020-p1-repair/REPORT.md)。

- [REQ-0038 v89 真实模型完整流程测试](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v89真实模型完整流程限定测试完成：桌面冷启动16.982 秒，原4322/配置/数据保持；真实模型两轮设计10条59步、Excel回导一致；DSH在同一任务795.372 秒独立编写及自修后10/10正式通过且证据完整，首次证据完整5/10。原稿无模型复跑9/10（MAT-002等待竞态失败）、回导原稿无模型复跑10/10但仅9/10证据完整（MAT-005整窗异常），脚本/文件包SHA保持。工程全量1117项中5失败保留，不宣称交付全绿或发布；诊断与10份未执行登记不计通过。 见[本轮问题与关键截图](../../workbench/qa/20261020-full-model-acceptance/REPORT.md)。

- [REQ-0038 v88 交付检查与回放布局](REQ-0038-requirements-and-protocol-test-input/current_state.md)：17项文件读取视图由修复前独立证据核对，原基线保留；桌面真实快捷方式冷启动17.198秒，原4322单实例、原配置数据与DSH正常。真实Edge左步骤右录像、同步定位和旧脚本/失败/未执行稿查看已验，7857原文件不变，0业务执行。最终交付检查以实际日志为准，非整体发布。见[本轮报告与关键截图](../../workbench/qa/20261019-performance-repair/oct20-REPORT.md)。

- [REQ-0038 v87 页面性能与启动恢复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：原4322已恢复、原配置与数据指纹一致、DSH为RUNNING；真实Edge查看与恢复后只读审计3项通过，7857原文件不变，46项工程检查保留。历次启动失败、最终原配置冷启动对比未重测及交付门禁失败保持；0新增业务成绩。见[恢复与关键截图报告](../../workbench/qa/20261019-performance-repair/RECOVERY-REPORT.md)及[前阶段耗时记录](../../workbench/qa/20261019-performance-repair/REPORT.md)。

- [REQ-0038 v86 六项交付检查修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：显式范围/冻结基线、真实失败状态、按验证项/批次核对证据，原成绩与混合工作区保留。35项定向检查通过；正式4322原六稿一批6/6、123.025秒、0模型，24步/488实际/18媒体可看，1033原文件及前三批不变；最终门禁见实际日志，非整体发布。见[关键截图报告](../../workbench/qa/20261016-delivery-gates/REPORT.md)。

- [REQ-0038 v85 原生安装启动与交付范围](REQ-0038-requirements-and-protocol-test-input/current_state.md)：工程内独立原生0.2.0-rc.2，配置保全、原4322加载0.1.0-native.20261016.1；完整便携候选57378文件及离线核验，本轮基线差异单独冻结。55工程项最终通过；六原稿零模型6/6、119.765秒，24步/488实际/18媒体真实浏览器可看，845原文件与历史保持。限定结论，第二电脑/整体发布未验。见[关键截图报告](../../workbench/qa/20261016-native-runtime-delivery/REPORT.md)。

- [REQ-0038 v84 导入稿直接复跑](REQ-0038-requirements-and-protocol-test-input/current_state.md)：正式4322刚导入六原稿0模型直接复跑最终6/6通过，121.105秒，24步/488实际/18媒体真实浏览器可看。首批证据缺口修复后同稿再验，两批12次执行均保留；登记仍NOT_RUN、诊断不计通过。114工程项及原稿/历史保全核对通过；非整体发布。见[关键截图报告](../../workbench/qa/20261016-imported-six-rerun/REPORT.md)。

- [REQ-0038 v82 三项修复与六原稿复测](REQ-0038-requirements-and-protocol-test-input/current_state.md)：正式4322真实Edge，六冻结包0模型复跑6/6通过、127.475秒；实际值213/488→488/488、24步/18媒体可读。DSH主入口与历史旧流程分离，逐步预期实际配对；88工程项及原数据/业务源保全通过。诊断与NOT_RUN不计通过；非新生成或全产品/真人首审/发布结论。见[六图报告](../../workbench/qa/20261016-native-six-repair/REPORT.md)与[离线HTML](../../workbench/qa/20261016-native-six-repair/修复复测报告.html)，云平台暂停。

- [REQ-0038 v81 本地六条DSH生成与工作台验收](REQ-0038-requirements-and-protocol-test-input/current_state.md)：正式4322真实Edge验证，六条当前脚本和公共函数由DSH编写，最新6/6通过、首次5/6，24步实际/18媒体可查看；3正式ERROR和3诊断保留，旧未执行稿不计通过。全过程14分38.3秒含通用插桩修复，人工操作体验未达标，213/488断言留安全实际，首审/独立反例/真人全屏未验。见[关键截图报告](../../workbench/qa/20261016-native-local-six/REPORT.md)与[离线HTML](../../workbench/qa/20261016-native-local-six/本地六条DSH验收报告.html)；云平台暂停，未发布。

- [REQ-0038 v80 DSH凭据与未执行稿件](REQ-0038-requirements-and-protocol-test-input/current_state.md)：正式4322凭据恢复；真实Edge使用本地合成UI-WO-04既有模型稿完成DSH登记与正文展示，NOT_RUN/NOT_CAPTURED、不计通过，0新增业务运行。原001无执行登记事实单列；历史结果保留，云平台暂停。见[本轮报告](../../workbench/qa/20261016-native-draft-registration/REPORT.md)。

- [REQ-0038 v79 DSH与工作台接入修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：修复已加载正式4322；148/148限定工程回归与真实Edge旧资料只读验收完成。原10脚本、16步、30媒体可查看，007同步录像播放到结尾；9通过1失败、12诊断隔离及历史资料保全。原生DSH服务进程缺模型凭据，0登记稿件，实际稿件链路未验；云平台和新10条继续暂停。见[正式查看验收](../../workbench/qa/20261015-formal-view-check/REPORT.md)及[代码修复记录](../../workbench/qa/20261015-dsh-workbench-repair/REPORT.md)。

- [REQ-0038 v78 第二批新10条DSH脚本编写验证](REQ-0038-requirements-and-protocol-test-input/current_state.md)：按用户要求暂缓。014/016/017/019/020/021/022/024/025/026两次提交均停在模型前准备阶段、0正式run；安全诊断/终态/会话I/O与shutdown已完成工程回归。工具预检与用户终端配置不一致的根因及后续修复转入v79；耗时、业务通过率及主控制台真实浏览器验收未完成，024授权园区前置阻塞单列。见[准备故障历史记录](../../workbench/qa/20261015-native-next10/REPORT.md)，v77部分验收结论保持。

- [REQ-0038 v77 原生DSH逐步证据与原稿复跑](REQ-0038-requirements-and-protocol-test-input/current_state.md)：部分验收。正式4322真实Edge零模型复跑原10条并限定补跑001，最新9PASS/1FAIL；16原步骤、10整窗/时间线及355项只读审计通过，旧3224run文件/21业务文件不变、12诊断隔离。首轮001录像缺口及补跑001业务失败保留；全屏NOT_VERIFIED，65/316断言实际值未安全采集。见[本轮报告](../../workbench/qa/20261015-native-evidence-replay/REPORT.md)，不宣称整体完美或新脚本编写验证通过。

- [REQ-0038 v76 DSH主控制台数据接通](REQ-0038-requirements-and-protocol-test-input/current_state.md)：正式4322真实浏览器逐条读取原10条脚本、结果与证据；63正式/12诊断分开，27失败保留；111工程项与原数据哈希保全通过，0模型/0业务重跑。见[本轮报告](../../workbench/qa/20261015-dsh-main-console/REPORT.md)。

- [REQ-0038 v75 诊断隔离与DSH四条覆盖补齐](REQ-0038-requirements-and-protocol-test-input/current_state.md)：49工程项及原4322真实隔离验证通过；DSH三批修订后001/008/009/010自测与本次AI覆盖审查均通过，0主管业务改稿。32次执行中8次诊断不计用例结果，12正式失败保留；真人首审/独立反例未验，未发布。见[本轮报告](../../workbench/qa/20261015-dsh-diagnostic-gate/REPORT.md)。

- [REQ-0038 v74 原生dsh薄接入与实时过程](REQ-0038-requirements-and-protocol-test-input/current_state.md)：66工程检查通过；正式008超时、009首测失败后环境阻塞停止，业务0/2通过。已验证同会话复用和失败截图/录像读取，0主管业务改稿；未验安装包。见[本轮报告](../../workbench/qa/20261014-native-dsh-integration/REPORT.md)。

- [REQ-0038 v73 外部执行与两条试验](REQ-0038-requirements-and-protocol-test-input/current_state.md)：通道已跑通；010两次月份定位失败按约停止，014未运行、复用收益未验证，0主管改稿。见[本轮报告](../../workbench/qa/20261014-dsh-file-execution/REPORT.md)。

- [REQ-0038 v72 精简两例与Grok会诊](REQ-0038-requirements-and-protocol-test-input/current_state.md)：执行宿主spawn/IPC阻塞，两例业务NOT_RUN、复用收益未验证；按用户停止条件收口，不自动重开。见[本轮报告](../../workbench/qa/20261014-dsh-slim-two/REPORT.md)。

- [REQ-0038 v70 独立dsh共享探索试验](REQ-0038-requirements-and-protocol-test-input/current_state.md)：008旧两组未产出可运行脚本；用户转向后旧009配对暂缓。独立008/009真实验证通过，009同稿0模型复跑通过；经历纠错，非完整A/B，不宣称整体成功率。见[试验报告](../../workbench/qa/20261014-direct-dsh/REPORT.md)。
- [REQ-0038 v65 批量跟进与提交反馈](REQ-0038-requirements-and-protocol-test-input/current_state.md)：用户新72条批次在原4322继续运行，跟进恢复；补齐提交等待与健康超时重试提示，35专项及4项正式只读检查通过，真实整批生成尚未完成。见[本轮记录](../../workbench/qa/20261013-bulk-submit/REPORT.md)。

- [REQ-0038 v64 登录与批量弹窗修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：专用浏览器聚焦/会话复用及批量弹窗立即反馈已加载原4322，67工程及4项正式只读检查通过；用户停止原72条批次，TC-TPL-002数据前置失败保留，未自动重新生成。见[本轮记录](../../workbench/qa/20261013-bulk-monitor/REPORT.md)。

- [REQ-0038 v63 脚本生成阻塞修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：被动认证监控、图标非致命阻断和异常证据读取已修复；37专项及5项正式验收通过，TC-TPL-001真实完整生成待人工核对，其余用例未纳入本轮验收。见[本轮记录](../../workbench/qa/20261013-generation-blockers/REPORT.md)。

- [REQ-0038 v62 工作台合并与加载修复](REQ-0038-requirements-and-protocol-test-input/current_state.md)：统一为一个工作台的用例/脚本与运行视图，范围双向保持，首屏独立加载；真实73条预检本机实测18秒降至约0.4秒，98专项及正式4322范围/保全验证通过。实际模型/业务未运行，整体发布未完成。见[本轮记录](../../workbench/qa/20261013-workspace-loading/REPORT.md)。

- [REQ-0038 v61 批量工作台与正文核对](REQ-0038-requirements-and-protocol-test-input/current_state.md)：批量生成入口保持可见，用例库负责正文，跨页选择和人工批量确认已接通；71工程项及正式4322两条合成核对/生成预览通过。真实73条已观察到whj人工确认，仍需专用测试浏览器登录；实际模型/云平台执行未运行，整体发布未完成。见[本轮记录](../../workbench/qa/20261013-batch-workflow/REPORT.md)。

- [REQ-0038 v60 无接口人工登录](REQ-0038-requirements-and-protocol-test-input/current_state.md)：已移除普通设置的必填登录校验接口，支持专用浏览器人工确认与页面访问检查、内网HTTP。正式4322配置保存与未登录拒绝已验证；云平台业务和模型未运行，历史验收结论保持。见[本轮记录](../../workbench/qa/20261013-manual-login/REPORT.md)。

- [REQ-0041-engineer-case-auto-import](REQ-0041-engineer-case-auto-import/current_state.md)：工程师模板与CSV自动识别导入已实现；29项工程检查与正式4322的7组交互见[本轮记录](../../workbench/qa/20261009-case-auto-import/REPORT.md)，未运行客户业务与模型，整体发布门禁另记。

- [REQ-0037-autonomous-candidate-development](REQ-0037-autonomous-candidate-development/current_state.md)：v16首次真人19事件示范已确认；首轮DSH写草稿后传输失败、无候选，原失败保留。恢复DSH基于同一示范完成2自测/2审查/1独立五步复验，正式零模型技术试跑同稿五步通过，候选待人工批准。Windows原生控制条已正式加载，用户确认可见/拖动/收起/切回仍置顶、直接框选取消后保持暂停；第三次试用未确认，不计作新示范。结论仅CASE-02合成场景，非全产品或发布验收。见[本轮记录](../../workbench/qa/20260929-demonstration-controls/REPORT.md)；v13反馈闭环与原业务失败历史保留。

- [REQ-0039-windows-device-license](REQ-0039-windows-device-license/current_state.md)：v4，Skills 1.1新便携包约573MB，同机字节核验、普通Windows解压及私有PATH新RuntimeHome离线运行时/Chromium录像探针成功。独立授权DLL与签发私钥分离；干净Windows、客户独立安装、第二实体主板仍NOT_RUN。见[新包证据](../../workbench/qa/20260928-skills11/packaging-acceptance-summary.md)与[用户交接](REQ-0039-windows-device-license/用户使用与组件交接.md)。

- [REQ-0038-requirements-and-protocol-test-input](REQ-0038-requirements-and-protocol-test-input/current_state.md)：v58工具JSON故障有界恢复已加载；81工程检查、正式实模14条和两份Excel导入预览完成，恢复为离线故障注入验证，见[本轮记录](../../workbench/qa/20261010-dsh-json-recovery/REPORT.md)。历史v57已实现草稿格式与步骤指导改进；Excel下载和编辑后导入预览通过，步骤加强后的两轮真实DSH修订因JSON错误失败，完整复验未通过，见[本轮记录](../../workbench/qa/20261010-draft-excel/REPORT.md)。历史v56新增资料对话用例助手，见[验证记录](../../workbench/qa/20261010-case-assistant/REPORT.md)。历史v55有限清理与本机发布测试已执行，886工程项、真实模型与新前后端运行、媒体报告、示范和原数据保全见[清理验收报告](../../workbench/qa/20261010-cleanup-release/REPORT.md)。两处业务检查不完整保留，完整发布未通过，未发布。历史v54针对A01-A08修复并完成本机限定真实复验；195项工程、UI正常/故障清理/替代文案、后端、增强生成及数据保全见[修复报告](../../workbench/qa/20261010-acceptance-fixes/REPORT.md)。模型多轮失败保留，完整发布及文档门禁未通过，未发布。历史v53本机试用前全面验收完成但未通过，8类未解决问题，正式3条正常运行通过但实模生成仍有阻断；见[验收报告](../../workbench/qa/20261009-release-acceptance/REPORT.md)与[28组范围](../../workbench/qa/20261009-release-acceptance/COVERAGE.md)。未修产品、未发布。历史v52录像联动、最大化录制与全屏播放已在正式4322限定验证，67工程通过/1既有跳过及原脚本/保全见[本轮记录](../../workbench/qa/20261009-replay-sync/REPORT.md)。历史v51整窗录像在本机正式4322限定验证通过，47工程通过/1既有跳过、原脚本复跑及保全见[录像报告](../../workbench/qa/20261009-browser-window-recording/REPORT.md)，其他机器与多窗口未验。历史v50集中核对与人工示范入口已限定验证，76项工程和正式4322合成确认/冲突恢复见[本轮报告](../../workbench/qa/20261009-bulk-review-demo/REPORT.md)；真人录制整链未重验。历史 v49巡检工单生成失败修复完成限定验证：真实模型修订与审查、六条24步正式运行、原用例/失败记录保全已核对，见[修复报告](../../workbench/qa/20261009-generation-recovery/REPORT.md)。多轮修订后的结果，不证明新项目一次生成成功；整体文档门禁仍未通过。历史 v48当前功能全面验收未通过：54组逐项边界、6类未解决问题；本轮只验收不修产品，见[验收报告](../../workbench/qa/20261008-final-acceptance/REPORT.md)和[矩阵](../../workbench/qa/20261008-final-acceptance/COVERAGE.md)。历史 v47首批云平台定向优化已实现并限定验证，173项去重工程、正式3条9步技术运行和旧数据保全见[优化报告](../../workbench/qa/20261008-cloud-optimization/REPORT.md)；普通写入/真实鉴权与产品发布未验。历史 v46 F08及受限断言缺口已修复，3条后端真实生成/审查/独立复验后运行成功；证据见[修复报告](../../workbench/qa/20261008-backend-stage-fix/REPORT.md)，不代表完整产品/发布验收。历史 v45全功能检查见[回归报告](../../workbench/qa/20261008-full-functional/REPORT.md)。历史 v44 第二版前端已实现，120项专项工程与正式4322限定交互验证完成，见[界面实现报告](../../workbench/qa/20261008-v2-frontend/REPORT.md)；真实模型/业务执行/真人录制未验，多角色与协议逐项合并未扩展。历史 v43 项目先配置、按需登录与批量脚本流程已实现并限定验证，见[本轮报告](../../workbench/qa/20261005-project-first-workflow/REPORT.md)；真实模型/外部登录未验。历史 v42 主流程渐进展示与操作简化已实现，限定验证见[操作简化报告](../../workbench/qa/20261004-workflow-simplification/REPORT.md)；模型/业务执行由用户继续。历史 v41 项目固定 UI/HTTP 环境已实现，专项工程与正式4322配置/拒绝流程证据见[项目环境报告](../../workbench/qa/20261004-project-environment/REPORT.md)；业务模型/测试由用户后续执行，不代表完整发布。历史 v38第四轮修复和真实复验完成列明范围：普通全量分区、CHECKED选定范围、A默认同稿质量链、取消保全、名称/报告和当前ZIP；556项工程零失败/跳过。原生物理、客户干净PC/另一主板及完整产品/发布仍未完成，B工具审查上游格式失败保留。见[第四轮报告](../../workbench/qa/20261001-release-goal-round4/发布目标第四轮报告.md)与51组新旧证据边界；无自动提交推送或发布。
 v39续接：B边界/ALL图像真实回归、本机原生工具阻断、558工程项及逐文件归档见[第四轮收口报告](../../workbench/qa/20261001-release-goal-round4/closeout/第四轮收口报告.md)；发布与第二机验收仍阻塞。

- **V2.1正常生成/复跑/环境返修**：[REQ-0036](REQ-0036-ui-ux-01-workbench-usability-review/current_state.md)正式4322已实测1条真实重新生成、2批3次复跑及50媒体；核心修复已加载，仅最后后端原因优先级重载被自动审批拒绝；用户体验材料已更新，实际范围见[原交付报告](../../workbench/qa/20260925-v21/REPORT.md)。

- [REQ-0037-autonomous-candidate-development](REQ-0037-autonomous-candidate-development/current_state.md)：任务内Agent自主自测与有界修订；v10 完成第二轮独立真实UI、1次从头建例及取消展示修复复验；原业务、历史和候选待批准边界保留。

- [REQ-0036-ui-ux-01-workbench-usability-review](REQ-0036-ui-ux-01-workbench-usability-review/current_state.md)：V2.1与运行入口返修已实施；真实模型有界功能轮已执行，候选未批准及未完成项见原REPORT。
\r
- [REQ-0035-auth01-target-session](REQ-0035-auth01-target-session/current_state.md)：AUTH-01 被测系统人工登录与内存会话；独立合成站的真实 Harness 浏览器接入及新执行上下文复用已验证，现有工作台建例任务尚未绑定此登录环境。

- [REQ-0034-e2e01-caption-step-sync](REQ-0034-e2e01-caption-step-sync/current_state.md)：E2E-01 六用例录像字幕、可信步骤时间轴、双向联动及开发者浏览器自测；步骤证据回放开发自测完成，待用户体验与候选人工批准。

- [REQ-0032-test-site-six-cases](REQ-0032-test-site-six-cases/current_state.md)：独立设备台账站点的三组正常/故障入口、六条同预期配对用例、真实 Excel 与正式后端导出 JSON，以及 3 通过/3 指定业务失败的参考自检；不调用 Harness、模型或既有批准脚本。

- [REQ-0031-ui-d2a-real-case-library](REQ-0031-ui-d2a-real-case-library/current_state.md)：将已选定的墨白极简界面通过同源 `/workspace/` 接入现有真实项目与用例后端，完成 xlsx/原生包导入、版本编辑、正式导出、跨项目再导入和重启读回；保留旧 UI，不调用 Harness、模型或业务脚本。

- [REQ-0030-ui-d1-workbench-prototype](REQ-0030-ui-d1-workbench-prototype/current_state.md)：独立可点击的测试工程师项目工作台原型；只用合成演示数据，不替换正式UI、不调用Harness或业务脚本，完成后等待用户核对。

- [REQ-0029-m4a-query-case](REQ-0029-m4a-query-case/current_state.md)：M4-A 单条 HOLD-Q1 列表查询用例迁移；复用现有项目用例与建例链路，正常输入与反例资料分离，真实结果最多到等待人工首审。

- [REQ-0028-workbench-m3c-reviewed-asset-run](REQ-0028-workbench-m3c-reviewed-asset-run/current_state.md)：将指定M3-B2候选按用户已作出的限定人工首审结论登记为私有耐久资产，并从项目页面直接执行正常回归；独立反例只走受控验收入口，不调用Harness、模型或自愈。

- [REQ-0027-workbench-m3b2-project-case-run](REQ-0027-workbench-m3b2-project-case-run/current_state.md)：M3-B2一条项目用例的单次真实Harness建例、正常/反例技术验证与项目页面结果媒体返回已完成；后续已将新任务的模型输入与反例验证契约分离，并保留历史输入曾暴露反例值的事实，不扩展批量、批准或自愈。

当前输入接通：[REQ-0026 M3-B1项目单条用例建例输入接通](REQ-0026-workbench-m3b-case-build-input/current_state.md)只把项目内已确认的指定版本冻结为现有build task输入并展示双向关联；任务明确停在已创建、尚未启动，不调用Harness、模型或业务脚本。

当前用例库：[REQ-0025 M3-A项目用例库与Excel及原生用例包导入导出](REQ-0025-workbench-m3a-case-import-export/current_state.md)只实现本地单用户的项目、用例、xlsx预览确认和JSON用例包跨项目往返；不接Harness、模型、业务脚本、审批或套件执行。

当前建例入口：[REQ-0024 M2-C工作台最小候选建例入口](REQ-0024-workbench-minimal-candidate-builder/current_state.md)仅支持固定无登录合成任务，以阶段最多两次真实Harness启动完成候选生成、独立验证、一次显式修订和人工待核对状态；不批准资产、不接复杂业务或自愈。

当前隔离核对：[REQ-0023 M2-B隔离边界与候选反馈修订](REQ-0023-harness-isolation-feedback/current_state.md)先以确定性程序验证文件、网络和凭据边界；任一禁止项未被外层强制阻断即停止模型调用，只提交缺口诊断，不补算M2-A成功或进入Web集成。

当前探针：[REQ-0022 DeepSeek Harness受控调用可行性探针](REQ-0022-deepseek-harness-probe/current_state.md)固定官方 Harness 与实验性 Browser Use 版本，在隔离目录内验证程序化启动、浏览器交互、候选产出/执行和有界取消；只形成 A/B/C 可行性结论，不接正式建例 Web 或修改 M1 执行链。

当前复审修复：[REQ-0021 工作台M1代码复审问题集中修复](REQ-0021-workbench-m1-review-fixes/current_state.md)只处理入口选择轮询保持、非正常终态整体通过封闭和错误事实分类三项问题；先复现后修改，另做一组新真实Web正常/故障验证，不改批准脚本、原集成报告或禁止目录，不进入Harness。

当前实施：[REQ-0020 测试工作台第一阶段：批准脚本执行闭环](REQ-0020-test-workbench-m1/current_state.md)从批准排序资产建立本地单用户、受控入口、独立 Playwright 进程、持久化结果与中文 Web 闭环；只做工作台集成验证，不修改原脚本/冻结站点/旧结果，不接入模型、Harness 或 healer。

当前独立修订：[REQ-0019 排序组S02草稿修订与人工首审交付](REQ-0019-sorting-s02-review/current_state.md)仅由原建例器补齐S02行集合完整性，并以同一候选做正常工程干跑和独立新增行反例；旧REQ-0018结论、脚本、报告和事实不变。本轮最多一次修订和一次明确反馈纠正，完成后仅交付真人首审，不执行正式3+3、不启动详情组、不接产品。

当前独立试点：[REQ-0018 AI辅助建例与脚本回归](REQ-0018-ai-script-pilot/current_state.md)已到初稿1/修正2上限；两版正常工程干跑均可运行，但末版S02缺行总数不变检查，完整性未达到，人工未批准，正式0次、详情未启动。[完整报告](../../pilot/REPORT.md)。仅codex/ai-case-script-pilot分支，不接产品；V40源复核扩展、位置补丁、模型对照及录像解耦暂停，主工作区不改。

当前：[V40原义务解释与证据契约](REQ-0017-controlled-react/real-model-v40-result.md)唯一追加已结束，18调用/76.920秒，原S1/S2仍S01技术停止，指定故障未触达。两轮合计38/200调用、不跨构建拼成功；源复核缺断言语义定义并混淆目标待绑定与原文未知。45项工程无失败不能代替真实验收。已停止重跑/扩量/局部补丁，录像解耦未实施；原题、模型配置、录制与断言期限不变，未发布。[V39有限对照](REQ-0017-controlled-react/real-model-v39-comparison.md)无预定重复改善，保留基线。

## 历史进度快照（以下“当前/最新”均指记录当时，不代表当前状态）

官方最新：[版本35原V01](REQ-0017-controlled-react/real-model-v35-result.md)14调用后4步13断言逐义务完整，绝对位置与字段同样本实测，8媒体SHA/原输入一致；同构建原3第一整轮进行中，单例不算整轮稳定。累计34完成官方轮2542调用；旧错误和未完成范围保留。

当前：[版本35位置范围](REQ-0017-controlled-react/real-model-v35-result.md)301项受影响工程及34项重叠交付复检无失败，官方原V01待冻结后复测。[版本34原V02](REQ-0017-controlled-react/real-model-v34-result.md)官方22调用/13媒体逐义务完整一次，但未触发新增补充语义分支，不能归因或拼为整轮稳定；累计33轮2528调用。原三例同构建两整轮、未调试迁移场景及写入清理仍未达。

当前：[版本34部分断言语义许可](REQ-0017-controlled-react/real-model-v34-result.md)工程回归中。版本33整轮发现V02将否定预期写反却被部分审查放行造成误报，V01范围位置被相对顺序替代；V03同构建两次完整不能拼成原3整轮稳定。按最新目标分列完整/故障检出/误报/漏验/技术失败/人工介入，旧独立集转回归，另留未调试场景；写入清理仍未完成。

官方最新：[版本33原V03](REQ-0017-controlled-react/real-model-v33-result.md)27调用后4步13断言逐义务完整，14媒体SHA/原输入一致，真实触发缺证→补测→重新完整收尾；现继续同构建原3整轮，单例不等于整体稳定或发布。

当前：[版本33补证后重新收尾](REQ-0017-controlled-react/real-model-v33-result.md)已实现，230项受影响工程、7纯函数补验、8旧执行守卫和11交付专项分别无失败（重叠不累加）；官方V03待冻结复验。按真正新增成功测量允许再次完整核验，原重试/调用/步骤额度不增加。[版本32真实失败](REQ-0017-controlled-react/real-model-v32-result.md)与旧记录保留，不以工程结果代替产品验收。

当前：[版本32当前页证据](REQ-0017-controlled-react/real-model-v32-result.md)341项受影响工程无失败，官方原V03待冻结复验。[版本31原3整轮结果](REQ-0017-controlled-react/real-model-v31-result.md)三例通过标签但V03漏初始第1页，不计整轮完整；旧结果及分母保持。

最新：[版本31查询结果必要证据](REQ-0017-controlled-react/real-model-v31-result.md)337项受影响工程无失败；原V02官方24调用/14媒体核验一致，4步17断言逐义务完整，S03原三条件已在结果中同次测量。单例不等于整轮稳定，接续原3例同构建复验。[版本30遗漏](REQ-0017-controlled-react/real-model-v30-result.md)及旧失败保留。

最新：[版本29实际排序证据](REQ-0017-controlled-react/real-model-v29-result.md)317项受影响工程无失败，尚未官方模型复验。版本28原前三条第二轮V02出现整行摘要断言误报，稳定性未达，先修复再继续真实测试。

当前：[版本28真实验证](REQ-0017-controlled-react/real-model-v28-result.md)：独立8例已实跑190调用/110媒体SHA一致，4正常记录完成、4指定故障实际检出；初始排序部分只测控件而非表体，完整覆盖不夸大。F1同构建两次逐义务完整；接续原前三条稳定性复验，整体目标仍未达。[版本27误报](REQ-0017-controlled-react/real-model-v27-result.md)及旧题/旧失败保持。

最新：[版本24当前页排序关系](REQ-0017-controlled-react/real-model-v24-result.md)304项受影响工程无失败；首次完整句来源拒绝已修正，日志保留。冻结后复测原V07及独立8例，不将工程数量当产品通过率。

当前迭代：[版本23页签状态修复](REQ-0017-controlled-react/real-model-v23-result.md)主工程213项受影响工程无失败，交付10项重叠子集无失败；真实8例仍待排序能力修复后复验，不替代下列历史产品事实。

- [REQ-0017-controlled-react](REQ-0017-controlled-react/current_state.md)：[版本22表格关系来源修复](REQ-0017-controlled-react/real-model-v22-result.md)209项受影响工程无失败，真实待复验。[版本21独立8例](REQ-0017-controlled-react/real-model-v21-heldout.md)98次官方调用后全技术失败，已收敛表格关系表述/页签类型/排序能力三类共因，原题保持。[版本20原三例](REQ-0017-controlled-react/real-model-v20-result.md)一轮完整、稳定性未达；[版本18原对照](REQ-0017-controlled-react/real-model-v18-result.md)4正常完整/4指定差异检出。[原32诊断](REQ-0017-controlled-react/diagnostic-v16-matrix.md)及失败保留，40不同流程/30浏览器例不随重复增加；完整自主能力未达，不宣称发布。

- [REQ-0016-login-recovery](REQ-0016-login-recovery/current_state.md)：版本2增加显式Windows加密Key保存/重启恢复/忘记，以及有界合成自动登录维护入口；21项配置/登录专项无失败。4179已切换，用户首次保存完成，后续合成复测无需重复输入或点击登录。真实业务挑战仍需人工；业务结果独立验收。

- [REQ-0015-manual-complex-lab](REQ-0015-manual-complex-lab/current_state.md)：独立复杂合成网站与18有效/4待澄清/2已知缺陷用例；Kimi编写、Codex核验，用户手动测试Agent，不修改旧验收集。

- [REQ-0013-discovery-observability](REQ-0013-discovery-observability/current_state.md)：探索规划衔接、可展开的候选排除诊断与300项内分区采集已实现；627项非暂停工程回归及本机注入联调完成。权限/审批不变，真实模型收益另验，4179及旧包未切换。

- [REQ-0012-ui-experience-memory](REQ-0012-ui-experience-memory/current_state.md)：有限经验库已接入并完成本机工程验证；默认只记录，同名范围定位可积累可信经验，真实模型收益对照未运行，不绕过多步表单审批。

- [REQ-0011-recording-caption-readability](REQ-0011-recording-caption-readability/current_state.md)：录像呈现；版本2补控制台与离线报告的原步骤结果面板，区分通过、断言不一致、未完成及未执行，保留原事实和媒体；本轮工程及真实复测分别记账。

- [REQ-0010-candidate-file-integrity](REQ-0010-candidate-file-integrity/current_state.md)：REQ-0001子问题；说明损坏仍被自检报摘要一致，限定增加清单元数据/路径集合/逐文件核验，不代替签名或发布验收。

- [REQ-0009-guarded-query-reset](REQ-0009-guarded-query-reset/current_state.md)：REQ-0001子问题；原查询后“重置”可见但无候选，仅补原文绑定且核验身份的原生查询重置，保留业务重置禁令。

- [REQ-0008-multistep-plan-grounding](REQ-0008-multistep-plan-grounding/current_state.md)：用户已选A，一次批准完整固定计划；未来字段以原文意图标记、执行时核验向导步骤及所属表单，614项工程回归完成；不扩大探索业务操作，不以工程计划代替真实模型验收。

- [REQ-0007-guarded-query-forms](REQ-0007-guarded-query-forms/current_state.md)：REQ-0001子问题；submit型查询使输入和点击候选缺失，增加原文绑定的受限GET查询及一次submit现场核验；不开放业务提交。

- [REQ-0006-case-bound-reading-actions](REQ-0006-case-bound-reading-actions/current_state.md)：REQ-0001子问题；分页/说明/读取重试入口可见但不进探索候选，增加原文绑定与现场重验，保留表单和网络边界。

- [REQ-0005-semantic-scope-locators](REQ-0005-semantic-scope-locators/current_state.md)：REQ-0001子问题；重复卡片/列表按钮被全页唯一校验丢弃，新增受限语义范围及身份复核，冻结夹具不改。

- [REQ-0004-multi-ui-fixtures](REQ-0004-multi-ui-fixtures/current_state.md)：REQ-0001子包；原8保留，三种结构24例复杂UI与独立真值，夹具自检不代替Agent验收。

- [REQ-0014-runtime-binding](REQ-0014-runtime-binding/current_state.md)：默认关闭的只读运行时绑定试点已实现并完成本机工程验证；先输入审查，再批准意图，运行时查验当前目标；真实模型与发布验收未完成。

- [REQ-0003-state-file-coordination](REQ-0003-state-file-coordination/current_state.md)：REQ-0001子问题；实际并发回归暴露Windows状态替换EPERM，协调本进程读写并验证有界失败。

- [REQ-0002-wrapped-label-controls](REQ-0002-wrapped-label-controls/current_state.md)：REQ-0001子问题；嵌套标签控件观察/查询绑定与缺口报告，先复现再修复。

- [REQ-0001-release-readiness](REQ-0001-release-readiness/current_state.md)：用户新设持续发布目标；先需求、逐问题修复/验证/Git同步，多界面真实模型与安全/安装/独立操作证据齐备才可判内部试用就绪。

- [REQ-20260916-internal-beta](REQ-20260916-internal-beta/current_state.md)：已授权实施；身份、同站点清理保护和安装恢复入口已做工程验证。真实模型、干净 Windows 和独立人员验收未齐全，候选待验。
- [REQ-20260916-checkpoints](REQ-20260916-checkpoints/current_state.md)：原步骤内分段检查，工程实现与限定验证完成；真实模型效果和真实业务验收未验证。

- [REQ-0040 正式工作台托管重启与配置保留](REQ-0040-managed-workbench-restart/current_state.md)：REQ v5，配置隔离修复后正式4322新增第二目标并重启成功，source/config/data保持、两目标恢复、grant current=true；app.js后续UI刷新修复工程322/322，但正式新实例0e80c9c1已加载source f17且config489/data bf51保持；busy→idle同页复验确认health/按钮自动恢复；零模型候选未批准，ASSERTION_UNRESOLVED，不代表业务语义验收。配置摘要差异根因已由证据定位为启动注册表共享引用被install阶段push污染；service-identity.mjs已用structuredClone隔离并接入index，project-trial-authorization工程回归4/4。此前加载前的fafd6841/source e41与审批拒绝为历史状态，随后source f17已由正式实例0e80c9c1加载；保留更早一次重启未恢复及随后两次CLI重启成功的历史记录；忙碌/并发反例仅工程证据，整体验收未判通过。

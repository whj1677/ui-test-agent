# 需求索引

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

# REQ-20260916-internal-beta 验证

## 2026-09-17 条件提示与无遮挡当前工程及限定真实模型证据

- `node tests/runtime-regression.mjs`，exit_code=0、test_count=341、failure_count=0、skipped_count=0，日志validation/optional-runtime-release-20260917.log；末版只读复核不新增真实模型请求。
- `node tests/optional-dialog.integration.mjs`，exit_code=0，24场景；validation/optional-dialog-final-20260917.log。`node tests/optional-dialog-flow.integration.mjs`，exit_code=0，7场景；validation/optional-flow-1789615328221/summary.json，真实固定浏览器执行及探索，网络写入到达数0，无真实模型。
- 既有探索18场景、固定执行9场景、行内定位专项及登录/准备/URL/重定向22个TAP条目分别退出0；日志optional-discovery、optional-browser、optional-row、optional-preparation-20260917.log。分层不累加为业务通过率。
- 范围内16个源码/测试文件格式检查退出0；源码最终冻结21732433cbf299061f2901b2b91bf1b2573153a1a6829574ba782be5422d7ee5。verify-service before/after/check各退出0，8旧任务/17份历史摘要和原fixture源码/用例SHA不变。用户本机恢复连接后开展下列原合成例复测，无Key读出/持久化。
- 一张工程执行截图已视觉抽查，不替代完整视频验收。Kimi只读会诊结果独立核验后采纳副作用/瞬时性反例；模型会诊不计测试通过。详情见work/optional-dialog-20260917/修复验收.md。
- 新轮次optional-dialog-20260917仅LOCAL-002，任务c824e77f-285a-46d4-8ac6-dd5ed726deab。实际1次prepare/9次deepseek-flash请求，0传输重试，输入99529/输出4774 tokens，9次均有用量；不含用户连接测试。三份候选依次PLAN_OBSTRUCTION_UNPROVEN、INVALID_LOCATOR（plan.steps[2].assertions[1].target.kind）、PLAN_AUDIT_ACCEPTED，2次内部自动修复。人工计划反馈/代导航0，主任务仍独立核对完整计划并批准，不声称无人审批。
- 运行e4225630-5a0a-4bc0-8f92-46894c0693a7的批准计划SHA为14ce11a57f6ad917efa7027b452ea18c0877816bcc6c0d80491dd8ba28c30ae0，实际8步骤/10项断言满足，4次点击；条件提示ABSENT、SKIPPED_NOT_PRESENT、dispatched:false。目标为工业日间方案行的查看详情，五点均命中同一按钮、modal/inert/透明阻断false。字段名称、08:00—22:00和0.68元/度符合原预期，最后关闭详情返回目录。
- `node work/optional-dialog-20260917/verify-live.mjs`已退出0，回读校验原样本/17份历史摘要、冻结构建、审批/预算/9次用量、执行事实及9份媒体SHA；verified-live-summary.json留范围。step-3和step-8截图已视觉抽查无弹层，未全程播放录像。出现提示分支仅固定Chromium证据；LOCAL-001/003本轮NOT_EXECUTED，不借旧结果作为同版三例验收。
- 冻结服务未再改，无活动作业，限定修复已收口；非真实电价业务或完整发布验收。正式文档门禁仍有历史状态混写及两个未提交REQ限制，不弱化规则、删除历史或自动提交。

## 2026-09-17 行内定位/精确修复本轮证据

- 主任务直接实现，未创建子Agent。活动codex-luna-supervisor已移至用户retired-skills完整归档，内容校验一致，可恢复；不删除历史项目证据。
- `node tests/row-locator.integration.mjs`退出0：真实Chromium验证行按钮与单元格绑定、0.32对0.23产生不匹配、重复表/行/列/目标拒绝、可区分多表允许、重排同节点允许、替换节点/改变身份拒绝，以及产品DiscoveryBrowser实际暴露两个行候选并准确选择夜间；没有调用模型或进入真实业务。
- `node --test tests/repair-contracts.test.mjs tests/self-repair.test.mjs tests/plan-staged.test.mjs`退出0，36项、失败0、跳过0；包含精准路径反馈到下一候选、原候选和预算保留、无URL且跳转起始页、额外数量/跨行数值拒绝、无关菜单不算证据。模型为注入回复。
- 自主准备浏览器集成6项退出0，覆盖登录、适配修复、相关探测重规划、初始请求残缺和动作写入阻断、身份反例。各组与历史工程集不得累加成业务用例数。
- 初次新增浏览器断言测试误读回执status，实际契约为passed；已修正测试取值并复验。产品读到0.23且passed=false，未改变业务预期。
- 最终collector实际执行`node tests/runtime-regression.mjs`退出0，337项、失败0、跳过0；`validation/row-repair-runtime-final-20260917.log`。此前335项日志保留；后补了数值预期防护及导航轮次元数据去重，最终337包含全部当前运行单元，不与专项相加。
- 浏览器专项命令`node --test tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs tests/case-entry-url.integration.mjs tests/discovery-redirects.integration.mjs`退出0：22个TAP条目（21叶子场景+1容器）。另有原探索安全18场景退出0，跨站导航/写入0；固定执行9场景退出0，证据`validation/browser-1789609898023/summary.json`。模型为注入回复/无模型，不算真实业务覆盖。
- 冻结旧候选回读退出0：A原多余row_count被新规则拒绝；C两份原非法候选分别反馈`plan.steps[0].actions[0].target.kind`及`plan.preconditions[0].target.kind`。原文件SHA未变，明细`work/repair-loop-20260917/frozen-candidates-result.json`。
- 范围内18个源码/测试文件Prettier检查退出0。源码冻结为4e4761ffeaabe2b1af62e44c322caa8a5d208c20d688040538e4e266ec1677cb，服务/源码一致，七个既有任务、数据目录、原fixture源与用例SHA一致；`service-before.json`、`service-after.json`、`service-after-final.json`分别保留。因末尾补去重而正常重启两次，由用户本机恢复Key，未保存或提取凭据。
- 新版真实模型终态：自动审批最初拒绝后，用户明确授权仅3条合成用例及localhost:4188观察外发，才重试原有命令。唯一新任务24fc4960-372a-4f10-80a7-af7b7377e9d0，2次准备/23次deepseek-flash请求，输入217786、输出6552 tokens，23次均有用量；不含用户连接测试。
- LOCAL-001首次候选无需主管语义纠错，执行3步骤/9项断言满足；LOCAL-003非法kind获精确路径反馈后自动修正，执行至工业夜间方案单价cell，预期0.32元/度、实际0.23元/度，保留不匹配结果。
- LOCAL-002通过行内候选打开日间详情，实际观测#detail-name为工业日间方案。其多余行数被内部规则自动修正；独立模型审查却漏过“表格可见=没有提示遮挡”。主任务反馈1次后，用完第3个候选仍为BLOCKED_MAPPING、尝试0，未执行业务用例；不算完整自主成功。模型说协议不能表达元素不存在并不准确，已有hidden/count断言；实际缺的是可信提示目标及受控条件处理/不遮挡验收能力。
- 已导出normal-state/diagnostics/facts/report；`node work/repair-loop-20260917/verify-live.mjs`退出0，核对构建、原步骤/预期、预算、23次请求用量、2份执行事实与8份媒体SHA、原fixture/旧证据不变。`verified-live-summary.json`保存范围；没有新增模型/业务执行。媒体视觉抽查未完成（本机图像工具sandbox helper异常），不宣称完整录像验收。
- 当前无活动作业，最终服务源码未再改动。本轮到有界终态停止，不新开容易样本、不刷新预算；三例完整自主闭环与原发布验收仍未满足。

## 2026-09-17 已恢复Key后的有界真实模型续验

- 固定构建495afc79a8fd，原fixture/cases摘要未变，原三例未加URL/handoff。新任务c23b99b5-2b3f-4901-a94a-157c25b37d4e，2次prepare/46次deepseek-flash请求，旧轮预算保留；输入280377 token、输出7178 token。调用不等同于执行例数。
- 自动认证识别1次、无人工确认登录；合成驱动只模拟一次登录提交，不替Agent导航。LOCAL-001自主进入业务页生成计划，主管拒绝多余row_count=2后通过产品反馈入口让模型重生成；批准精确哈希ff061d023ea6后执行1次，3步骤/9项断言满足。一次主管语义反馈不能计为完全无人干预。
- LOCAL-002同名详情按钮缺行内绑定，2轮采证终止；LOCAL-003三份候选含非法kind，后两份相同，修复耗尽。两例BLOCKED_MAPPING且尝试0、未执行；预置错误价格未进入业务断言，不记业务缺陷检出。
- 证据根为work/claude-supervision/20260916-autonomy/postfix-495afc；normal-state/diagnostics/facts/report与verified-summary均留档。回读核验脚本verify-evidence.mjs实际exit_code=0，范围为既有记录一致性，新增业务执行0，不与此前329等工程集合相加。录像已记录但视觉检查PENDING。
- 产品运行源码本轮未改；正式交付检查与历史限制仍分开记录。当前无活动作业，按限定复测收口，不将原内测发布T-5标为完成。

## 2026-09-17 登录/菜单与选填入口修复证据

- `node tests/runtime-regression.mjs`：collector实际执行，exit_code=0，329项、失败0、跳过0；日志`validation/entry-url-runtime-20260917.log`。此轮在最终原生重定向实现之前；后续改动另由下列专项与原安全集覆盖，不能说所有329项在最终实现后重新运行。
- 最终专项命令：`node --test tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs tests/case-entry-url.test.mjs tests/case-entry-url.integration.mjs tests/discovery-redirects.integration.mjs`。collector实际执行exit_code=0，36个TAP条目、失败0、跳过0：14项程序检查+21个真实Chromium叶子场景+1个父容器；日志`validation/entry-url-browser-final-20260917.log`。包括导入/控制台填改清除、预算保留、错误候选修复、无URL探索、失效回退、安全反例、认证/名称/节点身份及原生逐跳重定向。模型均为注入回复，真实DeepSeek请求0，不计为36条业务用例。
- 最终`node tests/discovery-browser.integration.mjs`：exit_code=0，18项既有探索安全场景满足断言，外部只读资源4项取得、外部导航/写入请求0；`node tests/browser.integration.mjs`在观察层修改后exit_code=0，9项固定执行场景，证据`validation/browser-1789574339234/summary.json`。两组与专项分开记录。
- 未修改原冻结fixture：`node work/claude-supervision/20260916-autonomy/repair-validation.mjs`实际运行，`postfix-observation/summary.json`记录连续3次稳定样本自动识别认证、产品候选完成两级菜单、模型请求0、业务尝试0。原三例没有补URL，错误价格仍是预期0.32、实值0.23；不是模型自主规划证据。
- 初版URL集成7场景有1项暴露跨站302真实到达；主管复现后追加原生响应护栏。中间代理抓取方案又破坏只读CDN，因此已移除；最终专项36条目及既有18场景复验满足断言。失败历史保留，不将最终结果回写成从未失败。
- 范围内13个源码/测试文件Prettier检查exit_code=0；本轮无新运行依赖。正常停止闲置旧服务后在4179启动新版495afc79a8fd，构建与本地源码身份相符、6个任务ID及数据目录不变，证据`work/claude-supervision/20260916-autonomy/postfix-service.json`。模型选择不变，Key仅在内存，等待用户本机重新配置。
- 正式同步已运行且无派生变化；collector验证子命令成功，但正式文档门禁仍受历史混合状态和两个既有未提交REQ限制。未提交/隐藏旧改动来绕过，不标正式发布完成。最后证据收集另运行14项入口单元作为留档确认，不与此前集合累加。
- 真实DeepSeek新版复测尚未执行、真实电价业务未操作、行内同名按钮仍不支持；完整发布验收仍未完成。详细边界与使用说明见`work/claude-supervision/20260916-autonomy/修复与入口URL验证.md`。

## Schema

## 2026-09-16 自主准备专项当前证据

- `node tests/runtime-regression.mjs` 由collector实际运行，exit_code=0、test_count=315、failure_count=0、skipped_count=0；日志 `validation/autonomous-runtime-20260916-final.log`。包含受限程序、网络证据门禁、持久预算及既有运行回归，不与以下场景相加作产品覆盖。
- `node --test tests/autonomous-preparation.integration.mjs`，exit_code=0、test_count=6、failure_count=0、skipped_count=0；执行摘要 `validation/autonomous-preparation-20260916-summary.json`。真实Chromium、注入模型回复，覆盖源码损坏修复、probe重规划、登录/权限/对象身份反例；业务执行0、真实模型请求0。
- `node tests/console.integration.mjs`、`node tests/model-flow.integration.mjs`、`node tests/diagnostics.integration.mjs` 均exit_code=0；相应证据目录 `validation/console-1789558229575`、`validation/model-flow-1789558448168`、`validation/diagnostics-1789558665673`。这些测试覆盖真实本地控制台、批准和合成执行，不是实站验收。
- `node tests/discovery.integration.mjs`，exit_code=0；`validation/discovery-wWrRZ1/summary.json`。两条独立业务夹具，模型注入11次（探索5、规划2、输入审查2、计划审查2），目标页人工操作仅登录1次，无业务写请求；表内义务均以预置控件可见性为范围，不扩为通用业务语义证明。
- `node tests/discovery-browser.integration.mjs`，exit_code=0，18个真实浏览器安全场景；与新增6场景分别记录。范围内Prettier检查exit_code=0。
- 初次完整回归315项中1项失败：旧兼容任务缺snapshots导致新门禁异常；已采用空观测集兼容并复验29项core及315项完整回归。先前失败日志 `validation/autonomous-runtime-20260916.log` 保留；未删除失败记录或修改预期降低验收。
- 正式同步exit_code=0；collector实际验证exit_code=0，但collector自身及 `python scripts/check_ai_context.py` exit_code=1：历史混合状态文档和多份既有未提交REQ不能满足门禁。保留文档检查输出于 `delivery_evidence.md`，未修改无关需求、未声明正式发布完成。
- 新服务已正常重启在4179，构建 `a8b589fec7252c51e26a5c0b94cdf4a7494aa87d0d32eb88ffe22fbca2b8403e`，API `autonomous_preparation=true`。旧电价轮次不动；新验证轮次 `d02c061e-1a2f-4c06-a4b7-3cd74bd5dd9c` 仅TC-TPL-001，沿用用户确认，禁止写入，计划未批准、执行0。本机Key/登录恢复及真实模型计划结果仍待验证。

- schema: `ai-engineering-context/req-package-v1`

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 |
|---|---|---|---|---|---|---|
| VT-1 | DR-1 | 已确认 | 人工待确认 | 安装、身份、停止、升级回退 | 干净Windows及实际升级证据 | 本机启动5场景，ZIP解压安装及旧版升级/回退6场景已验证；未有干净Windows证据 |
| VT-2 | DR-2 | 已确认 | 未运行 | 两轮真实DeepSeek，各20条 | 每轮16可执行正确终态+4合理阻塞 | 冻结输入齐全；真实新调用0；准备服务已正常停止，新后台启动被审批拒绝 |
| VT-3 | DR-3 | 已确认 | 集成测试通过 | 数据清理、崩溃恢复与反例（合成工程验证） | 故障注入与20条模型用例分开 | 同构建真实Chromium合成写入/清理故障、跨任务/重启锁、无归属/无关数据保护及精确人工恢复已验证；历史失败保持 |
| VT-4 | DR-4 | 已确认 | 人工待确认 | 独立操作、单报告、可读媒体 | 非开发人员实际完成及录像播放 | 已有开发侧控制台验证；独立试用由用户稍后安排 |
| VT-5 | DR-5 | 已确认 | 人工待确认 | 成本、敏感出口与候选完整性 | 清单/摘要、合成敏感值反例、真实成本 | 白名单包验证排除注入资料；实际页面/源码/已知Key注入值未进入模型请求正文及诊断导出；外部API调用0，完整媒体/真实成本待验 |

## 本轮命令与环境

- 工作目录：ui-test-agent。Node 22.19.0，Windows，Python 3.11.9。
- `node --test tests/installation.test.mjs tests/release-boundaries.test.mjs`：退出码0，14项，失败0、跳过0；日志 `work/internal-beta-20260916/installation-unit.log`，含真实独立子进程崩溃但不含产品业务执行。
- `node tests/launcher.integration.mjs`：退出码0，5场景；日志 `work/internal-beta-20260916/launcher-with-maintenance.log`，明细 `validation/launcher-1789546969711/summary.json`。
- 候选独立目录中 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\安装.ps1`：退出码0，真实安装2项npm运行依赖、专用Python环境及openpyxl，Chromium启动自检；`work/internal-beta-20260916/candidate-install-1.log`。复用了本机Node/Python及下载/浏览器缓存，不是干净系统验证。
- 正式collector实际运行 `node tests/runtime-regression.mjs`：退出码0，304项，失败0、跳过0，`validation/internal-beta-runtime.log`；包含上述14项，不重复相加。collector因后续文档门禁失败返回1，不能称完整正式门禁通过。
- `node work/internal-beta-20260916/package-smoke.mjs`：退出码0，6场景，证据 `work/internal-beta-20260916/package-smoke/summary.json`，实际验证旧版数据备份、新包读取旧记录/阻断同源新任务、专用Python的中文Excel导入、正常停止、原版原数据回退。工程样本，无产品业务写入或真实模型调用。
- 正式门禁初次发现本包的VT映射及执行状态写法不符合格式，已修正文档。另因既有工作区同时有两个未提交REQ，门禁无法把整个Git差异归为一个记录；不修改旧需求、不提交或隐藏历史差异来强行过门。
- `node work/internal-beta-20260916/hardening-validation.mjs`：退出码0，5场景，直接导入已解压安装的11260542b79f构建；证据 `work/internal-beta-20260916/hardening-1789548154674/summary.json`。实际创建1次，自动清理请求失败1次；新任务与重启仍被阻止。维护者精确清理1次，无关记录保留，旧事实SHA不变，新任务尝试0。仅重启后增加一次登录。
- 同一硬化脚本捕获Controller→DeepSeek真实请求边界：本地拦截回复1次，外部API请求0。合成页面、源码片段及已知Key注入值不在请求正文/诊断导出中；不证明任意未标注敏感信息均可识别。截图与录像摘要匹配；抽取4秒和15秒的画面并人工视觉核对步骤、预期、实际可读，没有宣称完整播放器验收。
- `node tests/reliability.integration.mjs`：退出码0，10个真实Chromium合成工程场景；`validation/reliability-1789548402940/summary.json`，验证无归属不删除、持久化故障不派发删除、有界修复及不重放。夹具直接清空残留不算Agent自动清理成功。
- `node tests/browser.integration.mjs`：退出码0，9个真实Chromium合成场景；`validation/browser-1789548513709/summary.json`，批准的创建及自动清理达到断言、只读禁写、前置失败、业务差异、停止和认证失效分别保留正确状态；最初两业务共登录1次，刻意失效后再登录1次。与10项故障和5项硬化分别统计。

## 结论

- 工程验证不代替产品、真实模型或发布验收。当前不满足内部试用发布条件。

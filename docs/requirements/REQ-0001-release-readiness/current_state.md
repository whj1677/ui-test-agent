<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0001 当前状态

- 需求标题：多界面真实链路发布就绪

## 元数据

- 需求状态：v18修复生成准备对受保护Office原件的ZIP重解析；54项相关工程通过，正式4322真实DSH读取102段、生成前端6/后端6条，用网页按钮下载两份Excel，55步骤和75引用核对通过；v3完整包57367文件与源码核验并编译成功。业务仍待确认、未执行，图片与真实WPS未验，新EXE未重复安装向导。
- 治理分级：G2
- 当前版本：18
- 最后更新：2026-10-29

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0001-01 | 已确认 | Windows本地团队内部试用达到可复验发布标准，日常不依赖外部code agent临时导航、手写定位或候选计划。 |
| UN-0001-02 | 已确认 | 推进测试Agent可交付，补完整安装器与独立安装范围的实际证据 |
| UN-0001-03 | 已确认 | 推进可交付：测试工程师能在主工作台直接找到和读懂既有DSH公开回复 |
| UN-0001-04 | 已确认 | 将当前测试Agent打包给测试工程师试用，附试用手册、测试用例模板和代码归档 |
| UN-0001-05 | 已确认 | 本次工程师试用先去掉设备许可证，不要求申请或激活 |
| UN-0001-06 | 已确认 | 模拟新电脑完整解压、安装及真实模型功能测试，发现问题修复后重打包复验 |
| UN-0001-07 | 已确认 | 修复报告预览空白和交付门禁，重新打包并验证 |
| UN-0001-08 | 已确认 | 继续排查并修复 Edge 报告预览空白，重新打包、解压并验证后恢复原工作台 |
| UN-0001-09 | 已确认 | 排查 Edge 子框导航停滞并修复报告预览，重新打包解压验证并恢复原工作台 |
| UN-0001-10 | 已确认 | 修复工程师跨电脑试用时的模型启用、资料选择和环境保存错误提示 |
| UN-0001-11 | 已确认 | 安装版在网页保存密钥后可直接启用模型，不再操作CMD；重启保持并验证真实DSH和AI用例助手 |
| UN-0001-12 | 已确认 | 接入企业保护DOCX的本机Word只读后备，并交付选择旧安装目录的轻量增量升级包 |
| UN-0001-13 | 已确认 | 把Word/WPS读取后备直接打进新的完整Windows安装器，取消增量升级包交付 |
| UN-0001-14 | 已确认 | 继续使用同一受保护需求文档，在AI用例助手真实生成一次并下载Excel，验证读取到下载的整个流程 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0001-01 | 已确认 | 修改前建立缺陷需求包/复现/验收；修复验证后独立commit并同步现有GitHub。 |
| DR-0001-02 | 已确认 | 冻结至少3种不同前端结构24条代表性例，两轮真实模型从原输入重新规划并受控执行，保留原8难例。 |
| DR-0001-03 | 已确认 | 逐缺陷复现修复，保留身份/审批/预算/清理/敏感出口及有界恢复。 |
| DR-0001-04 | 已确认 | 中文配置/报告、干净Windows安装、旧版升级回退及非开发人员独立流程。 |
| DR-0001-05 | 已确认 | 冻结源码/服务/包身份，披露成本/范围/限制，所有硬门槛有证据才判内部试用就绪。 |
| DR-0001-06 | 已确认 | 根PowerShell安装器提供可选RuntimeHome并保持默认路径、运行中保护和失败退出 |
| DR-0001-07 | 已确认 | 公开对话默认定位本次读取的最新回复，并提供保留原文的安全排版 |
| DR-0001-08 | 已确认 | 生成现有.4代码的工程师内部试用交付物 |
| DR-0001-09 | 已确认 | 当前试用关闭设备许可门禁并显式打包，更新交付物 |
| DR-0001-10 | 已确认 | 修复解压版运行缺陷并以新包复验 |
| DR-0001-11 | 已确认 | 修复预览无反馈并重建可追溯交付范围 |
| DR-0001-12 | 已确认 | 报告子框导航受阻时自动恢复预览 |
| DR-0001-13 | 已确认 | 移除报告预览对子框文档导航的依赖 |
| DR-0001-14 | 已确认 | 修复当前便携试用包的启动模式恢复、资料选择阻断和环境保存错误提示 |
| DR-0001-15 | 已确认 | 网页显式启用模型及安全重新加载保存密钥 |
| DR-0001-16 | 已确认 | 加入DOCX本机Word只读后备和离线增量升级/回退 |
| DR-0001-17 | 已确认 | 完整安装器包含Word/WPS后备并验证程序/环境完整性 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0001-01 | DR-0001-01 | 已确认 | 历史基线归档，新问题一包一提交。 |
| DD-0001-02 | DR-0001-02 | 已确认 | 交互类型×前端结构×正常/错误/阻塞矩阵，最终同版两轮。 |
| DD-0001-03 | DR-0001-03 | 已确认 | 分层失败诊断、有界重试与安全正反例。 |
| DD-0001-04 | DR-0001-04 | 已确认 | 保留中文控制台，在真实环境验可用性。 |
| DD-0001-05 | DR-0001-05 | 已确认 | 最终冻结后完整回归、打包脱敏和单份报告。 |
| DD-0001-06 | DR-0001-03 | 已确认 | 时间义务由原文绑定的可信执行观察器测量，候选不自设时钟或容差。 |
| DD-0001-07 | DR-0001-06 | 已确认 | 仅向根安装器增加可选RuntimeHome，先校验非空绝对路径，再向原初始化脚本转发；默认空参数列表保持既有行为。 |
| DD-0001-08 | DR-0001-05 | 已确认 | 版本化新待验源码包；完整安装在独立解压目录/运行时/浏览器缓存执行，正式工作台停机前确认空闲和归属，恢复只使用原启动器/配置/数据。 |
| DD-0001-09 | DR-0001-07 | 已确认 | 在既有只读视图优先呈现最新公开回复和对应输入，完整历史折叠保留；有限安全排版先转义后构造固定标签，原文与失败/截断提示可查看。 |
| DD-0001-10 | DR-0001-08 | 已确认 | 复用现有便携打包器和当前.4版本；附独立PDF/HTML手册、同格式模板和源码快照，分开工程师交付物与维护归档。 |
| DD-0001-11 | DR-0001-09 | 已确认 | 复用已有无设备许可策略分支，并为便携包增加显式互斥构建参数；保留既有有许可构建和签名验证代码，源程序与当前试用包均关闭门禁。 |
| DD-0001-12 | DR-0001-10 | 已确认 | 显式收录两个证据插件并覆盖 cjs；仅在新建且为空的受管运行时根目录授予当前用户权限；解压入口限定短路径、拒绝覆盖并校验。 |
| DD-0001-13 | DR-0001-11 | 已确认 | 保留同源报告框，增加明确的超时恢复和直接打开；以本轮修改前工作树建立新范围并保存旧声明。 |
| DD-0001-14 | DR-0001-12 | 已确认 | 导航超时后同源读取固定HTML，在禁止脚本的受限文档中加载；采用构造样式表和安全目录定位，允许内嵌数据媒体。 |
| DD-0001-15 | DR-0001-13 | 已确认 | 使用同源 fetch 读取报告，直接写入受限子框；30秒超时和取消机制，不再使用 iframe src 导航。 |
| DD-0001-16 | DR-0001-14 | 已确认 | 普通启动只读取已保存的显式model_calls_allowed和user_initiated_operations；模型不可用只阻止发送，保留资料准备；修正CMD打包换行和环境错误映射。 |
| DD-0001-17 | DR-0001-15 | 已确认 | 新增受管模型启用IPC模式；旧服务排空和端口释放后，由父进程以固定运行目录准备模型环境，同数据根启动替代子进程。显式网页操作持久化DPAPI来源；普通重启仍保持指纹。 |
| DD-0001-18 | DR-0001-16 | 已确认 | 现有DOCX解析失败后对非标准容器调用受限Word COM，冻结原文件摘要与部分读取段落；升级器用旧包Node执行带摘要、精确文本补丁和备份的事务，仅携带新增组件。 |
| DD-0001-19 | DR-0001-17 | 已确认 | 复用已验证完整安装包的同锁依赖与运行时，覆盖当前受控运行代码并重建完整摘要，Inno Setup生成新EXE；模板仅复用上一完整包中可解析的公开工程模板，不修改本机加密原件。 |
| DD-0001-20 | DR-0001-17 | 已确认 | Office结果先校验段落/单元格位置与类型，再省略空白文字；有效原文不改，重新连续分配segment_id并保留原位置与quote_sha256。 |
| DD-0001-21 | DR-0001-17 | 已确认 | 生成会话只对local-office/PARTIAL、图片UNANALYZED且嵌图清单为空的DOCX使用已冻结文字，不重开原件ZIP；原字节摘要仍核验，普通DOCX插图继续解析及校验，MCP清单保留读取方式和图片缺口。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0001-01 | DR-0001-01 / DD-0001-01 | 已实现 | 发布基线、八项限定修复及REQ-0012有限经验能力均有先需求后实现和独立Git同步证据；REQ-0004提供冻结验收资产。 |
| TK-0001-02 | DR-0001-02 / DD-0001-02 | 进行中 | 三结构24例基线已冻结且完成独立参考验证；原003→原8及多站两轮真实Agent链路仍待运行。 |
| TK-0001-03 | DR-0001-03 / DD-0001-03 | 进行中 | 八项限定修复及经验库工程实现已有证据，现阶段593项非暂停工程回归、TTL测试补强后的52项重叠专项均无失败/跳过；录像和经验闭环已有本机证据。REQ-0008等待选择；真实模型学习收益、其他能力及发布仍未完成。 |
| TK-0001-04 | DR-0001-04 / DD-0001-04 | 进行中 | 本机安装/维护、两历史版本升级回退及报告loopback播放已有证据；字幕缺陷REQ-0011修复并实际复验。file://直开被策略拒绝，干净Windows、独立人员及最终同版媒体仍未验收。 |
| TK-0001-05 | DR-0001-05 / DD-0001-05 | 进行中 | 当前739f待验ZIP/87文件摘要和解包三模式HTTP验证已有证据，包含经验库；旧9b7f包保留但不当作当前候选。最终同版真实复验、干净安装/独立操作、完整成本报告和发布结论仍待完成。 |
| TK-0001-06 | DR-0001-04 / DD-0001-04 | 进行中 | 统一4322安装启动、首次空工作区、浏览器发现和三组锁定依赖 |
| TK-0001-07 | DR-0001-03 / DD-0001-03 | 进行中 | 查明并收口真实HTTPS目标与内存认证接入边界 |
| TK-0001-08 | DR-0001-02 / DD-0001-02 | 进行中 | 固定可信回归矩阵，保留已知业务失败和漏验反例 |
| TK-0001-09 | DR-0001-03 / DD-0001-03 | 进行中 | 验证执行能力边界，处理当前可修复问题并明确剩余隔离缺口 |
| TK-0001-10 | DR-0001-05 / DD-0001-05 | 进行中 | 生成可追溯待验包和主管独立验收报告 |
| TK-0001-11 | DR-0001-03 / DD-0001-06 | 已实现 | 有限时间原义务与可信计时执行、保真提交拒绝及原例复验 |
| TK-0001-12 | DR-0001-06 / DD-0001-07 | 已完成本机限定验收；非整体发布批准 | 安装器独立RuntimeHome、默认兼容和失败边界验证 |
| TK-0001-13 | DR-0001-05 / DD-0001-08 | 已完成本机限定验收；非整体发布批准 | 新候选完整安装、首次浏览器下载及原4322恢复保全 |
| TK-0001-14 | DR-0001-07 / DD-0001-09 | 已完成本轮阅读体验限定验收；非整体发布批准 | 公开对话最新定位、安全排版及原4322既有记录验收 |
| TK-0001-15 | DR-0001-08 / DD-0001-10 | 已完成内部试用打包交付；非整体发布批准 | 完整便携包、手册、模板和源码归档；包字节、诊断及原4322只读验收 |
| TK-0001-16 | DR-0001-09 / DD-0001-11 | 已完成免设备许可试用交付；非整体发布批准 | 源策略、便携构建、手册与归档同步取消设备激活并验证 |
| TK-0001-17 | DR-0001-10 / DD-0001-12 | 已完成限定本机验证，完整产品验收未完成 | 修复、构建、解压、安装并验证新用户工作流 |
| TK-0001-18 | DR-0001-11 / DD-0001-13 | 已实现，按本轮证据验收 | 预览恢复交互、范围冻结、打包与验证 |
| TK-0001-19 | DR-0001-12 / DD-0001-14 | 已实现，按本轮证据验收 | 实现自动兼容恢复、回归和便携包验收 |
| TK-0001-20 | DR-0001-13 / DD-0001-15 | 已实现，按本轮证据验收 | 根因对照、报告直载、回归与便携包验证 |
| TK-0001-21 | DR-0001-14 / DD-0001-16 | 已实现并完成本机限定验证；远端与整体交付待验 | 修复显式模型启用后的普通启动恢复与CMD交付入口 |
| TK-0001-22 | DR-0001-14 / DD-0001-16 | 已实现并完成本机限定验证；远端与整体交付待验 | 修复模型不可用时资料选择无反应及环境保存错误文案 |
| TK-0001-23 | DR-0001-15 / DD-0001-17 | 已实现，按本轮证据验收 | 实现网页首次启用、安全重启及重新打包安装验收 |
| TK-0001-24 | DR-0001-16 / DD-0001-18 | 已实现；真实受保护DOCX/WPS兼容待接收电脑验证 | DOCX只读Office后备与错误提示 |
| TK-0001-25 | DR-0001-16 / DD-0001-18 | 已实现；历史限定验证保留，本轮改交完整安装器 | 选择旧目录的增量升级、备份与回退 |
| TK-0001-26 | DR-0001-16 / DD-0001-18 | 已实现；历史限定验证保留，本轮改交完整安装器 | 正式4322、旧包升级/回退及轻量归档验证 |
| TK-0001-27 | DR-0001-17 / DD-0001-19 | 已实现并完成限定工程/安装验证；整体待验 | 新完整安装器组装与实际安装校验 |
| TK-0001-28 | DR-0001-17 / DD-0001-19 | 已实现并完成限定工程/安装验证；整体待验 | 正式助手普通资料入口及限定交付验证 |
| TK-0001-29 | DR-0001-17 / DD-0001-20 | 已实现并完成限定工程、正式助手和安装验证；真实WPS未验 | 修复Office空段落误报并复验正式助手受保护资料读取 |
| TK-0001-30 | DR-0001-17 / DD-0001-19 | 已实现并完成限定工程、正式助手和安装验证；真实WPS未验 | 重建并验证含修复的完整安装器 |
| TK-0001-31 | DR-0001-17 / DD-0001-21 | 已实现；真实生成与网页Excel下载及内容/引用核对通过 | 修复受保护资料生成准备并完成真实生成和Excel下载 |
| TK-0001-32 | DR-0001-17 / DD-0001-19 | 已实现；完整程序字节与编译核对通过，安装向导未重复执行 | 完整安装包包含受保护资料生成修复 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0001-01 | DR-0001-01 | 未运行 | 逐问题需求和Git闭环 | 现有8项限定修复及REQ-0012实现03f9650提交与各次GitHub远端SHA已核对，范围秘密模式扫描未命中；后续逐项继续，不等于最终全部验收。 |
| VT-0001-02 | DR-0001-02 | 未运行 | 多界面真实链路 | 真实模型启动被工具拒绝，本轮0调用。REQ-0004仅完成合成基线/独立参考验证，不能计为本VT真实链路验收。 |
| VT-0001-03 | DR-0001-03 | 集成测试通过 | 现阶段工程安全与恢复（最终候选须复验） | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：593；失败数量：0；跳过数量：0；证据：validation/REQ-0012-delivery-final.log |
| VT-0001-04 | DR-0001-04 | 未运行 | 独立可安装可使用 | 本机子集：REQ-0010安装/维护；两真实Git旧版本14项升级回退（REQ-0001-upgrade-final.log）；REQ-0011实际浏览器报告/两段视频中文可读且媒体缺失不抹失败，详细SHA/观察见子包browser-review.md。file://直接打开被策略拒绝未绕过；干净Windows、独立人员和最终同版报告仍未验收。 |
| VT-0001-05 | DR-0001-05 | 未运行 | 可追溯发布候选 | 当前739f待验ZIP完成87项字节SHA、精确清单/有限秘密模式、三模式隔离HTTP身份/静态响应/正常关闭检查；4TAP条目0失败/跳过，日志validation/REQ-0001-candidate-739f-runtime-final.log；ZIP摘要及限制见candidate-check.md。共享依赖不是干净安装，旧4179未切换，模型请求0。旧9b7f包保留；PENDING_ACCEPTANCE不变，最终同版两轮/独立使用/成本门槛未齐全，本VT整体未验收。 |
| VT-0001-06 | DR-0001-04 | 人工待确认 | 统一4322安装启动、首次空工作区、浏览器发现和三组锁定依赖 | 安装/启动改动、语法/本机静态诊断及新目录三组离线依赖安装已执行；完整安装器与干净Windows未运行。证据：workbench/qa/20260925-release/package-report-20260926-01.md、install-diagnostic.log。 |
| VT-0001-07 | DR-0001-03 | 人工待确认 | 查明并收口真实HTTPS目标与内存认证接入边界 | 认证合成目标已完成真实生成与零模型复跑。旧CASE02时间放宽反例保留；本轮可信计时新候选五步独立语义未见拒绝，CASE03原六步复跑正常。范围见workbench/qa/20260926-timing/REPORT.md；真实业务未验、CASE01生命周期未完整执行。 |
| VT-0001-08 | DR-0001-02 | 人工待确认 | 固定可信回归矩阵，保留已知业务失败和漏验反例 | 正式4322同版两轮固定2例：每轮KC-02保留原预期失败、KC-08通过；模型0次；regression-round1-result.json、regression-round2-result.json和ui/regression-round1-detail.png。未扩展为通用语义成功率或历史24例验收。 |
| VT-0001-09 | DR-0001-03 | 人工待确认 | 验证执行能力边界，处理当前可修复问题并明确剩余隔离缺口 | 当前工程清单106项通过、0失败/跳过；精确登记会话终止接口保护和原时间保真拒绝完成。新CASE02及原CASE03正式复跑后身份有效。仅有限已登记策略与DOM提示计时，操作系统隔离及通用语义仍未提供。见workbench/qa/20260926-timing/REPORT.md。 |
| VT-0001-10 | DR-0001-05 | 人工待确认 | 生成可追溯待验包和主管独立验收报告 | 最终04候选101源文件、SHA28ad0485003fba314e25bc7f8b63835675d732a430d9cf5509015b13a87962e2，精确字节/闭包/主管独立核对及正式UI呈现检查完成。03至04仅2个前端文件及说明变化，70服务端/Harness字节不变。三锁不变，沿用01有限离线安装证据，04未重新安装。正式发布未达标；见workbench/qa/20260926-timing/REPORT.md、package-report-20260926-04.md。 |
| VT-0001-11 | DR-0001-03 | 集成测试通过 | 原时间边界保真与可信可见时长观测 | 命令：npm test；退出码：0；测试数量：106；失败数量：0；跳过数量：0；证据：workbench/qa/20260926-timing/engineering-presentation-final.log |
| VT-0001-12 | DR-0001-06 | 集成测试通过 | 安装器独立RuntimeHome、默认兼容和失败边界验证 | 命令：node --test workbench/qa/20261022-full-installer/verify-final.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-full-installer/delivery-verify.log |
| VT-0001-13 | DR-0001-05 | 集成测试通过 | 新候选完整安装、首次浏览器下载及原4322恢复保全 | 命令：node --test workbench/qa/20261022-full-installer/verify-final.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-full-installer/delivery-verify.log |
| VT-0001-14 | DR-0001-07 | 集成测试通过 | 最新定位、完整历史、原文与安全排版；既有记录正式浏览器及数据保全 | 命令：node --test workbench/qa/20261022-conversation-readability/verify-final.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261022-conversation-readability/delivery-verify.log |
| VT-0001-15 | DR-0001-08 | 集成测试通过 | 本次试用交付物精确核对、实际包内准备诊断、手册与模板检查及正式工作台只读验收 | 命令：node --test workbench/qa/20261026-engineer-release/verify.test.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/qa/20261026-engineer-release/delivery-verify.log |
| VT-0001-16 | DR-0001-09 | 集成测试通过 | 无许可启动检查、构建模式互斥与原有签名拒绝、原4322浏览器及精确交付物核对 | 命令：node --test workbench/qa/20261026-no-device-license/verify.test.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261026-no-device-license/delivery-verify.log |
| VT-0001-17 | DR-0001-10 | 集成测试通过 | 本机解压安装、前后端真实模型及助手与原工作台恢复 | 命令：npm test；退出码：0；测试数量：1296；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-portable-functional/engineering-final.log |
| VT-0001-18 | DR-0001-11 | 集成测试通过 | 报告预览和恢复交互及打包门禁 | 命令：node --test --test-concurrency=1 workbench/tests/report-navigation.test.mjs workbench/tests/report.test.mjs workbench/tests/report-project-latest.test.mjs workbench/tests/portable-package.test.mjs；退出码：0；测试数量：43；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-report-delivery/tests.log |
| VT-0001-19 | DR-0001-12 | 集成测试通过 | Edge报告预览自动恢复和相关回归 | 命令：node --test --test-concurrency=1 workbench/tests/report-navigation.test.mjs workbench/tests/report.test.mjs workbench/tests/report-project-latest.test.mjs workbench/tests/portable-package.test.mjs；退出码：0；测试数量：44；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-edge-preview/tests.log |
| VT-0001-20 | DR-0001-13 | 集成测试通过 | Edge文档响应暂停对照、报告直载与相关工程回归 | 命令：node --test --test-concurrency=1 workbench/tests/report-navigation.test.mjs workbench/tests/report.test.mjs workbench/tests/report-project-latest.test.mjs workbench/tests/portable-package.test.mjs；退出码：0；测试数量：44；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-edge-root-cause/tests.log |
| VT-0001-21 | DR-0001-14 | 集成测试通过 | 修复显式模型启用后的普通启动恢复与CMD交付入口 | 命令：npm test；退出码：0；测试数量：1302；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-portable-assistant/full-unit.log |
| VT-0001-22 | DR-0001-14 | 集成测试通过 | 修复模型不可用时资料选择无反应及环境保存错误文案 | 命令：node workbench/qa/20261028-portable-assistant/verify-official.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-portable-assistant/official.log |
| VT-0001-23 | DR-0001-15 | 集成测试通过 | 网页首次启用、旧凭据隔离、真实模型及重复重启 | 命令：node --test workbench/tests/model-activation.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/service-restart.test.mjs workbench/tests/service-restart-ui.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/desktop-launch.test.mjs workbench/tests/supervisor-reliability.test.mjs workbench/tests/native-install-delivery.test.mjs workbench/tests/model-credential-paths.test.mjs；退出码：0；测试数量：68；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-web-model-activation/collector-tests.log |
| VT-0001-24 | DR-0001-16 | 人工待确认 | DOCX只读Office后备与错误提示 | 命令：node --test workbench/tests/office-reader.test.mjs workbench/tests/incremental-upgrade.test.mjs workbench/tests/requirements-documents.test.mjs workbench/tests/requirements-integration.test.mjs workbench/tests/case-assistant-view.test.mjs；退出码：0；测试数量：49；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-office-upgrade/targeted-delivery.log |
| VT-0001-25 | DR-0001-16 | 人工待确认 | 选择旧目录的增量升级、备份与回退 | 命令：node workbench/qa/20261028-office-upgrade/verify-delivery-package.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-office-upgrade/delivery-package.log |
| VT-0001-26 | DR-0001-16 | 人工待确认 | 正式4322、旧包升级/回退及轻量归档验证 | 命令：node workbench/qa/20261028-office-upgrade/verify-delivery-ui.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-office-upgrade/delivery-ui.log |
| VT-0001-27 | DR-0001-17 | 集成测试通过 | 新完整安装器组装与实际安装校验 | 命令：pwsh.exe -NoProfile -File workbench/qa/20261028-office-upgrade/verify-full-install.ps1；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-office-upgrade/full-install-r2.log |
| VT-0001-28 | DR-0001-17 | 人工待确认 | 正式助手普通资料入口及限定交付验证 | 命令：node workbench/qa/20261028-office-upgrade/verify-delivery-ui.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261028-office-upgrade/delivery-ui.log |
| VT-0001-29 | DR-0001-17 | 集成测试通过 | 修复Office空段落误报并复验正式助手受保护资料读取 | 命令：node workbench/qa/20261029-protected-document-retest/verify-persisted.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-protected-document-retest/persisted.log |
| VT-0001-30 | DR-0001-17 | 集成测试通过 | 重建并验证含修复的完整安装器 | 命令：pwsh -File workbench/qa/20261029-protected-document-retest/verify-full-install.ps1；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-protected-document-retest/install.log |
| VT-0001-31 | DR-0001-17 | 集成测试通过 | 修复受保护资料生成准备并完成真实生成和Excel下载 | 命令：C:/Users/20240082/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe -X utf8 workbench/.local/protected-e2e-20261029/verify-xlsx.py；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-protected-document-retest/generation-verify.log |
| VT-0001-32 | DR-0001-17 | 集成测试通过 | 完整安装包包含受保护资料生成修复 | 命令：pwsh -File workbench/scripts/build-windows-installer.ps1 -ProgramRoot D:/UAOF3Build -OutputDirectory D:/UAOF3Setup -Iscc D:/01_AI工程/01_工程项目/pm-req/evidence/build-tools/InnoSetup-6.7.3/ISCC.exe；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-protected-document-retest/generation-build-v3.log |

## 人工待确认项

- [ ] 真实业务项目当前没有，已按用户要求改用Kimi独立合成站验证技术链路；真实业务验收保持未运行，不再重复索要资料。
- [ ] 干净Windows和独立普通测试人员是否可用待用户安排；本机与子Agent均不能替代。

## 本轮禁止实现内容

- 禁止改原预期、删除失败样本、主管手写候选或降低安全边界刷通过。
- 禁止持久化凭据或绕过工具策略；禁止未经确认公开发布。

# 内部候选运行与维护边界

适用 REQ-20260916-internal-beta；不覆盖暂停的评测/训练模块。

## 职责与入口

| 代码 | 责任 | 输出与副作用 |
|---|---|---|
| src/build-info.mjs | 从固定运行目录和文件计算内容身份 | 版本、SHA清单、构建摘要；排除数据和维护脚本 |
| src/server.mjs | 返回加载时身份；受CSRF/实例校验的正常停止 | config实例信息；停止接入、等待活动收尾、释放写锁 |
| src/store.mjs | 持久事实、排他写锁、同站点清理影响查询 | 构建信息随新收据保存；不修改旧事实 |
| src/controller.mjs | 业务入口前统一检查待清理影响 | 新任务被阻止；原任务人工处理与有依据确认仍可用 |
| public/app.js | 中文构建身份、锁原因和原任务跳转 | 不以隐藏按钮代替服务端保护 |
| src/data-maintenance.mjs | 显式恢复已死进程、停止后备份 | 互斥维护锁、旧锁归档、完整备份清单；不结束进程或清除待清理 |
| src/installation.mjs、安装/环境检查等入口 | 固定依赖安装、环境诊断和维护命令 | 本地依赖、专用Python环境、只读身份核对、独立空白浏览器探测 |
| src/distribution.mjs | 新目录白名单打包 | 待验manifest，排除Key、数据、录像、测试、治理和训练目录 |

## 数据流与约束

2026-09-17 条件提示：`optional-dialog.mjs`提供原文限定单次native dialog本地关闭，接入计划/执行/探索；缺席记录未派发点击。`browser.checkAssertionGroup`增加目标五点hit-test的unobstructed当前观测；`plan-semantics`阻止visible偷换不遮挡及遗漏分支。网络/身份/审批/预算不放宽；native method=dialog不是任意事件脚本无副作用证明。报告保存条件分支与采样详情。范围和原例复验见REQ最新记录。

2026-09-17 自主准备续作：`browser.mjs` 在同源、正向登录后标志、无挑战和稳定样本约束下使用角色限定导航定位；控件名称排除隐藏装饰，仍独立检查唯一性和同一DOM对象。`case-entry-url.mjs` 处理选填URL的安全验证/来源区分，`importer` 从JSON或CSV/Excel保留的原始行投影选填列。`controller` 允许在用例详情补填/清除，更新有效Case身份并撤销旧计划与本Case旧hint证据；纯提示变化不补充既有候选预算。

入口优先用于只读观察，不替代原操作，直达和回到首页均消耗现有步骤预算；失效页面尝试回退，未知写入/跨站护栏不清除。`planning-input` 只提升已观察的入口事实，原始URL提示不发送模型。`plan-repair` 对跳过明确菜单步骤的候选给出反馈，并在原有修复次数内重试；最终仍需人工批准。界面提供中文错误、选填字段与入口核验状态。此变更不扩展行内同名按钮定位、不自动批准执行，也不改变业务预期。

`discovery-browser` 为文档重定向增加Chromium CDP响应阶段护栏：Location在原生跟随前验证同源、只读路径及预算；事件`DISCOVERY_REDIRECT_ALLOWED`进入原有步骤计数。保留原生响应、Cookie和外部只读资源行为，不使用代理抓取/改写文档，不重复派发点击。跨站重定向一旦触发安全阻断，入口回退不得清除；覆盖范围为探索浏览器。

启动先核对本地build；已运行服务必须同时匹配构建与数据目录。服务启动时获取排他写锁并恢复中断状态，真实写入尝试不会因重启自动重放。运行、探索和新浏览器入口查同源残留影响；原任务允许打开浏览器供人工核实。恢复说明记录LOCAL_OPERATOR和相关尝试，不能把历史失败改成通过。

维护锁阻止备份/旧锁处理与新服务同时进入数据目录。只有明确确认PID不存在才移除旧进程锁；活跃、权限不明或损坏状态均拒绝。系统在维护操作自身崩溃时保持保守阻塞，需维护者核对，首版不承诺任意故障自动修复。

备份在服务停止后复制文件并流式计算摘要，最后生成清单；源目录不修改。不合并目标或复制目录链接，避免未知归属和递归副本。候选包仅复制固定运行文件与使用说明，运行数据没有打包入口。完整性摘要不是签名，不能抵御同时篡改程序及manifest的攻击者。

## 验证及边界

本轮自主准备新增 `controller.prepare` → `BrowserSession.waitForAuthentication` → 探索/计划准备；只对固定选择集工作。`autonomous-recovery` 在缺技术事实时重新观察、只读探测及导航；`adapter-program/worker/runtime` 仅解释受限定位映射源码，由固定执行器验证当前真实DOM对象身份。源码、尝试与预算保存在任务状态/任务adapters目录；Cookie/存储保持内存。单个初始未知POST被abort不阻止独立菜单观察，但缺口随页面证据传播并阻止依赖该页面的计划批准；未知动作写仍中止。运行内核、业务预期和审批不属于可修复程序范围。

新增6个真实Chromium合成场景覆盖一次准备、源码分支损坏恢复、取证probe重规划、未知初始化请求/动作写拒绝、登录模态/OTP/公开页反例、唯一但错误目标拒绝及拒绝修复后登录保留；模型均为注入回复。不据此声称真实DeepSeek或电价业务验收。

2026-09-16 电价试用修复：`src/model-transport.mjs` 为 DeepSeek 专用 fetch 提供惰性的 EnvHttpProxyAgent，支持 HTTP(S)_PROXY/NO_PROXY，不设置全局 dispatcher。`DeepSeek.close()` 及服务正常退出释放连接池；外部注入的测试 fetch 不由此关闭。连接诊断只保留允许清单内的网络码，不输出异常消息、代理 URL 或凭据。固定 undici 依赖随 lock 安装，默认 HTTPS 校验、禁止重定向和请求取消继续有效。控制台按本轮 job_id 展示被阻断的方法/路径并作 HTML 转义；授权模型和探索网络保护未修改，只读 POST 仍通过既有精确路径配置。

本轮验证入口增加 `tests/model-transport.test.mjs`，覆盖实际本地代理隧道、NO_PROXY、无代理直连、超时取消、禁止重定向及诊断脱敏；`tests/repair-presentation.test.mjs` 验证失败接口说明不混入旧批次。

`tests/release-boundaries.test.mjs` 验证身份、同站点阻断和事实；`tests/installation.test.mjs` 验证实际独立进程崩溃、活锁/损坏锁反例、备份及包白名单；`tests/launcher.integration.mjs` 实际调用PowerShell启动/停止。`tests/runtime-regression.mjs` 明确排除暂停的两个评测测试。

本机新目录安装只证明该机及共享依赖条件；干净Windows、真实DeepSeek两轮20条和非开发人员独立操作仍为独立验收条件。测试统计不与产品覆盖混加。

# 批准脚本测试工作台（第一阶段）

这是独立于原产品的本地单用户子工程。M1 负责登记已批准资产、从固定入口启动 Playwright、持久化运行事实并在中文 Web 中展示结果。M2-C 在不改变 M1 执行链的前提下，增加了一个仅面向固定无登录合成探针的候选建例入口；它调用锁定的 DeepSeek Harness 生成候选并独立验证，但不会登记或批准候选。

第一阶段原始 normal/fault 组合、运行 ID、三方一致性、重启证据和边界见 [集成验收报告](docs/ACCEPTANCE_REPORT.md)。2026-09-21 的三项代码复审修复、修前/修后证据和新运行 ID 见 [M1 复审修复报告](docs/REVIEW_FIX_REPORT.md)；整体通过与既定三类媒体证据的后续关联见 [证据完整性修订记录](docs/EVIDENCE_COMPLETENESS_REVISION.md)。前两份历史报告没有改写。

## 安装、登记与启动

```powershell
cd workbench
npm ci
node node_modules/@playwright/test/cli.js install chromium
npm test
npm run test:build-browser
npm run register:approved
npm start
```

默认只监听 `http://127.0.0.1:4210`。受控登记命令从仓库真实文件读取用例、批准依据、配置和依赖锁，只有脚本 SHA-256 精确等于批准值才写入 catalog；重复登记同一事实是幂等操作，冲突内容会被拒绝。

运行数据、报告和媒体写入被 Git 忽略的 `workbench/.local/`。JSON 使用串行写入和同目录临时文件替换；每次运行使用独立目录。服务启动会把遗留的排队、启动、运行或停止中记录标为 `INTERRUPTED`，但不会自动重放，也不会尝试接管旧 PID。

每个 M2-C attempt 还会在事件发生时追加 `lifecycle.ndjson`：记录 task/attempt/服务实例、Harness PID 与工作台父 PID、阶段与工具名称元数据、主动取消/到期/工具额度停止、`error`/`exit`/`close` 和输出是否完整。它不保存模型内部推理、完整命令参数或环境变量。进程必须等到 `close` 或有界流收尾超时后才能结算，无换行的最后一条 NDJSON 也会在流关闭时解析。诊断或任务状态持续写失败会将健康状态改为 `degraded` 并拒绝新建例；`EPERM`、`EACCES`、`EBUSY` 仍只做有限重试。

当前接口：`GET /api/health`、`GET /api/assets`、`GET /api/assets/:asset_id`、`GET /api/runs`、`GET /api/runs/:run_id`、`POST /api/runs` 和 `POST /api/runs/:run_id/stop`。状态变更只接受同源本地 JSON 请求，正文只允许固定字段。

M2-C 还提供固定结构的 `/api/build/templates`、`/api/build/tasks` 及任务 `start`、`revise`、`stop` 路由。第一版不接受任意 URL、文件、代码或命令上传。启动真实建例前还需在 `harness-probe` 执行 `npm ci`，并为工作台进程提供现有的 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 与 `DSH_PROBE_BROWSER_EXECUTABLE`。这些值仅传给 Harness 子进程；候选验证进程使用收缩后的独立环境，不注入模型密钥、Cookie 或完整宿主环境。

执行前会确认 4198 的 `/healthz` 精确标识冻结 heldout 站点并检查入口可用性；不匹配时拒绝运行，不关闭或替换未知进程。后端只从已登记资产映射入口，以参数数组启动本地锁定的 `@playwright/test`，显式使用 `workers=1`、`retries=0`，不通过 shell 或 `npx` 下载。批准脚本按原始字节复制到本次运行目录，来源和副本在运行前后分别核验哈希。

同一时间最多一个活动运行。停止只接受当前服务持有的活动 `run_id`，Windows 上仅对该子进程 PID 调用进程树终止；已结束、旧服务遗留或其他 PID 不会被处理。子进程仅继承 Playwright 运行需要的系统路径/临时目录变量，不继承模型 Key、Cookie 或任意完整 `process.env`。

## 结果判定与 Web

打开 `http://127.0.0.1:4210`，可查看批准资产、选择正常/故障入口、启动或停止当前任务、浏览运行历史、步骤错误及媒体。页面每秒读取一次真实后端状态；轮询只负责刷新，不制造进度或结果。

同一页面的“最小候选建例”区只加载 `synthetic-probe-v1`。先“提交固定任务”冻结输入摘要，再显式“启动 Harness”。任务、候选生成、技术验证、人工核对是四个独立状态：正常页面通过且同一候选在错误输出反例上产生确切断言不符后，只进入 `WAITING_HUMAN_REVIEW`；候选失败则保留源码与实际错误，并且只允许用户显式发起一次反馈修订。页面刷新或服务重启不会恢复模型调用。

阶段预算保存在 Git 忽略的数据目录中，而不是浏览器状态：整个 M2-C 验收最多两次 Harness 启动，每次最多 30 次工具调用和 10 分钟。模型供应商没有返回的底层请求数或 usage 显示为未知，不能填零或用一次 Harness 启动代替。工具日志、页面快照和原始报告分别登记；只有登记为 Web 可见且哈希未变化的候选文件可以读取。

环境选择由明确的前端状态保存。轮询即使重建选项也会恢复仍在资产允许列表中的用户选择；资产不再允许该值时才回退到首个允许环境。启动请求读取该状态，不从刚重建的 DOM 猜测入口。

- `execution_status` 只描述进程和工作台生命周期；`report_status` 描述 JSON 报告是否完整；`test_status` 保留 Playwright 的通过、失败、跳过或未运行；`evidence_status` 单独描述截图、视频和 Trace 是否齐全。
- 原始 Playwright 结果保留在 `test_status`、`summary.playwright_status` 和 `summary.playwright_pass`；整体有效通过另记为 `summary.complete_pass`。只有工作台终态为 `PROCESS_ENDED`、退出码为 0、报告有效、恰好运行一个目标测试、没有跳过、登记步骤全部实际通过，并且 screenshot、video、trace 三类既定媒体齐全，整体才为真。哈希异常、取消、中断、进程、报告或证据异常不会被原始绿色结果覆盖。
- 错误保留原消息、已确定的期望值/实际值和 `PENDING_ANALYSIS` 归因。只有同时取得具体 `Expected` 与 `Received` 值才分类为 `ASSERTION_MISMATCH`；缺元素或严格匹配冲突为 `LOCATOR_OR_TARGET`，只有单侧值或普通 expect 文本为 `ASSERTION_UNRESOLVED`，纯超时保留 `TIMEOUT`。包含超时文字但已取得 H111/H106 两值的真实比较仍是值不符。没有执行的登记步骤显示 `NOT_EXECUTED`。
- 媒体 API 只按本运行记录中的 `media_id` 读取，并复核真实路径仍在 run 目录和文件大小未变化。截图与视频可在页面本地查看；Trace 下载后可执行：

```powershell
node node_modules/@playwright/test/cli.js show-trace <下载的-trace.zip>
```

原 T3 工程验证包含 18 项 Node 测试和一次真实 Chromium 工作台操作流；三项复审修复后为 21 项，本次证据完整性修订后完整集合为 25 项 Node 测试。工程测试不代替批准脚本正常/故障真实组合；本次纯汇总修订按授权没有重跑业务组合。

M2-C 增量工程验证使用 `npm test` 覆盖预算持久化、重启中断、重复启动、取消、报告异常、反例判定和文件边界；`npm run test:build-browser` 验证真实浏览器的提交、启动、状态与候选展示。`harness-probe` 目录仍须独立执行 `npm test`。模拟事件只证明工作台控制逻辑，不算真实 Harness 接入证据。

新的真实集成应从一个明确保活的前台 PowerShell 会话启动工作台服务，再从浏览器操作 Web；给外层命令的生命周期至少覆盖 10 分钟任务上限和收尾时间。按 `Ctrl+C` 触发工作台的有界取消与收尾，不能用短时命令宿主启动后让宿主先退出。发生异常时先保留 `.local` 目录、服务控制台的脱敏错误和 attempt 生命周期记录，不换 task ID 重置预算。当前历史真实任务没有这些新增记录，因此其唯一根因仍是未知。

## 验收命令

先在独立终端运行冻结站点和工作台：

```powershell
npm run lab
npm start
```

完成工程测试后，使用真实 Web 组合和重启验证：

```powershell
npm run test:real
# 正常停止并重新 npm start 后
npm run test:restart
```

`test:real` 会真实新增 normal/fault 运行，不能用作无改动反复碰运气。公开报告已记录本轮实际 ID；不要用旧成绩替代新的授权验收。

## 架构与隔离边界

- 复用：批准脚本的原始字节、冻结用例事实、固定 Playwright 参数与 heldout 合成站点。
- 隔离：独立依赖、端口、数据目录、运行进程、报告和媒体；不加载旧 Controller、Store 或浏览器执行主循环。
- 禁止：任意脚本/命令/文件/URL、跨域状态变更、外部监听、模型密钥或会话继承。

M2-C 延续用户接受的“独立任务目录＋最小资料暴露”单机开发策略，但它不是操作系统级文件或网络沙箱。Harness 能充分读写其专用工作目录；程序侧的路径、哈希、输出登记、超时、取消和预算控制不能被描述为强隔离。不得用本入口接触公司真实业务数据、账号、批准记录或整个产品仓库。

M1 第一阶段集成验证、三项代码复审修复及既定证据完整性关联保持不变。M2-C 的最终状态以单独验收报告为准，只能是“技术验证通过，等待人工核对”或“候选验证失败”；不代表批准资产、复杂建例、自愈、多人服务、产品发布或通用平台完成。

本分支的实际 M2-C 收口为“部分实现，真实集成中断”：工程验证通过，真实 Web 初始建例在候选落盘前中断并按重启规则收口，没有自动重放。完整事实、任务 ID、预算与未完成项见 [M2-C 验收报告](docs/M2C_ACCEPTANCE_REPORT.md)。

中断诊断批次没有启动 Harness 或调用模型；它只补齐后续任务的事件时记录、进程流收尾和存储失败关闭策略。原中断事实与预算保持不变，详见 [M2-C 中断诊断修订报告](docs/M2C_INTERRUPTION_DIAGNOSTIC.md)。

诊断修订后的单次真实 Web 复验已按新增独立授权启动一次，但验收驱动误把旧 `INTERRUPTED` 历史卡片当作新任务终态，随后清理逻辑取消了刚启动的新任务。新任务保留为 `CANCELLED`，无候选且正常/反例验证未运行；独立授权已耗尽，没有重跑。驱动现已改为按新 `task_id` 等待，完整事实见 [M2-C 单次真实 Web 复验报告](docs/M2C_REVALIDATION_REPORT.md)。

终态等待回归测试随后补准为直接检查 Promise 在“旧任务已终止、新任务仍生成”时保持 pending，并用原任意历史卡片扫描逻辑作预期失败对照；没有重新调用 Harness，详见 [终态等待回归测试补准记录](docs/M2C_REVALIDATION_WAIT_TEST_REVISION.md)。

终态等待修复后的独立一次性授权已从真实 Web 启动并正确绑定新 `task_id`。Harness 完整生成了新候选，但正常与反例执行均因两个安装位置的 Playwright Test 实例被同时加载而得到零测试，任务保留为 `CANDIDATE_VALIDATION_FAILED`；没有媒体、修订或替补调用。完整事实见 [终态等待修复后单次真实 Web 验证报告](docs/M2C_WAIT_FIX_VALIDATION_REPORT.md)。

后续零模型修复让 workbench 的候选执行显式使用本子工程的 Playwright CLI、配置和依赖解析根，harness-probe 默认入口仍保持独立。原候选的同字节副本已在正常页实际通过，并在反例页取得 PROBE-42/PROBE-41 断言差异；两边截图、录像、Trace 均生成，但新的独立复验记录和媒体尚未接入 Web。详见 [Playwright 双实例修复与同候选复验](docs/M2C_PLAYWRIGHT_RUNTIME_FIX_REVALIDATION.md)。

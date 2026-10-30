<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0042 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0042-01 | DR-0042-01 | 已确认 | 仅静态检查 | 列明入口/前后端/执行器/数据与历史目录，有具体代码证据和风险优先级 | 实际命令、退出码、统计、证据路径；工程/正式功能/模型调用分开。 | 命令：git ls-remote --heads origin refs/heads/codex/archive-before-architecture-review-20261029；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-architecture-review/archive-verification.json | git ls-remote --heads origin refs/heads/codex/archive-before-architecture-review-20261029 | 0 | 1 | 0 | 0 | workbench/qa/20261029-architecture-review/archive-verification.json |
| VT-0042-02 | DR-0042-02 | 已确认 | 单元测试通过 | 重试次数、临时文件、清理、尾部换行与既有IO注入语义保持；不改变其他存储策略 | 实际命令、退出码、统计、证据路径；工程/正式功能/模型调用分开。 | 命令：npm test；退出码：0；测试数量：1387；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/engineering.log | npm test | 0 | 1387 | 0 | 0 | workbench/qa/20261029-three-fixes/engineering.log |
| VT-0042-03 | DR-0042-03 | 已确认 | 单元测试通过 | 保留调用和返回契约；正确处理网络、非JSON错误、错误MIME及损坏下载文件名 | 实际命令、退出码、统计、证据路径；工程/正式功能/模型调用分开。 | 命令：npm test；退出码：0；测试数量：1387；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/engineering.log | npm test | 0 | 1387 | 0 | 0 | workbench/qa/20261029-three-fixes/engineering.log |
| VT-0042-04 | DR-0042-04 | 已确认 | 集成测试通过 | 新增明确安全的工程测试入清单；运行完整清单和4322功能测试；付费/环境受阻项明确标注 | 实际命令、退出码、统计、证据路径；工程/正式功能/模型调用分开。 | 命令：node workbench/qa/20261029-three-fixes/page-readiness/verify-pages.mjs；退出码：0；测试数量：22；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/page-readiness/results.json | node workbench/qa/20261029-three-fixes/page-readiness/verify-pages.mjs | 0 | 22 | 0 | 0 | workbench/qa/20261029-three-fixes/page-readiness/results.json |
| VT-0042-05 | DR-0042-05 | 已确认 | 单元测试通过 | 无请求体、肯定请求体与相邻接口隔离回归，并用原正式输入复验。 | 实际定向命令、退出码、统计及原4322准备返回。 | 命令：npm test；退出码：0；测试数量：1387；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/engineering.log | npm test | 0 | 1387 | 0 | 0 | workbench/qa/20261029-three-fixes/engineering.log |
| VT-0042-06 | DR-0042-06 | 已确认 | 集成测试通过 | 只处理预览副本，旧报告字节、下载、样式媒体及沙箱策略保持，真实浏览器复验零CSP错误。 | 定向工程、完整工程与正式4322功能证据分开登记。 | 命令：node workbench/qa/20261029-three-fixes/page-readiness/verify-pages.mjs；退出码：0；测试数量：22；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/page-readiness/results.json | node workbench/qa/20261029-three-fixes/page-readiness/verify-pages.mjs | 0 | 22 | 0 | 0 | workbench/qa/20261029-three-fixes/page-readiness/results.json |
| VT-0042-07 | DR-0042-07 | 已确认 | 集成测试通过 | 移除默认扩写指令；逐动作和预期保守核对来源，未核验内容明确提示待澄清；保存和导出不丢提示，真实模型结果独立核查。 | 定向工程、完整工程与正式4322功能证据分开登记。 | 命令：node workbench/qa/20261029-three-fixes/verify-assistant.mjs；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/assistant-verification.log | node workbench/qa/20261029-three-fixes/verify-assistant.mjs | 0 | 5 | 0 | 0 | workbench/qa/20261029-three-fixes/assistant-verification.log |
| VT-0042-08 | DR-0042-08 | 已确认 | 单元测试通过 | 真实同一宿主受保护；确证PID复用可回收旧锁；身份未知保持阻塞，旧锁兼容、并发二次核验，不终止未知进程。 | 定向工程、完整工程与正式4322功能证据分开登记。 正式真实锁的22项只读核验另见formal-host-identity.json，包含前后同SHA和精确CIM身份。 | 命令：node --test --test-concurrency=1 workbench/tests/native-dsh-host-lock.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/native-dsh-workspace-runtime.test.mjs；退出码：0；测试数量：30；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/host-lock-targeted.log | node --test --test-concurrency=1 workbench/tests/native-dsh-host-lock.test.mjs workbench/tests/native-dsh-runtime.test.mjs workbench/tests/native-dsh-workspace-runtime.test.mjs | 0 | 30 | 0 | 0 | workbench/qa/20261029-three-fixes/host-lock-targeted.log |
| VT-0042-09 | DR-0042-09 | 已确认 | 集成测试通过 | 本机新目录静默安装、57368文件全量校验、334源码与ZIP同字节、原注册/快捷方式/已记录配置文件及正式实例保全。 | 实际安装退出0；JSON回执及各层文件摘要，不等同于干净Windows或未覆盖业务验收。 | 命令：pwsh -NoProfile -File workbench/qa/20261029-three-fixes/packaging/verify-install-preservation.ps1；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-three-fixes/packaging/full-install-result-architecture-v4-verified.json | pwsh -NoProfile -File workbench/qa/20261029-three-fixes/packaging/verify-install-preservation.ps1 | 0 | 1 | 0 | 0 | workbench/qa/20261029-three-fixes/packaging/full-install-result-architecture-v4-verified.json |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent
- 命令：npm test
- 命令：npm --prefix harness-probe test
- 命令：npm run test:official
- 命令：node workbench/qa/20261029-three-fixes/official-functional.mjs
- 命令：node workbench/qa/20261029-three-fixes/verify-assistant.mjs
- 环境：Windows/Node>=22；唯一正式4322入口；复用原配置和数据。

## 结论

- 最终固定源工程1387/1387、Harness32/32通过；正式零模型44/44、来源输入7/7、页面18/18与下载4/4、报告媒体10/10通过。各层次及重叠测试不累加。
- 报告实际CSP/控制台错误为0，3视频实际解码播放暂停，Trace字节核验；旧报告和下载字节不变。
- 需求一次真实请求生成UI1/HTTP1；助手一轮生成UI7步/HTTP3步，原三处扩写消失；19个改写字段保留未核验警示，两Excel与保存草稿逐格一致。并非所有字段语义已被机器证明。
- 原生宿主锁30项联动通过，实际父/宿主CIM精确身份及锁前后摘要22项核验通过。PID复用/未知身份/并发只在临时目录注入。
- UI任务保留1次诊断和首次实际值缺失；同任务修订后12/12断言实际值、25产物摘要、录像和时间线完整。冻结UI及HTTP复跑均model_calls=0通过；最终报告2通过0未执行0不完整。
- 原76项目保持，仅新增3个本轮合成项目；原配置数据根保持，目标夹具4479已停止，正式工作台4322保持RUNNING/空闲。实际付费金额不可见，未重复提交未知付费任务。

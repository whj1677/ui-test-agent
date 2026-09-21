# M3-B2 项目单条用例真实建例与结果返回报告

日期：2026-09-21

分支：`codex/test-workbench-m3b2-project-case-run`

需求：`REQ-0027`

## 结论

本批达到规定的最高状态：**一条真实 Excel 导入的项目用例已从工作台 Web 明确启动，DeepSeek Harness 实际读取冻结输入并生成新候选；同一候选在正常页面通过、在独立反例页面取得指定断言差异，结果与媒体已返回项目关联任务，重启后仍可读。当前状态为“技术验证通过，等待人工核对”，候选未批准。**

没有启动反馈修订、替补任务或第二次 Harness；没有批量建例、任意 URL、自动批准、自愈或复杂业务扩展。M1/M2 历史、M3-B1 `INPUT_ONLY` 任务和批准排序脚本未改写。

Codex 当前具体子型号与推理档位未由环境暴露，记录为未知。建例端保持 `dsh 0.1.6-alpha.2`、`deepseek-official`、`deepseek-v4-pro`、两个 `0.1.6-alpha.2` 浏览器插件和 Playwright Test `1.62.1`。

## 项目输入与一次授权

真实 Chromium 在工作台创建项目并上传实际 `.xlsx`，完成工作表读取、预览和确认后选择用例 `M3B2-001` v1。任务来源与冻结身份如下：

| 项目 | 实际值 |
|---|---|
| task_id | `build-20260921120911-48d7c545` |
| attempt_id | `attempt-01-initial` |
| source project_id | `project-038b87b4-88d0-443b-ba66-c20883d7b3e9` |
| source case_id | `case-27a1c174-4485-4eaf-b9b0-d0c9cdedf3f6` |
| 用例内容 SHA-256 | `9A70FFC1F15863D7AD04ECEB69F9976895A7E810D5AF6C8DDDAE4C97B5AC44B9` |
| 环境 | `synthetic-probe-normal-v1` |
| 授权 | `m3b2-project-case-run-20260921`，`1/1`，在 `process_spawn` 时消耗 |
| 限额 | 30 次工具调用 / 600 秒；无自动重试、无修订 |

任务根与 attempt 工作目录中的 `case-snapshot.json` 哈希均为 `47404170FF54020D2FF960253A1220A36BAE32E9FAD5898AB7B5FFD14573E56E`；两处 `task.md` 哈希均为 `82520F792F58FFA3A740B491A38048435542C75068442CFAD2DEA05C53A7D813`。实际入口和候选输出位置渲染后，`agent-instruction.txt` 哈希为 `36A2896E425A925150ECFBB02A7088C15AF9236692910F6671F71B7B2AF51C82`。这些事实证明实际 attempt 使用创建任务时冻结的项目版本，没有重新读取项目最新版，也没有回退为旧固定探针正文。

## Harness 与候选

Harness 进程正常退出：exit code 0，`turn_end=completed`，final 存在，输出完整。可观察 Agent steps 为 8，外层观察到工具调用 8 次，其中浏览器工具 4 次；工具包含 browser navigate/snapshot/click、read 和 write。供应商没有返回底层模型请求数及 token usage，两项记录为未知，不能用一次 Harness 启动代替。

Harness 新生成候选大小 721 bytes，SHA-256：

`4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730`

候选按冻结用例保留两个步骤：`CASE_STEP_1` 检查“执行探针交互”按钮可见，`CASE_STEP_2` 点击按钮并断言状态输出 `PROBE-42`。两项均在正常结构化报告中实际观察到。候选在正常/反例执行前后哈希一致；代码由 Harness 写入专用 attempt，不是旧候选复制或 Codex 代写。

## 独立验证事实

| 验证 | 测试事实 | 进程/报告 | 判定 |
|---|---|---|---|
| 正常页面 | 1 条 `PASSED`；`CASE_STEP_1/2` 均执行 | exit 0；报告完整；`complete_pass=true` | 正常技术验证通过 |
| 独立反例 | 1 条 `FAILED` | exit 1；报告完整 | 期望 `PROBE-42`、实际 `PROBE-41`，`ASSERTION_MISMATCH`，指定错误已检出 |

反例失败没有被改写成普通业务通过；其归因仍为 `PENDING_ANALYSIS`。工作台只据冻结验证契约确认本合成反例的指定差异，不把它扩展成通用语义裁判。最终任务状态为：

`WAITING_HUMAN_REVIEW / GENERATED / PASSED / WAITING_REVIEW`

## Web 与媒体

工作台项目用例页可返回关联任务，并展示冻结输入、实际渲染指令、候选源码/哈希、两步映射、正常通过、反例失败及其期望/实际。真实浏览器检查结果：

- 正常和反例截图各 1 张，均真实解码加载；
- 正常和反例录像各 1 段，均实际播放、暂停，并在超过两次页面轮询后保持暂停进度；
- 正常和反例 Trace 各 1 份，从受控 task/file ID 路由下载后与登记 SHA-256 一致；
- 关闭并重启工作台服务后，项目、用例、任务、候选、结果和媒体关联仍可读取；授权仍为 `1/1`，没有恢复模型调用。

[脱敏的真实 Web 结果截图](evidence/M3B2_PROJECT_CASE_REAL_WEB.png)

录像使用浏览器原生 controls。Trace 不嵌入工作台，下载后在 `workbench` 目录用锁定 Playwright 查看：

```powershell
node node_modules/@playwright/test/cli.js show-trace <下载的-trace.zip>
```

## 一次外层修复

真实任务已经完成后，初始验收驱动错误地读取不存在的 `#build-selected-title`，因此把“等待精确 task_id 的 Web 展示”误报为 30 秒超时。原任务、报告、候选和媒体没有被覆盖。修复后改为检查 `#build-history button.selected[data-task-id=...]`，再用独立零模型读回入口对同一任务完成媒体与重启验证。读回前后授权均为 `1/1`，没有第二次 Harness 启动；原始驱动超时仍保留在私有总结中。

## 验证与投入

| 命令/阶段 | 结果 |
|---|---|
| `npm test`（workbench） | 60/60 通过，退出码 0 |
| `npm test`（harness-probe） | 24/24 通过，退出码 0 |
| `npm run test:m3b1-browser` | 1/1 通过；Harness 0 次 |
| `npm run test:m3b2-browser` | 1/1 通过；真实 Excel/Web/Playwright/媒体，Harness 为零模型捕获适配器 |
| `npm run test:m3b2-real` | Harness 1 次；候选与双验证完成；后续 Web 等待选择器超时 |
| `npm run test:m3b2-real-readback` | 退出码 0；同一任务两图、两视频、两 Trace 及重启读回完成；Harness 启动仍为 1 |

可量化墙钟：真实 Harness 44,584 ms；真实 Web 任务从驱动开始到私有总结结束约 90.6 秒；外层零模型读回 9.3 秒；锁定 Harness 运行时预检 7.9 秒；完整 workbench 回归 14.1 秒；harness-probe 回归 2.9 秒。开发/排查与人工输入时间未单独由计时器采集，记录为未知。模型货币成本、供应商请求数和 token usage 未由接口提供，均为未知。

运行前曾发生操作员把旧凭据输入普通终端的事件；真实调用在操作员确认旧凭据已撤销并替换后才开始。公开仓库、报告和候选不含 Key、Cookie、完整环境或私有会话。

## 边界和待办

- 当前仍是用户接受残余风险的“专用任务目录＋最小资料暴露”单机模式，不是 OS 级文件/网络沙箱。
- 本结果只证明固定无登录合成用例的单条建例技术闭环；不证明复杂业务、任意网站、批量建例或自动维护。
- 候选仍需维护者人工核对；工作台没有批准按钮，本批也没有登记为批准业务资产。
- 每次真实模型任务仍需要操作员通过受控方式提供凭据；凭据不会保存到任务、报告或 Git。
- 本批到该状态停止，不进入反馈修订、批量、审批或自愈。

## 2026-09-21 输入边界追加说明

后续只读审查确认：本报告对应历史任务的 v1 `case-snapshot.json` 包含工作台验证侧字段 `verification_contract.counterexample_actual=PROBE-41`。因此，本报告记录的真实正常通过、反例断言失败、媒体和授权事实保持不变，但该轮不能作为“反例设计对建例器保密”的验证依据。

新建任务的输入边界已在后续代码中改为模型可读 v2 快照与控制器验证契约分离；该修订不迁移、不覆盖本报告的历史任务。修订证据及候选只读首审见 [M3B2_INPUT_BOUNDARY_AND_CANDIDATE_REVIEW.md](M3B2_INPUT_BOUNDARY_AND_CANDIDATE_REVIEW.md)。

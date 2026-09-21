# M2-C 终态等待修复后单次真实 Web 建例验证报告

日期：2026-09-21

分支：`codex/test-workbench-m2c-build-ui`

基线：`b7a34c22bfb9401fb88c59a6af5a51561ba1299e`

结果分类：**B — Web 提交、真实 Harness 生成和进程收尾完成，但正常与反例验证均因 Playwright 运行时重复加载而未执行目标测试。**

## 优先结论

1. 本次网页建例没有完整走完。真实 Web 创建并启动了任务，Harness 实际访问合成页面并生成了新候选；工作台也只等待本次 `task_id` 后进入终态。但两次候选执行均为零测试，最终状态是 `CANDIDATE_VALIDATION_FAILED / GENERATED / FAILED / NOT_READY`，不能进入等待人工核对。
2. 正常页与独立错误输出反例均生成了完整 JSON 报告，但两者都是 `NOT_RUN`、`test_count=0`、`complete_pass=false`。报告中的全局错误明确显示候选从 `workbench/node_modules` 加载 `@playwright/test`，而 CLI/config 从 `harness-probe/node_modules` 加载另一实例，触发 `Requiring @playwright/test second time`，随后报告 `No tests found`。因此没有正常通过事实，也没有取得反例的 PROBE-42/PROBE-41 断言差异。
3. 候选执行没有启动测试用例，所以没有产生被测页面截图、录像或 Trace。Web 能显示候选源码、哈希、两份报告及工具文件的登记摘要；只有候选文件可在 Web 读取，其余文件仍按既定策略显示“仅本机登记”。工作台页面截图只是操作和终态证据，不能替代被测页面媒体。
4. 仍缺同一候选在正常页真实通过、在反例页产生指定断言不符，以及相应 screenshot/video/trace。没有修改候选、预期或断言，也没有启动修订或第二次 Harness。

## 真实任务与调用事实

| 项目 | 实际值 |
|---|---|
| task / attempt | `build-20260921060716-ae44c3f2` / `attempt-01-initial` |
| 授权 | `m2c-wait-fix-validation-20260921`，`1/1`，在 `process_spawn` 消耗 |
| 旧阶段预算 | 仍为 `1/2`，没有清零或挪用 |
| Harness | `dsh 0.1.6-alpha.2` / `deepseek-official` / `deepseek-v4-pro` |
| Codex 子型号 / 推理档位 | 运行环境未提供，记为未知 |
| Harness 启动 | 1 次；无重试、修订或替补启动 |
| 可观测 Agent steps / 工具 / 浏览器工具 | `8 / 7 / 5` |
| 供应商请求数 / usage | 接口未提供，均为未知 |
| Harness 墙钟 | 29,986 ms |
| Harness 进程 | PID 26980；exit code 0；exit、close、output 完整均已观察 |
| 生命周期 | 95 条；终态事件 `attempt_settled`；输出完整 |

Harness 的评估为完成且候选存在。工具名称包含 Playwright MCP 的 navigate、snapshot、click、evaluate，以及 read/write；这证明候选不是 Codex 复制的旧稿。候选源码由 Harness 新写入专用目录，大小 393 bytes，SHA-256 为 `119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A`。

## 正常与反例核对

| 核对项 | 正常页 | 错误输出反例 |
|---|---|---|
| report_status | `COMPLETE` | `COMPLETE` |
| test_status / test_count | `NOT_RUN / 0` | `NOT_RUN / 0` |
| complete_pass | `false` | `false` |
| 报告 SHA-256 | `4E7D066FC8AED04F7D35A6910824192B0D31BF9CD426DAFBBF37E8DEB81778C4` | `5A23FBE5EF4F1132BF95E989EF7743C1E105B4465448D23533E0975805F290FA` |
| 候选执行前后哈希 | 相同 | 相同 |
| screenshot / video / trace | 未产出 | 未产出 |

工作台没有把零测试或报告全局错误标成通过。任务错误保持 `TARGET_TEST_COUNT_INVALID`、期望 1、实际 0、归因 `PENDING_ANALYSIS`；报告原始错误另行保留，未改写成产品缺陷或指定反例检出。

## Web、后台与文件对应

- Web 通过固定 `synthetic-probe-v1` 提交并显式启动；本次驱动从独立授权 claim 取得 task ID，随后 `waitForTerminal(page, task.task_id)` 只等待该任务。
- 后台 `task.json`、授权 claim、候选哈希、正常/反例 JSON 报告和 Web 卡片均对应 `build-20260921060716-ae44c3f2`。
- 服务重启后 Web 再次选择同一任务并读取到同一终态；没有恢复模型调用。
- 登记文件共 10 个：候选 1、两份 Playwright 报告、两份运行元数据、Harness 摘要、生命周期、控制台日志和两个页面快照。候选为唯一 `web_visible=true` 文件。
- 脱敏 Web 截图：[本次终态页面](evidence/m2c-wait-fix-validation-web.png)，SHA-256 `3356742BAB01A3F864D1C9C66AA51CCF21F6D4DE62E9D3C48DDC13F81F0703AA`。

原始任务、模型事件、报告和私有工具文件继续保存在 Git 忽略的 `workbench/.local/m2c-acceptance/`，没有提交。

## 本轮最小代码与零模型验证

- 新增固定 ID 的一次性授权账本文件名和登记命令；旧授权文件和旧阶段账本继续独立读取。
- 工作台启动可显式选择本次授权 ID；真实入口继续用隐藏输入读取模型 Key，不把 Key 放进普通命令、提示词或报告。
- 增加零模型启动前检查：锁定 Harness 包、浏览器存在、任务目录可写、健康状态 ready、无活动任务、新授权 0/1，以及旧 INTERRUPTED/CANCELLED 状态未改变。
- 工程验证：workbench 42/42、build-browser 通过、harness-probe 24/24，均退出码 0；启动前专用检查退出码 0。

## 边界与停止点

本轮真实调用已按授权消耗并停止。没有改动原候选、原预期、历史报告、M1 批准资产或旧任务；没有自动修复 Playwright 双实例问题，因为本轮禁止替补真实调用且要求在候选失败后停止。若后续处理，应先用零模型临时候选复现并修正执行器的模块解析一致性，再由新的明确任务决定是否需要真实复验；本报告本身不构成新授权。

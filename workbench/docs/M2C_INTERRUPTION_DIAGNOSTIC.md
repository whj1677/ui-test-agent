# M2-C 中断诊断与进程收尾修订报告

日期：2026-09-21

审查基线：`de9b874b70f040ac9ee2d2009f8071326d3315bf`

分支：`codex/test-workbench-m2c-build-ui`

## 结论

本批完成了零模型的中断诊断与进程收尾补强。没有启动 DeepSeek Harness、没有调用模型、没有生成候选，也没有改写 `M2C_ACCEPTANCE_REPORT.md`、原真实任务或阶段预算。原任务 `build-20260921030548-a1bf1358` 的历史根因仍为 `UNKNOWN`；先前复现的 Windows `EPERM` 只证明曾存在一个已修复缺陷，不能据此唯一归因原中断。

后续 attempt 现在可在进程运行中逐事件保存服务实例、PID/父进程、阶段、工具元数据、终止请求、`error`、`exit`、`close` 与输出完整性。子进程结果只结算一次，并优先等待 `close`；流未在 2 秒内关闭则显式记为输出不完整。生命周期或任务状态持续写失败会输出脱敏错误、将工作台标为 `degraded`，并拒绝新建例。

## 原中断只读核对

| 事实 | 观察结果 |
|---|---|
| Task / attempt | `build-20260921030548-a1bf1358` / `attempt-01-initial` |
| 任务时间 | 03:05:49Z 启动；03:10:18Z 在后续服务恢复时收口 |
| 外层上限 | 600 秒；现有记录没有到期事件 |
| 主动取消 | 没有取消请求记录 |
| Harness / 浏览器迹象 | 有未完成 Harness 会话投影及 2 个 `.playwright-mcp` 文件，说明到达浏览器工具阶段 |
| 候选与终态 | 无候选、无 Harness summary、无进程 `exit/close`、无正常/反例报告 |
| PID / 父进程 | 旧实现未持久化，未知 |
| 直接根因 | `UNKNOWN`；不能归因为 EPERM、模型、网络或用户行为 |

工作台/集成协调进程、Harness 子进程和浏览器子进程在旧记录中没有可关联 PID；现存文件只能证明部分阶段，不能补造完整工具调用总数或终态。

## 最小修订

- `runOwnedProcess` 分开记录 `exit` 与 `close`，在 `close` 时刷新无换行 NDJSON 末行；设置 2 秒有界流收尾和 3 秒终止宽限，使用一次性结算守卫。
- Harness 事件解析只向生命周期日志写类型、阶段、工具名、字节数等元数据，不写 final 文本、内部推理、完整参数或环境。达到工具额度后计数冻结且只发起一次终止。
- Build attempt 按事件写 `lifecycle.ndjson`，任务中保存服务实例和观测摘要；重启读取最后事件，标 `INTERRUPTED`、`cause=UNKNOWN`，不重放也不增加预算。
- 后台 completion 的拒绝不再由空 `catch` 静默吸收；最终持久化失败会进入可查询的 degraded 状态。健康接口公开服务实例和脱敏存储状态，不公开敏感错误正文。
- 服务收到 `SIGINT`/`SIGTERM` 时先取消本任务拥有的活动进程，最多等待 5 秒收尾，再关闭 HTTP 服务；不接管或终止其他进程。

脱敏生命周期示例：

```json
{"sequence":1,"task_id":"build-...","attempt_id":"attempt-01-initial","service_instance_id":"service-...","type":"process_spawn","pid":1234,"parent_pid":5678,"partial_observation":true}
{"sequence":2,"type":"harness_event","event_type":"tool_call","tool":"mcp__playwright-mcp__browser_navigate"}
{"sequence":3,"type":"process_exit","exit_code":7,"signal":null}
{"sequence":4,"type":"process_close","exit_code":7,"signal":null}
{"sequence":5,"type":"output_complete","output_complete":true,"trailing_stdout_line":false}
```

若协调进程在第 2 条后被强制终止，日志可以只保留最后事件；重启会追加 `recovered_interrupted` 并明确“缺少终态、原因未知”，不会把部分观测冒充完整调用数。

## 零模型故障注入

| 子工程命令 | 结果 | 覆盖 |
|---|---:|---|
| `npm test`（`harness-probe`） | 24/24，退出 0 | 真实外部 Node 假子进程的分段 NDJSON、异常退出、无换行与截断末行、取消、到期、工具额度、`exit/close` 与流收尾 |
| `npm test`（`workbench`） | 38/38，退出 0 | 生命周期持久化、短暂/持续状态写失败、completion 拒绝可观察、degraded 拒绝新建例、协调进程被终止后的重启中断与预算不重放，以及既有 M1/M2-C 回归 |

所有故障均在临时目录和专用假子进程中注入。测试没有运行 `build-real.integration.mjs`，没有关闭办公进程，也没有修改批准资产。

## 新真实验证的启动条件

工程条件已经具备：建议从明确保活的前台 PowerShell 会话启动工作台服务，使外层生命周期覆盖单次 10 分钟上限及收尾；从真实 Web 发起后，以 `Ctrl+C` 触发有界取消。不要把服务置于会提前结束的短时命令宿主中。异常时保留 `.local`、控制台脱敏错误和 lifecycle 文件，再做诊断。

这只表示后续一次真实验证具备更好的可诊断性，不代表本批已获得新的模型调用授权或成功事实。M2-C 阶段预算仍是已用 `1/2`；剩余一次仍是原规则下的显式修订额度，不能改作新的初始建例，也不能通过新 task ID 重置。

## 边界

未新增后台 Worker、守护系统、数据库、语义审核、自动重启或业务范围；未更改 Harness 核心、M1 批准脚本、历史候选、历史报告、旧真实任务与预算。具体 Codex 子型号和推理档位未由运行环境暴露，记录为未知。

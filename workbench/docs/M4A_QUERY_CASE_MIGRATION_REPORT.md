# M4-A HOLD-Q1 列表查询用例迁移验证报告

日期：2026-09-22

分支：`codex/test-workbench-m4a-query-case`

需求：`REQ-0029`

## 结论

本批结论为 **C：项目导入、冻结输入、零模型接线和真实 Web 启动已经完成，但 Harness 在第一次模型请求阶段收到 HTTP 404，未进入浏览器工具、未生成候选，因此正常/既定反例验证、媒体和人工首审均未发生。**

真实任务 `build-20260922014848-604af86d` 保留为 `FAILED / FAILED / NOT_RUN / NOT_READY`。本次初始启动已经消耗；虽然阶段上限还剩一次“有明确候选错误时的定向修订”，当前没有候选，也没有可供修订的脚本错误，因此没有把该额度用作替补初稿或碰运气重跑。

本批未修改 `heldout-lab/cases.json`、`oracle.json`、冻结页面、批准排序脚本、M3-C 资产或历史结果；未自动批准、未进入批量、复杂业务或自愈。

Codex 的具体子型号与推理档位未由运行环境暴露，记录为未知。建例端保持锁定的 `dsh 0.1.6-alpha.2`、`deepseek-official`、`deepseek-v4-pro`、既有浏览器插件与 Playwright Test `1.62.1`，没有升级依赖。

## 原用例、项目与冻结输入

工作台从当前基线的 `heldout-lab/cases.json` 读取 HOLD-Q1，并以有 schema 版本的原生用例包经真实 Web 完成预览和确认。转换后保留前置条件、测试数据、S01-S03 的动作及逐步预期；固定反例 HOLD-Q2 的入口和故障说明只留在验证控制器侧，没有出现在模型可读的快照、`task.md` 或 Agent 指令中。

| 项目 | 实际值 |
|---|---|
| project_id | `project-91a7e347-5741-41f6-a33d-3b6e4c140d13` |
| case_id | `case-541ee3ef-6989-4b9d-a490-8ed3355342d9` |
| 对外编号 / 版本 | `HOLD-Q1` / v1 |
| 用例内容 SHA-256 | `2DDBA239792E3CC58307918BD3DF32604CD510DC997CEBA87F8C5DB0CCD02ED2` |
| cases.json SHA-256 | `5A4D33D9211EBF145F2AE0228CAB62ABF7B91FEBDDC6E9941BC53593353DCFC9` |
| oracle.json SHA-256 | `23697F682EE3C0A83C16B2E867BEC982F73966D4AE063015D16E191DD9D89E17` |
| 正常环境 | `heldout-query-q1-v1`，`/probe/q1` |
| task_id | `build-20260922014848-604af86d` |
| attempt_id | `attempt-01-initial` |

冻结快照、`task.md` 和实际渲染的 Agent 指令分别登记到任务；attempt 工作区使用同一冻结版本，没有重新读取项目最新版，也没有回退到旧 `PROBE-42` 探针任务。服务重启后能按同一 task_id 读回任务和文件，且没有自动重放。

## 真实 Harness 事实

本次授权 `m4a-query-case-run-20260922` 的初始启动在观察到 Harness 子进程后记账，实际为 `1/2`。单次上限为 30 个工具调用和 600 秒。

原始 DSH 会话中的终态为：

- `assistant/attempt`：finish reason 为 error；
- 错误消息：`DeepSeek Messages request failed (404)`；
- 错误代码/HTTP 状态：`HTTP_404` / `404`；
- `turn/end`：reason `error`；
- Harness exit code：1；墙钟 2,892 ms；
- 可观察 Agent step：1；工具调用：0；浏览器工具调用：0；
- 候选文件：不存在；供应商底层请求数及 token usage：接口未提供，记录为未知。

这证明失败发生在首次模型请求阶段、早于页面探索和候选写入。现有证据不能进一步唯一确定是模型路由、Base URL、账号权限还是其他上游配置问题，因此报告只记录 HTTP 404，不猜测具体根因。

## 正常、反例、义务和媒体

| 项目 | 结果 |
|---|---|
| Harness 是否消费冻结输入 | 已将冻结文件和指令写入实际 attempt，并向 Harness 提交；模型请求失败，无法证明模型完成理解或执行 |
| 新候选 | 未生成 |
| S01-S03 候选覆盖 | 无候选，无法核查；不是“遗漏 0 项” |
| 正常运行 | `NOT_RUN` |
| 既定反例运行 | `NOT_RUN` |
| 被测页截图/录像/Trace | 均未生成 |
| 工作台 Web | 可查看项目、用例、失败任务、冻结输入、生命周期文件和失败状态；没有候选、验证结果或被测页媒体可展示 |
| 人工首审 | `NOT_READY`，未进入 |

公开截图仅证明真实 Web 的项目、任务和失败状态展示，不能替代被测页面媒体：

[真实 Web 失败状态截图](evidence/M4A_QUERY_CASE_REAL_WEB.png)

## 通用代码变化

- 增加从当前 HOLD-Q1 原文生成可逆原生用例包的转换器，并对源文件哈希和逐字段内容做校验。
- 增加数据驱动的 HOLD-Q1 环境和控制器侧固定反例契约；正常模型输入不包含反例入口或答案。
- 复用现有 build task、当前 task_id 等待、生命周期、Playwright 统一运行根、结构化报告和媒体登记，不建立第二套任务系统。
- 工程预检允许显式 fixture 路由，以实际 Playwright CLI 分别证明 `/probe/q1` 可通过、`/probe/q2` 可产生结构化失败及三类媒体；这些零模型夹具结果不冒充 Harness 候选结果。
- 增加当前 Windows 用户绑定的 DPAPI 凭据保存脚本。密钥不进入命令行、任务、报告或 Git；实际调用前由前台脚本解密到当前进程环境，结束后清除。它是本机使用便利，不是操作系统级隔离。

## 工程验证与投入

| 命令/阶段 | 实际结果 |
|---|---|
| `npm test`（workbench） | 69/69 通过，退出码 0 |
| `npm test`（harness-probe） | 24/24 通过，退出码 0 |
| `npm run test:m4a-cli-preflight` | 退出码 0；正常夹具 1 条通过、固定反例 1 条结构化失败；各自生成截图、录像、Trace；Harness 0 次 |
| `pwsh -NoProfile -File .\scripts\run-m4a-real.ps1` | 真实 Web 导入/冻结/启动完成；Harness 1 次，HTTP 404；候选与业务验证未运行 |
| PowerShell 脚本解析检查 | 保存凭据和前台启动脚本均通过 |

可量化墙钟：真实 Harness 2,892 ms；真实验收驱动从开始到总结约 10.3 秒。开发、排查和人工操作时间未由统一计时器采集，记录为未知；模型货币成本、供应商请求数和 token usage 均为未知，未填零。

## 停止点和后续边界

- 本轮没有有效候选，故不具备“定向反馈修订”的输入条件；不启动第二次 Harness。
- 若后续要继续，必须先由维护者独立确认 `deepseek-official + deepseek-v4-pro` 在所配官方端点和账号中的实际可用路由，再取得新的明确调用授权；本报告不把剩余修订额度解释为替补初始额度。
- 未验证完整 HOLD-Q1 候选覆盖、正常执行、对应反例检出、媒体展示或人工首审。
- 本批只证明工作台已消费并冻结完整 HOLD-Q1、真实 Web 能发起受控任务，以及失败可追溯；不证明未知页面泛化、复杂业务、批量稳定或发布能力。

到该 C 类结果收口即停止。

# M2-C 诊断修订后单次真实 Web 建例复验报告

日期：2026-09-21

分支：`codex/test-workbench-m2c-build-ui`

已审查基线：`a0da137fb8e262d093f1e8e7fab95f629af8c1bc`

结果分类：**C — 复验驱动误判旧历史终态并取消新任务；没有候选，正常/反例验证未运行。**

## 结论

本次从真实工作台 Web 提交并启动了新的 `synthetic-probe-v1` 任务，Harness 子进程确实创建，因而本次独立初始调用授权已按规则从 `0/1` 消耗为 `1/1`。但是复验驱动等待终态时错误扫描整个历史列表，旧任务的 `INTERRUPTED` 卡片立即满足等待条件；驱动进入清理后对仍活动的新任务发出取消。因此本次没有生成候选，也没有执行正常与独立反例验证，不能进入“等待人工核对”。没有启动第二次 Harness。

该原因由新任务的事件时间线直接确认，不归因于模型、网络或用户：`process_spawn` 后 50 ms 出现 `cancel_requested`，其发起路径是复验驱动的 `finally -> closeRuntime -> stop`。代码已在零模型条件下改为先取得本次授权对应的 `task_id`，再只等待该任务卡片的终态；授权耗尽，修复后没有重跑真实模型。

## 实际记录

| 项目 | 实际值 |
|---|---|
| 新任务 ID | `build-20260921041411-12b52a7b` |
| attempt | `attempt-01-initial` |
| 服务实例 | `service-feb93398-2fac-463b-b99d-57486f4b765d` |
| Harness PID / 父 PID | `23408 / 6112` |
| task / generation / verification / human | `CANCELLED / CANCELLED / NOT_RUN / NOT_READY` |
| 候选 | 未生成；哈希不适用 |
| 授权 | `m2c-diagnostic-revalidation-20260921`，`1/1`，在 `process_spawn` 消耗 |
| 旧阶段预算 | 仍为 `1/2`，没有挪用剩余修订额度 |
| Harness 启动 | 1 次 |
| 可观测 Agent steps / 工具 / 浏览器工具 | `0 / 0 / 0`；进程被外层快速取消，只代表已观测值 |
| 供应商底层请求数 / usage | 未提供，记为未知，不填零 |
| Harness 墙钟 | 579 ms |
| 子进程退出事实 | exit code 1；exit/close/output_complete 均已观察；termination=`cancelled` |

生命周期顺序为：`attempt_started` → `fixture_starting` → `harness_starting` → `process_spawn` → `cancel_requested(user_cancelled)` → `termination_requested(cancelled)` → `process_exit` → `process_close` → `output_complete`。持久化记录中的中文消息沿用通用取消文案“用户取消了当前建例任务”，但本次实际发起者是复验驱动清理逻辑；原记录未改写，报告单独澄清。

## Web、后台与原始事实核对

- 真实 Web 完成了“提交固定任务”和“启动 Harness”；后台生成了独立任务目录及一次 initial attempt。
- 服务重启后的 Web 能读取新任务，展示 `CANCELLED / CANCELLED / NOT_RUN / NOT_READY`、授权 `1/1`、无候选及两份已登记文件。
- 后台 `task.json`、`lifecycle.ndjson`、`harness-summary.json` 与 Web 最终展示一致。
- 本次无候选，因此不存在候选哈希、Playwright 正常/反例报告或被测页面截图/录像/Trace。工作台页面截图只能证明 Web 读回，不能替代这些缺失的执行证据。
- 当前页面对 lifecycle 与 harness 原件仅登记、不直接公开；候选执行媒体入口本次因验证未运行而不适用。没有临时开发播放器。

脱敏 Web 证据：[取消终态读回截图](evidence/m2c-revalidation-cancelled.png)。私有任务原件继续保存在 Git 忽略的 `workbench/.local/m2c-acceptance/`，未提交。

## 保护项核对

| 保护项 | 复验前 SHA-256 | 复验后 SHA-256 | 结论 |
|---|---|---|---|
| 旧阶段账本 | `4A836B5142E7AA26CE0754D2C333BAB0903ECE73DCDAB85B55C6DC8CAA08EA0B` | 相同 | 未改变 |
| 旧任务 `build-20260921030548-a1bf1358/task.json` | `8642248E7E353520C144CB67E8A0A9E44019A5B8BF835BA88FFFC098EDA78178` | 相同 | 旧 `INTERRUPTED/UNKNOWN` 保留 |
| `M2C_ACCEPTANCE_REPORT.md` | `8AA10B576F17153E89B60A0AAD1241F398E5C7AFA15252876E2C1F7EC2DBAAD0` | 相同 | 历史报告未改写 |

M1 批准资产、旧 M2 候选和原历史结果没有修改。本次授权账本是独立文件，不能重置旧预算或创建替补调用。

## 修复与验证

- 独立授权只允许一次 initial，并且仅在观察到 `process_spawn` 时原子消耗；页面显示与后端健康接口读取同一账本。
- 复验驱动现在绑定本次新建 `task_id` 等待终态，不再以任意历史卡片终态作为完成条件。
- 增加零模型重启读回检查，确认耗尽授权、取消终态、无候选、旧预算未变和 Web 最终截图。
- 候选执行器按既定要求开启 screenshot、video、trace 三类媒体并分类登记；本次没有候选执行，不能把配置准备视为媒体已产出。

工程测试的最终命令、数量与退出码以本次 REQ 验证记录为准。真实模型路径只启动上述一次，没有修订或自动重试。

## 边界与停止点

本次属于 C 类：真实任务和进程有完整收尾证据，但复验未完成候选生成及双验证。当前代码已具备避免同类“旧历史终态误判”的条件；是否再次真实验证需要新的明确授权，本任务不会自行追加调用。这里不批准候选、不接工作台复杂业务、不进入 Harness 扩展或自愈。

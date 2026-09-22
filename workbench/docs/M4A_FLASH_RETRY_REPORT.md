# M4-A deepseek-flash 单次真实复验记录

日期：2026-09-22

分支：`codex/test-workbench-m4a-query-case`

关联需求：`REQ-0029`

## 结论

用户在 DeepSeek Harness Web 中完成登录并明确同意将本次 M4-A 复验模型从原锁定的 `deepseek-v4-pro` 改为已验证可用的 `deepseek-flash`。本次使用独立一次性授权，从真实项目 Web 启动同一完整 HOLD-Q1 输入，Harness 实际浏览正常页面并生成一份新候选。

最终状态为 **`CANDIDATE_VALIDATION_FAILED / GENERATED / FAILED / NOT_READY`**：候选在正常页实际 1 条通过，在冻结反例页实际 1 条失败并取得预期“共3条”/实际“共6条”的差异；但三个 `test.step` 标题均在要求的精确 `CASE_STEP_<order>` 后追加了动作文字，结构化步骤门无法把它们视为精确标记。因此候选没有进入等待人工首审，也没有批准、修改或再次调用模型。

原 HTTP 404 任务、原报告和旧 `deepseek-v4-pro` 事实保持不变。本报告是追加式新复验，不追溯改写旧结论。

## 授权、任务与模型

| 项目 | 实际值 |
|---|---|
| 新授权 | `m4a-query-case-flash-retry-20260922`，一次 initial，30 工具调用/600 秒 |
| task_id | `build-20260922022951-0e638858` |
| attempt_id | `attempt-01-initial` |
| 模型 | `dsh 0.1.6-alpha.2 · deepseek-official / deepseek-flash` |
| 凭据来源 | 用户刚完成登录的独立 DSH home；未读取或输出凭据内容 |
| 项目 / 用例 | `project-36e84aad-b95b-4f93-bebf-29a51841277b` / `case-b9de79dc-73fd-47a4-8970-22a6ce9b0831` |
| 用例内容 SHA-256 | `2DDBA239792E3CC58307918BD3DF32604CD510DC997CEBA87F8C5DB0CCD02ED2` |
| 候选 SHA-256 | `CA3819EF8CA3A3C8A89DFFEB5F53372658EA34EEAD59245714BB742BB06B6914` |

初次验收驱动在 Harness 启动前因仍断言旧授权上限为 2 而停止；当时任务为 `SUBMITTED`、attempt 为 0、授权为 `0/1`，没有模型调用。修正纯外层断言后，继续同一个 task_id 从真实 Web 点击启动，没有换任务或重置账本。

Harness 进程 exit 0，`turn_end=completed`，候选存在，输出完整。墙钟 98,987 ms；可观察 Agent step 20；工具调用 22，其中浏览器工具 10。供应商底层请求数及 usage 未由该事件接口提供，记录为未知。

## 候选与原义务对应

| 原步骤 | 候选实际检查 | 结果 |
|---|---|---|
| S01 默认态 | 标题、12条/1/4页、关键词空、站点/类型全部、编号升序、表体3行 | 正常页实际通过 |
| S02 只改条件且不查询 | 控件值、计数器不变、表体完整矩阵与操作前相同、编号 H101/H102/H103 | 正常页实际通过 |
| S03 联合查询 | 3条/1/1页、3行、H102/H106/H110、站点、类型、120/220/110 kW | 正常页实际通过 |

候选没有反例值特判、地址后缀特判、删断言、吞异常或跳过；使用 `process.env.PROBE_URL`。但步骤标题分别为“`CASE_STEP_1 + 动作文字`”等，而任务要求使用精确标记。这是候选交付契约不符合，不是报告解析器漏掉了实际失败。

## 正常与既定反例

| 运行 | 原始事实 | 工作台判定 |
|---|---|---|
| 正常 `/probe/q1` | 1 条 `PASSED`，exit 0；三段业务动作和断言均执行 | 原始 Playwright 通过，但步骤精确标记覆盖失败，整体候选验证失败 |
| 冻结反例 `/probe/q2` | 1 条 `FAILED`，exit 1；S03 计数器期望 `共3条 · 第1/1页`，实际 `共6条 · 第1/2页` | 保留 `ASSERTION_MISMATCH`；因步骤标题不是精确标记，不登记为结构化“指定反例检出成功” |

正常和反例使用同一候选，候选前后 SHA-256 一致。没有向 Harness 提供反例入口、故障说明或答案。

## Web 与媒体

工作台为正常和反例分别生成并登记：

- 截图各 1 张，真实加载；
- 录像各 1 段，真实播放、暂停并取得非零播放进度；
- Trace 各 1 份，通过受控 task/file 路由读取并核对登记哈希；
- 服务重启后，同一项目、用例、任务、候选、错误和媒体仍可读，没有再次调用模型。

[脱敏 Web 结果截图](evidence/M4A_QUERY_CASE_FLASH_RETRY_WEB.png)

页面显示模型已修正为本次实际的 `deepseek-flash`。候选代码、原始报告和媒体继续保存在 Git 忽略的专用目录；公开仓库不包含凭据、原始会话、录像或 Trace。

## 工程与停止边界

- 新增显式 flash patch，不改变原 `browser.cordis.yml` 的 `deepseek-v4-pro` 默认值。
- 新增独立单次授权 ID，不挪用旧 M4-A 的可选修订额度。
- 只有显式 `useStoredDshCredentials` 路径才省略进程环境中的 API Key/Base URL，并使用指定 DSH home；通用默认仍要求受控进程凭据。
- 零模型授权/接线测试 5/5 通过；完整 workbench 回归 70/70 通过；完整 harness-probe 回归 24/24 通过。
- 真实 Chromium Web 读回确认正常/反例截图各 1 张、录像各 1 段可加载并实际播放/暂停/定位，Trace 各 1 份下载哈希一致；服务重启后读回仍通过。
- 本次没有反馈修订授权，候选保持原字节，结果停在“候选验证失败”。

本轮不登记批准资产，不进入批量、复杂业务或自愈。

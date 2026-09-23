# E2E-01 六用例工作台体验指南

> 2026-09-23 状态提示：下文仍适用于查看**历史运行**。新版“中文步骤证据回放”目前只完成隔离工程验证；4322 服务还在旧运行器，六条新的产品回放尚未生成。不要把历史原录像或旧字幕当作本次步骤回放。服务切换和六条产品自测完成前，本指南不宣称该能力已可供最终体验。

现在打开 <http://127.0.0.1:4322/workspace/>，先选项目 **E2E-01 六用例工作台自动建例闭环**。三份候选和六条目标运行已准备好；你只需查看，无须输入密钥、编辑 JSON、运行测试命令或重新启动建例。

被测设备台账页面的三组入口分别是：组合查询 [正常 /ui/a](http://127.0.0.1:4320/ui/a) / [故障 /ui/b](http://127.0.0.1:4320/ui/b)，功率排序 [正常 /ui/c](http://127.0.0.1:4320/ui/c) / [故障 /ui/d](http://127.0.0.1:4320/ui/d)，设备详情 [正常 /ui/e](http://127.0.0.1:4320/ui/e) / [故障 /ui/f](http://127.0.0.1:4320/ui/f)。它们是本机固定设备数据，不连接真实公司站点。

## 如果本机服务没有运行

先在浏览器试开 `/ui/a` 和工作台地址。若设备台账服务未运行，在一个 PowerShell 窗口执行并保持窗口开启：

```powershell
Set-Location 'C:\Users\20240082\.codex\worktrees\test-workbench-six-case-e2e\ui-test-agent\workbench'
npm run start:trial-site
```

若工作台服务未运行，再在第二个 PowerShell 窗口执行：

```powershell
$trialRepo = 'C:\Users\20240082\.codex\worktrees\test-workbench-six-case-e2e\ui-test-agent'
Set-Location (Join-Path $trialRepo 'workbench')
$env:WORKBENCH_PORT = '4322'
$env:WORKBENCH_DATA_DIR = (Join-Path $PWD '.local\six-case-e2e')
$env:WORKBENCH_TEST_SITE_BASE_URL = 'http://127.0.0.1:4320'
$env:WORKBENCH_BUILD_AUTHORIZATION_ID = 'e2e01-six-case-project-20260923'
$env:WORKBENCH_DSH_HOME = 'C:\Users\20240082\.codex\worktrees\workbench-m4a-query-case\ui-test-agent\workbench\.local\m4a-query-case-acceptance\build-runtime\dsh'
$env:WORKBENCH_HARNESS_PATCH = (Join-Path $trialRepo 'harness-probe\config\browser-flash.cordis.yml')
$env:WORKBENCH_USE_STORED_DSH_CREDENTIALS = '1'
$env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm start
```

两个命令都是前台服务，窗口关闭即停止。已有正确服务时不要重复启动，也不要关闭来源不明的占用进程。密钥位于本机 DSH_HOME 下 Git 忽略的 `.env`，无需在命令中填写；不要把它复制到仓库或报告。仅查看现有记录不会调用模型。

## 按页面查看六条结果

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| 1 | 工作台 → **项目** → **E2E-01 六用例工作台自动建例闭环** → **用例** | TC-001～TC-006 六条已确认的 v1 用例；正文保留动作、逐步预期、前置条件和测试数据。 |
| 2 | 项目 → **建例任务** → 选 **TC-001 · v1** 的新任务（ID 结尾 `03dfb09e`） | 工作台生成的候选 v2；首稿 v1 的正常页定位失败也在任务历史中，v2 经正常页反馈修订。任务显示 `TECHNICAL_VALIDATION_PASSED / WAITING_REVIEW`，并未批准。 |
| 3 | 同一任务 → **候选与运行** | TC-001 正常记录 `run-91f7c675-239d-4736-8f10-43e9e1d46525` 为 PASSED；TC-004 对照记录 `run-c0dffdf4-5953-4c38-b6b2-71be1c43d04e` 为 FAILED。后者在 CASE_STEP_3 期望“共2条”，实际“共3条”。 |
| 4 | 项目 → **建例任务** → 选 **TC-002 · v1** 的新任务（ID 结尾 `98c45421`） | 候选 v1；TC-002 正常记录 `run-0271a569-5ac4-46d0-b6a6-2892c57cbc9a` 为 PASSED。TC-005 对照记录 `run-f08aadb1-4ae7-40e8-aa40-3b5e9e88fc2c` 在 CASE_STEP_2 为 FAILED：第二行期望 DEV-006，实际 DEV-002。 |
| 5 | 项目 → **建例任务** → 选 **TC-003 · v1** 的新任务（ID 结尾 `922a763f`） | 候选 v1；TC-003 正常记录 `run-181fe9f3-5c98-4426-bfd9-96ba54210031` 为 PASSED。TC-006 对照记录 `run-0d50b295-883d-4454-ab25-ad62375033df` 在 CASE_STEP_2 为 FAILED：期望 220 kW，实际 320 kW；CASE_STEP_3 保持 NOT_EXECUTED。 |
| 6 | 项目 → **执行记录** → 按上面的运行 ID 找六条目标记录 | 每条都有独立运行 ID、实际执行用例、来源候选哈希和步骤状态。同组正常/故障记录使用相同候选哈希；故障运行原始状态保持 FAILED、`complete_pass=false`，另显示“对照验证检出指定缺陷”。 |
| 7 | 在任一目标记录中点击 **查看截图**、操作录像播放/暂停/拖动，或点击 **下载 Trace** | 浏览器实际读取工作台保存的媒体；六条记录各有截图、录像和 Trace。刷新页面后仍可查看，不会重新建例或执行。 |

项目执行记录总数是 **8**，因为旧失败也保留：TC-001 首稿正常页定位失败，以及 TC-005 解析修复前的对照运行 `run-d59a52e9-bf00-4acb-a3c3-0b7218160147`。体验六条目标结果时按表中的运行 ID 选择，不把这两条旧记录误认为丢失或新增业务用例。

“技术验证通过”仅表示三组同哈希候选完成正常与指定故障对照，仍需你人工看候选和界面。不要把故障记录的 `FAILED` 改理解为业务通过，也不需要确认“所有功能通过”。你可以只记录哪一步不好找、看不懂，或媒体是否顺手。完整的修复依据、哈希和运行结果见[实际验证记录](E2E_01_ACCEPTANCE_REPORT.md)。

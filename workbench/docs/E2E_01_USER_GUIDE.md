# E2E-01 六用例工作台体验指南

现在打开 <http://127.0.0.1:4322/workspace/>，选择项目 **E2E-01 六用例工作台自动建例闭环**，进入 **执行记录**。以下六条是 2026-09-24 本批最终可体验的记录；只需查看，无须重新建例或试跑。项目目前有 39 条运行记录，其中旧记录继续保留。

| 用例 | 本批运行 ID | 业务结果与重点 |
|---|---|---|
| TC-001 组合查询正常 | `run-fee3e7f4-88fa-4ed4-b85a-1ba526c1f4dd` | PASSED；结果共 2 条。 |
| TC-004 组合查询故障 | `run-9a19f912-d770-4b36-a92c-d2b5d5bcc43a` | FAILED；第 3 步预期“共2条”，实际“共3条”。 |
| TC-002 功率排序正常 | `run-c499a492-8678-4b2f-be59-515d5a30e4f6` | PASSED；DEV-005 后是 DEV-006。 |
| TC-005 功率排序故障 | `run-70990e55-b484-4774-82eb-d93525e093ce` | FAILED；第 2 步预期第二行 DEV-006，实际 DEV-002。 |
| TC-003 设备详情正常 | `run-ddc80799-3ced-4cdb-9295-ff25dda0f1e8` | PASSED；详情额定功率 220 kW。 |
| TC-006 设备详情故障 | `run-297c7474-bb80-4901-89a4-6f482a464479` | FAILED；第 2 步预期 220 kW，实际 320 kW；第 3 步未执行。 |

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| 1 | 项目 → **用例** → TC-001～TC-006 中任一条 | 冻结 v1 正文，包括业务动作、预期、前置条件、测试数据。 |
| 2 | 项目 → **建例任务**，分别看 TC-001、TC-002、TC-003 | 三份工作台生成的候选；仅技术验证，仍待人工核对和批准。故障用例复用同组候选，没有另造脚本。 |
| 3 | 项目 → **执行记录** → 按表中运行 ID 打开详情 | 该运行自己的步骤、结果、候选 SHA-256、截图和媒体。 |
| 4 | 详情 → **中文步骤证据回放（非原始连续录像）** → 播放，点击已执行步骤 | 中文字幕显示本次冻结动作、检查目标和原始结果；点击步骤跳到对应回放章节，播放位置同步高亮。失败处查看预期与实际。 |
| 5 | 在回放上暂停、拖动、回退、调整倍速；点击 **下载带中文字幕的步骤证据回放** | 六条各有独立可播放、可下载的视频。TC-006 第 3 步显示未执行，不能跳到虚构画面。 |
| 6 | 详情 → **原始连续录像（不支持精确步骤定位）**、步骤截图、**下载本次 Trace** | 原录像、步骤回放、截图和 Trace 是不同证据。原录像不支持精确步骤跳转；回放由执行时绑定的步骤截图生成，不是连续动作实录。 |

工作台原始业务状态仍是正常三条 `PASSED`、故障三条 `FAILED / complete_pass=false`。故障另标“对照验证检出指定缺陷”，不等于业务通过。通过步骤若没有单独采集实际值，会写“未单独采集实际值”，不会把预期复制为实际。刷新和查看不启动新任务。

本机设备台账入口：查询 [正常](http://127.0.0.1:4320/ui/a) / [故障](http://127.0.0.1:4320/ui/b)，排序 [正常](http://127.0.0.1:4320/ui/c) / [故障](http://127.0.0.1:4320/ui/d)，详情 [正常](http://127.0.0.1:4320/ui/e) / [故障](http://127.0.0.1:4320/ui/f)。它们使用固定数据，不连接真实公司站点。

## 服务未运行时

在第一个 PowerShell 窗口启动 4320：

```powershell
Set-Location 'C:\Users\20240082\.codex\worktrees\test-workbench-six-case-e2e\ui-test-agent\workbench'
npm run start:trial-site
```

仅在 4322 尚未运行时，在第二个 PowerShell 窗口启动工作台：

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

两个服务均为前台进程，窗口关闭即停止。已有正确服务时不要重复启动或关闭来源不明的进程。仅查看记录不会调用模型，也无须填写密钥。

## 历史与限制

本批开始前有 31 条旧运行，其中此前重点复核的 TC-001～006 分别是 `run-d35a94aa-0d80-4b7f-a4d5-f92978ce23bc`、`run-93332c05-852e-46a3-a126-631c16dfc155`、`run-107ad5b9-da39-4e6b-a11f-3fec32d68eab`、`run-02982c6f-34f3-4a50-9de4-a7ba0798a786`、`run-812748ee-ca09-4ac6-a28d-06a8da35f5c9`、`run-2ac306ef-19d4-4dfd-9221-873e3e0942f6`。本批另有第一次详情正常 `run-be96bf41-868c-4e2c-af5b-958562c85685` 和技术未运行 `run-e2736d80-a0af-4c23-b412-5c857168b2bd`；修复 Windows 长路径后，按上表生成最终详情配对。旧录像、报告和哈希都未覆盖；旧原录像时间轴不能精确定位。完整历史和开发自测见[自测记录](E2E_01_CAPTION_SELF_TEST.md)。

三份候选仍待真人核对及批准；本指南不要求你确认所有功能通过。只需记录哪里不好找、看不懂或不顺手。

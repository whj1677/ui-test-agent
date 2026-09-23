# E2E-01 六用例工作台使用说明

## 当前可用状态

工作台新页面：<http://127.0.0.1:4322/workspace/>。被测设备台账站点：<http://127.0.0.1:4320>。

本机当前数据目录为 `workbench/.local/six-case-e2e`。已经通过新页面创建项目并导入官方六用例 JSON 包；项目名称为 **E2E-01 六用例工作台自动建例闭环**。已在本机 DSH_HOME `.env` 配置凭据，并确认不带工具的官方文本请求可返回 `OK`；但带 Browser 工具的两个真实初稿任务启动均异常退出，当前仍没有候选或产品运行记录。不要把工程样例或文本连通检查当成产品结果。查看详情请见 [验收记录](E2E_01_ACCEPTANCE_REPORT.md)。

## 启动

先确认本机设备台账站点 `http://127.0.0.1:4320` 仍由本仓库 `workbench/trial-site/server.mjs` 提供；不要关闭来源不明的占用进程。再开 PowerShell：

```powershell
Set-Location "<本仓库>\workbench"
$env:WORKBENCH_PORT = "4322"
$env:WORKBENCH_DATA_DIR = (Join-Path $PWD ".local\six-case-e2e")
$env:WORKBENCH_TEST_SITE_BASE_URL = "http://127.0.0.1:4320"
$env:WORKBENCH_BUILD_AUTHORIZATION_ID = "e2e01-six-case-project-20260923"
npm start
```

以上是前台进程；保持窗口开启，按 `Ctrl+C` 停止。此命令不启动 Harness。当前本机已用的 DSH_HOME 是 `C:\Users\20240082\.codex\worktrees\workbench-m4a-query-case\ui-test-agent\workbench\.local\m4a-query-case-acceptance\build-runtime\dsh`；密钥应写入该目录的 `.env`（变量名 `DEEPSEEK_API_KEY`，不加引号）。该目录在另一既有本机 worktree 的 `.local` 下，受当前服务环境引用；不要将密钥写入命令、报告或仓库。文本连通已确认，但带工具的建例仍报错，不能视为 E2E Harness 可用。

## 查看本次导入与项目

1. 打开 <http://127.0.0.1:4322/workspace/>，点击“项目”。
2. 选择 **E2E-01 六用例工作台自动建例闭环**。本次通过界面建立的项目 ID 为 `project-61579c25-2833-4c41-b592-357e1b306026`。
3. 进入“用例”查看 TC-001～TC-006。导入包为 `workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json`；预览后已确认 6 条新增，0 重复、0 冲突、0 不可导入。
4. 当前可以查看版本正文、任务与执行记录页面；本批任务页中 TC-001 有一条“已创建、尚未启动”的任务。因为 Harness 连通检查失败，先不要把它描述成已生成候选或已执行。

## 目标闭环的页面操作（模型恢复可用后再执行）

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| 1 | 项目 → **E2E-01 六用例工作台自动建例闭环** → 用例 → TC-001 → 创建演示建例任务 | 冻结任务为已创建、尚未启动；输入只包含 TC-001 正常场景。TC-004 对照入口不会进入建例输入。 |
| 2 | 建例任务 → 对应 TC-001 任务 → **生成并试跑正常入口** | 明确启动一次工作台 Harness 会话；候选应显示实际来源、attempt 和哈希。不得刷新页面来启动。 |
| 3 | 任务详情 → **运行 TC-004 对照入口** | 对同一候选哈希运行 TC-004，保留独立 run ID、步骤、原始 FAILED/complete_pass=false 和媒体；若检出指定缺陷另标明“对照验证检出指定缺陷”。 |
| 4 | 对 TC-002 重复步骤 1～3，配对 TC-005 | 第二份新候选，只从 TC-002 正常用例生成；TC-005 使用同哈希做对照。 |
| 5 | 对 TC-003 重复步骤 1～3，配对 TC-006 | 第三份新候选，只从 TC-003 正常用例生成；TC-006 的未执行后续步骤应保持未执行。 |
| 6 | 项目 → 执行记录 → 分别打开 TC-001～TC-006 记录 | 六个独立实际运行记录及步骤、预期/实际、错误、截图、可播放录像和 Trace。刷新/重启只读回记录，不重放任务。 |

界面上的模拟工程预检只验证接线，不是产品运行结果。本轮没有产品候选、六条 run ID 或产品截图/录像/Trace，因此当前没有这些证据可供查看。不要运行 Harness 来“补齐”报告，除非另行确认模型连接已恢复并明确授权续跑；原预算状态见验收记录。

# TEST-SITE-01 设备台账六案例操作指南

## 1. 启动与入口

打开 PowerShell：

```powershell
cd C:\Users\20240082\.codex\worktrees\test-site-six-cases\ui-test-agent\workbench
npm ci
npm run start:trial-site
```

看到 `TEST-SITE-01 http://127.0.0.1:4320/ui/a` 后，先打开：

<http://127.0.0.1:4320/ui/a>

六个入口共用同一页面、同一批 6 台设备和同一业务规则。`/ui/a`、`/ui/c`、`/ui/e` 是正常入口；`/ui/b`、`/ui/d`、`/ui/f` 预置对应实现缺陷。

## 2. 六条用例怎么操作

### TC-001 / TC-004：组合查询

两条的动作和预期完全相同，TC-001 打开 `/ui/a`，TC-004 打开 `/ui/b`。

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| S01 | 打开对应地址 | “设备台账”；筛选为“全部站点 / 全部状态 / 设备编号升序”；“共6条”；DEV-001 到 DEV-006 升序 |
| S02 | “所属站点”选“西站”；“设备状态”选“检修”，先不要点查询 | 控件已改变，但列表仍为 6 条 |
| S03 | 点“查询” | 正常业务预期：共 2 条，只显示 DEV-002、DEV-005，不含 DEV-004 |

- TC-001 `/ui/a`：S03 符合预期。
- TC-004 `/ui/b`：S03 实际显示 3 条，并多出运行状态的 DEV-004；这是指定失败。

### TC-002 / TC-005：功率排序

两条的动作和预期完全相同，TC-002 打开 `/ui/c`，TC-005 打开 `/ui/d`。

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| S01 | 打开对应地址；“排序方式”选“额定功率降序”，先不要点查询 | 列表仍为初始 6 条，第一行仍是 DEV-001 |
| S02 | 点“查询” | 完整行顺序应为 DEV-005、DEV-006、DEV-002、DEV-004、DEV-001、DEV-003；第 2 行应是 DEV-006 / 排水泵 / 东站 / 运行 / 140 kW |

- TC-002 `/ui/c`：S02 符合预期。
- TC-005 `/ui/d`：S02 实际第 2 行是 DEV-002，第 3 行才是 DEV-006；这是整行交换的指定失败。

### TC-003 / TC-006：设备详情

两条的动作和预期完全相同，TC-003 打开 `/ui/e`，TC-006 打开 `/ui/f`。

| 步骤 | 在哪里点击 | 应该看到什么 |
|---|---|---|
| S01 | 找到 DEV-005 行，点“详情” | 打开“设备详情 · DEV-005”弹窗 |
| S02 | 查看详情字段 | DEV-005、冷却泵、西站、检修、220 kW |
| S03 | 点弹窗底部“关闭” | 弹窗关闭，返回设备列表 |

- TC-003 `/ui/e`：S02 显示 220 kW，S03 可继续执行。
- TC-006 `/ui/f`：S02 实际显示 320 kW；表格行和“历史备注”仍是 220 kW。参考测试在 S02 失败，因此 S03 未执行。

## 3. 文件位置

- Excel：`workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.xlsx`
- 正式后端导出 JSON：`workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json`
- 冻结规格：`workbench/trial-site/FROZEN_SPEC.md`
- 预期结果：`workbench/trial-site/EXPECTED_OUTCOMES.md`
- 自检报告：`workbench/trial-site/REFERENCE_SELF_CHECK.md`

文件 SHA-256：

- Excel：`62E41E6B8E311A7042E642D043F83096087C2C3C57A9D9F8BBDF6748EEB73818`
- JSON：`55EF60BBD3F9EDD20F392B4BF63BC821B075BEF8AF92BAF4CEE0B59D5A2CD816`

## 4. 查看自检截图、录像和报告

先完成一次参考自检（预期命令退出码为 1，因为三条故障用例要真实失败）：

```powershell
cd C:\Users\20240082\.codex\worktrees\test-site-six-cases\ui-test-agent\workbench
npm run self-check:trial-site
```

然后查看：

- HTML：`workbench/.local/ui-six-cases/reference/html-report/index.html`
- 原始 JSON：`workbench/.local/ui-six-cases/reference/raw-report.json`
- 媒体根目录：`workbench/.local/ui-six-cases/reference/artifacts/`
- 每条目录里都有 `.png`、`.webm`、`trace.zip`；故障用例还含 `error-context.md`。

## 5. 查看真实工作台导入结果

这一步使用独立数据目录，不会读取或覆盖原工作台项目：

```powershell
cd C:\Users\20240082\.codex\worktrees\test-site-six-cases\ui-test-agent\workbench
$env:WORKBENCH_PORT='4321'
$env:WORKBENCH_DATA_DIR="$PWD\.local\ui-six-cases\workbench-trial"
npm start
```

打开 <http://127.0.0.1:4321/workspace/>：

1. 选择“TEST-SITE-01 六案例导入验证”：可看到 6 条内容已确认用例。
2. 选择“TEST-SITE-01 JSON复导验证”：可看到正式 JSON 再导入的 6 条用例。
3. 页面中的“建例任务”和“执行记录”显示“未接入”。本批没有调用 Coding Agent、Harness 或既有批准脚本。

如需从空白状态重做本案例，只关闭这个 4321 工作台进程后，移走或删除 `workbench/.local/ui-six-cases/workbench-trial`。清除范围仅包括这两个隔离验证项目及其上传/预览记录，不包括原有项目；参考截图、录像和报告位于同级 `reference` 目录，不会随之删除。

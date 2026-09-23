# TEST-SITE-01 独立参考自检

## 结论

2026-09-23 在锁定的 `@playwright/test 1.62.1`、Chromium、单 worker、零重试条件下完整执行 6 条。命令退出码为 `1`，原因是三个预设业务缺陷被真实断言检出；不是基础设施失败。

| 用例 | 结果 | 最后执行步骤 | 实际事实 |
|---|---|---|---|
| TC-001 | PASSED | S03 | 西站+检修为 2 条，仅 DEV-002、DEV-005 |
| TC-002 | PASSED | S02 | 功率降序第 2 行为 DEV-006 / 140 kW |
| TC-003 | PASSED | S03 | DEV-005 详情功率 220 kW，弹窗可关闭 |
| TC-004 | FAILED | S03 | 期望“共2条”，实际“共3条”；多出 DEV-004 |
| TC-005 | FAILED | S02 | 期望第 2 行 DEV-006，实际第 2 行 DEV-002 |
| TC-006 | FAILED | S02 | 期望 220 kW，实际 320 kW；S03 未执行 |

原始结果未使用 `test.fail`、跳过、主动 `throw`、吞异常或报告改写。正常/故障配对调用同一测试函数，只有入口不同。

## 运行与证据

在 `workbench` 目录执行：

```powershell
npm run self-check:trial-site
```

运行材料位于未提交的独立目录：

- 原始 JSON：`workbench/.local/ui-six-cases/reference/raw-report.json`
- HTML 报告：`workbench/.local/ui-six-cases/reference/html-report/index.html`
- 六条截图、录像与 trace：`workbench/.local/ui-six-cases/reference/artifacts/`

每条均有 `screenshot`、`video`、`trace`；失败三条另有 `error-context.md`。这些是本新站点的独立参考结果，不是工作台 Coding Agent 生成、批准或执行的结果。

## 工作台文件闭环

使用 `WORKBENCH_DATA_DIR=workbench/.local/ui-six-cases/workbench-trial` 的独立后端与 `/workspace/` 实际操作：

1. 项目“TEST-SITE-01 六案例导入验证”上传 Excel；后端识别工作表“六条用例”6 行，八列自动映射。
2. 预览分类为新增 6、重复 0、冲突 0、待澄清 0、无法导入 0；确认后实际新增 6，全部“内容已确认”。
3. 点击“导出全部（6）”，页面反馈“内容来自正式后端导出”；保存的 JSON schema 为 `workbench/case-package-v1`，包含 6 条。
4. 新项目“TEST-SITE-01 JSON复导验证”上传该 JSON；预览新增 6，确认后实际新增 6。

工作台页面明确显示“建例任务 · 未接入”“执行记录 · 未接入”。本轮没有接线、没有调用 Harness 或模型，也没有把参考结果登记为批准资产。

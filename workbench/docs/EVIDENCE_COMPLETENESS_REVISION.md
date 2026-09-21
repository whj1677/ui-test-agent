# M1 整体通过与证据完整性关联修订

日期：2026-09-21

基线：`853a798d80d2bc3645e22c51ccabd2a807084035`

需求：REQ-0021 v3

## 结论

`summary.complete_pass` 现与既有 `evidenceComplete` 使用同一组必需媒体事实：screenshot、video、trace 三类均存在，才满足整体有效通过的证据条件。证据缺失只形成 `evidence_status=INCOMPLETE` 和整体不通过；原始 `test_status`、`playwright_status`、`playwright_pass` 及已有断言错误保持不变，不据此宣布产品业务缺陷。

本次只调整 `workbench/server/report.mjs` 的汇总条件，不新增媒体格式、上传、签名或通用证据框架。`ACCEPTANCE_REPORT.md`、`REVIEW_FIX_REPORT.md`、既有 run/report/media 和批准脚本均未改写。

## 修前复现

在基线实现上先增加媒体组合断言，执行：

`node --test workbench/tests/report.test.mjs`

退出码 1；10 项中 6 通过、4 失败。完整绿色报告在以下四种情况下均实际得到 `evidence_status=INCOMPLETE`、`playwright_pass=true`、`complete_pass=true`：

- 全部媒体缺失；
- 缺 screenshot；
- 缺 video；
- 缺 trace。

四项失败均为期望 false、实际 true。三类齐全的正常报告、媒体齐全的原始断言失败和五种非正常终态在修前测试中仍按既有语义通过。

## 修订与工程验证

修订只将同一 `evidenceComplete` 加入 `completePass` 的必要条件。临时夹具覆盖：

- 全缺及分别缺 screenshot、video、trace：原始 Playwright 为 passed，但整体均为 false；
- 三类齐全且其他条件符合：`evidence_status=COMPLETE`、整体为 true；
- 原始脚本失败且媒体齐全：保留 `FAILED`、H111/H106 和 `PENDING_ANALYSIS`，整体为 false；
- `INTEGRITY_FAILED`、`CANCELLED`、`INTERRUPTED`、`PROCESS_ERROR`、`START_FAILED`：媒体齐全且模拟原始 passed，整体仍为 false。

实际命令：

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node --test workbench/tests/report.test.mjs` | 0 | 10/10 通过，0 失败、0 跳过 |
| `npm --prefix workbench test` | 0 | 25/25 通过，0 失败、0 跳过 |

全部报告和媒体由系统临时目录夹具生成；没有修改批准业务脚本。

## 既有真实运行离线重算

使用当前 `analyzeRunArtifacts` 只读加载两条既有运行的 `run.json`、`report.json` 和媒体目录，没有写回或覆盖原记录：

| run_id | 存储事实 | 离线重算 | 媒体 |
|---|---|---|---|
| `run-20260921003740-7f873f2a` | PASSED / COMPLETE / complete=true | passed / playwright_pass=true / COMPLETE / complete=true | screenshot、trace、video |
| `run-20260921003746-78120f47` | FAILED / COMPLETE / complete=false；H111/H106 | failed / playwright_pass=false / COMPLETE / complete=false；H111/H106 | screenshot、trace、video |

离线核对命令退出码 0。本次是纯结果汇总修订，按授权没有重新启动业务 normal/fault 组合。

## 边界

- 缺证据不自动归因为产品缺陷，也不覆盖原始 Playwright 或错误事实。
- 不修改 `src/`、`public/`、`pilot/`、`heldout-lab/`、批准脚本和既有历史报告。
- `.local` 中的原始运行文件、媒体和任何凭据不提交。
- 完成本修订、工程验证和同分支同步后停止，不进入 Harness。

# 工作台 M1 代码复审集中修复记录

日期：2026-09-21

需求：REQ-0021

基线：`edc0888999e0c1fc7d678398beb0e7f5de427a5e`

分支：`codex/test-workbench-m1`

## 结论与范围

三项复审问题已集中修复并完成工程验证及一组新的真实 Web normal/fault 运行：入口选择跨轮询保持；非正常工作台终态不能被原始绿色 Playwright 报告覆盖为整体通过；未取得实际值的 expect 类错误不再冒充确定的值不符。

本记录不改写 `ACCEPTANCE_REPORT.md`，不重新声明批准业务脚本首次验收。没有接入 Harness、模型、建例、healer、语义审核层或通用框架，也没有修改原 `src/`、`public/`、`pilot/`、`heldout-lab/`。

## 修前复现

复现均在基线代码上先加入期望行为断言，再修改实现：

| 命令 | 退出码 | 修前事实 |
|---|---:|---|
| `npm --prefix workbench run test:browser` | 1 | 选择 `fault` 后等待 2.3 秒，实际值恢复成 `normal`。 |
| `node --test workbench/tests/report.test.mjs` | 1 | 6 项中 4 通过、2 失败：`INTEGRITY_FAILED` 的 `complete_pass` 实际为 `true`；缺元素的 expect 错误实际分类为 `ASSERTION_MISMATCH`。 |

失败断言分别得到：`'normal' !== 'fault'`、`true !== false`、`ASSERTION_MISMATCH !== LOCATOR_OR_TARGET`。这是旧实现的修前证据，不是修后测试失败。

## 集中修改

1. `web/app.js` 增加 `selectedEnvironmentId` 状态。选择变更只由用户事件写入；轮询重建选项后恢复仍受允许的值，启动 POST 使用该状态。
2. `server/report.mjs` 将整体通过限定为 `executionStatus === 'PROCESS_ENDED'`，并保留 `playwright_status`、`playwright_pass` 与 `test_status` 原始事实。完整性失败、取消、中断、进程错误和启动失败即使携带绿色模拟报告也不会整体通过。
3. 错误分类仅在同时取得具体 `Expected` 与 `Received` 时认定 `ASSERTION_MISMATCH`；缺元素/严格匹配冲突、未取得双侧值、纯超时分别落到 `LOCATOR_OR_TARGET`、`ASSERTION_UNRESOLVED`、`TIMEOUT`，归因均保持 `PENDING_ANALYSIS`。

## 修后工程验证

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node --test workbench/tests/report.test.mjs` | 0 | 6/6 通过；覆盖正常通过、H111/H106、缺/损报告、跳过/零目标、未执行步骤、五种非正常终态及四类错误反例。 |
| `npm --prefix workbench test` | 0 | 21/21 通过，0 失败、0 跳过；运行副本临时改动夹具产生 `INTEGRITY_FAILED`，原始 `PASSED` 保留但整体为 false。 |
| `npm --prefix workbench run test:browser` | 0 | 真实 Chromium：fault 选择等待 2.3 秒跨至少两次轮询保持；POST 与运行详情为 fault；运行中控件禁用、停止、历史和随后 normal 选择保持。 |

完整性测试只改临时运行副本，没有修改批准源脚本。缺失/损坏报告、指定错序和未执行步骤的原有测试语义继续通过。

## 新的真实 Web 组合

命令：独立启动 `npm run lab`、`npm start` 后执行 `npm run test:real`；退出码 0。脚本在 fault 启动前选择该项并等待 2.3 秒，随后同时断言 DOM 选择、POST `/api/runs` 正文和新运行记录环境均为 `fault`。

| 事实 | normal | fault |
|---|---|---|
| run_id | `run-20260921003740-7f873f2a` | `run-20260921003746-78120f47` |
| 入口 | `http://localhost:4198/probe/s1` | `http://localhost:4198/probe/s2` |
| 工作台终态 | `PROCESS_ENDED` | `PROCESS_ENDED` |
| 原始 Playwright | `passed` / `playwright_pass=true` | `failed` / `playwright_pass=false` |
| 整体有效通过 | `complete_pass=true` | `complete_pass=false` |
| 步骤 | S01-S04 全部 `PASSED` | S01、S02 `PASSED`；S03 `FAILED`；S04 `NOT_EXECUTED` |
| 原始错误事实 | 无 | `ASSERTION_MISMATCH`；期望 `H111`，实际 `H106`；`PENDING_ANALYSIS` |
| 进程/报告/证据 | 退出码 0；`COMPLETE`；`COMPLETE` | 退出码 1；`COMPLETE`；`COMPLETE` |
| 媒体 | screenshot、Trace、video 各 1 | screenshot、Trace、video 各 1 |

本组没有旧运行复用、失败追加或无改动重跑。开始至汇总结束为 `2026-09-21T00:37:40.238Z` 至 `00:37:54.565Z`；模型调用 0、重试 0、healer=false。原始 report、run JSON 和媒体仅留在 Git 忽略的 `workbench/.local/`。

## 资产与停止点

- 批准脚本在新组合前后及最终核对均为 SHA-256 `280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A`；两次运行的来源/副本结束哈希也一致。
- 新真实组合结束后只停止本任务启动的 4198/4210 进程，两端口已无监听。
- 私有运行 JSON、原始截图、录像、Trace、Cookie、凭据和完整环境变量不提交。
- 到三项修复、工程验证、新真实组合和 GitHub 同分支同步即停止；不进入 Harness 或扩大业务范围。

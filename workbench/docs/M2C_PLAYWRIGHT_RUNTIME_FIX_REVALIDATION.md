# M2-C 候选执行器 Playwright 双实例修复与同候选复验

日期：2026-09-21

分支：`codex/test-workbench-m2c-build-ui`

基线：`21684f5ccefb428cf4027c5fd7c2105850165f28`

目标任务：`build-20260921060716-ae44c3f2`

结论：**运行时加载问题已解决；原候选在正常页实际通过，并在独立反例页取得期望 PROBE-42、实际 PROBE-41 的断言差异。该结果是单独的技术复验，不改写原 B 类任务，也不批准候选。**

## 加载关系与最小修复

修前真实复现使用原候选的同字节临时副本和 workbench 任务目录结构。旧共享入口固定启动：

- CLI：`<repo>/harness-probe/node_modules/@playwright/test/cli.js`
- 配置：`<repo>/harness-probe/config/playwright.config.mjs`
- 候选导入：`<repo>/workbench/node_modules/@playwright/test/package.json`

两个 `@playwright/test` 声明版本虽同为 1.62.1，但来自两个安装位置；其实际 Playwright Test 辅助模块也分别来自 harness-probe 与 workbench。修前执行 exit 1、测试数 0，原始错误顺序为 `Requiring @playwright/test second time`，随后才是 `No tests found`。

修复后，workbench 显式向共享 `verifyCandidate` 传入自己的运行根和配置：

- CLI：`<repo>/workbench/node_modules/@playwright/test/cli.js`
- 配置：`<repo>/workbench/config/candidate.playwright.config.mjs`
- CLI、配置、候选导入的 `@playwright/test`：均为 `<repo>/workbench/node_modules/@playwright/test/package.json`，版本 1.62.1
- 三者实际使用的 `playwright`：均为 `<repo>/workbench/node_modules/playwright/package.json`，版本 1.62.1

共享函数继续默认使用 harness-probe 的运行根和原配置，因此其独立入口仍可执行。没有升级依赖、修改 Playwright 内部代码、放行零测试或改动候选 import。

新 workbench 配置保持原语义：Edge、1280×720、`zh-CN`、test timeout 30 秒、expect timeout 5 秒、workers=1、retries=0，截图/录像/Trace 均为 `on`。

## 零模型真实执行器测试

修前：同目录结构样例通过旧固定 harness-probe 入口得到 exit 1、0 测试及双实例错误。

修后：`node --test tests/verify-candidate-runtime.integration.test.mjs` 使用实际 CLI 子进程、实际配置、实际 Edge 和临时 HTTP 夹具：

- workbench 运行根：正常 1 条通过，反例 1 条失败且解析为 `ASSERTION_MISMATCH / PROBE-42 / PROBE-41`；两边三类媒体齐全。
- harness-probe 默认运行根：独立候选 1 条实际通过。
- 首次测试为 1/2：辅助模块一致性检查错误比较了调用方目录下未加载的顶层 `playwright`；改为从实际解析出的 `@playwright/test` 包位置解析其辅助模块后，同一测试 2/2。此调整不放宽测试执行或报告判定。

最终完整回归：workbench 44/44、harness-probe 24/24、build-browser 通过，退出码均为 0。全程 Harness 启动 0 次、模型调用 0 次。

## 已有候选直接复验

复验记录 ID：`candidate-runtime-fix-20260921`

原候选及工作副本运行前后 SHA-256 均为：

`119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A`

| 项目 | 正常页面 | 独立错误输出反例 |
|---|---|---|
| 测试数 / 状态 | 1 / `PASSED` | 1 / `FAILED` |
| 进程 | exit 0，无终止 | exit 1，无终止 |
| 断言事实 | 取得原预期 `PROBE-42` | Expected `PROBE-42` / Received `PROBE-41` |
| 判定 | 正常通过 | 指定断言不符已实际检出 |
| screenshot / video / trace | 1 / 1 / 1 | 1 / 1 / 1 |
| 报告 SHA-256 | `3F588CADE489232C0112C9357147ADB720FAD40230C1D6AAEC617BFE5AF86565` | `2BE85E4115F6F7752FDA1BB6C7810EFE463B0355D02073CE73FDC9A0434BE4A0` |

脱敏截图：[正常 PROBE-42](evidence/m2c-runtime-fix-normal.png)；[反例 PROBE-41](evidence/m2c-runtime-fix-negative.png)。录像、Trace、原始报告及完整文件清单保存在 Git 忽略的独立目录 `workbench/.local/m2c-acceptance/candidate-revalidations/candidate-runtime-fix-20260921/`，未上传。

原 NOT_RUN 报告的 SHA-256 复验前后保持：正常 `4E7D066F...81778C4`，反例 `5A23FBE5...290FA`。原任务状态、候选记录、两份授权账本和旧阶段预算均未改写或重置。

## Web 能力核对

现有页面仍能读取目标任务、候选源码、候选哈希、原任务状态和原登记文件，并准确保留原 `CANDIDATE_VALIDATION_FAILED` 与两边 `NOT_RUN`；[Web 读回截图](evidence/m2c-runtime-fix-web-readback.png)。

新的离线复验通过 `source_task_id`、`source_attempt_id`、候选版本和 SHA-256 关联原任务，但现有 Web 数据模型不读取该独立记录。因此：

- 新正常/反例结果尚不能在页面查看；
- 新截图、录像和 Trace 已生成，但 Web 未开放查看或播放；
- 页面没有被改写成新的绿色结果，也没有把反例失败显示成普通业务通过。

本轮不扩建播放器或新的历史模型。

## 停止边界

本次仅证明执行器统一运行环境后，已有 Harness 候选完成正常与最小反例技术复验。候选仍未批准；没有启动 Harness、调用建例模型、修改候选、自动修订、扩展复杂业务或接入自愈。原 B 类报告继续保留为当时真实事实。

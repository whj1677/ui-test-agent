# M2-C 终态等待回归测试补准记录

日期：2026-09-21

基线：`e803e11db65bac5630044508270e29c70c825863`

## 结论

保留 `waitForTerminal(page, taskId)` 按本次任务 ID 定位的生产修复，仅修正回归测试的判定方式。原测试用“测试自身先等待 250 ms，再检查总耗时”不能证明被测 Promise 在这段时间内没有提前完成；新测试直接观察 Promise 的结算状态。

新测试建立同一临时页面状态：旧任务为 `INTERRUPTED`，新任务为 `GENERATING`。它通过 `Promise.race` 在观察窗口结束时断言新任务等待仍为 `pending`，随后只把新任务改为 `CANDIDATE_VALIDATION_FAILED`，并等待原 Promise 正常完成。该判断不再使用测试总耗时作为代理证据。

同一断言还注入了原来的“扫描任意历史卡片”临时对照实现。旧实现会因旧任务的 `INTERRUPTED` 立即结算，触发 `old terminal history must not settle the new task wait` 的 `AssertionError`；正式测试用 `assert.rejects` 明确确认这个预期失败。因此：旧实现不满足同一行为断言，当前按 `task_id` 的实现满足该断言。

## 实际验证

| 命令 | 结果 |
|---|---|
| `node --test tests/revalidation-driver.test.mjs`（`workbench`） | 2/2 通过；第2项确认旧实现触发预期断言失败 |
| `npm test`（`workbench`） | 41/41 通过，0失败，0跳过 |

详细输出见需求包中的 `logs/revalidation-driver-tests.log` 与 `logs/workbench-tests.log`。本批未启动 Harness、未调用模型，也未创建或消耗任何授权。

## 保护项

- 原取消任务 `build-20260921041411-12b52a7b/task.json` SHA-256：`0FC0B37F170CD71E0AACF11ABCC21B5FD47CA045EEE59F137522826AE21933B1`。
- 独立复验授权账本 SHA-256：`981E19A4695DAA5DCD418C7BFEEE710EF79AC42C412FDF66319424E047F81617`。
- 原复验 C 类报告 SHA-256：`D9EE18FB87197D3A159CA8C4BDD3DD190B7EE7756C159BCD08FD35A8360236E4`。
- 原 M2-C 验收报告 SHA-256：`8AA10B576F17153E89B60A0AAD1241F398E5C7AFA15252876E2C1F7EC2DBAAD0`。
- 批准排序脚本 SHA-256：`280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A`。

本次只补准工程测试证据，不改变原 `CANCELLED` 记录、C 类结论、预算系统、工作台架构或批准业务脚本。

<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0024-01 | DR-0024-01 / DR-0024-02 | 已确认 | 集成测试通过 | 存储、跨任务阶段预算、重复启动、取消和重启恢复。 | workbench工程测试与持久化读回 | 命令：npm test --prefix workbench；退出码：0；测试数量：44；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/runtime-fix-revalidation-tests.log | npm test --prefix workbench | 0 | 44 | 0 | 0 | docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/runtime-fix-revalidation-tests.log |
| VT-0024-02 | DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 集成测试通过 | Harness终态、候选/工具/报告登记、通用报告解析和显式修订。 | 模拟工程测试与真实事件分开记录 | 命令：npm test --prefix harness-probe；退出码：0；测试数量：24；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/wait-fix-validation-tests.log | npm test --prefix harness-probe | 0 | 24 | 0 | 0 | docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/wait-fix-validation-tests.log |
| VT-0024-03 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 人工待确认 | 真实浏览器中的固定任务提交、状态、候选、错误、文件和按钮行为。 | Chromium工程流、截图和后端记录 | npm run test:browser与npm run test:build-browser均退出0；零模型重启读回显示新任务CANCELLED、授权1/1和无候选，公开截图见workbench/docs/evidence/m2c-revalidation-cancelled.png。 | - | - | - | - | - | - |
| VT-0024-04 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 无法运行 | 真实Web-Harness-候选-正常/反例集成、资产不变和远端SHA。 | 真实任务ID、尝试、工具计数、候选哈希、两份报告、Git查询 | 终态等待修复后的任务build-20260921060716-ae44c3f2经真实Web启动，Harness以7次工具调用生成候选；正常与反例报告均完整但目标测试数为0，原始报告显示harness-probe与workbench的Playwright Test实例重复加载。此处无法运行仅指两次目标测试均未被Playwright执行；授权1/1耗尽，无修订或替补启动。见workbench/docs/M2C_WAIT_FIX_VALIDATION_REPORT.md。 | - | - | - | - | - | - |
| VT-0024-05 | DR-0024-05 | 已确认 | 集成测试通过 | 真实外部假子进程的逐事件记录、异常退出、无换行与截断末行、取消/到期/额度、存储故障和协调进程终止后恢复。 | 零模型外部进程测试、临时目录、重启读回 | harness-probe 24/24、workbench 38/38，均退出0；未运行build-real.integration.mjs。 | - | - | - | - | - | - |
| VT-0024-06 | DR-0024-03 | 已确认 | 集成测试通过 | 统一Playwright运行根后，真实CLI发现1条测试并以同一原候选完成正常通过和独立反例断言差异验证。 | 解析路径、实际CLI子进程、结构化报告、候选哈希和三类媒体 | npm run revalidate:m2c-runtime-fix退出0；正常1条PASSED，反例1条FAILED且Expected PROBE-42/Received PROBE-41；候选哈希前后相同，两边截图/录像/Trace各1。原始记录在Git忽略目录，脱敏事实见workbench/docs/M2C_PLAYWRIGHT_RUNTIME_FIX_REVALIDATION.md。 | - | - | - | - | - | - |
| VT-0024-07 | DR-0024-06 | 已确认 | 集成测试通过 | 已有复验精确关联、受控媒体访问、原历史并列显示、轮询状态保持和重启读回。 | 工程异常注入与本机既有媒体真实Chromium读回 | 命令：npm test --prefix workbench；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/existing-revalidation-web-media-tests.log | npm test --prefix workbench | 0 | 47 | 0 | 0 | docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/existing-revalidation-web-media-tests.log |

## 本轮命令与环境

- 工作目录：workbench与harness-probe子工程
- 命令：npm test --prefix harness-probe
- 命令：npm test --prefix workbench
- 命令：npm run test:build-browser --prefix workbench
- 命令：npm run register:m2c-runtime-revalidation --prefix workbench
- 命令：npm run test:m2c-runtime-media-readback --prefix workbench
- 环境：127.0.0.1单用户；独立Git忽略任务目录；Chromium；无OS级强制隔离；本批不向任何进程提供模型凭据。

## 结论

- 既有复验已在不改写原任务、原报告和媒体的前提下接入Web；原NOT_RUN与加载错误保留。正常/反例截图均解码、视频均实际播放暂停定位、Trace哈希一致，轮询不重置播放状态且重启可读。本批Harness和模型调用均为0。

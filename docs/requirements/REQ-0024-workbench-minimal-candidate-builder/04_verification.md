<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0024-01 | DR-0024-01 / DR-0024-02 | 已确认 | 集成测试通过 | 存储、跨任务阶段预算、重复启动、取消和重启恢复。 | workbench工程测试与持久化读回 | 命令：npm test --prefix workbench；退出码：0；测试数量：40；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log | npm test --prefix workbench | 0 | 40 | 0 | 0 | docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log |
| VT-0024-02 | DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 集成测试通过 | Harness终态、候选/工具/报告登记、通用报告解析和显式修订。 | 模拟工程测试与真实事件分开记录 | 命令：npm test --prefix harness-probe；退出码：0；测试数量：24；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/harness-probe-tests.log | npm test --prefix harness-probe | 0 | 24 | 0 | 0 | docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/harness-probe-tests.log |
| VT-0024-03 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 人工待确认 | 真实浏览器中的固定任务提交、状态、候选、错误、文件和按钮行为。 | Chromium工程流、截图和后端记录 | npm run test:browser与npm run test:build-browser均退出0；零模型重启读回显示新任务CANCELLED、授权1/1和无候选，公开截图见workbench/docs/evidence/m2c-revalidation-cancelled.png。 | - | - | - | - | - | - |
| VT-0024-04 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 无法运行 | 真实Web-Harness-候选-正常/反例集成、资产不变和远端SHA。 | 真实任务ID、尝试、工具计数、候选哈希、两份报告、Git查询 | 单次复验任务build-20260921041411-12b52a7b启动Harness后被复验驱动清理取消；生命周期完整、授权1/1、候选不存在、正常/反例未运行。此处“无法运行”仅指候选后续双验证未具备输入，真实启动和取消事实见workbench/docs/M2C_REVALIDATION_REPORT.md。 | - | - | - | - | - | - |
| VT-0024-05 | DR-0024-05 | 已确认 | 集成测试通过 | 真实外部假子进程的逐事件记录、异常退出、无换行与截断末行、取消/到期/额度、存储故障和协调进程终止后恢复。 | 零模型外部进程测试、临时目录、重启读回 | harness-probe 24/24、workbench 38/38，均退出0；未运行build-real.integration.mjs。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：workbench与harness-probe子工程
- 命令：npm test --prefix harness-probe
- 命令：npm test --prefix workbench
- 命令：npm run test:browser --prefix workbench
- 命令：npm run test:build-browser --prefix workbench
- 命令：npm run test:build-revalidation-readback --prefix workbench -- build-20260921041411-12b52a7b
- 环境：127.0.0.1单用户；独立Git忽略任务目录；Edge；无OS级强制隔离；公司批准DeepSeek连接仅传Harness进程。

## 结论

- 旧任务仍是INTERRUPTED且原因UNKNOWN；新增单次复验为CANCELLED，直接原因为复验驱动旧历史终态误判；原预算1/2不变，独立授权已用1/1。
